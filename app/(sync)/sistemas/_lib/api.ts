"use client";

/**
 * Chamadas do console. Uma casca fina sobre `apiFetch`, que já anexa o ID token.
 *
 * A interface nunca fala com o Firestore do produto direto — as rules de lá
 * negariam, e é para negar. Tudo passa pelo servidor do Sync, que é quem tem a
 * service account.
 */

import { apiFetch } from "@/core/lib/api-client";
import type {
  EntradaDaPrefeitura,
  PrefeituraDoConsole,
  ReferenciaCenso,
  SistemaParaTela,
  UsuarioDoConsole,
} from "@/core/domain/sistemas";

/** O que a tela envia ao cadastrar — o `slug` e o `status` o servidor completa. */
export type EntradaDePrefeitura = Omit<EntradaDaPrefeitura, "slug" | "status" | "criadoEm"> & {
  slug?: string;
  status?: string;
};
import type { RegistroDoConsole } from "@/core/lib/sistemas-registro";

export interface SistemaComResumo extends SistemaParaTela {
  prefeituras: number;
  usuarios: number;
  erro?: string;
}

const json = (corpo: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

export const listarSistemas = () =>
  apiFetch<{ sistemas: SistemaComResumo[] }>("/api/sistemas").then((r) => r.sistemas);

export const obterSistema = (id: string) => apiFetch<SistemaComResumo>(`/api/sistemas/${id}`);

export const listarPrefeituras = (id: string) =>
  apiFetch<{ prefeituras: PrefeituraDoConsole[] }>(`/api/sistemas/${id}/prefeituras`).then(
    (r) => r.prefeituras,
  );

export const criarPrefeitura = (id: string, entrada: EntradaDePrefeitura) =>
  apiFetch<PrefeituraDoConsole>(`/api/sistemas/${id}/prefeituras`, json(entrada));

// ---------------------------------------------------------------------------
// Municípios — o que alimenta o preenchimento automático do cadastro
// ---------------------------------------------------------------------------

export interface MunicipioEncontrado {
  codigoIbge: string;
  nome: string;
  uf: string;
  regiao?: string;
}

export interface Dossie extends MunicipioEncontrado {
  populacao?: number;
  prefeito?: string;
  partido?: string;
  censo?: ReferenciaCenso;
  ideb?: { anosIniciais: number | null; anosFinais: number | null; ano: number };
  semDados: string[];
}

export const buscarMunicipios = (termo: string, uf?: string) =>
  apiFetch<{ municipios: MunicipioEncontrado[] }>(
    `/api/sistemas/municipios?q=${encodeURIComponent(termo)}${uf ? `&uf=${uf}` : ""}`,
  ).then((r) => r.municipios);

/**
 * Nome, UF e região vão na query porque a busca já os devolveu — poupa o
 * servidor de reconsultar o IBGE só para redescobri-los.
 */
export const dossieDoMunicipio = (codigoIbge: string, identidade?: MunicipioEncontrado) => {
  const q = new URLSearchParams();
  if (identidade?.nome) q.set("nome", identidade.nome);
  if (identidade?.uf) q.set("uf", identidade.uf);
  if (identidade?.regiao) q.set("regiao", identidade.regiao);
  const sufixo = q.toString();
  return apiFetch<Dossie>(`/api/sistemas/municipios/${codigoIbge}${sufixo ? `?${sufixo}` : ""}`);
};

export const salvarPrefeitura = (
  id: string,
  slug: string,
  patch: { nome?: string; uf?: string; status?: string; codigoIbge?: string },
) =>
  apiFetch<PrefeituraDoConsole>(`/api/sistemas/${id}/prefeituras/${slug}`, {
    ...json(patch),
    method: "PATCH",
  });

export const listarUsuarios = (id: string, prefeitura?: string) =>
  apiFetch<{ usuarios: UsuarioDoConsole[] }>(
    `/api/sistemas/${id}/usuarios${prefeitura ? `?prefeitura=${encodeURIComponent(prefeitura)}` : ""}`,
  ).then((r) => r.usuarios);

export interface RespostaDoProvisionamento {
  usuario: UsuarioDoConsole;
  contaNova: boolean;
  linkDeSenha?: string;
}

export const criarUsuario = (
  id: string,
  entrada: {
    email: string;
    nome: string;
    papel: string;
    prefeitura: string;
    prefeituras?: string[];
    senha?: string;
  },
) => apiFetch<RespostaDoProvisionamento>(`/api/sistemas/${id}/usuarios`, json(entrada));

export const salvarUsuario = (
  id: string,
  uid: string,
  patch: {
    nome?: string;
    papel?: string;
    prefeitura?: string;
    prefeituras?: string[];
    ativo?: boolean;
  },
) =>
  apiFetch<UsuarioDoConsole>(`/api/sistemas/${id}/usuarios/${uid}`, {
    ...json(patch),
    method: "PATCH",
  });

export const revogarAcesso = (id: string, uid: string) =>
  apiFetch<{ ok: true }>(`/api/sistemas/${id}/usuarios/${uid}`, { method: "DELETE" });

export const ressincronizarClaims = (id: string, uid: string) =>
  apiFetch<UsuarioDoConsole>(
    `/api/sistemas/${id}/usuarios/${uid}/acoes`,
    json({ acao: "ressincronizar_claims" }),
  );

export const gerarLinkDeSenha = (id: string, uid: string, email: string) =>
  apiFetch<{ link: string }>(
    `/api/sistemas/${id}/usuarios/${uid}/acoes`,
    json({ acao: "link_de_senha", email }),
  );

export const listarRegistro = (sistemaId?: string) =>
  apiFetch<{ registro: RegistroDoConsole[] }>(
    `/api/sistemas/registro${sistemaId ? `?sistema=${encodeURIComponent(sistemaId)}` : ""}`,
  ).then((r) => r.registro);
