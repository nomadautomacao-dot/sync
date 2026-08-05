import { describe, expect, it } from "vitest";
import { permissoesPadrao } from "@/core/domain/rbac";
import { bearerToken, sessionUserFromClaims } from "./auth-token";

describe("bearerToken", () => {
  it("extrai o token de um header Bearer bem formado", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("aceita o esquema em qualquer caixa", () => {
    expect(bearerToken("bearer abc")).toBe("abc");
    expect(bearerToken("BEARER abc")).toBe("abc");
  });

  it("devolve null para header ausente, vazio ou de outro esquema", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer   ")).toBeNull();
  });
});

describe("sessionUserFromClaims", () => {
  const claims = {
    uid: "uid-1",
    email: "consultora@globalcompany.com.br",
    name: "Consultor",
    groupId: "grupo-1",
    groupRole: "admin",
  };

  it("monta o SessionUser a partir das claims", () => {
    expect(sessionUserFromClaims(claims)).toEqual({
      id: "uid-1",
      name: "Consultor",
      email: "consultora@globalcompany.com.br",
      groupId: "grupo-1",
      groupRole: "admin",
      permissoes: permissoesPadrao("admin"),
    });
  });

  it("aplica os ajustes da claim por cima do padrão do papel", () => {
    const restrita = sessionUserFromClaims({
      ...claims,
      groupRole: "member",
      perm: { cidades: "nenhum", pessoas: "editar" },
    });
    expect(restrita?.permissoes.cidades).toBe("nenhum");
    expect(restrita?.permissoes.pessoas).toBe("editar");
    // O que a claim não tocou segue o padrão de member.
    expect(restrita?.permissoes.pipeline).toBe("editar");
  });

  it("claim de permissão adulterada não escala privilégio", () => {
    const tentativa = sessionUserFromClaims({
      ...claims,
      groupRole: "viewer",
      perm: { ajustes: "editar" },
    });
    expect(tentativa?.permissoes.ajustes).toBe("ver");
  });

  it("usa o email como nome quando name esta ausente", () => {
    const { name: _omitido, ...semNome } = claims;
    expect(sessionUserFromClaims(semNome)?.name).toBe("consultora@globalcompany.com.br");
  });

  it("rebaixa groupRole desconhecido para member", () => {
    expect(sessionUserFromClaims({ ...claims, groupRole: "superuser" })?.groupRole).toBe("member");
  });

  it("rebaixa groupRole ausente para member", () => {
    const { groupRole: _omitido, ...semRole } = claims;
    expect(sessionUserFromClaims(semRole)?.groupRole).toBe("member");
  });

  it("devolve null sem uid, sem email ou sem groupId", () => {
    const { uid: _u, ...semUid } = claims;
    const { email: _e, ...semEmail } = claims;
    const { groupId: _g, ...semGrupo } = claims;
    expect(sessionUserFromClaims(semUid)).toBeNull();
    expect(sessionUserFromClaims(semEmail)).toBeNull();
    expect(sessionUserFromClaims(semGrupo)).toBeNull();
  });
});
