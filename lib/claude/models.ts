export const ANTHROPIC_SUPPORTED_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (plataforma)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (rapido)" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 (avancado)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (mais recente)" },
] as const

export type AnthropicModelId = (typeof ANTHROPIC_SUPPORTED_MODELS)[number]["id"]
