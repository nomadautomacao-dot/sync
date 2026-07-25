"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ItemDeNavegacao {
  rotulo: string;
  rota: string;
  /** Falso enquanto a seção só existir no app Flutter legado. */
  portado: boolean;
}

/** Espelha o `AppSection` do app Flutter, na mesma ordem. */
const ITENS: readonly ItemDeNavegacao[] = [
  { rotulo: "Painel", rota: "/painel", portado: true },
  { rotulo: "Caixa de entrada", rota: "/caixa", portado: false },
  { rotulo: "Empresas", rota: "/empresas", portado: false },
  { rotulo: "Pessoas", rota: "/pessoas", portado: false },
  { rotulo: "Pipeline", rota: "/pipeline", portado: false },
  { rotulo: "Módulos", rota: "/modulos", portado: false },
  { rotulo: "Ajustes", rota: "/ajustes", portado: false },
];

const AVISO_LEGADO = "Esta seção ainda está no sistema antigo.";

const CLASSES_ITEM =
  "relative flex h-11 w-full items-center justify-between gap-2 rounded-[10px] px-3 text-left text-[15px] font-semibold tracking-[-0.25px] transition-colors";

const CLASSES_ROTULO_SECAO =
  "px-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-[#9CA3AF]";

export function SyncSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[292px] shrink-0 flex-col border-r border-[#E2E8F0] bg-white">
      <div className="border-b border-[#E2E8F0] px-6 py-6">
        <p className="text-[20px] font-bold tracking-[-0.6px] text-[#111827]">Global Sync</p>
        <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-[#6B7280]">
          Global Services Consultorias
        </p>
      </div>

      <nav aria-label="Navegação principal" className="px-4 py-5">
        <p className={CLASSES_ROTULO_SECAO}>Workspace</p>
        <ul className="flex flex-col gap-0.5">
          {ITENS.map((item) => (
            <li key={item.rota}>
              {item.portado ? (
                <ItemPortado item={item} pathname={pathname} />
              ) : (
                <ItemInerte item={item} />
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function ItemPortado({ item, pathname }: { item: ItemDeNavegacao; pathname: string }) {
  const ativo = pathname === item.rota || pathname.startsWith(`${item.rota}/`);

  return (
    <Link
      href={item.rota}
      aria-current={ativo ? "page" : undefined}
      className={`${CLASSES_ITEM} ${
        ativo
          ? "bg-[#DCF2F0] text-[#049598] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-[2px] before:bg-[#049598]"
          : "text-[#4B5563] hover:bg-[#F1F3F7]"
      }`}
    >
      {item.rotulo}
    </Link>
  );
}

/**
 * Item de seção ainda não portada. É inerte de propósito — e não um link para a
 * rota Flutter, como previa o plano original: foi medido que carregar
 * `/flutter-web` limpa o `firebaseLocalStorage` da origem, então um clique
 * desses deslogaria o usuário em silêncio.
 *
 * Fica focável com `aria-disabled` em vez de `disabled` para que quem navega
 * por teclado também descubra a seção e ouça que ela está indisponível; sem
 * handler, o clique não faz nada.
 */
function ItemInerte({ item }: { item: ItemDeNavegacao }) {
  return (
    <button
      type="button"
      aria-disabled="true"
      title={AVISO_LEGADO}
      className={`${CLASSES_ITEM} cursor-not-allowed text-[#9CA3AF]`}
    >
      {item.rotulo}
      <span aria-hidden="true" className="font-mono text-[10px] uppercase tracking-[0.9px]">
        legado
      </span>
      <span className="sr-only">{AVISO_LEGADO}</span>
    </button>
  );
}
