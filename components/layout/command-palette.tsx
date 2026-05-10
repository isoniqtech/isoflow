"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  Plus,
  Search,
  Settings,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import type { SearchResponse } from "@/app/api/search/route"

const QUICK_LINKS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Nova fatura", href: "/faturas/nova", icon: Plus },
  { label: "Faturas", href: "/faturas", icon: FileText },
  { label: "Projetos", href: "/projetos", icon: FolderKanban },
  { label: "Novo projeto", href: "/projetos/novo", icon: Plus },
  { label: "Suporte", href: "/suporte", icon: LifeBuoy },
  { label: "Novo ticket", href: "/suporte/novo", icon: Plus },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)

  // Cmd/Ctrl + K para abrir.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Reset state quando fecha.
  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults(null)
    }
  }, [open])

  // Debounced search.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        )
        if (res.ok) {
          const data = (await res.json()) as SearchResponse
          setResults(data)
        }
      } catch {
        // ignore aborts
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  const hasResults =
    results &&
    (results.faturas.length > 0 ||
      results.projetos.length > 0 ||
      results.tickets.length > 0)

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Pesquisar faturas, projetos, tickets..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.length === 0 && (
          <CommandGroup heading="Atalhos">
            {QUICK_LINKS.map((l) => {
              const Icon = l.icon
              return (
                <CommandItem
                  key={l.href}
                  onSelect={() => go(l.href)}
                  value={l.label}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {l.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {query.length > 0 && query.length < 2 && (
          <CommandEmpty>Escreve pelo menos 2 caracteres...</CommandEmpty>
        )}

        {query.length >= 2 && loading && !hasResults && (
          <CommandEmpty>A pesquisar...</CommandEmpty>
        )}

        {query.length >= 2 && !loading && !hasResults && (
          <CommandEmpty>Sem resultados.</CommandEmpty>
        )}

        {results && results.faturas.length > 0 && (
          <>
            <CommandGroup heading="Faturas">
              {results.faturas.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={`fatura ${hit.title} ${hit.subtitle ?? ""}`}
                  onSelect={() => go(hit.href)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{hit.title}</p>
                    {hit.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {hit.subtitle}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {results && results.projetos.length > 0 && (
          <>
            <CommandGroup heading="Projetos">
              {results.projetos.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={`projeto ${hit.title} ${hit.subtitle ?? ""}`}
                  onSelect={() => go(hit.href)}
                >
                  <FolderKanban className="mr-2 h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{hit.title}</p>
                    {hit.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {hit.subtitle}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {results && results.tickets.length > 0 && (
          <CommandGroup heading="Tickets">
            {results.tickets.map((hit) => (
              <CommandItem
                key={hit.id}
                value={`ticket ${hit.title} ${hit.subtitle ?? ""}`}
                onSelect={() => go(hit.href)}
              >
                <LifeBuoy className="mr-2 h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{hit.title}</p>
                  {hit.subtitle && (
                    <p className="text-xs text-muted-foreground truncate">
                      {hit.subtitle}
                    </p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

export function CommandTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        // Dispara o atalho via evento sintetizado.
        const event = new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        })
        document.dispatchEvent(event)
      }}
      className="hidden lg:inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      aria-label="Pesquisar"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Pesquisar...</span>
      <CommandShortcut>⌘K</CommandShortcut>
    </button>
  )
}
