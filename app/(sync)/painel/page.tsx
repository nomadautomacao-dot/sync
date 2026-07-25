"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, getCountFromServer, query, where, type Firestore } from "firebase/firestore";
import type { ReactNode } from "react";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";

/**
 * Painel `/painel` — porte fiel de `DashboardFirestoreService.overview`
 * (`sync_flutter/lib/src/core/data/dashboard_firestore_service.dart`).
 *
 * O contrato é deliberadamente pequeno: três contagens reais no Firestore e
 * dois KPIs de dinheiro zerados. Os KPIs de dinheiro não são um placeholder
 * nosso — é o que o produto mostra hoje, porque o motor financeiro vive em
 * Cloud Functions que ainda não existem. Inventar número aqui seria mentir
 * sobre o estado do sistema; mostrar `R$ 0` com a legenda certa é a informação
 * correta. Pelo mesmo motivo não há gráfico, alerta nem ranking de municípios:
 * no Flutter esses campos voltam vazios, então não há dado para desenhar.
 */

/** Coleções contadas, na mesma ordem e com os mesmos textos do serviço Flutter. */
const COLECOES = [
  { chave: "cities", rotulo: "Cidades trabalhadas", apoio: "municípios no pipeline" },
  { chave: "collaborators", rotulo: "Colaboradores", apoio: "parceiros e articuladores" },
  { chave: "companies", rotulo: "Empresas", apoio: "empresas do grupo" },
] as const;

type Contagens = Record<(typeof COLECOES)[number]["chave"], number>;

const APOIO_MOTOR_FINANCEIRO = "via motor financeiro (em breve)";

/** Zerados na origem: ver o comentário do topo. */
const KPIS_DE_DINHEIRO = ["Lucro base YTD", "Comissão prevista"] as const;

const CLASSES_CARTAO = "rounded-[14px] border border-[#E2E8F0] bg-white px-[18px] pb-4 pt-[18px]";

const CLASSES_ROTULO_KPI =
  "font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-[#9CA3AF]";

const CLASSES_VALOR_KPI =
  "font-mono text-[32px] font-semibold leading-none tracking-[-1.6px] text-[#111827] tabular-nums";

const CLASSES_APOIO_KPI = "font-mono text-[11px] text-[#6B7280]";

/**
 * Conta no servidor: `getCountFromServer` devolve só o total, sem trafegar
 * documento nenhum. Os dois filtros são obrigatórios — `groupId` é o que
 * satisfaz as `firestore.rules` (sem ele a query toma `permission-denied`, não
 * uma lista maior), e `deletedAt == null` reproduz o soft delete do produto.
 */
async function contarPorGrupo(db: Firestore, colecao: string, groupId: string): Promise<number> {
  const consulta = query(
    collection(db, colecao),
    where("groupId", "==", groupId),
    where("deletedAt", "==", null),
  );
  const snapshot = await getCountFromServer(consulta);
  return snapshot.data().count;
}

export default function PainelPage() {
  const { user } = useAuth();

  // A guarda de `app/(sync)/layout.tsx` não renderiza filho nenhum sem sessão
  // resolvida. Este ramo existe para provar isso ao TypeScript sem `!` — e não
  // é um estado que o usuário chegue a ver.
  if (!user) return null;

  return <VisaoExecutiva groupId={user.groupId} />;
}

function VisaoExecutiva({ groupId }: { groupId: string }) {
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", groupId],
    queryFn: async (): Promise<Contagens> => {
      const db = getFirebaseDb();
      // Três leituras independentes: em paralelo, não em fila.
      const [cities, collaborators, companies] = await Promise.all([
        contarPorGrupo(db, "cities", groupId),
        contarPorGrupo(db, "collaborators", groupId),
        contarPorGrupo(db, "companies", groupId),
      ]);
      return { cities, collaborators, companies };
    },
  });

  return (
    <div className="min-w-0">
      <h1 className="text-[23px] font-bold tracking-[-0.7px] text-[#111827]">Visão executiva</h1>
      <p className="mt-1 text-[13px] text-[#6B7280]">Carteira consolidada do grupo</p>

      {error ? (
        <PainelDeFalha erro={error} onTentarDeNovo={refetch} recarregando={isFetching} />
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {COLECOES.map(({ chave, rotulo, apoio }) => (
          <CartaoDeContagem
            key={chave}
            rotulo={rotulo}
            apoio={apoio}
            valor={data?.[chave]}
            carregando={isPending}
          />
        ))}

        {KPIS_DE_DINHEIRO.map((rotulo) => (
          <CartaoKpi key={rotulo} rotulo={rotulo} apoio={APOIO_MOTOR_FINANCEIRO}>
            <span className={CLASSES_VALOR_KPI}>R$ 0</span>
          </CartaoKpi>
        ))}
      </div>
    </div>
  );
}

interface CartaoDeContagemProps {
  rotulo: string;
  apoio: string;
  valor: number | undefined;
  carregando: boolean;
}

/**
 * Três estados excludentes, nesta ordem: carregando → esqueleto; sem valor
 * (falhou) → travessão; valor → número. Nunca um zero de mentira enquanto a
 * contagem real ainda está em voo.
 */
function CartaoDeContagem({ rotulo, apoio, valor, carregando }: CartaoDeContagemProps) {
  return (
    <CartaoKpi rotulo={rotulo} apoio={apoio}>
      {carregando ? (
        <span
          role="status"
          aria-label={`Carregando ${rotulo}`}
          className="block h-8 w-24 animate-pulse rounded-[6px] bg-[#F1F3F7]"
        />
      ) : (
        <span className={CLASSES_VALOR_KPI}>
          {valor === undefined ? <span className="text-[#9CA3AF]">—</span> : valor}
        </span>
      )}
    </CartaoKpi>
  );
}

interface CartaoKpiProps {
  rotulo: string;
  apoio: string;
  children: ReactNode;
}

function CartaoKpi({ rotulo, apoio, children }: CartaoKpiProps) {
  return (
    <article className={CLASSES_CARTAO}>
      <p className={CLASSES_ROTULO_KPI}>{rotulo}</p>
      <div className="mt-2.5 flex h-8 items-center">{children}</div>
      <p className={`mt-3 ${CLASSES_APOIO_KPI}`}>{apoio}</p>
    </article>
  );
}

interface PainelDeFalhaProps {
  erro: Error;
  onTentarDeNovo: () => void;
  recarregando: boolean;
}

/**
 * Erro em tela, não em toast: aqui falhou a tela inteira, não uma ação pontual.
 * Um toast some em segundos e deixa o usuário diante de cards vazios sem
 * explicação. A mensagem crua vai junto de propósito — é ela que carrega o
 * código do Firebase (`permission-denied`, `unavailable`) e sem isso não há
 * diagnóstico possível.
 */
function PainelDeFalha({ erro, onTentarDeNovo, recarregando }: PainelDeFalhaProps) {
  return (
    <div
      role="alert"
      className="mt-6 rounded-[14px] border border-[#EF4444] bg-[#FEF2F2] px-[18px] py-4"
    >
      <p className="text-[14px] font-semibold text-[#991B1B]">
        Não foi possível carregar as contagens do painel.
      </p>
      <p className="mt-1.5 font-mono text-[12px] leading-relaxed break-words text-[#991B1B]">
        {erro.message}
      </p>
      <button
        type="button"
        onClick={() => void onTentarDeNovo()}
        disabled={recarregando}
        aria-busy={recarregando}
        className="mt-3.5 h-10 rounded-[10px] border border-[#EF4444] bg-white px-4 text-[14px] font-semibold tracking-[-0.1px] text-[#991B1B] transition-colors hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
      >
        {recarregando ? "Tentando…" : "Tentar de novo"}
      </button>
    </div>
  );
}
