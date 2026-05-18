const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01'

export async function downloadTwilioMedia(mediaUrl: string): Promise<{
  buffer: Buffer
  contentType: string
}> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured')
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${auth}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'image/jpeg'

  return { buffer: Buffer.from(buffer), contentType }
}

export async function sendWhatsAppReply(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials not configured')
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`

  const params = new URLSearchParams()
  params.set('From', `whatsapp:${fromNumber}`)
  params.set('To', `whatsapp:${to}`)
  params.set('Body', body)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send WhatsApp message: ${error}`)
  }
}

export function parseTwilioMediaType(contentType: string): 'pdf' | 'jpg' | 'png' {
  if (contentType.includes('pdf')) return 'pdf'
  if (contentType.includes('png')) return 'png'
  return 'jpg'
}
