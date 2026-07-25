import { SecaoNaoMigrada } from "@/core/components/sync-shell/secao-nao-migrada";

export default function PipelinePage() {
  return (
    <SecaoNaoMigrada
      titulo="Pipeline"
      fase={2}
      resumo="Quadro comercial dos municípios por estágio, com diagnóstico FUNDEB."
    />
  );
}
