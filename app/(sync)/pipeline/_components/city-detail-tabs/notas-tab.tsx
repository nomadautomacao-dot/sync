"use client";

import type { CityAccount } from '@/core/lib/city-types';

interface NotasTabProps {
  city: CityAccount;
}

export function NotasTab({ city }: NotasTabProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
      <div className="text-4xl mb-4">📝</div>
      <h3 className="font-semibold text-gray-700 mb-1">Notas e observações</h3>
      <p className="text-sm">Em breve — notas internas sobre o município</p>
    </div>
  );
}
