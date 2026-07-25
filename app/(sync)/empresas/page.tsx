import { SecaoNaoMigrada } from "@/core/components/sync-shell/secao-nao-migrada";

export default function EmpresasPage() {
  return (
    <SecaoNaoMigrada
      titulo="Empresas"
      fase={3}
      resumo="Cadastro das empresas do grupo, quadro de funcionários e módulos habilitados."
    />
  );
}
