/**
 * As iniciativas de uma cidade, no Firestore.
 *
 * Subcoleção de `cities/{cityId}`, pelo mesmo motivo de `eventos` e `etapas`:
 * "tudo desta cidade" vira uma leitura só, e a regra de segurança não precisa
 * de índice composto para separar município de município. O `groupId` viaja
 * dentro de cada documento porque a alternativa é a regra fazer `get()` no
 * documento da cidade a cada leitura — uma leitura cobrada por linha exibida.
 */

"use client";

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

import {
  etapaCumpridaAoEncerrar,
  novaIniciativa,
  type DefinicaoDeIniciativa,
  type EntradaDeIniciativa,
  type EstadoDaIniciativa,
  type IniciativaDaCidade,
  type TipoDeIniciativa,
} from "@/core/domain/cidade-iniciativas";
import { novoEvento, type Autor } from "@/core/domain/cidade-eventos";
import type { EtapaDoCronograma } from "@/core/domain/cronograma";

const CIDADES = "cities";
const INICIATIVAS = "iniciativas";
const EVENTOS = "eventos";
const ETAPAS = "etapas";

function caminhoDasIniciativas(db: Firestore, cityId: string) {
  return collection(db, CIDADES, cityId, INICIATIVAS);
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor : undefined;
}

export function iniciativaDoDoc(
  id: string,
  dados: Record<string, unknown>,
): IniciativaDaCidade {
  return {
    id,
    tipo: (texto(dados.tipo) ?? "projeto") as TipoDeIniciativa,
    nome: texto(dados.nome) ?? "(sem nome)",
    objetivo: texto(dados.objetivo),
    estado: (texto(dados.estado) ?? "em_andamento") as EstadoDaIniciativa,
    inicio: texto(dados.inicio) ?? "",
    fim: texto(dados.fim),
    responsavelId: texto(dados.responsavelId),
    responsavelNome: texto(dados.responsavelNome),
    etapaModeloKey: texto(dados.etapaModeloKey),
    cargaHoraria: typeof dados.cargaHoraria === "number" ? dados.cargaHoraria : undefined,
    formador: texto(dados.formador),
    autorUid: texto(dados.autorUid) ?? "",
    autorNome: texto(dados.autorNome) ?? "—",
    criadoEm: texto(dados.criadoEm) ?? "",
    atualizadoEm: texto(dados.atualizadoEm),
    concluidaEm: texto(dados.concluidaEm),
  };
}

export async function listIniciativas(
  db: Firestore,
  groupId: string,
  cityId: string,
): Promise<IniciativaDaCidade[]> {
  const consulta = query(
    caminhoDasIniciativas(db, cityId),
    where("groupId", "==", groupId),
    orderBy("inicio", "desc"),
  );
  const snap = await getDocs(consulta);
  return snap.docs.map((d) => iniciativaDoDoc(d.id, d.data()));
}

/**
 * Abre a iniciativa, carimba a cidade e anuncia na linha do tempo — num lote.
 *
 * As três coisas andam juntas por razões distintas, e nenhuma delas é
 * cosmética:
 *
 * - **`lastActivityAt`** é o que a carteira mostra na coluna "última
 *   atividade". Sem o carimbo, um município com capacitação recém-aberta
 *   apareceria como parado há três semanas — a coluna mentiria justamente
 *   sobre a cidade em que a equipe acabou de começar a trabalhar.
 * - **O evento** existe porque a linha do tempo é onde a equipe olha para saber
 *   o que andou. Abrir um projeto e não aparecer lá seria o acontecimento mais
 *   importante da semana faltando, sem nada indicando a falta.
 *
 * O evento nasce já com `iniciativaId`: ele é o primeiro registro do fio, e
 * filtrar pela iniciativa tem que trazer a própria abertura dela.
 */
export async function criarIniciativa(
  db: Firestore,
  groupId: string,
  cityId: string,
  entrada: EntradaDeIniciativa,
  autor: Autor,
  /* O catálogo entra porque é ele que diz se o tipo comporta carga horária —
     e um tipo criado pela equipe ("Formação continuada") pode comportar. Sem
     passá-lo, o domínio olharia só os quatro do sistema e descartaria a carga
     horária que a pessoa acabou de digitar. */
  catalogo?: readonly DefinicaoDeIniciativa[],
): Promise<IniciativaDaCidade> {
  const agora = new Date();
  const documento = { ...novaIniciativa(entrada, autor, agora, catalogo), groupId };
  const ref = doc(caminhoDasIniciativas(db, cityId));

  const lote = writeBatch(db);
  lote.set(ref, documento);
  lote.update(doc(db, CIDADES, cityId), { lastActivityAt: documento.criadoEm });

  const evento = novoEvento(
    {
      tipo: "iniciativa",
      titulo: `Aberto: ${documento.nome}`,
      quando: agora.toISOString(),
      relato: documento.objetivo,
      iniciativaId: ref.id,
    },
    autor,
    agora,
  );
  lote.set(doc(collection(db, CIDADES, cityId, EVENTOS)), { ...evento, groupId });

  await lote.commit();
  return { id: ref.id, ...documento };
}

/** O que uma edição pode tocar. Autoria e criação não estão aqui. */
export interface EdicaoDeIniciativa {
  nome?: string;
  objetivo?: string | null;
  inicio?: string;
  fim?: string | null;
  responsavelId?: string | null;
  responsavelNome?: string | null;
  etapaModeloKey?: string | null;
  cargaHoraria?: number | null;
  formador?: string | null;
}

/**
 * `null` apaga o campo; `undefined` não o toca.
 *
 * A distinção é a mesma de `corpoDaEdicao` em `collaborators-firestore.ts`:
 * sem ela, limpar a carga horária de uma capacitação seria impossível — o
 * campo vazio chegaria como `undefined` e o Firestore o ignoraria, deixando o
 * valor antigo de pé com o formulário mostrando vazio.
 */
export async function atualizarIniciativa(
  db: Firestore,
  cityId: string,
  iniciativaId: string,
  edicao: EdicaoDeIniciativa,
): Promise<void> {
  const corpo: Record<string, unknown> = { atualizadoEm: new Date().toISOString() };
  for (const [chave, valor] of Object.entries(edicao)) {
    if (valor !== undefined) corpo[chave] = valor;
  }

  const lote = writeBatch(db);
  lote.update(doc(db, CIDADES, cityId, INICIATIVAS, iniciativaId), corpo);
  await lote.commit();
}

/**
 * Encerra a iniciativa: estado, evento na linha do tempo e — se ela apontar
 * para uma etapa do modelo — a conclusão dessa etapa, tudo no mesmo lote.
 *
 * O elo com o cronograma é o ponto desta função. `MODELO_DE_IMPLANTACAO` já traz
 * `capacitacao` no dia 90; sem concluir a etapa junto, a mesma ficha mostraria
 * a capacitação concluída em Projetos e a etapa pendente em Cronograma — duas
 * telas do mesmo município se contradizendo, que é pior que não ter nenhuma.
 *
 * Quem decide se há etapa a cumprir é `etapaCumpridaAoEncerrar`, que é pura e
 * testada: cancelar não cumpre etapa nenhuma, porque cancelar é decisão de não
 * fazer e marcar a etapa seria registrar entrega que não houve.
 */
export async function encerrarIniciativa(
  db: Firestore,
  groupId: string,
  cityId: string,
  iniciativa: IniciativaDaCidade,
  estadoNovo: Extract<EstadoDaIniciativa, "concluida" | "cancelada">,
  autor: Autor,
  etapas: readonly EtapaDoCronograma[],
): Promise<void> {
  const agora = new Date();
  const lote = writeBatch(db);

  lote.update(doc(db, CIDADES, cityId, INICIATIVAS, iniciativa.id), {
    estado: estadoNovo,
    ...(estadoNovo === "concluida" ? { concluidaEm: agora.toISOString() } : {}),
    atualizadoEm: agora.toISOString(),
  });

  const evento = novoEvento(
    {
      tipo: "iniciativa",
      titulo:
        estadoNovo === "concluida"
          ? `Concluído: ${iniciativa.nome}`
          : `Cancelado: ${iniciativa.nome}`,
      quando: agora.toISOString(),
      iniciativaId: iniciativa.id,
    },
    autor,
    agora,
  );
  lote.set(doc(collection(db, CIDADES, cityId, EVENTOS)), { ...evento, groupId });

  const etapaKey = etapaCumpridaAoEncerrar(iniciativa, estadoNovo);
  const etapa = etapaKey
    ? etapas.find((e) => e.modeloKey === etapaKey && e.estado !== "concluida")
    : undefined;
  if (etapa) {
    lote.update(doc(db, CIDADES, cityId, ETAPAS, etapa.id), {
      estado: "concluida",
      concluidaEm: agora.toISOString(),
      concluidaPor: autor.nome,
      atualizadoEm: agora.toISOString(),
    });
  }

  lote.update(doc(db, CIDADES, cityId), { lastActivityAt: agora.toISOString() });
  await lote.commit();
}
