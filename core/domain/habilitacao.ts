/**
 * A habilitação da Global — os documentos da **empresa**, não de município.
 *
 * Contrato social, CNDs, atestados de capacidade técnica e declarações são o
 * que prova que a Global pode contratar com a Administração. Eles entram em
 * todo kit de inexigibilidade, iguais para qualquer município — por isso não
 * vivem em `cityDocuments`, que exige uma cidade dona.
 *
 * A certidão é o motivo de existir deste módulo: ela **vence**. Antes disso
 * aqui, a habilitação era uma pasta de arquivos no computador de alguém, sem
 * data nenhuma — e certidão vencida dentro de processo administrativo é
 * inabilitação, descoberta pelo pregoeiro e não por nós.
 */

export type CategoriaHabilitacao =
  | "societario"
  | "certidoes"
  | "atestados"
  | "contratos_anteriores"
  | "notas_fiscais"
  | "documentos_socios"
  | "contabil"
  | "idoneidade"
  | "declaracoes";

export interface Categoria {
  key: CategoriaHabilitacao;
  /** Prefixo numérico: define a ordem das pastas dentro do ZIP do kit. */
  ordem: string;
  nome: string;
  descricao: string;
  /**
   * `true` quando o documento tem prazo de validade por natureza — certidão,
   * consulta de idoneidade. Nesses, data de validade é obrigatória: aceitar
   * uma CND sem data seria guardar o problema em vez do documento.
   */
  exigeValidade: boolean;
  /** O kit não deveria sair sem esta categoria preenchida. */
  essencial: boolean;
}

export const CATEGORIAS_HABILITACAO: Categoria[] = [
  {
    key: "societario",
    ordem: "01",
    nome: "Societário",
    descricao:
      "Contrato social e alterações, cartão CNPJ, alvará de funcionamento, consulta cadastral na Receita.",
    exigeValidade: false,
    essencial: true,
  },
  {
    key: "certidoes",
    ordem: "02",
    nome: "Certidões",
    descricao:
      "CND federal, estadual e municipal, FGTS, CNDT, falência e concordata, TCU, conselho profissional.",
    exigeValidade: true,
    essencial: true,
  },
  {
    key: "atestados",
    ordem: "03",
    nome: "Atestados de capacidade técnica",
    descricao: "Atestados emitidos pelas prefeituras já atendidas.",
    exigeValidade: false,
    essencial: true,
  },
  {
    key: "contratos_anteriores",
    ordem: "04",
    nome: "Contratos anteriores",
    descricao: "Contratos com outros municípios e respectivos aditivos.",
    exigeValidade: false,
    essencial: false,
  },
  {
    key: "notas_fiscais",
    ordem: "05",
    nome: "Notas fiscais",
    descricao: "Notas de serviços já prestados, como referência de execução.",
    exigeValidade: false,
    essencial: false,
  },
  {
    key: "documentos_socios",
    ordem: "06",
    nome: "Documentos dos sócios",
    descricao: "CNH ou RG e CPF do sócio-administrador; procuração, se houver.",
    exigeValidade: false,
    essencial: true,
  },
  {
    key: "contabil",
    ordem: "07",
    nome: "Contábil",
    descricao: "Livro diário, balanço patrimonial e DRE do último exercício.",
    exigeValidade: false,
    essencial: false,
  },
  {
    key: "idoneidade",
    ordem: "08",
    nome: "Idoneidade",
    descricao:
      "Consultas de improbidade (CNJ) e de inidôneos (TCU), da empresa e do sócio.",
    exigeValidade: true,
    essencial: true,
  },
  {
    key: "declaracoes",
    ordem: "09",
    nome: "Declarações",
    descricao:
      "Inexistência de fatos impeditivos e de que não emprega menores, assinadas.",
    exigeValidade: false,
    essencial: true,
  },
];

export function categoriaPorKey(key: CategoriaHabilitacao): Categoria {
  const encontrada = CATEGORIAS_HABILITACAO.find((c) => c.key === key);
  if (!encontrada) throw new Error(`Categoria de habilitação desconhecida: ${key}`);
  return encontrada;
}

export interface DocumentoDaHabilitacao {
  id: string;
  categoria: CategoriaHabilitacao;
  titulo: string;
  /** `YYYY-MM-DD`; ausente no documento que não vence. */
  validade?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
  observacao?: string;
  criadoEm?: string;
  criadoPorNome?: string;
}

export type SituacaoDoDocumento = "sem_validade" | "valido" | "vence_em_breve" | "vencido";

/** A partir daqui o documento entra no aviso: dá tempo de pedir a segunda via. */
export const DIAS_DE_ALERTA = 30;

export function hojeEmData(agora: Date): string {
  return agora.toISOString().slice(0, 10);
}

/**
 * Dias até vencer — negativo quando já venceu, `null` sem data de validade.
 * A comparação é por dia, não por instante: certidão vale o dia inteiro do
 * vencimento, e marcá-la vencida às 00h01 seria mentira que custa uma emissão.
 */
export function diasParaVencer(
  documento: Pick<DocumentoDaHabilitacao, "validade">,
  agora: Date,
): number | null {
  if (!documento.validade) return null;
  const fim = Date.parse(`${documento.validade}T00:00:00Z`);
  if (Number.isNaN(fim)) return null;
  const hoje = Date.parse(`${hojeEmData(agora)}T00:00:00Z`);
  return Math.round((fim - hoje) / 86_400_000);
}

export function situacaoDoDocumento(
  documento: Pick<DocumentoDaHabilitacao, "validade">,
  agora: Date,
): SituacaoDoDocumento {
  const dias = diasParaVencer(documento, agora);
  if (dias === null) return "sem_validade";
  if (dias < 0) return "vencido";
  return dias <= DIAS_DE_ALERTA ? "vence_em_breve" : "valido";
}

export const SITUACAO_LABELS: Record<SituacaoDoDocumento, string> = {
  sem_validade: "Sem validade",
  valido: "Válido",
  vence_em_breve: "Vence em breve",
  vencido: "Vencido",
};

export interface ResumoDaHabilitacao {
  total: number;
  vencidos: number;
  vencendo: number;
  /** Categorias essenciais ainda sem nenhum documento. */
  categoriasFaltando: Categoria[];
  /**
   * Pronta para montar kit: nenhuma essencial vazia e nenhum documento
   * vencido. Documento vencendo **não** trava — ainda vale hoje, e travar a
   * emissão por causa dele impediria o trabalho por um problema futuro.
   */
  pronta: boolean;
}

export function resumoDaHabilitacao(
  documentos: readonly DocumentoDaHabilitacao[],
  agora: Date,
): ResumoDaHabilitacao {
  const comDocumento = new Set(documentos.map((d) => d.categoria));
  const situacoes = documentos.map((d) => situacaoDoDocumento(d, agora));

  const categoriasFaltando = CATEGORIAS_HABILITACAO.filter(
    (categoria) => categoria.essencial && !comDocumento.has(categoria.key),
  );
  const vencidos = situacoes.filter((s) => s === "vencido").length;

  return {
    total: documentos.length,
    vencidos,
    vencendo: situacoes.filter((s) => s === "vence_em_breve").length,
    categoriasFaltando,
    pronta: categoriasFaltando.length === 0 && vencidos === 0,
  };
}

/**
 * O caminho do documento dentro do ZIP do kit: `Habilitacao/02 Certidões/…`.
 * O prefixo numérico da categoria é o que mantém a ordem das pastas igual à
 * do processo em papel — quem confere o kit segue a numeração.
 */
export function caminhoNoKit(documento: DocumentoDaHabilitacao): string {
  const categoria = categoriaPorKey(documento.categoria);
  return `Habilitacao/${categoria.ordem} ${categoria.nome}/${documento.fileName}`;
}
