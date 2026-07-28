"use client";

import { useQuery } from "@tanstack/react-query";
import { GraduationCapIcon } from "lucide-react";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { listCities } from "@/core/lib/cities-firestore";
import { useAuth } from "@/core/providers/auth-provider";

import { ModuleCard, type DocumentoDoModulo } from "./_components/module-card";
import { RetomarStrip } from "./_components/retomar-strip";

interface ModuloDisponivel {
  href: string;
  icone: React.ElementType;
  nome: string;
  descricao: string;
  fontes: string;
  documentos: DocumentoDoModulo[];
}

/**
 * Só entram aqui os módulos que abrem de verdade.
 *
 * Os outros do `moduleCatalog` ou perderam a interface junto com o Flutter
 * (Contrato FUNDEB, Case de Sucesso, Propostas, Slides, Kit Documental) ou nunca
 * saíram de chave no catálogo (Terceirização, Formação, Atas, Tecnologia). Cada
 * um volta para esta lista quando ganhar tela — a grade já é de duas colunas.
 */
const MODULOS: ModuloDisponivel[] = [
  {
    href: "/modulos/levantamento-fundeb",
    icone: GraduationCapIcon,
    nome: "Levantamento FUNDEB",
    descricao:
      "Diagnóstico automático por código IBGE: repasses VAAF, VAAT e VAAR, projeção de ganho e o retrato completo do município.",
    fontes: "IBGE · FNDE · INEP · DATASUS · CAGED · CadÚnico · SICONFI · TSE",
    documentos: [
      { nome: "Raio-X Municipal", paginas: 18 },
      { nome: "Diagnóstico FUNDEB", paginas: 10 },
    ],
  },
];

export default function ModulosPage() {
  const { user } = useAuth();

  const { data: cidades = [], isLoading } = useQuery({
    queryKey: ["modulos-cities", user?.groupId],
    queryFn: async () => {
      if (!user?.groupId) return [];
      return await listCities(getFirebaseDb(), user.groupId);
    },
    enabled: !!user?.groupId,
  });

  return (
    <div className="flex flex-col gap-[14px] px-[4px] pt-[4px] pb-[14px]">
      <header>
        <h1 className="text-[21px] font-bold tracking-[-0.7px] text-[#16181D]">Módulos</h1>
        <p className="mt-[3px] text-[13px] text-[#767A86]">
          As ferramentas que produzem os documentos da consultoria, a partir das bases oficiais.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
        {MODULOS.map((modulo) => (
          <ModuleCard key={modulo.href} {...modulo} />
        ))}
      </div>

      {isLoading ? (
        <div
          role="status"
          aria-label="Carregando a carteira"
          className="h-[220px] animate-pulse rounded-[16px] border border-white/95 bg-white/60"
        />
      ) : (
        <RetomarStrip cidades={cidades} />
      )}
    </div>
  );
}
