import { getFundebReceitasOficiais, getFundebVaatContext } from "@/core/lib/fundeb-fnde";
import { getIbgeCidadeIndicators } from "@/core/lib/ibge-cidade-indicators";
import { getInepCensoMunicipalRecord } from "@/core/lib/inep-censo";
import { estimateFundebReceitas } from "@/core/lib/fundeb-estimate";
import { buildPerfilEProjecaoComercial } from "@/core/lib/fundeb-commercial";
import { getTsePrefeitoRecord } from "@/core/lib/tse-prefeitos";
import type { PropostaAutofillData } from "@/modules/propostas/types";
import {
  authorityPreset,
  getStateNameByUf,
  inferAuthorityGender,
} from "@/modules/propostas/utils/proposta-calculos";

interface IbgeMunicipioResponse {
  id: number;
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string;
      };
    };
  };
  ["regiao-imediata"]?: {
    ["regiao-intermediaria"]?: {
      UF?: {
        sigla?: string;
      };
    };
  };
}

export interface PropostaPrefillRequest {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
}

export interface PropostaPrefillMunicipioData {
  autofill: Omit<PropostaAutofillData, "publicValidation" | "publicValidationSource">;
  authorityName: string;
  authorityParty: string;
}

const MUNICIPIO_NOME_ALIASES: Record<string, string> = {
  "ALVORADA DO OESTE-RO": "Alvorada D'Oeste",
  "AMPARO DE SAO FRANCISCO-SE": "Amparo do Sao Francisco",
  "AREZ-RN": "Ares",
  "ASSU-RN": "Acu",
  "BARAO DE MONTE ALTO-MG": "Barao do Monte Alto",
  "BOA SAUDE-RN": "Januario Cicco",
  "DONA EUSEBIA-MG": "Dona Euzebia",
  "ELDORADO DOS CARAJAS-PA": "Eldorado do Carajas",
  "ESPIGAO DO OESTE-RO": "Espigao D'Oeste",
  "SANTA ISABEL DO PARA-PA": "Santa Izabel do Para",
  "SANTO ANTONIO DO LEVERGER-MT": "Santo Antonio de Leverger",
  "SAO LUIS DO PARAITINGA-SP": "Sao Luiz do Paraitinga",
  "SAO THOME DAS LETRAS-MG": "Sao Tome das Letras",
};

function normalizeMunicipioName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`´\-.,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getMunicipioUf(municipio: IbgeMunicipioResponse) {
  return (
    municipio.microrregiao?.mesorregiao?.UF?.sigla ??
    municipio["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ??
    ""
  );
}

function resolveMunicipioAlias(nome: string, uf?: string) {
  if (!uf) {
    return nome;
  }

  const key = `${normalizeMunicipioName(nome)}-${uf.trim().toUpperCase()}`;
  return MUNICIPIO_NOME_ALIASES[key] ?? nome;
}

async function fetchAllIbgeMunicipios(): Promise<IbgeMunicipioResponse[]> {
  const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios", {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel consultar a base do IBGE.");
  }

  return (await response.json()) as IbgeMunicipioResponse[];
}

async function findMunicipio(params: PropostaPrefillRequest) {
  if (params.codigo_ibge) {
    const digits = params.codigo_ibge.replace(/\D/g, "");
    if (digits.length === 7) {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${digits}`,
        { next: { revalidate: 60 * 60 * 12 } },
      );

      if (response.ok) {
        return (await response.json()) as IbgeMunicipioResponse;
      }
    }
  }

  if (params.nome && params.uf) {
    const municipios = await fetchAllIbgeMunicipios();
    const targetUf = params.uf.trim().toUpperCase();
    const resolvedNome = resolveMunicipioAlias(params.nome, targetUf);
    const candidates = new Set([
      normalizeMunicipioName(params.nome),
      normalizeMunicipioName(resolvedNome),
    ]);

    return (
      municipios.find((municipio) => {
        return (
          getMunicipioUf(municipio).toUpperCase() === targetUf &&
          candidates.has(normalizeMunicipioName(municipio.nome))
        );
      }) ?? null
    );
  }

  return null;
}

export async function buildPropostaPrefillMunicipioData(
  params: PropostaPrefillRequest,
): Promise<PropostaPrefillMunicipioData | null> {
  const exercicio = params.exercicio && params.exercicio > 2000 ? params.exercicio : new Date().getFullYear();
  const municipio = await findMunicipio(params);

  if (!municipio) {
    return null;
  }

  const codigoIbge = String(municipio.id);
  const municipioUf = getMunicipioUf(municipio);
  const [receitasOficiais, vaatContext, ibgeIndicators] = await Promise.all([
    getFundebReceitasOficiais(codigoIbge, exercicio).catch(() => null),
    getFundebVaatContext(codigoIbge, exercicio).catch(() => null),
    getIbgeCidadeIndicators(municipio.nome, municipioUf).catch(() => null),
  ]);

  const inepRecord = getInepCensoMunicipalRecord(codigoIbge);
  const receitasBase =
    receitasOficiais ??
    estimateFundebReceitas({
      codigoIBGE: codigoIbge,
      municipio: municipio.nome,
      uf: municipioUf,
      exercicio,
      ibgeIndicators,
      inepRecord,
      vaatContext,
    }) ?? {
      codigoIBGE: codigoIbge,
      municipio: municipio.nome,
      uf: municipioUf,
      fonte: "Modelo tecnico interno",
      receitaContribuicaoMunicipal: 0,
      complementacaoVAAF: 0,
      complementacaoVAAT: 0,
      complementacaoVAAR: 0,
      totalReceitas: 0,
    };

  const comercial = buildPerfilEProjecaoComercial({
    receitas: receitasBase,
    ibgeIndicators,
    inepRecord,
    vaatContext,
  });
  const tseRecord = getTsePrefeitoRecord(codigoIbge);
  const authorityName = tseRecord?.nomeCompleto || tseRecord?.prefeito || "";
  const authorityParty = tseRecord?.partido ?? "";
  const suggestedGender = inferAuthorityGender(authorityName);
  const authority = authorityPreset(suggestedGender ?? "masculino");

  return {
    authorityName,
    authorityParty,
    autofill: {
      codigoIbge,
      municipioNome: municipio.nome,
      municipioUf,
      estadoNome: getStateNameByUf(municipioUf),
      comarcaNome: municipio.nome,
      nomeAutoridade: authorityName,
      partidoAutoridade: authorityParty,
      generoAutoridadeSugerido: suggestedGender,
      generoAutoridadeFoiInferido: Boolean(suggestedGender),
      pronomeTratamento: authority.pronomeTratamento,
      tituloSocialAutoridade: authority.tituloSocialAutoridade,
      cargoAutoridade: authority.cargoAutoridade,
      saudacaoInicial: authority.saudacaoInicial,
      anoBase: exercicio,
      anoProjetado: exercicio + 1,
      receitaAtual: receitasBase.totalReceitas,
      receitaProjetada: comercial.projecao.totalProjetado,
      incrementoProjetado: comercial.projecao.totalGanho,
      fonteReceita: receitasBase.fonte,
      camposPendentes: ["cnpjMunicipio", "enderecoMunicipio", "cepMunicipio", "rgAutoridade", "cpfAutoridade"],
    },
  };
}
