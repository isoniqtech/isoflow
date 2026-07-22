import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Descobre o `phase_order` a usar para uma fase, num dado projeto.
 *
 * Se a fase já existe no projeto, reutiliza a ordem dela - assim uma tarefa
 * criada à mão cai no mesmo grupo do Gantt que as geradas pela IA. Se é nova,
 * vai para o fim.
 *
 * Comparação exacta pelo nome: é o mesmo critério que a IA usa para agrupar.
 */
export async function resolverPhaseOrder(
  sb: SupabaseClient,
  projectId: string,
  phase: string,
): Promise<number> {
  const { data: existente } = await sb
    .from("project_tasks")
    .select("phase_order")
    .eq("project_id", projectId)
    .eq("phase", phase)
    .not("phase_order", "is", null)
    .limit(1)
    .maybeSingle()

  const ordem = (existente as { phase_order?: number | null } | null)?.phase_order
  if (typeof ordem === "number") return ordem

  const { data: ultima } = await sb
    .from("project_tasks")
    .select("phase_order")
    .eq("project_id", projectId)
    .not("phase_order", "is", null)
    .order("phase_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  return ((ultima as { phase_order?: number | null } | null)?.phase_order ?? -1) + 1
}
