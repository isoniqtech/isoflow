"use client"

export function PdfViewer({ url }: { url: string }) {
  return (
    <embed
      src={`${url}#toolbar=1&navpanes=0&scrollbar=1`}
      type="application/pdf"
      className="w-full h-full min-h-[500px] rounded"
    />
  )
}
