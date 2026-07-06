import { getAccessToken } from "./storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit, isFormData = false): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers || {});
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Erro ao processar a requisicao");
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  postForm: <T>(path: string, body: FormData) =>
    request<T>(
      path,
      {
        method: "POST",
        body,
      },
      true,
    ),
};
