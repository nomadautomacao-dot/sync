"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ItemDeNavegacao {
  rotulo: string;
  rota: string;
  /** Falso enquanto a tela ainda for só a marcação de "não migrada". */
  migrado: boolean;
}

/** Espelha o `AppSection` do app Flutter, na mesma ordem. */
const ITENS: readonly ItemDeNavegacao[] = [
  { rotulo: "Painel", rota: "/painel", migrado: true },
  { rotulo: "Caixa de entrada", rota: "/caixa", migrado: false },
  { rotulo: "Empresas", rota: "/empresas", migrado: false },
  { rotulo: "Pessoas", rota: "/pessoas", migrado: false },
  { rotulo: "Pipeline", rota: "/pipeline", migrado: false },
  { rotulo: "Módulos", rota: "/modulos", migrado: false },
  { rotulo: "Ajustes", rota: "/ajustes", migrado: false },
];

const CLASSES_ITEM =
  "relative flex h-11 w-full items-center justify-between gap-2 rounded-[10px] px-3 text-left text-[15px] font-semibold tracking-[-0.25px] transition-colors";

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
        <p className="px-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-[#9CA3AF]">
          Workspace
        </p>
        <ul className="flex flex-col gap-0.5">
          {ITENS.map((item) => {
            const ativo = pathname === item.rota || pathname.startsWith(`${item.rota}/`);

            return (
              <li key={item.rota}>
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
                  {!item.migrado && (
                    <>
                      <span
                        aria-hidden="true"
                        className="font-mono text-[10px] uppercase tracking-[0.9px] text-[#9CA3AF]"
                      >
                        em breve
                      </span>
                      <span className="sr-only">Seção ainda não migrada.</span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
