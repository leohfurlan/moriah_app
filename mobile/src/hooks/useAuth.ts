import { useEffect, useState } from "react";

import { api, setUnauthorizedHandler } from "@/services/api";
import { clearTokens, saveTokens } from "@/services/storage";
import { resetNotifications } from "@/services/notificationStore";
import { LoginResponse, MeResponse } from "@/types/api";

/**
 * Perfil e capacidades da conta logada, compartilhados por toda a aplicacao.
 *
 * O perfil vem de `GET /api/me/` e e a unica fonte de capacidades usada para
 * decidir o que aparece na navegacao. Sem o cache abaixo, cada tela (e agora
 * tambem o `Screen`) disparava um `/me/` proprio; aqui a primeira chamada e
 * reaproveitada pelas demais e todos os consumidores ativos sao notificados
 * quando o perfil muda (login, logout, refresh, sessao expirada).
 */
type Ouvinte = (perfil: MeResponse | null) => void;

const ouvintes = new Set<Ouvinte>();
let perfilAtual: MeResponse | null = null;
let requisicaoEmAndamento: Promise<MeResponse | null> | null = null;
let geracaoPerfil = 0;
let handlerRegistrado = false;

function notificar() {
  for (const ouvinte of ouvintes) ouvinte(perfilAtual);
}

/** Descarta o perfil em memoria (logout e sessao expirada). */
export function limparPerfilEmMemoria() {
  resetNotifications();
  geracaoPerfil += 1;
  requisicaoEmAndamento = null;
  perfilAtual = null;
  notificar();
}

function garantirHandlerDeSessao() {
  if (handlerRegistrado) return;
  handlerRegistrado = true;
  // Quando o refresh do token falha, a camada de API sinaliza aqui para
  // deslogar o usuario (a sessao ja foi limpa em storage).
  setUnauthorizedHandler(() => limparPerfilEmMemoria());
}

function carregarPerfil({ recarregar = false }: { recarregar?: boolean } = {}): Promise<MeResponse | null> {
  garantirHandlerDeSessao();
  if (!recarregar) {
    if (perfilAtual) return Promise.resolve(perfilAtual);
    if (requisicaoEmAndamento) return requisicaoEmAndamento;
  }
  if (recarregar) {
    geracaoPerfil += 1;
    requisicaoEmAndamento = null;
  }
  const geracao = geracaoPerfil;
  let requisicao: Promise<MeResponse | null>;
  requisicao = api
    .get<MeResponse>("/me/")
    .then((perfil) => {
      if (geracao === geracaoPerfil) perfilAtual = perfil;
      return perfil;
    })
    .catch(() => {
      if (geracao === geracaoPerfil) perfilAtual = null;
      return null;
    })
    .finally(() => {
      if (geracao === geracaoPerfil && requisicaoEmAndamento === requisicao) {
        requisicaoEmAndamento = null;
        notificar();
      }
    });
  requisicaoEmAndamento = requisicao;
  return requisicao;
}

export function useAuth() {
  const [me, setMe] = useState<MeResponse | null>(perfilAtual);
  const [loading, setLoading] = useState(perfilAtual === null);

  useEffect(() => {
    const ouvinte: Ouvinte = (perfil) => setMe(perfil);
    ouvintes.add(ouvinte);
    let ativo = true;
    carregarPerfil().then(() => {
      if (ativo) setLoading(false);
    });
    return () => {
      ativo = false;
      ouvintes.delete(ouvinte);
    };
  }, []);

  async function login(email: string, password: string) {
    const tokens = await api.post<LoginResponse>("/auth/login/", { email, password });
    await saveTokens(tokens.access, tokens.refresh);
    await carregarPerfil({ recarregar: true });
  }

  async function logout() {
    await clearTokens();
    limparPerfilEmMemoria();
  }

  async function refreshProfile() {
    await carregarPerfil({ recarregar: true });
  }

  return {
    me,
    loading,
    login,
    logout,
    refreshProfile,
  };
}
