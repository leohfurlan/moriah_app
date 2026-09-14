import { ApiError, NetworkError, SessionExpiredError } from "./errors";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
} from "./storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api";

// Handler chamado quando a sessao expira de vez (refresh invalido/expirado).
// A camada de UI (useAuth) registra aqui a rotina de logout.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

// Mutex/single-flight: garante que multiplas chamadas com 401 simultaneo
// disparem apenas UM refresh; as demais aguardam o mesmo resultado.
let refreshPromise: Promise<string | null> | null = null;

/** `fetch` que converte falha de rede em `NetworkError` tratavel pela UI. */
async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new NetworkError(error);
  }
}

/** Le o corpo da resposta como JSON quando possivel, senao como texto. */
async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function performRefresh(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) {
    return null;
  }
  const response = await safeFetch(`${API_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { access: string };
  await saveAccessToken(data.access);
  return data.access;
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function handleSessionExpired(): Promise<never> {
  await clearTokens();
  if (unauthorizedHandler) {
    unauthorizedHandler();
  }
  throw new SessionExpiredError();
}

async function request<T>(
  path: string,
  init?: RequestInit,
  isFormData = false,
  isRetry = false,
): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers || {});
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await safeFetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  // 401: tenta renovar o access token uma unica vez e repete a chamada.
  // `isRetry` evita loop infinito: uma chamada ja retentada nao tenta de novo.
  // Endpoints de autenticacao (login/refresh) nao entram no fluxo de refresh:
  // um 401 ali e credencial invalida, e deve retornar o erro original.
  const isAuthEndpoint = path.startsWith("/auth/");
  if (response.status === 401 && !isRetry && !isAuthEndpoint) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, init, isFormData, true);
    }
    // Refresh tambem falhou -> desloga o usuario.
    return handleSessionExpired();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseBody(response));
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
