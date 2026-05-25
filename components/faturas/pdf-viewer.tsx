"use client"

export function PdfViewer({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      className="w-full h-full min-h-[500px] rounded border-0"
      title="Fatura PDF"
    />
  )
}
