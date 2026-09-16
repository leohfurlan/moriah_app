import { useEffect } from "react";
import { Stack } from "expo-router";
import { usePathname, useRouter } from "expo-router";

import { ToastProvider, useToast } from "@/components/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { Capacidade, CAPACIDADES_DE_ESCALA, podeGerenciarEscalas } from "@/navigation";

/** Rotas que exigem apenas estar logado com vinculo de membro. */
const MEMBER_PATHS = ["/profile", "/statement", "/contribution", "/schedules", "/agenda", "/notifications"];

/**
 * Rotas de gestao: exigem capacidade. O backend continua sendo a autoridade
 * final (403), mas o app nao oferece o caminho a quem nao pode usar — e, se a
 * URL for digitada na mao, avisa em portugues em vez de abrir a tela vazia.
 */
const ROTAS_DE_GESTAO: Record<string, Capacidade[]> = {
  "/schedule-create": CAPACIDADES_DE_ESCALA,
};

function isMemberPath(pathname: string): boolean {
  return (
    MEMBER_PATHS.includes(pathname) ||
    pathname.startsWith("/schedule/") ||
    pathname.startsWith("/song/") ||
    pathname.startsWith("/notification/") ||
    pathname in ROTAS_DE_GESTAO
  );
}

function capacidadesDaRota(pathname: string): Capacidade[] | null {
  return ROTAS_DE_GESTAO[pathname] ?? null;
}

function LayoutComGuarda() {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useAuth();
  const toast = useToast();
  const exige = capacidadesDaRota(pathname);
  const precisaLogin = Boolean(!loading && !me && isMemberPath(pathname));
  const semVinculo = Boolean(me && !me.member_id && isMemberPath(pathname) && !exige);
  const destinoSemVinculo = me && podeGerenciarEscalas(me.capabilities || []) ? "/schedule-create" : "/home";
  const semCapacidade = Boolean(me && exige && !exige.some((capacidade) => (me.capabilities || []).includes(capacidade)));

  useEffect(() => {
    if (precisaLogin) router.replace("/");
    else if (semVinculo) router.replace(destinoSemVinculo);
    else if (semCapacidade) {
      toast("Sua conta não tem permissão para criar escalas.", { tone: "error", title: "Acesso restrito" });
      router.replace("/schedules");
    }
  }, [precisaLogin, semVinculo, semCapacidade, destinoSemVinculo, router, toast]);

  if (loading && isMemberPath(pathname)) return null;
  if (precisaLogin || semVinculo || semCapacidade) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function Layout() {
  return (
    <ToastProvider>
      <LayoutComGuarda />
    </ToastProvider>
  );
}
