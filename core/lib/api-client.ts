interface ApiClientError {
  error: string;
  details?: unknown;
  code?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json()) as ApiClientError;
    const details = body.details ? ` (${typeof body.details === "string" ? body.details : JSON.stringify(body.details)})` : "";
    throw new Error(`${body.error ?? "Erro inesperado na API"}${details}`);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get<T>(url: string) {
    return request<T>(url, { method: "GET" });
  },
  post<T>(url: string, body: unknown) {
    return request<T>(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  put<T>(url: string, body: unknown) {
    return request<T>(url, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  delete<T>(url: string) {
    return request<T>(url, { method: "DELETE" });
  },
};
