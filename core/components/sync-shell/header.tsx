"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientUser } from "@/core/lib/client-session";
import { useAuth } from "@/core/providers/auth-provider";

const ROTULOS_DE_PAPEL: Record<ClientUser["groupRole"], string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  viewer: "Visualizador",
};

interface SyncHeaderProps {
  user: ClientUser;
}

export function SyncHeader({ user }: SyncHeaderProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [saindo, setSaindo] = useState(false);

  const aoSair = async () => {
    setSaindo(true);
    try {
      await signOut();
      router.replace("/entrar");
    } catch (erro) {
      setSaindo(false);
      toast.error(erro instanceof Error ? erro.message : "Não foi possível sair.");
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-5 border-b border-line bg-white px-8">
      <div className="flex min-w-0 flex-col items-end">
        <span className="truncate text-[14px] font-semibold text-title">{user.name}</span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.9px] text-muted">
          {ROTULOS_DE_PAPEL[user.groupRole]}
        </span>
      </div>

      <button
        type="button"
        onClick={aoSair}
        disabled={saindo}
        aria-busy={saindo}
        className="h-10 shrink-0 rounded-[10px] border border-line-strong px-4 text-[14px] font-semibold tracking-[-0.1px] text-body transition-colors hover:border-line-stronger hover:bg-surface-alt disabled:cursor-not-allowed disabled:text-dim"
      >
        {saindo ? "Saindo…" : "Sair"}
      </button>
    </header>
  );
}
