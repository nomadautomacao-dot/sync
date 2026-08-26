/**
 * Quem pode ver e mexer em quê.
 *
 * ## Duas camadas, não uma
 *
 * `GroupRole` responde "que tipo de pessoa é esta no grupo" e continua sendo o
 * que viaja nas custom claims desde a migração para o Firebase. Ele sozinho é
 * grosso demais: dizer que alguém é `member` não diz se ela pode arrastar card
 * no pipeline ou só olhar.
 *
 * `Permissoes` é a camada fina: para cada área do sistema, um nível. O papel
 * define o ponto de partida; a permissão por área é o ajuste que o dono faz na
 * tela de Acessos.
 *
 * ## Por que área e não ação
 *
 * Permissão por ação ("emitir relatório", "excluir cidade") é mais expressiva
 * e envelhece pior: cada recurso novo exige lembrar de cadastrar a chave dele,
 * e a que ninguém cadastrou vira acesso liberado por omissão. Área × nível tem
 * um catálogo fechado que espelha a barra lateral — se aparece no menu, tem
 * regra.
 *
 * ## As duas travas que não se configuram
 *
 * 1. `owner` tem tudo, sempre. Sem isso o dono consegue se trancar para fora
 *    do próprio sistema, e não há de onde voltar: quem conserta permissão é a
 *    tela de Ajustes, que é justamente a que ele teria acabado de perder.
 * 2. Ninguém abaixo de `admin` edita Ajustes. Editar Ajustes é conceder
 *    acesso, e conceder acesso a si mesma é escalar privilégio — a permissão
 *    mais fina do mundo não adianta se a pessoa pode reescrevê-la.
 */

export type GroupRole = "owner" | "admin" | "member" | "viewer";

export const GROUP_ROLES: readonly GroupRole[] = [
  "owner",
  "admin",
  "member",
  "viewer",
];

export const GROUP_ROLE_LABELS: Record<GroupRole, string> = {
  owner: "Dona",
  admin: "Administradora",
  member: "Colaboradora",
  viewer: "Visitante",
};

const roleRank: Record<GroupRole, number> = {
  owner: 5,
  admin: 4,
  member: 2,
  viewer: 1,
};

export function papelAlcanca(papel: GroupRole, minimo: GroupRole): boolean {
  return roleRank[papel] >= roleRank[minimo];
}

/**
 * Papel mínimo para operar o console de sistemas (`/sistemas`).
 *
 * O console cria conta, concede papel e escreve no banco de outro produto pelo
 * Admin SDK, que ignora as security rules dele. É o poder mais alto que existe
 * neste projeto — por isso a régua fica em `admin`, e quem estiver abaixo não
 * passa nem na tela nem na rota.
 */
const PAPEL_MINIMO_NO_CONSOLE: GroupRole = "admin";

export function podeAdministrarSistemas(papel: GroupRole | undefined | null): boolean {
  if (!papel) return false;
  return papelAlcanca(papel, PAPEL_MINIMO_NO_CONSOLE);
}

/**
 * Só quem alcança `admin` abre a aba de Acessos e provisiona gente.
 *
 * Mesma régua de `podeAdministrarSistemas`, e nome próprio de propósito: são
 * poderes diferentes que hoje calham de exigir o mesmo papel. Fundir os dois
 * significaria que afrouxar um afrouxa o outro sem ninguém perceber — e um
 * deles escreve no banco de outro produto.
 */
export function podeAdministrarAcessos(papel: GroupRole): boolean {
  return papelAlcanca(papel, "admin");
}

// ── Áreas ────────────────────────────────────────────────────────────────

export type AreaKey =
  | "painel"
  | "caixa"
  | "cidades"
  | "pipeline"
  | "pessoas"
  | "documentos"
  | "modulos"
  | "sistemas"
  | "ajustes";

export interface Area {
  key: AreaKey;
  rotulo: string;
  rota: string;
  /** O que a pessoa passa a alcançar — texto da tela de Acessos. */
  descricao: string;
}

/**
 * O catálogo espelha `NAV_ITEMS` da barra lateral, na mesma ordem.
 *
 * Item de menu sem área correspondente seria acesso sem regra; área sem item
 * de menu seria regra que ninguém consegue exercer. Os dois andam juntos, e o
 * teste cobre a correspondência.
 */
export const AREAS: readonly Area[] = [
  {
    key: "painel",
    rotulo: "Painel",
    rota: "/painel",
    descricao: "Indicadores do grupo e resumo do mês.",
  },
  {
    key: "caixa",
    rotulo: "Caixa de entrada",
    rota: "/caixa",
    descricao: "Avisos, pendências e registro de auditoria.",
  },
  {
    key: "cidades",
    rotulo: "Cidades",
    rota: "/cidades",
    descricao: "Carteira de municípios, relatórios e documentos de cada um.",
  },
  {
    key: "pipeline",
    rotulo: "Pipeline",
    rota: "/pipeline",
    descricao: "Funil comercial por estágio, com valores e probabilidade.",
  },
  {
    key: "pessoas",
    rotulo: "Pessoas",
    rota: "/pessoas",
    descricao:
      "Colaboradoras e parceiras — inclui comissão, PIX e dados bancários.",
  },
  {
    key: "documentos",
    rotulo: "Documentos",
    rota: "/documentos",
    descricao: "Kit documental e arquivos anexados.",
  },
  {
    key: "modulos",
    rotulo: "Módulos",
    rota: "/modulos",
    descricao: "Geração de relatórios, dossiês, propostas e kits.",
  },
  {
    key: "sistemas",
    rotulo: "Sistemas",
    rota: "/sistemas",
    descricao:
      "Contas e prefeituras dos outros produtos Global — escreve no banco deles pelo Admin SDK.",
  },
  {
    key: "ajustes",
    rotulo: "Ajustes",
    rota: "/ajustes",
    descricao: "Configuração do workspace e concessão de acessos.",
  },
];

export const AREA_KEYS: readonly AreaKey[] = AREAS.map((area) => area.key);

export function areaPorKey(key: AreaKey): Area {
  const area = AREAS.find((item) => item.key === key);
  if (!area) throw new Error(`Área desconhecida: ${key}`);
  return area;
}

/**
 * A área que responde por um caminho.
 *
 * Compara pelo prefixo para que `/cidades/abc123` continue caindo em Cidades.
 * A comparação vai da rota mais longa para a mais curta — sem isso, uma rota
 * que fosse prefixo de outra roubaria o caminho da vizinha.
 */
export function areaDaRota(pathname: string): AreaKey | null {
  const candidatas = [...AREAS].sort((a, b) => b.rota.length - a.rota.length);
  const achada = candidatas.find(
    (area) => pathname === area.rota || pathname.startsWith(`${area.rota}/`),
  );
  return achada?.key ?? null;
}

// ── Níveis ───────────────────────────────────────────────────────────────

export type NivelAcesso = "nenhum" | "ver" | "editar";

export const NIVEIS: readonly NivelAcesso[] = ["nenhum", "ver", "editar"];

export const NIVEL_LABELS: Record<NivelAcesso, string> = {
  nenhum: "Sem acesso",
  ver: "Ver",
  editar: "Editar",
};

const nivelRank: Record<NivelAcesso, number> = {
  nenhum: 0,
  ver: 1,
  editar: 2,
};

export type Permissoes = Record<AreaKey, NivelAcesso>;

function mapaDeAreas(fn: (area: AreaKey) => NivelAcesso): Permissoes {
  return Object.fromEntries(
    AREA_KEYS.map((area) => [area, fn(area)]),
  ) as Permissoes;
}

/**
 * O ponto de partida de cada papel, antes de qualquer ajuste manual.
 *
 * `member` nasce operando o dia a dia e só olhando o que é cadastro de outra
 * gente: Pessoas guarda comissão, chave PIX e dados bancários — não é coisa que
 * se mexa sem querer.
 */
export function permissoesPadrao(papel: GroupRole): Permissoes {
  switch (papel) {
    case "owner":
    case "admin":
      return mapaDeAreas(() => "editar");
    case "member":
      return mapaDeAreas((area) => {
        if (area === "ajustes" || area === "sistemas") return "nenhum";
        if (area === "pessoas") return "ver";
        return "editar";
      });
    case "viewer":
      return mapaDeAreas((area) =>
        area === "ajustes" || area === "sistemas" ? "nenhum" : "ver",
      );
  }
}

/**
 * O que vale de verdade: o padrão do papel, com os ajustes por cima, e as duas
 * travas aplicadas por último para que nenhum ajuste consiga furá-las.
 */
export function permissoesEfetivas(
  papel: GroupRole,
  ajustes?: Partial<Permissoes> | null,
): Permissoes {
  if (papel === "owner") return mapaDeAreas(() => "editar");

  const base = permissoesPadrao(papel);
  const combinado = mapaDeAreas((area) => ajustes?.[area] ?? base[area]);

  if (!podeAdministrarAcessos(papel) && combinado.ajustes === "editar") {
    combinado.ajustes = "ver";
  }
  // Sistemas é mais duro que Ajustes: lá não há nível "ver" seguro. A tela
  // lista contas e prefeituras de outros produtos, e a rota que a alimenta
  // escreve no banco deles ignorando as security rules. Quem não administra
  // sistemas não chega nem a olhar.
  if (!podeAdministrarSistemas(papel)) {
    combinado.sistemas = "nenhum";
  }
  return combinado;
}

export function podeVer(permissoes: Permissoes, area: AreaKey): boolean {
  return nivelRank[permissoes[area]] >= nivelRank.ver;
}

export function podeEditar(permissoes: Permissoes, area: AreaKey): boolean {
  return nivelRank[permissoes[area]] >= nivelRank.editar;
}

/** As áreas que a pessoa enxerga, na ordem do catálogo. */
export function areasVisiveis(permissoes: Permissoes): Area[] {
  return AREAS.filter((area) => podeVer(permissoes, area.key));
}

// ── Ida e volta das custom claims ────────────────────────────────────────

/**
 * Nome da claim que carrega os ajustes. Só os desvios do padrão entram: claim
 * do Firebase tem teto de 1000 bytes por usuária, e gravar as nove áreas
 * quando oito delas são o padrão do papel é gastar o teto com redundância.
 */
export const CLAIM_PERMISSOES = "perm";

export function ajustesParaClaim(
  papel: GroupRole,
  permissoes: Permissoes,
): Partial<Permissoes> | null {
  const base = permissoesPadrao(papel);
  const desvios = AREA_KEYS.filter((area) => permissoes[area] !== base[area]);
  if (desvios.length === 0) return null;
  return Object.fromEntries(
    desvios.map((area) => [area, permissoes[area]]),
  ) as Partial<Permissoes>;
}

function ehNivel(valor: unknown): valor is NivelAcesso {
  return NIVEIS.includes(valor as NivelAcesso);
}

/** Lê a claim sem confiar nela: chave desconhecida e nível inválido caem fora. */
export function ajustesDaClaim(valor: unknown): Partial<Permissoes> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;

  const limpo: Partial<Permissoes> = {};
  for (const [chave, nivel] of Object.entries(valor as Record<string, unknown>)) {
    if (AREA_KEYS.includes(chave as AreaKey) && ehNivel(nivel)) {
      limpo[chave as AreaKey] = nivel;
    }
  }
  return Object.keys(limpo).length > 0 ? limpo : null;
}
