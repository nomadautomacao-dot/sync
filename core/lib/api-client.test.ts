import { describe, it, expect, vi, beforeEach } from "vitest";
import { withAuthHeader, apiFetch, ApiError } from "./api-client";
import { getFirebaseAuth } from "./firebase-client";
import type { User } from "firebase/auth";

let mockCurrentUser: User | null = null;

vi.mock("./firebase-client", () => {
  return {
    getFirebaseAuth: () => ({
      get currentUser() {
        return mockCurrentUser;
      }
    }),
  };
});

describe("withAuthHeader", () => {
  it("injeta Authorization Bearer preservando headers existentes", () => {
    const out = withAuthHeader({ headers: { "Content-Type": "application/json" } }, "tok");
    const h = new Headers(out.headers);
    expect(h.get("Authorization")).toBe("Bearer tok");
    expect(h.get("Content-Type")).toBe("application/json");
  });
});

describe("apiFetch", () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
    mockCurrentUser = null;
  });

  it("lança ApiError 401 NO_SESSION se não houver usuário logado", async () => {
    await expect(apiFetch("/api/test")).rejects.toThrowError(
      new ApiError(401, "NO_SESSION", "Sessão ausente.")
    );
  });

  it("faz fetch com token Bearer e retorna JSON de sucesso", async () => {
    const mockUser = {
      getIdToken: vi.fn().mockResolvedValue("mock-id-token"),
    } as unknown as User;
    mockCurrentUser = mockUser;

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: "hello" }),
    });

    const result = await apiFetch("/api/test", { method: "POST" });
    expect(result).toEqual({ ok: true, data: "hello" });
    expect(mockFetch).toHaveBeenCalledWith("/api/test", expect.any(Object));
    const initPassed = mockFetch.mock.calls[0][1];
    const headers = new Headers(initPassed?.headers);
    expect(headers.get("Authorization")).toBe("Bearer mock-id-token");
  });

  it("lança ApiError com status e code corretos quando a resposta não é ok", async () => {
    const mockUser = {
      getIdToken: vi.fn().mockResolvedValue("mock-id-token"),
    } as unknown as User;
    mockCurrentUser = mockUser;

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: "Dados inválidos", code: "INVALID_DATA" }),
    });

    try {
      await apiFetch("/api/test");
      throw new Error("Deveria ter lançado erro");
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      const apiErr = e as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe("INVALID_DATA");
      expect(apiErr.message).toBe("Dados inválidos");
    }
  });

  it("trata fallback quando o corpo de erro não é JSON válido", async () => {
    const mockUser = {
      getIdToken: vi.fn().mockResolvedValue("mock-id-token"),
    } as unknown as User;
    mockCurrentUser = mockUser;

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("Não é JSON");
      },
    });

    try {
      await apiFetch("/api/test");
      throw new Error("Deveria ter lançado erro");
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      const apiErr = e as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.code).toBe("HTTP_ERROR");
      expect(apiErr.message).toBe("Internal Server Error");
    }
  });
});
