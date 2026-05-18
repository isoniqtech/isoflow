import crypto from 'crypto'

export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const sortedKeys = Object.keys(params).sort()
  let message = url
  for (const key of sortedKeys) {
    message += key + params[key]
  }

  const hmac = crypto.createHmac('sha1', authToken)
  hmac.update(message)
  const computed = hmac.digest('base64')

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
  } catch {
    return false
  }
}
