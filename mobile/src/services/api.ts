import { ApiError, NetworkError, SessionExpiredError } from "./errors";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
} from "./storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/backend";

export type ApiPage<T> = {
  items: T[];
  count: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export function normalizePage<T>(payload: unknown, page = 1, pageSize = 25): ApiPage<T> {
  if (Array.isArray(payload)) {
    return { items: payload as T[], count: payload.length, page, pageSize, hasNext: false, hasPrevious: page > 1 };
  }
  const data = payload as { results?: unknown; count?: number; next?: unknown; previous?: unknown } | null;
  const items = Array.isArray(data?.results) ? data.results as T[] : [];
  return {
    items,
    count: Number(data?.count || 0),
    page,
    pageSize,
    hasNext: Boolean(data?.next),
    hasPrevious: Boolean(data?.previous),
  };
}

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

/**
 * Filtra resposta nao-JSON antes de virar erro exibivel.
 *
 * Quando a requisicao nao chega na view (500 do WSGI, 502/504 do proxy) o corpo
 * vem em HTML. Esse conteudo nao pode ser exibido ao membro — e o `ApiError`
 * fica com `payload: null`, o que faz `describeError` cair na mensagem padrao
 * do status. O aviso fica no console do desenvolvedor.
 */
function payloadDeErro(status: number, contentType: string, corpo: unknown): unknown {
  if (typeof corpo !== "string") {
    return corpo;
  }
  const pareceHtml =
    /text\/html/i.test(contentType) || /<\s*(!doctype|html|body|h1|pre)\b/i.test(corpo);
  if (!pareceHtml) {
    return corpo;
  }
  console.warn(
    `[api] resposta ${status} nao-JSON (${contentType || "sem content-type"}) descartada antes de chegar na UI`,
  );
  return null;
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
    const corpo = await parseBody(response);
    throw new ApiError(
      response.status,
      payloadDeErro(response.status, response.headers.get("content-type") || "", corpo),
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // 2xx que nao e JSON (proxy/HTML de portal cativo): nunca entregar o corpo
  // cru para a tela — vira erro de servidor com mensagem padrao.
  const corpo = await parseBody(response);
  if (typeof corpo === "string") {
    console.warn("[api] resposta 2xx nao-JSON descartada antes de chegar na UI");
    throw new ApiError(502, null);
  }
  return corpo as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getPage: async <T>(path: string, page = 1, pageSize = 25) => {
    const separator = path.includes("?") ? "&" : "?";
    const payload = await request<unknown>(`${path}${separator}page=${page}&page_size=${pageSize}`);
    return normalizePage<T>(payload, page, pageSize);
  },
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  /** Edicao parcial (PATCH): usado pela gestao de escalas (Fase 4). */
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  /** Remocao (DELETE). Resposta 204 vira `undefined`. */
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
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
