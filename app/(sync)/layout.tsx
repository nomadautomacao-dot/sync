"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { SyncHeader } from "@/core/components/sync-shell/header";
import { SyncSidebar } from "@/core/components/sync-shell/sidebar";
import { useAuth } from "@/core/providers/auth-provider";

interface SyncLayoutProps {
  children: ReactNode;
}

/**
 * Guarda de sessão do produto. A sessão do Firebase vive no IndexedDB, então
 * quem decide é o cliente — não há como o servidor barrar a rota.
 *
 * O redirect só pode acontecer depois que `loading` cai: no boot o provider
 * chama `getIdTokenResult(true)`, que vai à rede, e existe um intervalo real em
 * que `user` ainda é `null` com sessão válida. Redirecionar ali chutaria para
 * fora um usuário logado a cada F5.
 */
export default function SyncLayout({ children }: SyncLayoutProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/entrar");
  }, [loading, user, router]);

  // Também cobre o instante entre reconhecer a ausência de sessão e o redirect
  // acontecer: sem usuário, o shell nunca chega a renderizar.
  if (loading || !user) return <EsqueletoDoShell />;

  return (
    <div className="flex min-h-screen bg-[#EEF1F6] font-sans">
      <SyncSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <SyncHeader user={user} />
        <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
      </div>
    </div>
  );
}

function EsqueletoDoShell() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen animate-pulse bg-[#EEF1F6] font-sans"
    >
      <span className="sr-only">Carregando sua sessão…</span>
      <div className="w-[292px] shrink-0 border-r border-[#E2E8F0] bg-white" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-16 shrink-0 border-b border-[#E2E8F0] bg-white" />
        <div className="flex-1 px-8 py-7">
          <div className="h-7 w-52 rounded-[10px] bg-[#E2E8F0]" />
          <div className="mt-6 h-40 w-full rounded-[14px] border border-[#E2E8F0] bg-white" />
        </div>
      </div>
    </div>
  );
}
