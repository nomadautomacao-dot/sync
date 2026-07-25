import { describe, it, expect } from "vitest";
import { clientUserFromClaims } from "./client-session";

describe("clientUserFromClaims", () => {
  const fallback = { uid: "u1", email: "a@b.com" };

  it("monta ClientUser a partir de claims válidas", () => {
    expect(clientUserFromClaims({ groupId: "g1", name: "Ana", groupRole: "admin" }, fallback))
      .toEqual({ id: "u1", name: "Ana", email: "a@b.com", groupId: "g1", groupRole: "admin" });
  });

  it("retorna null sem groupId", () => {
    expect(clientUserFromClaims({}, fallback)).toBeNull();
  });

  it("preenche uid/email a partir do fallback quando ausentes nas claims", () => {
    expect(clientUserFromClaims({ groupId: "g1" }, fallback)).toEqual({
      id: "u1", name: "a@b.com", email: "a@b.com", groupId: "g1", groupRole: "member",
    });
  });

  it("faz fallback de role inválida para member (regra herdada do BFF)", () => {
    expect(clientUserFromClaims({ groupId: "g1", groupRole: "hacker" }, fallback)?.groupRole).toBe("member");
  });

  it("claims têm precedência sobre o fallback", () => {
    expect(clientUserFromClaims({ groupId: "g1", uid: "claim-uid" }, fallback)?.id).toBe("claim-uid");
  });
});
