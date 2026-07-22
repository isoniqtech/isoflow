/**
 * Estados a partir dos quais uma fatura pode transitar para "enviada_erp"
 * quando e' lancada no ERP.
 *
 * Deliberadamente NAO inclui estados posteriores ou terminais
 * (rejected, duplicate, matched, paid, reconciled): promover a partir desses
 * apagaria informacao de conciliacao ou reabriria faturas rejeitadas.
 */
export const PRE_ERP_STATUSES = [
  "pending",
  "processing",
  "em_sistema",
  "necessita_revisao",
] as const
