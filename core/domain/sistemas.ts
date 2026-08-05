/**
 * Catálogo dos sistemas Global e as regras puras do console.
 *
 * O Sync é a casa: todos os produtos Global vivem no mesmo projeto Firebase
 * (`globalconsultorias`), cada um com o seu **banco nomeado** do Firestore. O
 * servidor do Sync já tem uma service account desse projeto, então alcança
 * qualquer um desses bancos direto — `getFirestore(app, databaseId)`. Não há
 * API entre produtos, nem troca de token: cadastrar um produto novo no console
 * é acrescentar uma entrada neste arquivo.
 *
 * O que cada entrada declara é o *dialeto* do produto: como ele chama a coleção
 * de clientes, quais campos usa no documento, e quais custom claims espera no
 * ID token. O console fala esse dialeto ao escrever, em vez de impor o dele.
 *
 * Este arquivo é puro — sem I/O, sem `firebase-admin`. Ele é importado tanto
 * pelo servidor quanto pelas telas, e por isso não pode arrastar segredo nem
 * SDK de servidor para o bundle do cliente.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Forma do catálogo
// ---------------------------------------------------------------------------

export interface PapelDoSistema {
  /** Valor gravado no documento e na claim. */
  id: string;
  rotulo: string;
  descricao: string;
  /**
   * Enxerga todos os clientes do sistema, não só o que está vinculado.
   * A tela avisa antes de conceder — é o papel que abre a rede inteira.
   */
  irrestrito?: boolean;
}

export interface StatusDaPrefeitura {
  id: string;
  rotulo: string;
  /** Cor do Ant (`Tag color`). Nunca hexadecimal — ver a skill de interface. */
  cor: "success" | "processing" | "warning" | "error" | "default";
}

/** Matrículas da rede **municipal** por etapa — a rede que o produto atende. */
export interface MatriculasPorEtapa {
  creche: number;
  preEscola: number;
  anosIniciais: number;
  anosFinais: number;
  eja: number;
  educacaoEspecial: number;
}

/**
 * Linha de base do Censo Escolar, gravada junto com a prefeitura.
 *
 * Serve para o produto medir a implantação contra a realidade declarada ao
 * INEP: "12 das 41 escolas cadastradas", "3.100 das 7.344 matrículas". Sem
 * isso, um sistema meio preenchido é indistinguível de um município pequeno.
 *
 * É uma **fotografia**, não um valor vivo: fica o ano do censo junto para que
 * ninguém confunda o número de 2025 com a rede de hoje.
 */
export interface ReferenciaCenso {
  ano: number;
  escolasMunicipais: number;
  escolasNoMunicipio: number;
  matriculasMunicipais: number;
  docentesMunicipais: number;
  porEtapa: MatriculasPorEtapa;
}

/** Nome dos campos no documento da prefeitura, no dialeto do produto. */
export interface CamposDaPrefeitura {
  nome: string;
  slug: string;
  uf: string;
  status: string;
  criadoEm: string;
  codigoIbge?: string;
  /**
   * Campos abaixo são opcionais no catálogo: um produto que não os declare
   * simplesmente não os recebe, e o cadastro segue funcionando.
   */
  regiao?: string;
  populacao?: string;
  prefeito?: string;
  partido?: string;
  referenciaCenso?: string;
  ideb?: string;
}

/** Nome dos campos no documento do usuário, no dialeto do produto. */
export interface CamposDoUsuario {
  email: string;
  nome: string;
  papel: string;
  /** Vínculo principal — uma prefeitura só. */
  prefeitura: string;
  /** Vínculos possíveis — array de slugs. */
  prefeituras: string;
  ativo: string;
  criadoEm: string;
}

/**
 * Nome das custom claims que o produto lê do ID token.
 *
 * O Storage e as security rules não consultam o Firestore: o vínculo com a
 * prefeitura precisa estar na claim, senão o usuário entra e não enxerga nada.
 */
export interface ClaimsDoSistema {
  papel: string;
  prefeitura: string;
  prefeituras: string;
}

export interface SistemaGlobal {
  id: string;
  nome: string;
  descricao: string;
  /**
   * Banco nomeado dentro do projeto `globalconsultorias`.
   * String vazia = banco `(default)`, que é onde o próprio Sync guarda os dados.
   */
  databaseId: string;
  colecaoPrefeituras: string;
  colecaoUsuarios: string;
  camposPrefeitura: CamposDaPrefeitura;
  camposUsuario: CamposDoUsuario;
  claims: ClaimsDoSistema;
  papeis: readonly PapelDoSistema[];
  statusPrefeitura: readonly StatusDaPrefeitura[];
  /** Papel atribuído ao primeiro usuário de uma prefeitura recém-criada. */
  papelPadrao: string;
  url?: string;
}

// ---------------------------------------------------------------------------
// O catálogo
// ---------------------------------------------------------------------------

const GLOBALEDU: SistemaGlobal = {
  id: "globaledu",
  nome: "GlobalEdu",
  descricao: "Gestão escolar multi-município — matrícula, avaliação, censo e vagas.",
  databaseId: "globaledu",
  colecaoPrefeituras: "tenants",
  colecaoUsuarios: "users",
  camposPrefeitura: {
    nome: "name",
    slug: "slug",
    uf: "uf",
    status: "status",
    criadoEm: "createdAt",
    codigoIbge: "ibgeCode",
    regiao: "regiao",
    populacao: "populacao",
    prefeito: "prefeito",
    partido: "partidoPrefeito",
    referenciaCenso: "referenciaCenso",
    ideb: "ideb",
  },
  camposUsuario: {
    email: "email",
    nome: "nome",
    papel: "role",
    prefeitura: "tenantId",
    prefeituras: "tenantIds",
    ativo: "ativo",
    criadoEm: "createdAt",
  },
  claims: { papel: "role", prefeitura: "tenantId", prefeituras: "tenantIds" },
  papeis: [
    {
      id: "global_admin",
      rotulo: "Administrador global",
      descricao: "Acesso total, em todas as prefeituras. É o papel da Global, não do cliente.",
      irrestrito: true,
    },
    {
      id: "consultor",
      rotulo: "Consultor",
      descricao: "Acompanha a implantação e enxerga a rede inteira do município.",
    },
    {
      id: "sec_educacao",
      rotulo: "Secretaria de Educação",
      descricao: "Gestão da rede municipal: escolas, matrículas, relatórios e censo.",
    },
    {
      id: "diretor",
      rotulo: "Diretor",
      descricao: "Gestão de uma escola: turmas, servidores e matrículas da unidade.",
    },
    {
      id: "secretario",
      rotulo: "Secretário escolar",
      descricao: "Rotina da secretaria da escola: matrícula, enturmação e documentos.",
    },
    {
      id: "professor",
      rotulo: "Professor",
      descricao: "Diário: lançamento de notas, faltas, pareceres e ocorrências.",
    },
    {
      id: "responsavel",
      rotulo: "Responsável",
      descricao: "Consulta do aluno pelo portal. Não acessa a gestão.",
    },
  ],
  statusPrefeitura: [
    { id: "ativo", rotulo: "Ativo", cor: "success" },
    { id: "trial", rotulo: "Avaliação", cor: "processing" },
    { id: "suspenso", rotulo: "Suspenso", cor: "error" },
  ],
  papelPadrao: "sec_educacao",
  url: "https://globaledu.app",
};

/**
 * Sistemas administráveis pelo console.
 *
 * Para acrescentar um produto: crie o banco nomeado no projeto
 * `globalconsultorias`, traduza o dialeto dele nos campos acima e some a
 * entrada aqui. As telas e as rotas passam a atendê-lo sem mais nenhuma
 * alteração. O contrato do lado do produto fica em `docs/PROVISIONAMENTO.md`
 * do repositório dele.
 */
export const CATALOGO_DE_SISTEMAS: readonly SistemaGlobal[] = [GLOBALEDU];

export function sistemaPorId(id: string): SistemaGlobal | null {
  return CATALOGO_DE_SISTEMAS.find((s) => s.id === id) ?? null;
}

// Estas duas recebem só a parte de que precisam, e não `SistemaGlobal` inteiro:
// assim servem tanto ao servidor quanto às telas, que só têm `SistemaParaTela`.
export function papelDoSistema(
  sistema: Pick<SistemaGlobal, "papeis">,
  papel: string,
): PapelDoSistema | null {
  return sistema.papeis.find((p) => p.id === papel) ?? null;
}

export function statusDaPrefeitura(
  sistema: Pick<SistemaGlobal, "statusPrefeitura">,
  status: string,
): StatusDaPrefeitura {
  return (
    sistema.statusPrefeitura.find((s) => s.id === status) ?? {
      id: status,
      rotulo: status || "—",
      cor: "default",
    }
  );
}

/**
 * O que a tela precisa saber do sistema.
 *
 * Os mapas de campo e de claim ficam de fora: são detalhe de como o servidor
 * grava, e a interface não tem o que fazer com eles. Menos superfície no bundle
 * do navegador, e o console continua sendo uma coisa só do servidor.
 */
export interface SistemaParaTela {
  id: string;
  nome: string;
  descricao: string;
  databaseId: string;
  url?: string;
  papeis: readonly PapelDoSistema[];
  statusPrefeitura: readonly StatusDaPrefeitura[];
  papelPadrao: string;
}

export function paraTela(sistema: SistemaGlobal): SistemaParaTela {
  return {
    id: sistema.id,
    nome: sistema.nome,
    descricao: sistema.descricao,
    databaseId: sistema.databaseId,
    url: sistema.url,
    papeis: sistema.papeis,
    statusPrefeitura: sistema.statusPrefeitura,
    papelPadrao: sistema.papelPadrao,
  };
}

// ---------------------------------------------------------------------------
// Forma normalizada que o console manipula
// ---------------------------------------------------------------------------

export interface PrefeituraDoConsole {
  id: string;
  nome: string;
  slug: string;
  uf: string;
  status: string;
  codigoIbge?: string;
  criadoEm?: string;
  regiao?: string;
  populacao?: number;
  prefeito?: string;
  partido?: string;
  referenciaCenso?: ReferenciaCenso;
  ideb?: { anosIniciais: number | null; anosFinais: number | null; ano: number };
}

export interface UsuarioDoConsole {
  /** UID do Firebase Auth — a mesma chave do documento no Firestore. */
  id: string;
  email: string;
  nome: string;
  papel: string;
  prefeitura?: string;
  prefeituras: string[];
  ativo: boolean;
  criadoEm?: string;
  /** Conta existe no Auth do projeto? Falso indica documento órfão. */
  temConta?: boolean;
  /** Claims do produto conferem com o documento? Ver `divergenciaDeClaims`. */
  claimsEmDia?: boolean;
}

// ---------------------------------------------------------------------------
// Tradução documento <-> forma normalizada
// ---------------------------------------------------------------------------

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function listaDeTextos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
}

/** Lê um campo opcional só quando o catálogo o declara. */
function opcional(campo: string | undefined, doc: Record<string, unknown>): unknown {
  return campo ? doc[campo] : undefined;
}

export function lerPrefeitura(
  sistema: SistemaGlobal,
  id: string,
  doc: Record<string, unknown>,
): PrefeituraDoConsole {
  const c = sistema.camposPrefeitura;
  const populacao = opcional(c.populacao, doc);
  const censo = opcional(c.referenciaCenso, doc);
  const ideb = opcional(c.ideb, doc);

  return {
    id,
    nome: texto(doc[c.nome]) || id,
    slug: texto(doc[c.slug]) || id,
    uf: texto(doc[c.uf]).toUpperCase(),
    status: texto(doc[c.status]) || "ativo",
    codigoIbge: texto(opcional(c.codigoIbge, doc)) || undefined,
    criadoEm: texto(doc[c.criadoEm]) || undefined,
    regiao: texto(opcional(c.regiao, doc)) || undefined,
    populacao: typeof populacao === "number" ? populacao : undefined,
    prefeito: texto(opcional(c.prefeito, doc)) || undefined,
    partido: texto(opcional(c.partido, doc)) || undefined,
    referenciaCenso: censo && typeof censo === "object" ? (censo as ReferenciaCenso) : undefined,
    ideb:
      ideb && typeof ideb === "object"
        ? (ideb as { anosIniciais: number | null; anosFinais: number | null; ano: number })
        : undefined,
  };
}

export function lerUsuario(
  sistema: SistemaGlobal,
  id: string,
  doc: Record<string, unknown>,
): UsuarioDoConsole {
  const c = sistema.camposUsuario;
  const principal = texto(doc[c.prefeitura]);
  const todas = listaDeTextos(doc[c.prefeituras]);
  return {
    id,
    email: texto(doc[c.email]),
    nome: texto(doc[c.nome]) || texto(doc[c.email]),
    papel: texto(doc[c.papel]),
    prefeitura: principal || undefined,
    // O vínculo principal sempre aparece na lista, mesmo que o documento antigo
    // só tenha um dos dois campos preenchidos.
    prefeituras: todas.length ? todas : principal ? [principal] : [],
    ativo: doc[c.ativo] !== false,
    criadoEm: texto(doc[c.criadoEm]) || undefined,
  };
}

export interface EntradaDaPrefeitura {
  nome: string;
  slug: string;
  uf: string;
  status: string;
  criadoEm?: string;
  codigoIbge?: string;
  regiao?: string;
  populacao?: number;
  prefeito?: string;
  partido?: string;
  referenciaCenso?: ReferenciaCenso;
  ideb?: { anosIniciais: number | null; anosFinais: number | null; ano: number };
}

export function documentoDaPrefeitura(
  sistema: SistemaGlobal,
  entrada: EntradaDaPrefeitura,
): Record<string, unknown> {
  const c = sistema.camposPrefeitura;
  const doc: Record<string, unknown> = {
    [c.nome]: entrada.nome,
    [c.slug]: entrada.slug,
    [c.uf]: entrada.uf.toUpperCase(),
    [c.status]: entrada.status,
  };
  if (entrada.criadoEm) doc[c.criadoEm] = entrada.criadoEm;

  // Cada opcional só entra se o catálogo declarar o campo E houver valor. O
  // Firestore recusa `undefined`, e um produto que não declarou o campo não
  // deve recebê-lo.
  const talvez = (campo: string | undefined, valor: unknown) => {
    if (campo && valor !== undefined && valor !== null && valor !== "") doc[campo] = valor;
  };
  talvez(c.codigoIbge, entrada.codigoIbge);
  talvez(c.regiao, entrada.regiao);
  talvez(c.populacao, entrada.populacao);
  talvez(c.prefeito, entrada.prefeito);
  talvez(c.partido, entrada.partido);
  talvez(c.referenciaCenso, entrada.referenciaCenso);
  talvez(c.ideb, entrada.ideb);

  return doc;
}

export function documentoDoUsuario(
  sistema: SistemaGlobal,
  entrada: {
    email: string;
    nome: string;
    papel: string;
    prefeitura: string;
    prefeituras?: string[];
    ativo?: boolean;
    criadoEm?: string;
  },
): Record<string, unknown> {
  const c = sistema.camposUsuario;
  const doc: Record<string, unknown> = {
    [c.email]: entrada.email,
    [c.nome]: entrada.nome,
    [c.papel]: entrada.papel,
    [c.prefeitura]: entrada.prefeitura,
    [c.prefeituras]: entrada.prefeituras?.length ? entrada.prefeituras : [entrada.prefeitura],
    [c.ativo]: entrada.ativo ?? true,
  };
  if (entrada.criadoEm) doc[c.criadoEm] = entrada.criadoEm;
  return doc;
}

// ---------------------------------------------------------------------------
// Custom claims — a parte que exige cuidado
// ---------------------------------------------------------------------------

/**
 * As claims que este sistema espera, para este usuário.
 *
 * Só as chaves do sistema: quem mescla com o que já existe é `mesclarClaims`.
 */
export function claimsDoSistema(
  sistema: SistemaGlobal,
  entrada: { papel: string; prefeitura: string; prefeituras?: string[] },
): Record<string, unknown> {
  return {
    [sistema.claims.papel]: entrada.papel,
    [sistema.claims.prefeitura]: entrada.prefeitura,
    [sistema.claims.prefeituras]: entrada.prefeituras?.length
      ? entrada.prefeituras
      : [entrada.prefeitura],
  };
}

/**
 * Junta as claims novas às que o usuário já tinha.
 *
 * **Por que isto existe.** `setCustomUserClaims` não mescla: ele *substitui* o
 * objeto inteiro. E o Firebase Auth é um só para o projeto — o mesmo pool de
 * contas serve o Sync e o GlobalEdu. Gravar as claims do GlobalEdu por cima,
 * sem ler as anteriores, apagaria `groupId`/`groupRole` e trancaria a pessoa
 * para fora do Sync no próximo login. Já aconteceria com a primeira conta que
 * fosse consultor e usuário de município ao mesmo tempo.
 *
 * Consequência para quem cadastrar um produto novo no catálogo: **as chaves de
 * claim não podem colidir entre sistemas.** Hoje não colidem — o Sync usa
 * `groupId`/`groupRole`, o GlobalEdu usa `role`/`tenantId`/`tenantIds`.
 */
export function mesclarClaims(
  existentes: Record<string, unknown> | undefined,
  novas: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(existentes ?? {}), ...novas };
}

/** Remove só as chaves deste sistema, preservando as dos demais produtos. */
export function removerClaims(
  sistema: SistemaGlobal,
  existentes: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const restante = { ...(existentes ?? {}) };
  delete restante[sistema.claims.papel];
  delete restante[sistema.claims.prefeitura];
  delete restante[sistema.claims.prefeituras];
  return restante;
}

/**
 * O documento e a claim dizem a mesma coisa?
 *
 * Divergência é a causa mais comum de "entrei mas não vejo nada": o documento
 * foi editado e a claim ficou para trás, ou a claim foi sobrescrita por outro
 * caminho. A tela mostra o aviso e oferece o reenvio.
 */
export function divergenciaDeClaims(
  sistema: SistemaGlobal,
  usuario: Pick<UsuarioDoConsole, "papel" | "prefeitura" | "prefeituras">,
  claims: Record<string, unknown> | undefined,
): boolean {
  const atuais = claims ?? {};
  if (texto(atuais[sistema.claims.papel]) !== usuario.papel) return true;
  if (texto(atuais[sistema.claims.prefeitura]) !== (usuario.prefeitura ?? "")) return true;
  const lista = listaDeTextos(atuais[sistema.claims.prefeituras]);
  if (lista.length !== usuario.prefeituras.length) return true;
  return usuario.prefeituras.some((p) => !lista.includes(p));
}

// ---------------------------------------------------------------------------
// Slug e validação
// ---------------------------------------------------------------------------

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

/**
 * Slug da prefeitura: é o ID do documento **e** o valor da claim.
 *
 * Por isso normaliza acento e cai para minúsculas com hífen — o mesmo valor
 * precisa sobreviver a uma URL, a um caminho do Storage e a uma comparação de
 * string dentro das security rules.
 */
export function slugDePrefeitura(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const slugSchema = z
  .string()
  .min(2, "O identificador precisa de ao menos 2 caracteres.")
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas minúsculas, números e hífen.");

/**
 * Opcional que entende campo de formulário em branco.
 *
 * Um `<input>` vazio chega como `""`, e `.optional()` do Zod só aceita a
 * ausência da chave — string vazia ele valida contra o schema e reprova. Para
 * um campo opcional, vazio **é** ausência.
 *
 * Sem isto, deixar o identificador em branco — que é o caso normal, já que ele
 * é gerado do nome — derrubava o cadastro inteiro com um 400 falando de um
 * campo que o usuário nem preencheu.
 */
function opcionalDeFormulario<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
    schema.optional(),
  );
}

const referenciaCensoSchema = z.object({
  ano: z.number().int().min(2000).max(2100),
  escolasMunicipais: z.number().int().min(0),
  escolasNoMunicipio: z.number().int().min(0),
  matriculasMunicipais: z.number().int().min(0),
  docentesMunicipais: z.number().int().min(0),
  porEtapa: z.object({
    creche: z.number().int().min(0),
    preEscola: z.number().int().min(0),
    anosIniciais: z.number().int().min(0),
    anosFinais: z.number().int().min(0),
    eja: z.number().int().min(0),
    educacaoEspecial: z.number().int().min(0),
  }),
});

const idebSchema = z.object({
  anosIniciais: z.number().min(0).max(10).nullable(),
  anosFinais: z.number().min(0).max(10).nullable(),
  ano: z.number().int().min(2000).max(2100),
});

const codigoIbgeSchema = z
  .string()
  .trim()
  .regex(/^\d{7}$/, "O código IBGE tem 7 dígitos.");

export const novaPrefeituraSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da prefeitura."),
  uf: z.enum(UFS),
  slug: opcionalDeFormulario(slugSchema),
  status: opcionalDeFormulario(z.string().trim().min(1)),
  codigoIbge: opcionalDeFormulario(codigoIbgeSchema),
  // Vindos do dossiê, preenchidos pela tela. Validados assim mesmo: o corpo da
  // requisição é entrada externa, mesmo tendo saído da nossa própria tela.
  regiao: opcionalDeFormulario(z.string().trim().max(60)),
  populacao: z.number().int().min(0).max(50_000_000).optional(),
  prefeito: opcionalDeFormulario(z.string().trim().max(120)),
  partido: opcionalDeFormulario(z.string().trim().max(40)),
  referenciaCenso: referenciaCensoSchema.optional(),
  ideb: idebSchema.optional(),
});

export const edicaoPrefeituraSchema = z.object({
  nome: opcionalDeFormulario(z.string().trim().min(2)),
  uf: opcionalDeFormulario(z.enum(UFS)),
  status: opcionalDeFormulario(z.string().trim().min(1)),
  codigoIbge: opcionalDeFormulario(codigoIbgeSchema),
});

export const novoUsuarioSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  nome: z.string().trim().min(2, "Informe o nome de quem vai usar o sistema."),
  papel: z.string().trim().min(1, "Escolha o papel."),
  prefeitura: slugSchema,
  prefeituras: z.array(slugSchema).optional(),
  /**
   * Opcional de propósito. Sem senha, a conta nova nasce sem credencial e a
   * pessoa define a dela pelo e-mail de redefinição — assim a senha nunca
   * transita por aqui nem fica no histórico de quem cadastrou.
   */
  senha: opcionalDeFormulario(z.string().min(8, "A senha precisa de ao menos 8 caracteres.")),
});

export const edicaoUsuarioSchema = z.object({
  nome: opcionalDeFormulario(z.string().trim().min(2)),
  papel: opcionalDeFormulario(z.string().trim().min(1)),
  prefeitura: opcionalDeFormulario(slugSchema),
  prefeituras: z.array(slugSchema).optional(),
  ativo: z.boolean().optional(),
});

export type NovaPrefeitura = z.infer<typeof novaPrefeituraSchema>;
export type EdicaoPrefeitura = z.infer<typeof edicaoPrefeituraSchema>;
export type NovoUsuario = z.infer<typeof novoUsuarioSchema>;
export type EdicaoUsuario = z.infer<typeof edicaoUsuarioSchema>;

/**
 * Papéis e status vêm do catálogo, não do schema: cada sistema tem os seus.
 * Devolve a mensagem de erro, ou `null` quando está tudo certo.
 */
export function validarContraCatalogo(
  sistema: SistemaGlobal,
  entrada: { papel?: string; status?: string },
): string | null {
  if (entrada.papel && !papelDoSistema(sistema, entrada.papel)) {
    return `O papel "${entrada.papel}" não existe no ${sistema.nome}.`;
  }
  if (entrada.status && !sistema.statusPrefeitura.some((s) => s.id === entrada.status)) {
    return `O status "${entrada.status}" não existe no ${sistema.nome}.`;
  }
  return null;
}
