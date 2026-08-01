"use client";

import { useDroppable } from "@dnd-kit/core";
import { Card, Typography, theme } from "antd";

import type { CityAccount, StageKey } from "@/core/lib/city-types";
import { STAGE_LABELS } from "@/core/lib/city-types";

interface StageIndexProps {
  stages: StageKey[];
  cities: CityAccount[];
  onDrop: (cityId: string, targetStage: string) => void;
}

function StageRow({ stage, count }: { stage: StageKey; count: number }) {
  const { token } = theme.useToken();
  const { isOver, setNodeRef } = useDroppable({
    id: `index-${stage}`,
    data: { stage },
  });

  // Continua `div` própria, e não um item de lista do Ant: o `useDroppable`
  // precisa do `ref` no mesmo nó que recebe o "solte aqui" — envolver em
  // camada própria quebra o arrasto do mesmo jeito que em `city-card.tsx`.
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: "6px 8px",
        borderRadius: token.borderRadiusSM,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: isOver ? token.colorPrimaryBg : "transparent",
        transition: "background-color .15s",
      }}
    >
      <Typography.Text ellipsis style={{ fontSize: 12, fontWeight: 500 }}>
        {STAGE_LABELS[stage] || stage}
      </Typography.Text>
      <Typography.Text
        type="secondary"
        style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10, marginInlineStart: 8 }}
      >
        {count}
      </Typography.Text>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `onDrop` fica na assinatura por simetria com o kanban; o drop real é resolvido pelo `DndContext` em page.tsx via os ids `index-<estágio>`
export function StageIndex({ stages, cities, onDrop }: StageIndexProps) {
  const counts = stages.reduce(
    (acc, stage) => {
      acc[stage] = cities.filter((c) => c.stage === stage).length;
      return acc;
    },
    {} as Record<StageKey, number>,
  );

  return (
    <Card
      size="small"
      style={{ width: 130, flexShrink: 0 }}
      styles={{ body: { padding: 10, display: "flex", flexDirection: "column", gap: 2 } }}
      title={
        <Typography.Text
          type="secondary"
          style={{
            fontFamily: "var(--font-sync-mono)",
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          +{stages.length} Estágios
        </Typography.Text>
      }
    >
      {stages.map((stage) => (
        <StageRow key={stage} stage={stage} count={counts[stage] || 0} />
      ))}
    </Card>
  );
}
