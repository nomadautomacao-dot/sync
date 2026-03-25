import { PageHeader } from "@/components/shared/page-header";
import { getWorkspaceSettings } from "./settings-actions";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const initialData = await getWorkspaceSettings();

  if (!initialData) {
    return (
      <div className="space-y-4 px-4 pb-8 md:px-8">
        <PageHeader title="Configuracoes do workspace" description="Parametros globais de grupo." />
        <div>Nenhum grupo encontrado. Banco de dados vazio.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 pb-8 md:px-8">
      <PageHeader
        title="Configuracoes do Workspace"
        description="Parametros globais do grupo e atalhos de administracao."
      />

      <SettingsForm initialData={initialData} />
    </div>
  );
}
