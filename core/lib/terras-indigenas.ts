import terrasBruto from "@/data/funai/terras-indigenas.json";

import { distanciaKm } from "@/core/lib/densidade-rede";
import { getEscolasTerritorio, type EscolaTerritorio } from "@/core/lib/escolas-territorio";

/**
 * Aldeias e terras indígenas por município — FUNAI, cruzadas com a rede.
 *
 * ## O elo que faltava
 *
 * A página "Declaração étnica" já percorria três elos: população indígena
 * (IBGE) → matrícula com cor/raça declarada (Censo Escolar) → matrícula no
 * segmento indígena do FUNDEB. Todos os três dependem de **autodeclaração**,
 * na coleta do Censo ou na do Censo Demográfico. Este é o quarto elo, e o
 * único que não depende: a FUNAI **cadastra** onde há aldeia.
 *
 * Isso muda a conversa de campo. "Há população indígena no município?" é uma
 * pergunta que o gestor responde de memória. "A FUNAI registra três aldeias
 * aqui e o Censo não declara nenhuma escola em terra indígena — qual é a
 * situação?" é uma conferência, e o segmento indígena pondera de 1,40 a 2,17,
 * o teto da tabela do FUNDEB.
 *
 * ## O que este módulo não afirma
 *
 * Aldeia sem escola municipal declarada **não é irregularidade**. A escola
 * pode ser estadual, as crianças podem estudar fora da aldeia, a aldeia pode
 * ter poucos moradores em idade escolar. O módulo mede a distância e nomeia o
 * caso; quem responde é o município.
 *
 * A ponderação do FUNDEB também não segue a cor/raça do aluno — segue a
 * **classificação da escola** no Censo. Por isso o que importa aqui é
 * `TP_LOCALIZACAO_DIFERENCIADA = 2` (terra indígena), e não a coluna de
 * cor/raça.
 */

/** Código da localização diferenciada "terra indígena" no dicionário do INEP. */
const DIF_TERRA_INDIGENA = 2;

/**
 * Raio a partir do qual uma aldeia é considerada "sem escola da rede por
 * perto". Não é norma — é a distância a partir da qual o deslocamento diário
 * de uma criança deixa de ser caminhada e vira transporte escolar, que é uma
 * despesa que o valor-aluno não cobre.
 */
const RAIO_PROXIMIDADE_KM = 10;

interface AldeiaBruta {
  nome: string;
  ti: string;
  lat?: number;
  lng?: number;
}

interface TerraBruta {
  nome: string;
  etnia: string;
  uf: string;
  fase: string;
  modalidade: string;
  hectares: number | null;
  fronteira: boolean;
}

interface ArquivoTerras {
  fonte?: string;
  geradoEm?: string;
  terras?: Record<string, TerraBruta>;
  municipios?: Record<string, { aldeias?: AldeiaBruta[] }>;
}

export interface Aldeia {
  nome: string;
  terra: TerraIndigena | null;
  lat: number | null;
  lng: number | null;
  /** Distância à escola municipal mais próxima, em km. */
  kmAteEscola: number | null;
  /** Distância à escola municipal **declarada em terra indígena**, em km. */
  kmAteEscolaIndigena: number | null;
}

export interface TerraIndigena {
  codigo: string;
  nome: string;
  etnia: string;
  uf: string;
  /** Regularizada, Homologada, Declarada, Delimitada, Em estudo… */
  fase: string;
  modalidade: string;
  hectares: number | null;
  fronteira: boolean;
}

export interface TerrasIndigenasMunicipio {
  fonte: string;
  aldeias: Aldeia[];
  terras: TerraIndigena[];
  /** Escolas municipais declaradas em terra indígena no Censo. */
  escolasIndigenas: number;
  matriculasEscolasIndigenas: number | null;
  /** Aldeias sem nenhuma escola municipal indígena dentro do raio. */
  aldeiasSemEscolaIndigena: number;
  /** Aldeias sem nenhuma escola municipal, indígena ou não, dentro do raio. */
  aldeiasSemEscolaAlguma: number;
  raioKm: number;
  /**
   * O caso que vale a conferência: a FUNAI registra aldeia e o Censo não
   * declara nenhuma escola municipal em terra indígena.
   */
  registroSemDeclaracao: boolean;
  /** Quantas aldeias entraram no cálculo de distância. */
  aldeiasComCoordenada: number;
}

const arquivo = terrasBruto as ArquivoTerras;

function lerTerra(codigo: string): TerraIndigena | null {
  const bruta = arquivo.terras?.[codigo];
  if (!bruta) return null;
  return {
    codigo,
    nome: bruta.nome ?? "",
    etnia: bruta.etnia ?? "",
    uf: bruta.uf ?? "",
    fase: bruta.fase ?? "",
    modalidade: bruta.modalidade ?? "",
    hectares: typeof bruta.hectares === "number" ? bruta.hectares : null,
    fronteira: Boolean(bruta.fronteira),
  };
}

/** Menor distância da aldeia a um conjunto de escolas com coordenada. */
function maisProxima(
  aldeia: AldeiaBruta,
  escolas: EscolaTerritorio[],
): number | null {
  if (aldeia.lat === undefined || aldeia.lng === undefined) return null;
  let menor: number | null = null;
  for (const escola of escolas) {
    if (escola.lat === null || escola.lng === null) continue;
    const km = distanciaKm(aldeia.lat, aldeia.lng, escola.lat, escola.lng);
    if (menor === null || km < menor) menor = km;
  }
  return menor === null ? null : Math.round(menor * 10) / 10;
}

export function getTerrasIndigenas(codigoIBGE: string): TerrasIndigenasMunicipio | null {
  const digits = String(codigoIBGE ?? "").replace(/\D/g, "");
  const registro = arquivo.municipios?.[digits];
  const brutas = registro?.aldeias ?? [];
  if (brutas.length === 0) return null;

  const territorio = getEscolasTerritorio(digits);
  const escolas = territorio?.escolas ?? [];
  const indigenas = escolas.filter((e) => e.dif === DIF_TERRA_INDIGENA);

  const aldeias: Aldeia[] = brutas.map((a) => ({
    nome: a.nome,
    terra: lerTerra(a.ti),
    lat: a.lat ?? null,
    lng: a.lng ?? null,
    kmAteEscola: maisProxima(a, escolas),
    kmAteEscolaIndigena: maisProxima(a, indigenas),
  }));

  // Uma terra pode ter várias aldeias no mesmo município; a lista de terras é
  // o conjunto, na ordem em que aparecem.
  const vistas = new Set<string>();
  const terras: TerraIndigena[] = [];
  for (const aldeia of aldeias) {
    if (!aldeia.terra || vistas.has(aldeia.terra.codigo)) continue;
    vistas.add(aldeia.terra.codigo);
    terras.push(aldeia.terra);
  }

  const comCoordenada = aldeias.filter((a) => a.lat !== null && a.lng !== null);
  const forade = (km: number | null) => km === null || km > RAIO_PROXIMIDADE_KM;

  const matriculas = indigenas.reduce<number | null>((total, e) => {
    if (e.matriculas === null) return total;
    return (total ?? 0) + e.matriculas;
  }, null);

  return {
    fonte: arquivo.fonte ?? "FUNAI — GeoServer WFS",
    aldeias,
    terras,
    escolasIndigenas: indigenas.length,
    matriculasEscolasIndigenas: matriculas,
    aldeiasSemEscolaIndigena: comCoordenada.filter((a) => forade(a.kmAteEscolaIndigena)).length,
    aldeiasSemEscolaAlguma: comCoordenada.filter((a) => forade(a.kmAteEscola)).length,
    raioKm: RAIO_PROXIMIDADE_KM,
    registroSemDeclaracao: aldeias.length > 0 && indigenas.length === 0,
    aldeiasComCoordenada: comCoordenada.length,
  };
}
