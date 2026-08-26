/**
 * A Proposta Comercial para contratação direta por dispensa de licitação
 * (Art. 75 da Lei 14.133/21) — a peça que fecha cliente.
 *
 * O conteúdo vem do modelo do dono (2026-08-14), com os erros de digitação
 * corrigidos ("viodeoconferência", "Prestação ser serviços", espaços comidos)
 * e a grafia atualizada ("frequência" sem trema). A estrutura é a mesma:
 * objeto, seis itens de serviço, prazo, preço, condições e assinatura.
 *
 * É via diferente do kit de inexigibilidade (Art. 74): a dispensa é o
 * instrumento simples, e o escopo aqui é a educação inteira — sistemas,
 * treinamento e assessoria aos programas MEC/FNDE — não só FUNDEB.
 */

import { viaPorKey, type ViaDeContratacao } from "@/core/domain/contratacao-direta";

export interface ItemDeServico {
  titulo: string;
  /** Linhas de detalhe; vazio quando o título já diz tudo. */
  detalhes: string[];
}

export const SERVICOS_PADRAO: ItemDeServico[] = [
  {
    titulo: "i-Educar",
    detalhes: [
      "Matrículas",
      "Histórico escolar e declarações",
      "Boletins",
      "Alocação de professores",
      "Lançamentos de notas e frequência",
      "Relatórios gerenciais",
      "Módulo para emissão do Censo Escolar",
    ],
  },
  {
    titulo: "Diário Eletrônico",
    detalhes: [
      "Diário de classe",
      "Registro de plano de aula",
      "Adaptado à BNCC",
    ],
  },
  {
    titulo: "Plataforma de suporte a aulas online",
    detalhes: [
      "Comunicação entre professores e alunos",
      "Envio de atividades com conteúdo audiovisual",
      "Integração com plataforma de videoconferência",
      "Acesso facilitado, sem necessidade de e-mail",
    ],
  },
  {
    titulo: "Treinamento presencial",
    detalhes: [
      "Para todos os usuários, com carga horária mínima de 20 h/aula por turma, incluso certificado de participação",
    ],
  },
  {
    titulo:
      "Assessoria e consultoria na Secretaria Municipal de Educação — programas e sistemas vinculados ao FNDE e ao MEC",
    detalhes: [
      "Programas vinculados ao MEC: PDDE Interativo; PDE Escola; PDE Mais Educação; PDDE Web; Educação no Campo; ProEMI; Atleta na Escola; Formação Continuada",
      "Programas vinculados ao FNDE: Bolsas e Auxílios; Brasil Carinhoso; Formação pela Escola; PAR; PBLE; PNAE; PNATE; PDDE; Programas do Livro; Proinfância; Proinfo; Programas Suplementares; CACS-FUNDEB",
    ],
  },
  {
    titulo: "Eixos de atuação junto à Secretaria de Educação",
    detalhes: [
      "Unidades Executoras (UEx): regularização e atualização cadastral do CNPJ na Receita Federal; atualização de Imposto de Renda e levantamento de dívida ativa; levantamento da declaração de RAIS; atualização do PDDEweb; elaboração e atualização de portaria e ofício do Comitê Estratégico PDDE; elaboração do Plano de Ação do PDDE e suas ações agregadas; adesão e manutenção das ações agregadas; monitoramento do PDDE Interativo; sínteses e diagnósticos financeiro-pedagógicos; monitoramento dos IdeGES",
      "CACS-FUNDEB: acompanhamento das prestações de contas do controle social; verificação dos pareceres conclusivos e envio ao Tribunal de Contas; cadastro de novos conselheiros; apoio à elaboração de portarias e normativas",
      "SIOPE: monitoramento da transmissão dos dados da execução físico-financeira do FUNDEB",
      "MAVS: cadastro do presidente e vice-presidente da Câmara do FUNDEB e habilitação do sistema; acompanhamento de validação do RREO",
      "SIGPC: elaboração e envio das prestações de contas dos recursos do FNDE (PNAE, PNATE, Caminho da Escola, PAR); análise de processos de pagamento; acompanhamento das análises finais; remoção de pendências de mandatos anteriores que inviabilizem recebimentos",
      "Governo Estadual: prestações de contas do programa estadual do transporte escolar; adesão aos termos de pactuação da municipalização de escolas estaduais; prestação de contas dos recursos da municipalização; acompanhamento dos pareceres conclusivos; recálculos de alunos para adequação aos valores do PETE",
    ],
  },
];

export interface PropostaDispensa {
  municipioNome: string;
  municipioUf: string;
  /**
   * A via do processo. O arquivo se chama `proposta-dispensa` porque nasceu do
   * modelo de dispensa do dono, mas a peça serve às duas vias — e afirmar
   * "dispensa" dentro de um processo de inexigibilidade seria a proposta
   * contradizendo a capa do próprio processo.
   */
  via?: ViaDeContratacao;
  prazoMeses: number;
  valorMensalCents: number;
  /** `YYYY-MM-DD` da emissão — vira "14 de agosto de 2026" no papel. */
  emitidaEm: string;
  itens: ItemDeServico[];
}

export const VALIDADE_DA_PROPOSTA = "60 (sessenta) dias";

/** A frase de abertura, com a via e o artigo corretos. */
export function aberturaDaProposta(via: ViaDeContratacao = "dispensa"): string {
  const escolhida = viaPorKey(via);
  return (
    `Apresentamos a presente proposta para contratação direta por ` +
    `${escolhida.nome.toLocaleLowerCase("pt-BR")}, nos termos do ` +
    `${escolhida.artigo}, visando à prestação dos serviços descritos a seguir.`
  );
}

export function valorGlobalCents(proposta: {
  valorMensalCents: number;
  prazoMeses: number;
}): number {
  return proposta.valorMensalCents * proposta.prazoMeses;
}

export function formatarReais(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-08-14" → "14 de agosto de 2026". Data inválida vira erro, não lixo. */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || mes > 12 || !dia || dia > 31) {
    throw new Error(`Data inválida para a proposta: ${iso}`);
  }
  return `${dia} de ${MESES_PT[mes - 1]} de ${ano}`;
}

/** "3" → "3 (três) meses" para os prazos usuais; fora da tabela, só o número. */
export function prazoPorExtenso(meses: number): string {
  const nomes: Record<number, string> = {
    1: "um",
    2: "dois",
    3: "três",
    4: "quatro",
    5: "cinco",
    6: "seis",
    7: "sete",
    8: "oito",
    9: "nove",
    10: "dez",
    11: "onze",
    12: "doze",
    24: "vinte e quatro",
    36: "trinta e seis",
    48: "quarenta e oito",
    60: "sessenta",
  };
  const unidade = meses === 1 ? "mês" : "meses";
  const nome = nomes[meses];
  return nome ? `${meses} (${nome}) ${unidade}` : `${meses} ${unidade}`;
}
