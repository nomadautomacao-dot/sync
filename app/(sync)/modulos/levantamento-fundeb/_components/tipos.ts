/**
 * Forma da resposta de `/api/modulos/levantamento-fundeb/[codigoIbge]`.
 *
 * A rota devolve o payload do GovIA sem schema de saída, então este arquivo é a
 * leitura que a bancada faz dele. Tudo é opcional de propósito: município sem
 * portaria publicada volta com blocos inteiros ausentes, e a tela precisa
 * atravessar isso sem quebrar.
 */

export interface IdentificacaoMunicipio {
  municipio?: string;
  municipioNome?: string;
  uf?: string;
  codigoIBGE?: string;
  prefeito?: string;
  partido?: string;
  exercicio?: number;
  mesorregiao?: string;
  regiao?: string;
}

export interface ProjecaoFundeb {
  vaafAtual?: number;
  vaafProjetado?: number;
  vaafGanho?: number;
  vaatAtual?: number;
  vaatProjetado?: number;
  vaatGanho?: number;
  vaarAtual?: number;
  vaarProjetado?: number;
  vaarGanho?: number;
  totalAtual?: number;
  totalProjetado?: number;
  totalGanho?: number;
  ganhoPercentual?: number;
  metodologia?: string;
  multiplicadorAplicado?: number;
  ressalva?: string;
}

export interface CensoEscolar {
  totalMatriculas?: number;
  totalEscolas?: number;
  matriculasEtapa?: {
    educacaoInfantil?: number;
    ensinoFundamental?: number;
  };
}

export interface PerfilComercial {
  faixa?: string;
  score?: number;
}

export interface RelatorioFundeb {
  identificacao?: IdentificacaoMunicipio;
  receitas?: {
    totalReceitas?: number;
    receitaContribuicaoMunicipal?: number;
    complementacaoVAAF?: number;
    complementacaoVAAT?: number;
    complementacaoVAAR?: number;
  };
  projecao?: ProjecaoFundeb;
  projecaoRecuperavel?: ProjecaoFundeb;
  censoEscolar?: CensoEscolar;
  perfilComercial?: PerfilComercial;
}

export interface RespostaLevantamento {
  relatorio?: RelatorioFundeb;
  payload?: Record<string, unknown>;
  municipio?: Record<string, unknown>;
  oportunidades?: unknown[];
}
