import { describe, expect, it } from "vitest";
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
    email: "consultor@rochaprime.com.br",
    name: "Consultor",
    groupId: "grupo-1",
    groupRole: "admin",
  };

  it("monta o SessionUser a partir das claims", () => {
    expect(sessionUserFromClaims(claims)).toEqual({
      id: "uid-1",
      name: "Consultor",
      email: "consultor@rochaprime.com.br",
      groupId: "grupo-1",
      groupRole: "admin",
    });
  });

  it("usa o email como nome quando name esta ausente", () => {
    const { name: _omitido, ...semNome } = claims;
    expect(sessionUserFromClaims(semNome)?.name).toBe("consultor@rochaprime.com.br");
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
