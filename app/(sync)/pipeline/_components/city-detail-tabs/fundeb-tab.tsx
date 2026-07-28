"use client";

import { useQuery } from '@tanstack/react-query';
import type { CityAccount, FundebDiagnostico } from '@/core/lib/city-types';
import { formatCurrency } from '@/core/lib/city-types';
import { apiFetch } from '@/core/lib/api-client';

interface FundebTabProps {
  city: CityAccount;
}

export function FundebTab({ city }: FundebTabProps) {
  const { data, isLoading, error, refetch } = useQuery<FundebDiagnostico>({
    queryKey: ['fundeb-diagnostico', city.codigoIbge],
    queryFn: () => {
      if (!city.codigoIbge) throw new Error("Código IBGE não cadastrado");
      return apiFetch<FundebDiagnostico>(`/api/modulos/levantamento-fundeb/${city.codigoIbge}`);
    },
    enabled: !!city.codigoIbge,
  });

  if (!city.codigoIbge) {
    return (
      <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
        <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <p className="font-medium">Código IBGE não cadastrado</p>
        <p className="text-sm mt-1">É necessário o código IBGE para buscar os dados do FUNDEB.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-500 text-sm">Carregando dados do FUNDEB...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
        <svg className="w-12 h-12 mb-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p className="font-medium text-red-500">Erro ao carregar dados</p>
        <p className="text-sm mt-1 mb-4 text-red-400">{(error as Error).message || "Ocorreu um erro inesperado."}</p>
        <button 
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Se não temos dados, mas também não é erro ou loading
  if (!data) return null;

  return (
    <div className="p-4 space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-900 rounded-xl p-6 text-white shadow-md">
        <div className="mb-4">
          <h4 className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Receita FUNDEB Atual</h4>
          <div className="text-3xl font-bold">{formatCurrency(data.receitaFundeb2026 || 0)}</div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-blue-500/30">
          <div>
            <div className="text-blue-200 text-[10px] uppercase tracking-wider mb-1">Estimativa 2027</div>
            <div className="font-semibold text-sm">{formatCurrency(data.estimativa2027 || 0)}</div>
          </div>
          <div>
            <div className="text-blue-200 text-[10px] uppercase tracking-wider mb-1">Ganho Potencial</div>
            <div className="font-semibold text-green-300 text-sm">+{formatCurrency(data.ganhoPotencial || 0)}</div>
          </div>
          <div>
            <div className="text-blue-200 text-[10px] uppercase tracking-wider mb-1">Camada Recuperável</div>
            <div className="font-semibold text-sm">{formatCurrency(data.camadaRecuperavel || 0)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 font-mono text-xs">
        <section className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
          <h3 className="font-semibold font-sans text-gray-700 border-b border-gray-100 pb-2 mb-2">1. Identificação do Ente</h3>
          <p className="text-gray-500 italic">Dados de identificação carregados com sucesso.</p>
        </section>

        <section className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
          <h3 className="font-semibold font-sans text-gray-700 border-b border-gray-100 pb-2 mb-2">2. Receita e Projeção</h3>
          <p className="text-gray-500 italic">Ver quadro resumo acima.</p>
        </section>

        <section className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
          <h3 className="font-semibold font-sans text-gray-700 border-b border-gray-100 pb-2 mb-2">3. VAAF / VAAT / VAAR</h3>
          <p className="text-gray-500 italic">Dados dos complementos da união.</p>
        </section>

        <section className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
          <h3 className="font-semibold font-sans text-gray-700 border-b border-gray-100 pb-2 mb-2">4. Eficiência Arrecadatória</h3>
          <p className="text-gray-500 italic">Indicadores de arrecadação local.</p>
        </section>

        <section className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
          <h3 className="font-semibold font-sans text-gray-700 border-b border-gray-100 pb-2 mb-2">5. Matrículas da Rede</h3>
          <p className="text-gray-500 italic">Evolução do Censo Escolar.</p>
        </section>

        <section className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
          <h3 className="font-semibold font-sans text-gray-700 border-b border-gray-100 pb-2 mb-2">6. Indicadores IDEB</h3>
          <p className="text-gray-500 italic">Resultados SAEB/IDEB mais recentes.</p>
        </section>

        <section className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
          <h3 className="font-semibold font-sans text-gray-700 border-b border-gray-100 pb-2 mb-2">7. Sistemas MEC/FNDE</h3>
          <p className="text-gray-500 italic">Status de condicionalidades (Siope, etc).</p>
        </section>

        <section className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
          <h3 className="font-semibold font-sans text-gray-700 border-b border-gray-100 pb-2 mb-2">8. SICONFI - Despesas</h3>
          <p className="text-gray-500 italic">Demonstrativo de despesas com educação.</p>
        </section>
      </div>
    </div>
  );
}
