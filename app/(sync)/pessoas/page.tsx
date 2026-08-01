"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Result, Skeleton, Typography } from "antd";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import type { CollaboratorItem, LinkFilter } from "@/core/lib/people-types";
import { listCollaborators, createCollaborator } from "@/core/lib/collaborators-firestore";

import { PeopleKpis } from "./_components/people-kpis";
import { PeopleTable } from "./_components/people-table";
import { CollaboratorDetailPanel } from "./_components/collaborator-detail-panel";
import { NewCollaboratorDialog } from "./_components/new-collaborator-dialog";

const DEFAULT_GROUP_ID = "default";

export default function PessoasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const db = getFirebaseDb();
  const groupId = user?.groupId || DEFAULT_GROUP_ID;

  const [search, setSearch] = useState("");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("todos");
  const [selectedCollaborator, setSelectedCollaborator] = useState<CollaboratorItem | null>(
    null,
  );
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  const {
    data: collaborators = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<CollaboratorItem[]>({
    queryKey: ["collaborators", groupId, search, linkFilter],
    queryFn: () => listCollaborators(db, groupId, { search, linkFilter }),
  });

  const createMutation = useMutation({
    mutationFn: (input: Partial<CollaboratorItem> & { fullName: string }) =>
      createCollaborator(db, groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
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

        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsNewDialogOpen(true)}>
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
      />

      <NewCollaboratorDialog
        open={isNewDialogOpen}
        onClose={() => setIsNewDialogOpen(false)}
        onSubmit={async (input) => {
          await createMutation.mutateAsync(input);
        }}
      />
    </Flex>
  );
}
