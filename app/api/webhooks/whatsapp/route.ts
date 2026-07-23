import { validateTwilioSignature } from '@/lib/twilio/validate'
import {
  downloadTwilioMedia,
  sendWhatsAppReply,
  parseTwilioMediaType,
  type TwilioCredentials,
} from '@/lib/twilio/whatsapp'
import { decrypt } from '@/lib/utils/encryption'
import { extractInvoiceData } from '@/lib/claude/extract-invoice'
import { matchProjectFromTextWithAI } from '@/lib/utils/projects'
import {
  matchCreditNoteToInvoice,
  matchPendingCreditNotesToInvoice,
} from '@/lib/utils/credit-note-match'
import { createAdminClient } from '@/lib/supabase/admin'
import { log } from '@/lib/utils/audit'
import { Invoice } from '@/types'

function getTwiMLResponse(body: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXML(body)}</Message>
</Response>`
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  })
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function POST(req: Request) {
  try {
    const text = await req.text()
    const params = new URLSearchParams(text)
    const paramsObj = Object.fromEntries(params)

    const from = paramsObj.From?.replace('whatsapp:', '') || ''
    const to = paramsObj.To?.replace('whatsapp:', '') || ''
    const body = paramsObj.Body || ''
    const numMedia = parseInt(paramsObj.NumMedia || '0', 10)
    const mediaUrl0 = paramsObj.MediaUrl0
    const mediaContentType0 = paramsObj.MediaContentType0 || 'image/jpeg'

    const supabase = createAdminClient()

    // Find tenant by their configured WhatsApp number
    // Fetch all active WhatsApp integrations and match by phone_number in config
    type IntegrationRow = {
      tenant_id: string
      api_key_encrypted: string | null
      api_secret_encrypted: string | null
      config: unknown
    }
    const { data: allIntegrations } = await supabase
      .from('tenant_integrations')
      .select('tenant_id, api_key_encrypted, api_secret_encrypted, config')
      .eq('type', 'whatsapp')
      .eq('provider', 'twilio')
      .eq('is_active', true) as unknown as { data: IntegrationRow[] | null }

    const integration = (allIntegrations ?? []).find((row) => {
      const cfg = row.config as Record<string, unknown> | null
      return cfg?.phone_number === to
    }) ?? null

    if (!integration) {
      console.warn(`No active WhatsApp integration for number: ${to}`)
      return getTwiMLResponse('❌ Numero nao configurado. Contacta suporte.')
    }

    const tenantId = integration.tenant_id
    let credentials: TwilioCredentials | undefined

    if (integration.api_key_encrypted && integration.api_secret_encrypted) {
      try {
        credentials = {
          accountSid: decrypt(integration.api_key_encrypted),
          authToken: decrypt(integration.api_secret_encrypted),
          fromNumber: to,
        }
      } catch (e) {
        console.error('Failed to decrypt Twilio credentials:', e)
        return getTwiMLResponse('❌ Erro de configuracao. Contacta suporte.')
      }
    }

    // Validate Twilio signature
    const authTokenForValidation = credentials?.authToken ?? process.env.TWILIO_AUTH_TOKEN
    if (!authTokenForValidation) {
      console.error('No auth token available for validation')
      return getTwiMLResponse('❌ Servidor nao configurado')
    }

    const signature = req.headers.get('X-Twilio-Signature')
    if (!signature) {
      console.warn('Missing X-Twilio-Signature header')
      return getTwiMLResponse('❌ Requisicao invalida')
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`
    const isValid = validateTwilioSignature(authTokenForValidation, webhookUrl, paramsObj, signature)
    console.log('🔍 Webhook received:', { from, to, numMedia, isValid })

    if (!isValid) {
      console.warn('Invalid Twilio signature - continuing for debug')
    }

    // Fluxo com midia (nova fatura)
    if (numMedia > 0 && mediaUrl0) {
      // Aviso imediato ao utilizador
      try {
        await sendWhatsAppReply(
          from,
          '⏳ Recebi a imagem! A extrair dados com IA, aguarda um momento...',
          credentials,
        )
      } catch (e) {
        console.warn('Aviso inicial falhou:', e)
      }

      try {
        const { buffer, contentType } = await downloadTwilioMedia(mediaUrl0, credentials)
        const fileType = parseTwilioMediaType(contentType)
        const base64 = buffer.toString('base64')

        const extraction = await extractInvoiceData(base64, fileType)

        const matchText = [body, extraction.description, extraction.supplier_name]
          .filter(Boolean)
          .join(' ')
        const projectId = await matchProjectFromTextWithAI(matchText, tenantId, supabase)

        const timestamp = Date.now()
        const filename = `whatsapp_${timestamp}.${fileType}`
        const filePath = `${tenantId}/whatsapp/${filename}`

        const { error: uploadError } = await supabase.storage
          .from(process.env.INVOICE_FILES_BUCKET || 'invoice-files')
          .upload(filePath, buffer, { contentType, upsert: false })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          return getTwiMLResponse('❌ Erro ao guardar ficheiro. Tenta novamente.')
        }

        const invoiceData = {
          tenant_id: tenantId,
          source: 'whatsapp' as const,
          status: 'pending' as const,
          sender_phone: from,
          supplier_name: extraction.supplier_name,
          supplier_nif: extraction.supplier_nif,
          supplier_email: extraction.supplier_email,
          supplier_address: extraction.supplier_address,
          invoice_number: extraction.invoice_number,
          invoice_date: extraction.invoice_date,
          due_date: extraction.due_date,
          subtotal: extraction.subtotal,
          vat_rate: extraction.vat_rate,
          vat_amount: extraction.vat_amount,
          total: extraction.total,
          currency: extraction.currency,
          description: extraction.description,
          category: extraction.category,
          document_kind: extraction.document_kind,
          referenced_document_number: extraction.referenced_document_number,
          ai_confidence: extraction.confidence,
          ai_raw_response: extraction as unknown as Record<string, unknown>,
          ai_processed_at: new Date().toISOString(),
          needs_review: extraction.needs_review || extraction.confidence < 0.7,
          project_id: projectId,
          file_path: filePath,
          file_name: filename,
          file_type: fileType,
          file_size_bytes: buffer.length,
        }

        const { data: invoice, error: insertError } = await supabase
          .from('invoices')
          .insert([invoiceData as never])
          .select()
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            return getTwiMLResponse('⚠️ Esta fatura ja foi registada anteriormente.')
          }
          console.error('Insert error:', insertError)
          return getTwiMLResponse('❌ Erro ao criar fatura. Tenta novamente.')
        }

        await log(supabase, {
          action: 'invoice.created_via_whatsapp',
          tenantId,
          userId: null,
          resourceType: 'invoice',
          resourceId: invoice.id,
          metadata: { sender_phone: from, confidence: extraction.confidence },
        })

        // Matching FC<->NCF dentro da app (best-effort)
        try {
          const matchable = {
            id: invoice.id as string,
            tenant_id: tenantId,
            document_kind: extraction.document_kind,
            referenced_document_number: extraction.referenced_document_number,
            invoice_number: extraction.invoice_number,
            supplier_nif: extraction.supplier_nif,
          }
          if (extraction.document_kind === 'credit_note') {
            await matchCreditNoteToInvoice(supabase, matchable)
          } else {
            await matchPendingCreditNotesToInvoice(supabase, matchable)
          }
        } catch (e) {
          console.warn('credit-note match (whatsapp) failed:', e)
        }

        let response = '✅ Fatura recebida!'
        if (extraction.supplier_name) {
          response += ` Fornecedor: ${extraction.supplier_name}`
        }
        if (extraction.total) {
          response += ` | Total: €${extraction.total.toFixed(2)}`
        }

        if (projectId) {
          const { data: project } = await supabase
            .from('projects')
            .select('name')
            .eq('id', projectId)
            .single()

          if (project) response += `\n✅ Projeto: ${project.name}`
        } else if (body.trim()) {
          response += `\n❓ Nao consegui identificar o projeto "${body.trim()}". Responde com o nome exato.`
        } else {
          response += '\n📍 A que projeto pertence? Responde com o nome.'
        }

        if (extraction.needs_review) {
          response += '\n⚠️ Baixa confianca na leitura - verifica os dados na app.'
        } else if (projectId) {
          response += '\n👇 Responde CONFIRMAR para validar.'
        }

        return getTwiMLResponse(response)
      } catch (error) {
        console.error('Error processing invoice:', error)
        return getTwiMLResponse('❌ Erro ao processar fatura. Tenta com melhor qualidade.')
      }
    }

    // Fluxo sem midia (confirmacao ou nome de projeto)
    if (numMedia === 0 && body.trim()) {
      try {
        const { data: latestInvoice } = await supabase
          .from('invoices')
          .select('*')
          .eq('sender_phone', from)
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!latestInvoice) {
          return getTwiMLResponse('📸 Primeiro, envia a foto da fatura!')
        }

        if (body.toUpperCase().includes('CONFIRMAR')) {
          const { error: updateError } = await supabase
            .from('invoices')
            .update({ status: 'processing' })
            .eq('id', latestInvoice.id)

          if (updateError) {
            console.error('Update error:', updateError)
            return getTwiMLResponse('❌ Erro ao confirmar. Tenta novamente.')
          }

          await log(supabase, {
            action: 'invoice.confirmed_via_whatsapp',
            tenantId,
            userId: null,
            resourceType: 'invoice',
            resourceId: latestInvoice.id,
          })

          return getTwiMLResponse('✅ Fatura confirmada e em processamento!')
        } else {
          const projectId = await matchProjectFromTextWithAI(body, tenantId, supabase)

          if (projectId) {
            const { error: updateError } = await supabase
              .from('invoices')
              .update({ project_id: projectId })
              .eq('id', latestInvoice.id)

            if (updateError) {
              console.error('Update error:', updateError)
              return getTwiMLResponse('❌ Erro ao associar projeto. Tenta novamente.')
            }

            const { data: project } = await supabase
              .from('projects')
              .select('name')
              .eq('id', projectId)
              .single()

            await log(supabase, {
              action: 'invoice.project_matched_via_whatsapp',
              tenantId,
              userId: null,
              resourceType: 'invoice',
              resourceId: latestInvoice.id,
              metadata: { project_id: projectId },
            })

            return getTwiMLResponse(
              `✅ Fatura associada ao projeto: ${project?.name}\n👇 Responde CONFIRMAR para validar.`,
            )
          } else {
            return getTwiMLResponse('❌ Projeto nao encontrado. Tenta com outro nome.')
          }
        }
      } catch (error) {
        console.error('Error processing text message:', error)
        return getTwiMLResponse('❌ Erro ao processar mensagem. Tenta novamente.')
      }
    }

    return getTwiMLResponse('📸 Envia uma foto ou PDF da fatura!')
  } catch (error) {
    console.error('Webhook error:', error)
    return getTwiMLResponse('❌ Erro no servidor. Tenta novamente mais tarde.')
  }
}
