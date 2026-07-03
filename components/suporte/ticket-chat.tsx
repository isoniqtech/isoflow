"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { SupportMessage } from "@/types"

type MessageWithSender = SupportMessage & {
  sender: { id: string; name: string }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s.charAt(0))
    .join("")
    .toUpperCase()
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function TicketChat({
  ticketId,
  currentUserId,
  initialMessages,
  ticketStatus,
  isSupport,
}: {
  ticketId: string
  currentUserId: string
  initialMessages: MessageWithSender[]
  ticketStatus: string
  isSupport: boolean
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages)
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "error">("connecting")
  const scrollRef = useRef<HTMLDivElement>(null)

  const isClosed = ticketStatus === "closed" || ticketStatus === "resolved"

  const lastMessage = messages[messages.length - 1]
  const canReply = isSupport || !lastMessage || lastMessage.sender_type === "support"

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const newMsg = payload.new as SupportMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            const senderName = newMsg.sender_id === currentUserId
              ? "Tu"
              : newMsg.sender_type === "support"
                ? "Suporte"
                : "Cliente"
            return [
              ...prev,
              { ...newMsg, sender: { id: newMsg.sender_id, name: senderName } },
            ]
          })
          router.refresh()
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("connected")
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setRealtimeStatus("error")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, currentUserId, router])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages.length])

  async function handleSend() {
    const text = draft.trim()
    if (!text || submitting) return
    setSubmitting(true)

    const res = await fetch(`/api/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Nao foi possivel enviar", {
        description: errBody.error ?? `HTTP ${res.status}`,
      })
      setSubmitting(false)
      return
    }

    const { data } = await res.json()
    setMessages((prev) => {
      if (prev.some((m) => m.id === data.id)) return prev
      return [...prev, { ...data, sender: { id: currentUserId, name: "Tu" } }]
    })
    setDraft("")
    setSubmitting(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] min-h-[400px] rounded-lg border bg-background">
      <div className="flex items-center justify-between px-4 h-9 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground">
          {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs",
            realtimeStatus === "connected" && "text-emerald-600 dark:text-emerald-400",
            realtimeStatus === "error" && "text-destructive",
            realtimeStatus === "connecting" && "text-muted-foreground",
          )}
          aria-live="polite"
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              realtimeStatus === "connected" && "bg-emerald-500",
              realtimeStatus === "error" && "bg-destructive",
              realtimeStatus === "connecting" && "bg-muted-foreground animate-pulse",
            )}
          />
          {realtimeStatus === "connected"
            ? "Tempo real"
            : realtimeStatus === "error"
              ? "Sem ligacao realtime"
              : "A ligar..."}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Sem mensagens ainda.
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId
            const isSupportMsg = msg.sender_type === "support"
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2 max-w-[85%]",
                  isMine ? "ml-auto flex-row-reverse" : "mr-auto",
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-[10px]",
                      isSupportMsg &&
                        "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
                    )}
                  >
                    {isSupportMsg ? "ST" : getInitials(msg.sender.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm whitespace-pre-line",
                      isMine ? "bg-foreground text-background" : "bg-muted",
                    )}
                  >
                    {msg.message}
                  </div>
                  <div
                    className={cn(
                      "text-[10px] text-muted-foreground",
                      isMine ? "text-right" : "text-left",
                    )}
                  >
                    {isSupportMsg ? "Suporte" : msg.sender.name}
                    {" · "}
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="border-t p-3 bg-background">
        {isClosed ? (
          <p className="text-center text-sm text-muted-foreground py-2">
            Este ticket esta {ticketStatus === "closed" ? "fechado" : "resolvido"}.
          </p>
        ) : !canReply ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            A aguardar resposta do suporte...
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Escreve uma mensagem... (Cmd/Ctrl + Enter para enviar)"
              rows={2}
              className="resize-none"
              disabled={submitting}
            />
            <Button
              onClick={handleSend}
              disabled={submitting || !draft.trim()}
              size="icon"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
