"use client";

import type { CityAccount } from '@/core/lib/city-types';

interface HistoricoTabProps {
  city: CityAccount;
}

export function HistoricoTab({ city }: HistoricoTabProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
      <div className="text-4xl mb-4">📊</div>
      <h3 className="font-semibold text-gray-700 mb-1">Histórico de atividades</h3>
      <p className="text-sm">Em breve — timeline de ações e mudanças de estágio</p>
    </div>
  );
}
