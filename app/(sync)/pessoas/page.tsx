"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Result, Skeleton, Typography } from "antd";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import type { CollaboratorItem, LinkFilter } from "@/core/lib/people-types";
import {
  listCollaborators,
  createCollaborator,
  updateCollaborator,
  type CamposEditaveis,
} from "@/core/lib/collaborators-firestore";

import { PeopleKpis } from "./_components/people-kpis";
import { PeopleTable } from "./_components/people-table";
import { CollaboratorDetailPanel } from "./_components/collaborator-detail-panel";
import { CollaboratorFormDialog } from "./_components/collaborator-form-dialog";

export default function PessoasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const db = getFirebaseDb();
  // Sem fallback: sessão sem a claim de grupo falha fechado — misturar dados
  // de grupos diferentes é pior que uma tela vazia. O auth-provider já impede
  // o login sem claim; isto é defesa em profundidade.
  const groupId = user?.groupId ?? "";

  const [search, setSearch] = useState("");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("todos");
  const [selectedCollaborator, setSelectedCollaborator] = useState<CollaboratorItem | null>(
    null,
  );
  /* `"novo"` abre em cadastro; um item abre em edição; `null` fecha. Um estado
     só, porque abrir os dois ao mesmo tempo nunca faz sentido. */
  const [alvoDoFormulario, setAlvoDoFormulario] = useState<CollaboratorItem | "novo" | null>(
    null,
  );

  const {
    data: collaborators = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<CollaboratorItem[]>({
    queryKey: ["collaborators", groupId, search, linkFilter],
    queryFn: () => listCollaborators(db, groupId, { search, linkFilter }),
    enabled: Boolean(groupId),
  });

  const createMutation = useMutation({
    mutationFn: (input: Partial<CollaboratorItem> & { fullName: string }) =>
      createCollaborator(db, groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, valores }: { id: string; valores: CamposEditaveis }) =>
      updateCollaborator(db, id, valores),
    onSuccess: (_resultado, { id, valores }) => {
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
      // A gaveta segura uma cópia do item, não uma consulta própria: sem este
      // ajuste ela continuaria mostrando o dado antigo até ser fechada e reaberta.
      setSelectedCollaborator((atual) =>
        atual && atual.id === id ? { ...atual, ...valores } : atual,
      );
    },
  });

  // KPIs sobre o mesmo conjunto exibido na tabela — reagem à busca e ao
  // filtro de vínculo como já reagiam antes da migração.
  const totalPeople = collaborators.length;
  const activeCount = collaborators.filter((c) => c.partnershipStatus === "ativo").length;
  const totalCommissionsYtd = collaborators.reduce(
    (sum, c) => sum + (c.commissionPaidYtd || 0),
    0,
  );

  if (!groupId) {
    return (
      <Result
        status="warning"
        title="Acesso não configurado"
        subTitle="Sua conta não está vinculada a um grupo. Fale com quem administra os acessos."
      />
    );
  }

  if (isError) {
    return (
      <Result
        status="warning"
        title="Não foi possível carregar as pessoas"
        subTitle="Verifique a conexão e tente novamente."
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <Flex vertical gap={20}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={12}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Pessoas e Colaboradores
          </Typography.Title>
          <Typography.Text type="secondary">
            Gestão de equipe interna, consultores parceiros e comissões.
          </Typography.Text>
        </div>

        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAlvoDoFormulario("novo")}>
          Nova Pessoa
        </Button>
      </Flex>

      <PeopleKpis
        totalPeople={totalPeople}
        activeCount={activeCount}
        totalCommissionsYtd={totalCommissionsYtd}
      />

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <PeopleTable
          collaborators={collaborators}
          selectedId={selectedCollaborator?.id}
          onSelect={(item) => setSelectedCollaborator(item)}
          search={search}
          onSearchChange={setSearch}
          linkFilter={linkFilter}
          onLinkFilterChange={setLinkFilter}
        />
      )}

      <CollaboratorDetailPanel
        collaborator={selectedCollaborator}
        onClose={() => setSelectedCollaborator(null)}
        onEdit={(pessoa) => setAlvoDoFormulario(pessoa)}
      />

      <CollaboratorFormDialog
        alvo={alvoDoFormulario}
        onClose={() => setAlvoDoFormulario(null)}
        onSubmit={async (valores) => {
          if (alvoDoFormulario === "novo" || alvoDoFormulario === null) {
            await createMutation.mutateAsync(valores);
          } else {
            await updateMutation.mutateAsync({ id: alvoDoFormulario.id, valores });
          }
        }}
      />
    </Flex>
  );
}
