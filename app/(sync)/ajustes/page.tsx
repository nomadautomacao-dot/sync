import { SecaoNaoMigrada } from "@/core/components/sync-shell/secao-nao-migrada";

export default function AjustesPage() {
  return (
    <SecaoNaoMigrada
      titulo="Ajustes"
      fase={6}
      resumo="Configuração do workspace, flags de funcionalidade, papéis e auditoria."
    />
  );
}
