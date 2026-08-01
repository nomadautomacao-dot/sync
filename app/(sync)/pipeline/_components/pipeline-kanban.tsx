"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Button, Empty, Tag, Typography, theme } from "antd";

import type { CityAccount, StageKey } from "@/core/lib/city-types";
import { STAGE_LABELS, BOARD_STAGES, INDEX_STAGES, formatCurrencyCompact } from "@/core/lib/city-types";
import { stageSignal, signalColor, stagePastelColor } from "./stage-helpers";
import { CityCard } from "./city-card";
import { StageIndex } from "./stage-index";

interface PipelineKanbanProps {
  cities: CityAccount[];
  selectedCityId?: string;
  onSelectCity: (city: CityAccount) => void;
  onStageDrop: (cityId: string, targetStage: string) => void;
}

const MIN_COLUMN_WIDTH = 220;
const INDEX_COLUMN_WIDTH = 140;
const GAP = 12;
const CARDS_PER_COLUMN = 6;

export function PipelineKanban({
  cities,
  selectedCityId,
  onSelectCity,
  onStageDrop,
}: PipelineKanbanProps) {
  const [expandedStages, setExpandedStages] = useState<Set<StageKey>>(new Set());

  // Os estágios "fechados" (institucional em diante, exceto perdido) vivem no
  // índice compacto ao lado das colunas — mesmo recorte de antes.
  const indexStages = INDEX_STAGES.filter((stage) => stage !== "lost");

  const toggleExpand = (stage: StageKey) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const minBoardWidth =
    BOARD_STAGES.length * (MIN_COLUMN_WIDTH + GAP) + INDEX_COLUMN_WIDTH;

  return (
    <div style={{ height: "100%" }}>
      <div
        style={{
          display: "flex",
          height: "100%",
          gap: GAP,
          overflowX: "auto",
          paddingBottom: 16,
          minWidth: minBoardWidth,
        }}
      >
        {BOARD_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            cities={cities.filter((c) => c.stage === stage)}
            isExpanded={expandedStages.has(stage)}
            onToggleExpand={() => toggleExpand(stage)}
            selectedCityId={selectedCityId}
            onSelectCity={onSelectCity}
            onStageDrop={onStageDrop}
          />
        ))}
        <StageIndex stages={indexStages} cities={cities} onDrop={onStageDrop} />
      </div>
    </div>
  );
}

// ── Coluna de estágio ────────────────────────────────────────

interface StageColumnProps {
  stage: StageKey;
  cities: CityAccount[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  selectedCityId?: string;
  onSelectCity: (city: CityAccount) => void;
  onStageDrop: (cityId: string, targetStage: string) => void;
}

function StageColumn({
  stage,
  cities,
  isExpanded,
  onToggleExpand,
  selectedCityId,
  onSelectCity,
}: StageColumnProps) {
  const { token } = theme.useToken();
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${stage}`,
    data: { stage },
  });

  const columnRevenue = cities.reduce(
    (sum, c) => sum + c.estimatedAnnualRevenue,
    0,
  );
  const signal = stageSignal(cities);
  const visible =
    isExpanded || cities.length <= CARDS_PER_COLUMN
      ? cities
      : cities.slice(0, CARDS_PER_COLUMN);
  const hidden = cities.length - visible.length;
  const tone = stagePastelColor(stage);

  // Continua `div` própria, e não `Card`: o `useDroppable` precisa do `ref`
  // no mesmo nó que recebe o "solte aqui" — um `Card` por cima cria uma
  // camada própria e quebra o arrasto do mesmo jeito que em `city-card.tsx`.
  // O conteúdo interno (título, contadores, botão) é todo Ant.
  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: MIN_COLUMN_WIDTH,
        flex: 1,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${isOver ? token.colorPrimary : token.colorBorderSecondary}`,
        boxShadow: token.boxShadowTertiary,
        backgroundColor: isOver ? token.colorPrimaryBg : token.colorBgContainer,
        transition: "background-color .15s, border-color .15s",
      }}
    >
      {/* Cabeçalho da coluna, com a cor do estágio no topo */}
      <div
        style={{
          padding: 14,
          borderTop: `4px solid ${tone.dot}`,
          borderTopLeftRadius: token.borderRadiusLG,
          borderTopRightRadius: token.borderRadiusLG,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: signalColor(signal),
                flexShrink: 0,
              }}
            />
            <Typography.Text strong ellipsis style={{ fontSize: 12 }}>
              {STAGE_LABELS[stage]}
            </Typography.Text>
          </div>
          <Tag style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10, marginInlineEnd: 0 }}>
            {cities.length}
          </Tag>
        </div>

        <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography.Text strong style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}>
            {columnRevenue > 0 ? formatCurrencyCompact(columnRevenue) : "R$ 0"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 10 }}>
            acumulado
          </Typography.Text>
        </div>
      </div>

      {/* Corpo: cards */}
      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        {cities.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {isOver ? "Solte para mover" : "Nenhuma cidade nesta fase"}
              </Typography.Text>
            }
            style={{ marginTop: 16 }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map((city) => (
              <CityCard
                key={city.id}
                city={city}
                isSelected={city.id === selectedCityId}
                onSelect={onSelectCity}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rodapé "+N" / "Mostrar menos" */}
      {(hidden > 0 || isExpanded) && (
        <div style={{ padding: "0 10px 10px" }}>
          <Button type="dashed" block size="small" onClick={onToggleExpand}>
            <span style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}>
              {isExpanded ? "Mostrar menos" : `+${hidden} cidades`}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
