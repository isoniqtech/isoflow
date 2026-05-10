import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

/**
 * AES-256-GCM symmetric encryption for sensitive values stored in the DB
 * (e.g., OAuth refresh tokens, third-party API keys).
 *
 * The key is read from env `ENCRYPTION_KEY` — must be a 64-char hex string
 * (32 bytes). Generate with:
 *
 *     openssl rand -hex 32
 *
 * Format of the cipher text returned by encrypt(): `iv:authTag:ciphertext`
 * — all hex-encoded. Decrypt() expects the exact same format and verifies
 * the auth tag (tampering throws).
 */

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // GCM recommended

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new Error("ENCRYPTION_KEY env var is not set")
  }
  if (hex.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY must be 64 hex chars (32 bytes); got ${hex.length}`,
    )
  }
  return Buffer.from(hex, "hex")
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format")
  }
  const [ivHex, tagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(tagHex, "hex")
  const encrypted = Buffer.from(encryptedHex, "hex")
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

/** Helper para encriptar valores opcionais. Devolve null se input for null/empty. */
export function encryptOptional(value: string | null | undefined): string | null {
  if (!value) return null
  return encrypt(value)
}

/** Helper inverso de encryptOptional(). */
export function decryptOptional(value: string | null | undefined): string | null {
  if (!value) return null
  return decrypt(value)
}
