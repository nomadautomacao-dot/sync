"use client";

import { useCallback, useMemo, useState } from "react";
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
  SearchIcon,
  PlusIcon,
  LayoutGridIcon,
  ListIcon,
  RefreshCwIcon,
  FilterIcon,
  TrendingUpIcon,
} from "lucide-react";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import type { CityAccount } from "@/core/lib/city-types";
import { STAGE_LABELS } from "@/core/lib/city-types";
import {
  listCities,
  createCity,
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
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Badge } from "@/core/components/ui/badge";

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
  const { data: cities = [], isPending, error, isFetching, refetch } = useQuery({
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
    ) => createCity(getFirebaseDb(), groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      toast.success("Município criado com sucesso.");
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
      <div className="flex h-full flex-col space-y-5">
        {/* Header & Controls Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#16181D]">
                Plano de Ação Comercial
              </h1>
              <Badge variant="outline" className="border-[#F0F1F5] bg-[#F2F1F7] text-[#16181D] font-mono text-[10px] font-bold rounded-[20px]">
                {cities.length} {cities.length === 1 ? "Município" : "Municípios"}
              </Badge>
            </div>
            <p className="mt-1 text-xs font-medium text-[#5A5E6A]">
              Gerencie a prospecção e avanço de estágios das contas municipais do grupo
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Kanban vs Lista */}
            <div className="flex rounded-[20px] border border-[#F0F1F5] bg-[#F2F1F7] p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setIsKanbanView(true)}
                className={`flex h-8 items-center gap-1.5 rounded-[20px] px-3 text-xs font-semibold transition-all ${
                  isKanbanView
                    ? "bg-[#16181D] text-white shadow-2xs"
                    : "text-[#5A5E6A] hover:text-[#16181D]"
                }`}
              >
                <LayoutGridIcon className="size-3.5" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setIsKanbanView(false)}
                className={`flex h-8 items-center gap-1.5 rounded-[20px] px-3 text-xs font-semibold transition-all ${
                  !isKanbanView
                    ? "bg-[#16181D] text-white shadow-2xs"
                    : "text-[#5A5E6A] hover:text-[#16181D]"
                }`}
              >
                <ListIcon className="size-3.5" />
                Lista
              </button>
            </div>

            {/* Novo município */}
            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              size="sm"
              className="h-9 gap-1.5 rounded-full bg-[#16181D] text-xs font-bold text-white shadow-2xs hover:bg-[#2C2F38]"
            >
              <PlusIcon className="size-4" />
              Novo Município
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <PipelineKpis
          totalRevenue={totalRevenue}
          weightedRevenue={weightedRevenue}
          inactiveCities={inactiveCities}
        />

        {/* Barra de Pesquisa e Filtros */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#A2A6B2]" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por município, UF ou código IBGE…"
              className="h-10 rounded-full border-[#F0F1F5]/90 bg-white pl-10 text-xs font-medium placeholder:text-[#A2A6B2] focus:border-[#16181D] focus:ring-2 focus:ring-[#16181D]/20"
            />
            {isFetching && (
              <RefreshCwIcon className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#16181D]" />
            )}
          </div>
        </div>

        {/* Conteúdo Principal (Kanban ou Tabela) + Painel Lateral */}
        <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            {isPending ? (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-white/95 bg-white/[.88] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
                <RefreshCwIcon className="size-6 animate-spin text-[#16181D]" />
              </div>
            ) : error ? (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-xs font-bold text-red-900">
                  Falha ao carregar o pipeline: {error.message}
                </p>
              </div>
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

          {/* Painel lateral de detalhes */}
          {selectedCity && (
            <CityDetailPanel
              city={selectedCity}
              onClose={() => setSelectedCity(null)}
              onSave={handleSave}
            />
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <div className="w-[240px] opacity-90">
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
