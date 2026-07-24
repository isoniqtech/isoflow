/**
 * Logos das integracoes ERP, recriados como SVG inline (sem depender de ficheiros
 * externos), com as cores de marca.
 */

/** Marca n8n (grafo de nos, rosa da marca). */
export function N8nLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 92 52"
      className={className}
      role="img"
      aria-label="n8n"
      fill="none"
    >
      <line x1="8" y1="26" x2="30" y2="26" stroke="#EA4B71" strokeWidth="4" />
      <line x1="30" y1="26" x2="54" y2="26" stroke="#EA4B71" strokeWidth="4" />
      <line x1="54" y1="26" x2="80" y2="12" stroke="#EA4B71" strokeWidth="4" />
      <line x1="54" y1="26" x2="80" y2="40" stroke="#EA4B71" strokeWidth="4" />
      <circle cx="8" cy="26" r="7" fill="#EA4B71" />
      <circle cx="30" cy="26" r="7" fill="#EA4B71" />
      <circle cx="54" cy="26" r="10" fill="#EA4B71" />
      <circle cx="80" cy="12" r="8" fill="#EA4B71" />
      <circle cx="80" cy="40" r="8" fill="#EA4B71" />
    </svg>
  )
}

/** Marca TOConline (quadrado teal com o "t" branco). */
export function ToconlineLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="TOConline"
    >
      <rect x="1" y="1" width="46" height="46" rx="11" fill="#38B6C6" />
      <path
        d="M19 10 L19 31 Q19 37 27 36.5"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 18 L33 18"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
