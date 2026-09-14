/**
 * Erros da camada de API e traducao para mensagens voltadas ao usuario final.
 *
 * O membro da igreja nao tem contexto tecnico: mostrar `String(error)` cru
 * ("TypeError: Network request failed") gera duvida e empurra a pessoa de
 * volta para o WhatsApp — exatamente o problema que o app existe para
 * resolver. Cada erro conhecido vira um titulo curto e uma instrucao clara
 * do que fazer em seguida.
 */

/** Falha de conexao: o dispositivo nao conseguiu falar com o servidor. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("Falha de conexao com o servidor.");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/** O refresh token tambem expirou/foi invalidado: a sessao acabou de fato. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Sessao expirada.");
    this.name = "SessionExpiredError";
  }
}

/** Resposta HTTP de erro vinda da API, com status e corpo ja parseados. */
export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown, message?: string) {
    super(message || `Erro ${status} ao processar a requisicao.`);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export type UserFacingError = {
  title: string;
  message: string;
};

/**
 * Extrai a primeira mensagem legivel de um corpo de erro do DRF.
 *
 * O DRF responde em formatos diferentes conforme a origem do erro:
 * - `{"detail": "..."}` para erros de autenticacao/permissao;
 * - `{"campo": ["msg1", "msg2"]}` para erros de validacao de serializer;
 * - `["msg"]` para `non_field_errors` levantados na raiz.
 */
function firstDetail(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload.trim() || null;
  }
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = firstDetail(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    // `detail` tem prioridade: e a chave padrao de erro do DRF.
    if (record.detail) {
      return firstDetail(record.detail);
    }
    for (const value of Object.values(record)) {
      const found = firstDetail(value);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * Traduz qualquer erro lancado pela camada de API em titulo + mensagem
 * prontos para um `Alert`. `context` permite ajustar o titulo por tela
 * (ex: "Falha no login" em vez de "Nao foi possivel concluir").
 */
export function describeError(error: unknown, context?: string): UserFacingError {
  const title = context || "Nao foi possivel concluir";

  if (error instanceof SessionExpiredError) {
    return {
      title: "Sessao expirada",
      message: "Sua sessao expirou por seguranca. Entre novamente para continuar.",
    };
  }

  if (error instanceof NetworkError) {
    return {
      title: "Sem conexao",
      message:
        "Nao conseguimos falar com o servidor. Verifique sua internet e tente de novo em instantes.",
    };
  }

  if (error instanceof ApiError) {
    const detail = firstDetail(error.payload);

    switch (error.status) {
      case 400:
        return {
          title: "Dados invalidos",
          message: detail || "Confira os dados informados e tente novamente.",
        };
      case 401:
        return {
          title: "Acesso negado",
          message: detail || "E-mail ou senha incorretos. Confira e tente novamente.",
        };
      case 403:
        return {
          title: "Sem permissao",
          message: detail || "Seu perfil nao tem permissao para esta acao.",
        };
      case 404:
        return {
          title: "Nao encontrado",
          message: detail || "O item que voce tentou acessar nao existe mais.",
        };
      case 413:
        return {
          title: "Arquivo muito grande",
          message: "O comprovante excede o limite de 8MB. Envie uma foto menor ou um PDF.",
        };
      default:
        break;
    }

    if (error.status >= 500) {
      return {
        title: "Erro no servidor",
        message:
          "Tivemos um problema do nosso lado. Tente novamente em alguns minutos ou avise a secretaria.",
      };
    }

    return { title, message: detail || error.message };
  }

  if (error instanceof Error && error.message) {
    return { title, message: error.message };
  }

  return { title, message: "Ocorreu um erro inesperado. Tente novamente." };
}
