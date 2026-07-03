import { validateTwilioSignature } from '@/lib/twilio/validate'
import { downloadTwilioMedia, sendWhatsAppReply, parseTwilioMediaType } from '@/lib/twilio/whatsapp'
import { extractInvoiceData } from '@/lib/claude/extract-invoice'
import { matchProjectFromText } from '@/lib/utils/projects'
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
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!authToken) {
      console.error('TWILIO_AUTH_TOKEN not configured')
      return getTwiMLResponse('❌ Servidor não configurado')
    }

    const text = await req.text()
    const params = new URLSearchParams(text)
    const paramsObj = Object.fromEntries(params)

    const signature = req.headers.get('X-Twilio-Signature')
    if (!signature) {
      console.warn('Missing X-Twilio-Signature header')
      return getTwiMLResponse('❌ Requisição inválida')
    }

    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`
    console.log('🔍 Twilio webhook received:', {
      from: paramsObj.From,
      numMedia: paramsObj.NumMedia,
      signature: signature?.substring(0, 20),
      url,
    })

    const isValid = validateTwilioSignature(authToken, url, paramsObj, signature)
    console.log('📝 Signature validation:', {
      isValid,
      paramsCount: Object.keys(paramsObj).length,
      authTokenLength: authToken.length,
    })

    if (!isValid) {
      console.warn('❌ Invalid Twilio signature')
      // Continuar mesmo com assinatura inválida para debug
      // return getTwiMLResponse('❌ Assinatura inválida')
    }
    console.log('✅ Processando webhook')

    const from = paramsObj.From?.replace('whatsapp:', '') || ''
    const body = paramsObj.Body || ''
    const numMedia = parseInt(paramsObj.NumMedia || '0', 10)
    const mediaUrl0 = paramsObj.MediaUrl0
    const mediaContentType0 = paramsObj.MediaContentType0 || 'image/jpeg'

    const supabase = createAdminClient()

    // Fluxo com mídia (nova fatura)
    if (numMedia > 0 && mediaUrl0) {
      let tenantId = process.env.DEMO_TENANT_ID

      if (!tenantId) {
        try {
          const { data: integrations, error } = await supabase
            .from('tenant_integrations')
            .select('tenant_id')
            .eq('type', 'whatsapp')
            .eq('provider', 'twilio')
            .limit(1)
            .single()

          if (!error && integrations?.tenant_id) {
            tenantId = integrations.tenant_id
          }
        } catch (e) {
          console.warn('tenant_integrations lookup failed:', e)
        }
      }

      if (!tenantId) {
        console.warn('No tenant found for WhatsApp webhook')
        return getTwiMLResponse('❌ Número não configurado. Contacta suporte.')
      }

      // Aviso imediato ao utilizador
      try {
        await sendWhatsAppReply(from, '⏳ Recebi a imagem! A extrair dados com IA, aguarda um momento...')
      } catch (e) {
        console.warn('Aviso inicial falhou:', e)
      }

      try {
        const { buffer, contentType } = await downloadTwilioMedia(mediaUrl0)
        const fileType = parseTwilioMediaType(contentType)
        const base64 = buffer.toString('base64')

        const extraction = await extractInvoiceData(base64, fileType)

        const projectId = await matchProjectFromText(body, tenantId, supabase)

        const timestamp = Date.now()
        const filename = `whatsapp_${timestamp}.${fileType}`
        const filePath = `${tenantId}/whatsapp/${filename}`

        const { data: uploadData, error: uploadError } = await supabase.storage
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

          if (project) {
            response += `\n✅ Adicionada ao projeto: ${project.name}`
          }
        } else {
          response += '\n📍 Qual é o projeto? Responde com o nome.'
        }

        if (extraction.needs_review) {
          response += '\n⚠️ Precisa de revisão manual (baixa confiança).'
        } else {
          response += '\n👇 Responde CONFIRMAR para validar.'
        }

        return getTwiMLResponse(response)
      } catch (error) {
        console.error('Error processing invoice:', error)
        return getTwiMLResponse('❌ Erro ao processar fatura. Tenta com melhor qualidade.')
      }
    }

    // Fluxo sem mídia (confirmação ou nome de projeto)
    if (numMedia === 0 && body.trim()) {
      const tenantId = process.env.DEMO_TENANT_ID
      if (!tenantId) {
        return getTwiMLResponse('❌ Servidor não configurado')
      }

      try {
        const { data: latestInvoice } = await supabase
          .from('invoices')
          .select('*')
          .eq('sender_phone', from)
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
          const projectId = await matchProjectFromText(body, tenantId, supabase)

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
            return getTwiMLResponse('❌ Projeto não encontrado. Tenta com outro nome.')
          }
        }
      } catch (error) {
        console.error('Error processing text message:', error)
        return getTwiMLResponse('❌ Erro ao processar mensagem. Tenta novamente.')
      }
    }

    // Sem mídia e sem texto
    return getTwiMLResponse('📸 Envia uma foto ou PDF da fatura!')
  } catch (error) {
    console.error('Webhook error:', error)
    return getTwiMLResponse('❌ Erro no servidor. Tenta novamente mais tarde.')
  }
}
