import { SecaoNaoMigrada } from "@/core/components/sync-shell/secao-nao-migrada";

export default function PessoasPage() {
  return (
    <SecaoNaoMigrada
      titulo="Pessoas"
      fase={3}
      resumo="Colaboradores, parceiros e articuladores, com documentos e comissões."
    />
  );
}
