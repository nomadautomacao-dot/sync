import { SecaoNaoMigrada } from "@/core/components/sync-shell/secao-nao-migrada";

export default function CaixadeentradaPage() {
  return (
    <SecaoNaoMigrada
      titulo="Caixa de entrada"
      fase={6}
      resumo="Eventos de auditoria do grupo, agrupados por dia."
    />
  );
}
