"use client";

/**
 * Andaime deliberado: existe para que `/painel` não caia no catch-all legado
 * (que redireciona ao Flutter) e a guarda de sessão possa ser observada.
 * A Task 7 substitui este corpo pelo dashboard real.
 */
export default function PainelPage() {
  return <h1 className="text-[23px] font-bold tracking-[-0.7px] text-[#111827]">Painel</h1>;
}
