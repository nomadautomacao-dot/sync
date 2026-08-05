/**
 * O braço do console: fala com o Auth do projeto e com o banco de cada produto.
 *
 * **Só servidor.** Usa o Admin SDK, que ignora as security rules do produto —
 * é justamente por isso que o console existe aqui e não numa SPA. Importar
 * este arquivo de um componente de cliente quebra o build, e é para quebrar.
 *
 * Dois recursos compartilhados exigem cuidado e concentram quase todo o
 * comentário deste arquivo:
 *
 * 1. **O Auth é um só para o projeto `globalconsultorias`.** A mesma conta pode
 *    ser consultor no Sync e diretor no GlobalEdu. Por isso nunca se escreve
 *    claim sem antes ler a que existe (`mesclarClaims`), e nunca se mexe na
 *    senha de conta que já existia.
 * 2. **Cada produto tem o seu banco nomeado.** `getFirestore(app, databaseId)`
 *    escolhe o banco; errar o id não dá erro de permissão, dá `NOT_FOUND` na
 *    primeira leitura.
 */

import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";

import {
  claimsDoSistema,
  divergenciaDeClaims,
  documentoDaPrefeitura,
  documentoDoUsuario,
  lerPrefeitura,
  lerUsuario,
  mesclarClaims,
  removerClaims,
  slugDePrefeitura,
  type EntradaDaPrefeitura,
  type PrefeituraDoConsole,
  type SistemaGlobal,
  type UsuarioDoConsole,
} from "@/core/domain/sistemas";
import { firebaseApp, firebaseAuth } from "@/core/lib/firebase-admin";

/** Erro de negócio do console — as rotas o traduzem em status HTTP. */
export class ErroDoConsole extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDoConsole";
  }
}

const agora = () => new Date().toISOString();

/**
 * Banco do produto. `databaseId` vazio significa o `(default)`, que é onde o
 * próprio Sync guarda `cities`, `companies` e `audit`.
 */
export function bancoDoSistema(sistema: SistemaGlobal): Firestore {
  const app = firebaseApp();
  return sistema.databaseId ? getFirestore(app, sistema.databaseId) : getFirestore(app);
}

// ---------------------------------------------------------------------------
// Prefeituras
// ---------------------------------------------------------------------------

export async function listarPrefeituras(sistema: SistemaGlobal): Promise<PrefeituraDoConsole[]> {
  const snap = await bancoDoSistema(sistema).collection(sistema.colecaoPrefeituras).get();
  return snap.docs
    .map((d) => lerPrefeitura(sistema, d.id, d.data()))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function criarPrefeitura(
  sistema: SistemaGlobal,
  entrada: Omit<EntradaDaPrefeitura, "slug" | "status" | "criadoEm"> & {
    slug?: string;
    status?: string;
  },
): Promise<PrefeituraDoConsole> {
  const slug = entrada.slug?.trim() || slugDePrefeitura(entrada.nome);
  if (!slug) {
    throw new ErroDoConsole(400, "SLUG_VAZIO", "O nome informado não gera um identificador válido.");
  }

  const doc = documentoDaPrefeitura(sistema, {
    ...entrada,
    nome: entrada.nome.trim(),
    slug,
    status: entrada.status ?? sistema.statusPrefeitura[0]?.id ?? "ativo",
    criadoEm: agora(),
  });

  const ref = bancoDoSistema(sistema).collection(sistema.colecaoPrefeituras).doc(slug);
  try {
    // `create` (e não `set`) para que duas pessoas cadastrando o mesmo município
    // ao mesmo tempo resultem em erro, não em sobrescrita silenciosa do que já
    // estava configurado.
    await ref.create(doc);
  } catch (erro) {
    if ((erro as { code?: number }).code === 6) {
      throw new ErroDoConsole(409, "PREFEITURA_EXISTE", `Já existe uma prefeitura com o identificador "${slug}".`);
    }
    throw erro;
  }

  return lerPrefeitura(sistema, slug, doc);
}

export async function atualizarPrefeitura(
  sistema: SistemaGlobal,
  slug: string,
  patch: { nome?: string; uf?: string; status?: string; codigoIbge?: string },
): Promise<PrefeituraDoConsole> {
  const ref = bancoDoSistema(sistema).collection(sistema.colecaoPrefeituras).doc(slug);
  const atual = await ref.get();
  if (!atual.exists) {
    throw new ErroDoConsole(404, "PREFEITURA_NAO_ENCONTRADA", `Prefeitura "${slug}" não existe no ${sistema.nome}.`);
  }

  const c = sistema.camposPrefeitura;
  const mudancas: Record<string, unknown> = {};
  if (patch.nome !== undefined) mudancas[c.nome] = patch.nome.trim();
  if (patch.uf !== undefined) mudancas[c.uf] = patch.uf.toUpperCase();
  if (patch.status !== undefined) mudancas[c.status] = patch.status;
  if (patch.codigoIbge !== undefined && c.codigoIbge) mudancas[c.codigoIbge] = patch.codigoIbge;

  // O slug não entra: ele é o id do documento e o valor gravado nas claims de
  // todo mundo que trabalha nessa prefeitura. Renomear exigiria reescrever cada
  // usuário e cada caminho do Storage — a operação certa é criar outra.
  if (Object.keys(mudancas).length) await ref.update(mudancas);

  return lerPrefeitura(sistema, slug, { ...atual.data(), ...mudancas });
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

/** `getUsers` aceita no máximo 100 identificadores por chamada. */
const LOTE_DE_CONTAS = 100;

async function contasPorUid(uids: string[]): Promise<Map<string, UserRecord>> {
  const mapa = new Map<string, UserRecord>();
  const auth = firebaseAuth();
  for (let i = 0; i < uids.length; i += LOTE_DE_CONTAS) {
    const lote = uids.slice(i, i + LOTE_DE_CONTAS).map((uid) => ({ uid }));
    const { users } = await auth.getUsers(lote);
    for (const u of users) mapa.set(u.uid, u);
  }
  return mapa;
}

/**
 * Usuários do produto, cruzados com o Auth.
 *
 * O cruzamento é o que dá valor à tela: um documento sem conta no Auth é órfão
 * (a pessoa nunca vai conseguir entrar) e uma claim diferente do documento é a
 * causa mais comum de "entrei e não vejo nada".
 */
export async function listarUsuarios(
  sistema: SistemaGlobal,
  filtro?: { prefeitura?: string },
): Promise<UsuarioDoConsole[]> {
  const snap = await bancoDoSistema(sistema).collection(sistema.colecaoUsuarios).get();
  const usuarios = snap.docs.map((d) => lerUsuario(sistema, d.id, d.data()));

  const filtrados = filtro?.prefeitura
    ? usuarios.filter(
        (u) => u.prefeitura === filtro.prefeitura || u.prefeituras.includes(filtro.prefeitura!),
      )
    : usuarios;

  const contas = await contasPorUid(filtrados.map((u) => u.id));

  return filtrados
    .map((u) => {
      const conta = contas.get(u.id);
      return {
        ...u,
        temConta: Boolean(conta),
        // Sem conta não há claim para comparar; o problema a mostrar é o órfão.
        claimsEmDia: conta
          ? !divergenciaDeClaims(sistema, u, conta.customClaims ?? {})
          : undefined,
        ativo: conta ? u.ativo && !conta.disabled : u.ativo,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface ResultadoDoProvisionamento {
  usuario: UsuarioDoConsole;
  /** A conta foi criada agora, ou já existia no projeto e apenas ganhou acesso. */
  contaNova: boolean;
  /**
   * Link de definição de senha, quando não veio senha na requisição.
   * O Admin SDK **gera** o link; quem entrega é você. O Sync não envia e-mail.
   */
  linkDeSenha?: string;
}

/**
 * Cria (ou vincula) uma conta e dá a ela acesso ao produto.
 *
 * Três coisas acontecem, nesta ordem, e nenhuma delas é transacional entre si —
 * Auth e Firestore são serviços diferentes. A ordem foi escolhida para que uma
 * falha no meio deixe o estado mais inofensivo possível: conta sem acesso é
 * inócua, acesso sem conta é um documento órfão que a listagem denuncia.
 */
export async function provisionarUsuario(
  sistema: SistemaGlobal,
  entrada: {
    email: string;
    nome: string;
    papel: string;
    prefeitura: string;
    prefeituras?: string[];
    senha?: string;
  },
): Promise<ResultadoDoProvisionamento> {
  const auth = firebaseAuth();
  const db = bancoDoSistema(sistema);

  const prefeitura = await db.collection(sistema.colecaoPrefeituras).doc(entrada.prefeitura).get();
  if (!prefeitura.exists) {
    throw new ErroDoConsole(
      400,
      "PREFEITURA_NAO_ENCONTRADA",
      `Cadastre a prefeitura "${entrada.prefeitura}" antes de criar usuários nela.`,
    );
  }

  let conta: UserRecord;
  let contaNova = false;
  try {
    conta = await auth.getUserByEmail(entrada.email);
    // Conta preexistente **não** tem a senha mexida. Pode ser a conta que a
    // pessoa já usa no Sync, ou em outro produto Global; trocar a senha dela
    // por causa de um cadastro novo derrubaria o acesso que ela já tinha.
  } catch (erro) {
    if ((erro as { code?: string }).code !== "auth/user-not-found") throw erro;
    conta = await auth.createUser({
      email: entrada.email,
      displayName: entrada.nome,
      // Sem senha, a conta nasce sem credencial e a pessoa define a dela pelo
      // link de definição. Assim a senha nunca passa por aqui.
      ...(entrada.senha ? { password: entrada.senha } : {}),
    });
    contaNova = true;
  }

  const vinculos = entrada.prefeituras?.length ? entrada.prefeituras : [entrada.prefeitura];

  await auth.setCustomUserClaims(
    conta.uid,
    mesclarClaims(
      conta.customClaims,
      claimsDoSistema(sistema, {
        papel: entrada.papel,
        prefeitura: entrada.prefeitura,
        prefeituras: vinculos,
      }),
    ),
  );

  const doc = documentoDoUsuario(sistema, {
    email: entrada.email,
    nome: entrada.nome,
    papel: entrada.papel,
    prefeitura: entrada.prefeitura,
    prefeituras: vinculos,
    ativo: true,
    criadoEm: agora(),
  });

  // Chaveado pelo uid: é assim que o produto encontra o documento a partir da
  // sessão. `merge` para não apagar campos que o produto grave por conta dele.
  await db.collection(sistema.colecaoUsuarios).doc(conta.uid).set(doc, { merge: true });

  return {
    usuario: {
      ...lerUsuario(sistema, conta.uid, doc),
      temConta: true,
      claimsEmDia: true,
    },
    contaNova,
    linkDeSenha: entrada.senha ? undefined : await gerarLinkDeSenha(entrada.email),
  };
}

export async function atualizarUsuario(
  sistema: SistemaGlobal,
  uid: string,
  patch: {
    nome?: string;
    papel?: string;
    prefeitura?: string;
    prefeituras?: string[];
    ativo?: boolean;
  },
): Promise<UsuarioDoConsole> {
  const auth = firebaseAuth();
  const db = bancoDoSistema(sistema);
  const ref = db.collection(sistema.colecaoUsuarios).doc(uid);

  const atual = await ref.get();
  if (!atual.exists) {
    throw new ErroDoConsole(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado neste sistema.");
  }
  const antes = lerUsuario(sistema, uid, atual.data() ?? {});

  const c = sistema.camposUsuario;
  const mudancas: Record<string, unknown> = {};
  if (patch.nome !== undefined) mudancas[c.nome] = patch.nome.trim();
  if (patch.papel !== undefined) mudancas[c.papel] = patch.papel;
  if (patch.prefeitura !== undefined) mudancas[c.prefeitura] = patch.prefeitura;
  if (patch.prefeituras !== undefined) mudancas[c.prefeituras] = patch.prefeituras;
  if (patch.ativo !== undefined) mudancas[c.ativo] = patch.ativo;

  if (Object.keys(mudancas).length) await ref.update(mudancas);
  const depois = lerUsuario(sistema, uid, { ...atual.data(), ...mudancas });

  // A claim tem de acompanhar o documento, senão o produto autoriza pela claim
  // antiga — as security rules e o Storage leem o token, não o Firestore.
  const conta = await auth.getUser(uid).catch(() => null);
  if (conta) {
    await auth.setCustomUserClaims(
      uid,
      mesclarClaims(
        conta.customClaims,
        claimsDoSistema(sistema, {
          papel: depois.papel,
          prefeitura: depois.prefeitura ?? "",
          prefeituras: depois.prefeituras,
        }),
      ),
    );

    // Desativar precisa valer agora. O `ativo: false` no documento depende de o
    // produto consultá-lo; `disabled` no Auth barra o login no próprio Firebase,
    // e o token que estiver em uso para de ser renovado.
    const naConta: { disabled?: boolean; displayName?: string } = {};
    const desabilitar = patch.ativo === undefined ? undefined : !patch.ativo;
    if (desabilitar !== undefined && desabilitar !== conta.disabled) {
      naConta.disabled = desabilitar;
    }
    if (patch.nome !== undefined && patch.nome.trim() !== conta.displayName) {
      naConta.displayName = patch.nome.trim();
    }
    if (Object.keys(naConta).length) await auth.updateUser(uid, naConta);
  }

  return {
    ...depois,
    temConta: Boolean(conta),
    claimsEmDia: Boolean(conta),
    // Documento e Auth podem discordar por um instante; o que a tela mostra é o
    // valor pedido, e a próxima listagem confirma contra o Auth.
    ativo: patch.ativo ?? antes.ativo,
  };
}

/**
 * Link de definição/redefinição de senha.
 *
 * O Admin SDK gera o link, mas **não envia e-mail** — mandar exigiria um
 * serviço de e-mail que o Sync não tem. Na prática é melhor assim: em
 * prefeitura, o caminho que funciona é passar o link direto para a pessoa.
 * O link vale por uma hora e é de uso único.
 */
export async function gerarLinkDeSenha(email: string): Promise<string> {
  try {
    return await firebaseAuth().generatePasswordResetLink(email);
  } catch (erro) {
    const codigo = (erro as { code?: string }).code;
    if (codigo === "auth/user-not-found") {
      throw new ErroDoConsole(404, "CONTA_NAO_ENCONTRADA", `Não há conta no projeto para ${email}.`);
    }
    throw erro;
  }
}

/** Regrava as claims a partir do documento — o conserto de "entrei e não vejo nada". */
export async function ressincronizarClaims(
  sistema: SistemaGlobal,
  uid: string,
): Promise<UsuarioDoConsole> {
  const db = bancoDoSistema(sistema);
  const doc = await db.collection(sistema.colecaoUsuarios).doc(uid).get();
  if (!doc.exists) {
    throw new ErroDoConsole(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado neste sistema.");
  }
  const usuario = lerUsuario(sistema, uid, doc.data() ?? {});

  const auth = firebaseAuth();
  const conta = await auth.getUser(uid).catch(() => null);
  if (!conta) {
    throw new ErroDoConsole(
      409,
      "SEM_CONTA",
      "O documento existe mas não há conta no Auth. Cadastre a pessoa de novo pelo mesmo e-mail.",
    );
  }

  await auth.setCustomUserClaims(
    uid,
    mesclarClaims(
      conta.customClaims,
      claimsDoSistema(sistema, {
        papel: usuario.papel,
        prefeitura: usuario.prefeitura ?? "",
        prefeituras: usuario.prefeituras,
      }),
    ),
  );

  return { ...usuario, temConta: true, claimsEmDia: true };
}

/** Tira o acesso ao produto sem apagar a conta nem o acesso aos outros. */
export async function revogarAcesso(sistema: SistemaGlobal, uid: string): Promise<void> {
  const auth = firebaseAuth();
  const conta = await auth.getUser(uid).catch(() => null);
  if (conta) await auth.setCustomUserClaims(uid, removerClaims(sistema, conta.customClaims));

  await bancoDoSistema(sistema)
    .collection(sistema.colecaoUsuarios)
    .doc(uid)
    .update({ [sistema.camposUsuario.ativo]: false });
}

// ---------------------------------------------------------------------------
// Resumo por sistema
// ---------------------------------------------------------------------------

export interface ResumoDoSistema {
  prefeituras: number;
  usuarios: number;
  /** Preenchido quando o banco não respondeu — o console segue mostrando o resto. */
  erro?: string;
}

export async function resumoDoSistema(sistema: SistemaGlobal): Promise<ResumoDoSistema> {
  try {
    const db = bancoDoSistema(sistema);
    const [prefeituras, usuarios] = await Promise.all([
      db.collection(sistema.colecaoPrefeituras).count().get(),
      db.collection(sistema.colecaoUsuarios).count().get(),
    ]);
    return { prefeituras: prefeituras.data().count, usuarios: usuarios.data().count };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    // NOT_FOUND aqui quase sempre é banco nomeado que não existe no projeto —
    // vale dizer isso em vez de repassar o texto cru do gRPC.
    return {
      prefeituras: 0,
      usuarios: 0,
      erro: mensagem.includes("NOT_FOUND")
        ? `O banco "${sistema.databaseId || "(default)"}" não existe no projeto.`
        : mensagem,
    };
  }
}
