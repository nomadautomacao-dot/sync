import { SecaoNaoMigrada } from "@/core/components/sync-shell/secao-nao-migrada";
import { DadosLocaisCaged } from "@/core/components/ajustes/dados-locais-caged";

/**
 * A tela de Ajustes ainda é placeholder (fase 6), mas já hospeda as ferramentas
 * de manutenção de dados locais — elas não dependem do resto da migração e
 * precisam de um lugar visível.
 *
 * O bloco de dev só é montado fora de produção. A rota que ele consome também
 * se recusa a responder em produção; a checagem aqui evita renderizar um
 * controle que só produziria 404.
 */
export default function AjustesPage() {
  const emDesenvolvimento = process.env.NODE_ENV !== "production";

  return (
    <SecaoNaoMigrada
      titulo="Ajustes"
      fase={6}
      resumo="Configuração do workspace, flags de funcionalidade, papéis e auditoria."
    >
      {emDesenvolvimento && <DadosLocaisCaged />}
    </SecaoNaoMigrada>
  );
}
