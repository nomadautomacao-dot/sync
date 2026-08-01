"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  AppstoreOutlined,
  EnvironmentOutlined,
  LoadingOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Button, Flex, Input, Result, Segmented, Space, Spin, Tag, Typography } from "antd";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import type { CityAccount } from "@/core/lib/city-types";
import { STAGE_LABELS } from "@/core/lib/city-types";
import {
  listCities,
  ensureCity,
  updateCityStage,
  updateCityPipeline,
} from "@/core/lib/cities-firestore";

import { PipelineKanban } from "./_components/pipeline-kanban";
import { PipelineTable } from "./_components/pipeline-table";
import { PipelineKpis } from "./_components/pipeline-kpis";
import { CityCard } from "./_components/city-card";
import { CityDetailPanel } from "./_components/city-detail-panel";
import { NewCityDialog } from "./_components/new-city-dialog";
import { daysIdle } from "./_components/stage-helpers";

export default function PipelinePage() {
  const { user } = useAuth();
  if (!user) return null;
  return <PipelineContent groupId={user.groupId} />;
}

function PipelineContent({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const [isKanbanView, setIsKanbanView] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<CityAccount | null>(null);

  // ── Data ────────────────────────────────────────────────────
  const { data: cities = [], isPending, error, isFetching } = useQuery({
    queryKey: ["pipeline-cities", groupId, searchQuery],
    queryFn: () =>
      listCities(getFirebaseDb(), groupId, { search: searchQuery }),
  });

  // ── Mutations ──────────────────────────────────────────────
  const stageMutation = useMutation({
    mutationFn: ({ cityId, stage }: { cityId: string; stage: string }) =>
      updateCityStage(getFirebaseDb(), cityId, stage),
    onSuccess: (_data, { stage }) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      toast.success(`Estágio atualizado para ${STAGE_LABELS[stage as keyof typeof STAGE_LABELS] ?? stage}`);
    },
    onError: (err) => {
      toast.error(`Erro ao atualizar estágio: ${err.message}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({
      cityId,
      data,
    }: {
      cityId: string;
      data: Record<string, unknown>;
    }) => updateCityPipeline(getFirebaseDb(), cityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      toast.success("Dados salvos com sucesso.");
    },
    onError: (err) => {
      toast.error(`Erro ao salvar dados: ${err.message}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (
      input: Partial<CityAccount> & { name: string; uf: string }
    ) => ensureCity(getFirebaseDb(), groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      toast.success("Município adicionado ao pipeline.");
    },
    onError: (err) => {
      toast.error(`Erro ao criar município: ${err.message}`);
    },
  });

  // ── DnD ────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const city = cities.find((c) => c.id === event.active.id);
      setActiveDrag(city ?? null);
    },
    [cities]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const cityId = String(active.id);
      const targetStage = String(over.data.current?.stage ?? over.id).replace("column-", "");
      const city = cities.find((c) => c.id === cityId);

      if (!city || city.stage === targetStage) return;
      stageMutation.mutate({ cityId, stage: targetStage });
    },
    [cities, stageMutation]
  );

  const handleStageDrop = useCallback(
    (cityId: string, targetStage: string) => {
      const city = cities.find((c) => c.id === cityId);
      if (!city || city.stage === targetStage) return;
      stageMutation.mutate({ cityId, stage: targetStage });
    },
    [cities, stageMutation]
  );

  // ── KPIs ───────────────────────────────────────────────────
  const { totalRevenue, weightedRevenue, inactiveCities } = useMemo(() => {
    let total = 0;
    let weighted = 0;
    let inactive = 0;
    for (const city of cities) {
      total += city.estimatedAnnualRevenue;
      weighted +=
        city.estimatedAnnualRevenue * (city.probability / 100);
      const idle = daysIdle(city);
      if (idle !== null && idle > 7) inactive++;
    }
    return {
      totalRevenue: total,
      weightedRevenue: weighted,
      inactiveCities: inactive,
    };
  }, [cities]);

  // ── Handlers ───────────────────────────────────────────────
  const handleSelectCity = useCallback((city: CityAccount) => {
    setSelectedCity(city);
  }, []);

  const handleSave = useCallback(
    (cityId: string, data: Record<string, unknown>) => {
      saveMutation.mutate({ cityId, data });
    },
    [saveMutation]
  );

  const handleCreate = useCallback(
    async (input: Partial<CityAccount> & { name: string; uf: string }) => {
      await createMutation.mutateAsync(input);
    },
    [createMutation]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Flex vertical gap={20} style={{ height: "100%" }}>
        {/* Header & Controls Toolbar */}
        <Flex wrap gap={16} align="center" justify="space-between">
          <div>
            <Space align="center">
              <Typography.Title level={3} style={{ margin: 0 }}>
                Plano de Ação Comercial
              </Typography.Title>
              <Tag style={{ fontFamily: "var(--font-sync-mono)" }}>
                {cities.length} {cities.length === 1 ? "município" : "municípios"}
              </Tag>
            </Space>
            <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
              Prospecção e avanço de estágio das contas municipais do grupo
            </Typography.Paragraph>
          </div>

          <Space>
            <Link href="/cidades">
              <Button icon={<EnvironmentOutlined />}>Fichas das cidades</Button>
            </Link>

            {/* `Segmented` é o componente para alternar entre modos de ver a
                mesma coisa — dois botões fingindo de abas era o que existia. */}
            <Segmented
              value={isKanbanView ? "kanban" : "lista"}
              onChange={(valor) => setIsKanbanView(valor === "kanban")}
              options={[
                { label: "Kanban", value: "kanban", icon: <AppstoreOutlined /> },
                { label: "Lista", value: "lista", icon: <UnorderedListOutlined /> },
              ]}
            />

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDialogOpen(true)}
            >
              Novo município
            </Button>
          </Space>
        </Flex>

        {/* KPIs */}
        <PipelineKpis
          totalRevenue={totalRevenue}
          weightedRevenue={weightedRevenue}
          inactiveCities={inactiveCities}
        />

        <Input
          allowClear
          value={searchQuery}
          onChange={(evento) => setSearchQuery(evento.target.value)}
          placeholder="Buscar por município, UF ou código IBGE…"
          prefix={<SearchOutlined />}
          suffix={isFetching ? <LoadingOutlined /> : null}
        />

        {/* Conteúdo principal — Kanban ou lista. O detalhe da cidade agora é
            `Drawer` (sobreposto), então não reserva espaço aqui como o painel
            fixo de antes. */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {isPending ? (
            <Spin style={{ display: "block", marginTop: 96 }} />
          ) : error ? (
            <Result
              status="warning"
              title="Não foi possível carregar o pipeline"
              subTitle={error.message}
            />
          ) : isKanbanView ? (
            <PipelineKanban
              cities={cities}
              selectedCityId={selectedCity?.id}
              onSelectCity={handleSelectCity}
              onStageDrop={handleStageDrop}
            />
          ) : (
            <PipelineTable
              cities={cities}
              selectedCityId={selectedCity?.id}
              onSelectCity={handleSelectCity}
            />
          )}
        </div>

        {/* Painel de detalhes da cidade selecionada */}
        {selectedCity && (
          <CityDetailPanel
            city={selectedCity}
            onClose={() => setSelectedCity(null)}
            onSave={handleSave}
          />
        )}
      </Flex>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <div style={{ width: 240, opacity: 0.9 }}>
            <CityCard
              city={activeDrag}
              isSelected={false}
              onSelect={() => {}}
            />
          </div>
        )}
      </DragOverlay>

      {/* Diálogo de novo município */}
      <NewCityDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
      />
    </DndContext>
  );
}
