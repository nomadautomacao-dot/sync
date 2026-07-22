import { describe, expect, it, vi, beforeEach } from "vitest";

const getHeader = vi.fn();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: getHeader }),
}));

const verifyIdToken = vi.fn();
vi.mock("./firebase-admin", () => ({
  firebaseAuth: () => ({ verifyIdToken }),
}));

const { getSessionUser } = await import("./auth");

describe("getSessionUser", () => {
  beforeEach(() => {
    getHeader.mockReset();
    verifyIdToken.mockReset();
  });

  it("devolve null quando nao ha header Authorization", async () => {
    getHeader.mockReturnValue(null);
    expect(await getSessionUser()).toBeNull();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("devolve o usuario quando o token e valido", async () => {
    getHeader.mockReturnValue("Bearer token-valido");
    verifyIdToken.mockResolvedValue({
      uid: "uid-1",
      email: "consultor@rochaprime.com.br",
      name: "Consultor",
      groupId: "grupo-1",
      groupRole: "owner",
    });

    expect(await getSessionUser()).toEqual({
      id: "uid-1",
      name: "Consultor",
      email: "consultor@rochaprime.com.br",
      groupId: "grupo-1",
      groupRole: "owner",
    });
  });

  it("devolve null quando o token e rejeitado", async () => {
    getHeader.mockReturnValue("Bearer token-expirado");
    verifyIdToken.mockRejectedValue(new Error("token expirado"));
    expect(await getSessionUser()).toBeNull();
  });

  it("devolve null quando o token e valido mas nao tem groupId", async () => {
    getHeader.mockReturnValue("Bearer sem-grupo");
    verifyIdToken.mockResolvedValue({ uid: "uid-1", email: "a@b.com" });
    expect(await getSessionUser()).toBeNull();
  });
});
