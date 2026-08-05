import { describe, it, expect } from "vitest";

import { permissoesEfetivas, permissoesPadrao } from "@/core/domain/rbac";
import {
  LIMITE_CLAIMS_BYTES,
  claimsCabem,
  claimsDeAcesso,
  doGrupo,
  mesclarClaims,
  normalizarEmail,
  normalizarPapel,
  podeAtribuirPapel,
  podeVincularAoGrupo,
  tamanhoDasClaims,
  usuariaDoRegistro,
  validarAlvo,
} from "./acessos";

describe("mesclarClaims", () => {
  it("preserva claims de outros produtos", () => {
    const existentes = { globaledu_role: "global_admin", outro: 1 };
    const novas = { groupId: "grupo-1", groupRole: "member" };
    expect(mesclarClaims(existentes, novas)).toEqual({
      globaledu_role: "global_admin",
      outro: 1,
      groupId: "grupo-1",
      groupRole: "member",
    });
  });

  it("sobrescreve o que repete", () => {
    expect(mesclarClaims({ groupRole: "viewer" }, { groupRole: "admin" })).toEqual({
      groupRole: "admin",
    });
  });

  it("null remove a chave em vez de gravá-la vazia", () => {
    expect(mesclarClaims({ perm: { cidades: "nenhum" }, groupId: "g" }, { perm: null }))
      .toEqual({ groupId: "g" });
  });

  it("aguenta usuária sem claim nenhuma", () => {
    expect(mesclarClaims(undefined, { groupId: "g" })).toEqual({ groupId: "g" });
    expect(mesclarClaims(null, { groupId: "g" })).toEqual({ groupId: "g" });
  });
});

describe("claimsDeAcesso", () => {
  it("não grava perm quando a pessoa está no padrão do papel", () => {
    const claims = claimsDeAcesso("grupo-1", "member", permissoesPadrao("member"));
    expect(claims).toEqual({ groupId: "grupo-1", groupRole: "member", perm: null });
    // null aqui significa "apague a chave" na mesclagem.
    expect(mesclarClaims({ perm: { cidades: "nenhum" } }, claims)).not.toHaveProperty(
      "perm",
    );
  });

  it("grava só os desvios", () => {
    const permissoes = permissoesEfetivas("member", { cidades: "nenhum" });
    expect(claimsDeAcesso("grupo-1", "member", permissoes).perm).toEqual({
      cidades: "nenhum",
    });
  });

  it("cabe folgado no teto de claims mesmo com todas as áreas desviadas", () => {
    const tudoNenhum = permissoesEfetivas("member", {
      painel: "nenhum",
      caixa: "nenhum",
      cidades: "nenhum",
      pipeline: "nenhum",
      empresas: "nenhum",
      pessoas: "nenhum",
      documentos: "nenhum",
      modulos: "nenhum",
      ajustes: "nenhum",
    });
    const claims = claimsDeAcesso("grupo-1", "member", tudoNenhum);
    expect(claimsCabem(claims)).toBe(true);
    expect(tamanhoDasClaims(claims)).toBeLessThan(LIMITE_CLAIMS_BYTES / 2);
  });

  it("reprova claims acima do teto", () => {
    expect(claimsCabem({ lixo: "x".repeat(LIMITE_CLAIMS_BYTES) })).toBe(false);
  });
});

describe("usuariaDoRegistro", () => {
  it("resolve papel e permissões a partir das claims", () => {
    const usuaria = usuariaDoRegistro({
      uid: "uid-1",
      email: "Maria@GlobalCompany.com.br",
      displayName: "Maria Souza",
      customClaims: { groupId: "g", groupRole: "member", perm: { cidades: "nenhum" } },
      metadata: { creationTime: "2026-08-01", lastSignInTime: "2026-08-05" },
    });
    expect(usuaria.nome).toBe("Maria Souza");
    expect(usuaria.groupRole).toBe("member");
    expect(usuaria.permissoes.cidades).toBe("nenhum");
    expect(usuaria.permissoes.pipeline).toBe("editar");
    expect(usuaria.desativada).toBe(false);
    expect(usuaria.ultimoAcessoEm).toBe("2026-08-05");
  });

  it("cai no e-mail quando não há nome, e marca desativada", () => {
    const usuaria = usuariaDoRegistro({
      uid: "uid-2",
      email: "sem.nome@globalcompany.com.br",
      disabled: true,
      customClaims: { groupId: "g" },
    });
    expect(usuaria.nome).toBe("sem.nome@globalcompany.com.br");
    expect(usuaria.desativada).toBe(true);
    // Sem groupRole na claim, o papel mais restrito que ainda opera.
    expect(usuaria.groupRole).toBe("member");
  });

  it("usuária sem claim nenhuma não quebra a listagem", () => {
    const usuaria = usuariaDoRegistro({ uid: "uid-3" });
    expect(usuaria.nome).toBe("uid-3");
    expect(usuaria.permissoes).toEqual(permissoesPadrao("member"));
  });
});

describe("doGrupo", () => {
  it("filtra por groupId da claim e ignora quem não tem", () => {
    const registros = [
      { uid: "a", customClaims: { groupId: "g1" } },
      { uid: "b", customClaims: { groupId: "g2" } },
      { uid: "c" },
    ];
    expect(doGrupo(registros, "g1").map((r) => r.uid)).toEqual(["a"]);
  });
});

describe("normalizarEmail", () => {
  it("apara e baixa a caixa", () => {
    expect(normalizarEmail("  Maria@GlobalCompany.com.BR ")).toBe(
      "maria@globalcompany.com.br",
    );
  });

  it("recusa o que não é e-mail", () => {
    expect(normalizarEmail("maria")).toBeNull();
    expect(normalizarEmail("maria@")).toBeNull();
    expect(normalizarEmail("maria @globalcompany.com.br")).toBeNull();
    expect(normalizarEmail(42)).toBeNull();
    expect(normalizarEmail(null)).toBeNull();
  });
});

describe("normalizarPapel", () => {
  it("aceita os quatro papéis e cai em member no resto", () => {
    expect(normalizarPapel("owner")).toBe("owner");
    expect(normalizarPapel("viewer")).toBe("viewer");
    expect(normalizarPapel("superusuario")).toBe("member");
    expect(normalizarPapel(undefined)).toBe("member");
  });
});

describe("validarAlvo — proteção contra se trancar para fora", () => {
  it("impede desativar a própria conta", () => {
    expect(validarAlvo("eu", "eu", { desativar: true }).erro).toMatch(/própria conta/);
  });

  it("impede rebaixar o próprio papel", () => {
    expect(validarAlvo("eu", "eu", { papel: "viewer" }).erro).toMatch(/próprio papel/);
    expect(validarAlvo("eu", "eu", { papel: "member" }).erro).toBeTruthy();
  });

  it("deixa a pessoa editar outras coisas de si mesma", () => {
    expect(validarAlvo("eu", "eu", { papel: "admin" }).erro).toBeNull();
    expect(validarAlvo("eu", "eu", { desativar: false }).erro).toBeNull();
  });

  it("não atrapalha edição de terceiros", () => {
    expect(validarAlvo("eu", "outra", { desativar: true }).erro).toBeNull();
    expect(validarAlvo("eu", "outra", { papel: "viewer" }).erro).toBeNull();
  });
});

describe("podeVincularAoGrupo — não roubar conta de outro grupo", () => {
  it("recusa conta que já pertence a outro grupo", () => {
    const r = podeVincularAoGrupo({ groupId: "outro" }, "meu-grupo");
    expect(r.permitido).toBe(false);
    expect(r.motivo).toMatch(/outro grupo/);
  });

  it("aceita conta que já é deste grupo — é revinculação", () => {
    expect(podeVincularAoGrupo({ groupId: "meu-grupo" }, "meu-grupo").permitido).toBe(true);
  });

  it("aceita conta de outro produto Global, que ainda não tem groupId aqui", () => {
    expect(podeVincularAoGrupo({ globaledu_role: "global_admin" }, "meu-grupo").permitido).toBe(true);
    expect(podeVincularAoGrupo({ groupId: "" }, "meu-grupo").permitido).toBe(true);
  });

  it("aceita conta nova, sem claim nenhuma", () => {
    expect(podeVincularAoGrupo(undefined, "meu-grupo").permitido).toBe(true);
    expect(podeVincularAoGrupo(null, "meu-grupo").permitido).toBe(true);
  });
});

describe("podeAtribuirPapel", () => {
  it("só a dona cria outra dona", () => {
    expect(podeAtribuirPapel("owner", "owner")).toBe(true);
    expect(podeAtribuirPapel("admin", "owner")).toBe(false);
  });

  it("dona e administradora atribuem os demais papéis", () => {
    for (const papel of ["admin", "member", "viewer"] as const) {
      expect(podeAtribuirPapel("owner", papel)).toBe(true);
      expect(podeAtribuirPapel("admin", papel)).toBe(true);
    }
  });

  it("quem não administra não atribui nada", () => {
    expect(podeAtribuirPapel("member", "viewer")).toBe(false);
    expect(podeAtribuirPapel("viewer", "viewer")).toBe(false);
  });
});
