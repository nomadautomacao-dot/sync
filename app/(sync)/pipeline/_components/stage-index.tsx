"use client";

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { CityAccount, StageKey } from '@/core/lib/city-types';
import { STAGE_LABELS } from '@/core/lib/city-types';

interface StageIndexProps {
  stages: StageKey[];
  cities: CityAccount[];
  onDrop: (cityId: string, targetStage: string) => void;
}

function StageRow({ stage, count }: { stage: StageKey, count: number }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `index-${stage}`,
    data: { stage }
  });

  return (
    <div
      ref={setNodeRef}
      className={`px-2 py-1.5 rounded-[6px] flex justify-between items-center transition-colors ${isOver ? 'bg-primary-light' : ''}`}
    >
      <div className="text-[12px] font-medium truncate text-title">
        {STAGE_LABELS[stage] || stage}
      </div>
      <div className="font-mono text-[10px] text-soft tabular-nums ml-2">
        {count}
      </div>
    </div>
  );
}

export function StageIndex({ stages, cities, onDrop }: StageIndexProps) {
  const counts = stages.reduce((acc, stage) => {
    acc[stage] = cities.filter(c => c.stage === stage).length;
    return acc;
  }, {} as Record<StageKey, number>);

  return (
    <div className="w-[130px] flex-shrink-0 bg-surface-subtle rounded-[14px] p-2.5 border border-dashed border-line flex flex-col">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft mb-3 px-1">
        +{stages.length} Estágios
      </div>
      <div className="flex flex-col gap-1">
        {stages.map(stage => (
          <StageRow key={stage} stage={stage} count={counts[stage] || 0} />
        ))}
      </div>
    </div>
  );
}
