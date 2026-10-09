import { useEffect } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { usePathname, useRouter } from "expo-router";

import { ToastProvider, useToast } from "@/components/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { Capacidade, CAPACIDADES_DE_COMPROMISSO, CAPACIDADES_DE_DIRETORIO, CAPACIDADES_DE_ESCALA, moduloOculto, podeGerenciarEscalas, raizDaRota } from "@/navigation";
import { colors, radius, spacing } from "@/theme";
import { WebEffects } from "@/components/WebEffects";
import { useReducedMotion } from "@/components/Motion";
import { useOnResume } from "@/hooks/useOnResume";
import { loadNotifications } from "@/services/notificationStore";
import {rememberOnboardingDestination} from "@/services/onboarding";

/**
 * Rotas que exigem apenas estar logado com vinculo de membro. As areas de
 * gestao (financeiro, membros, conteudo, eventos, novo compromisso) ficam em
 * ROTAS_DE_GESTAO: quem opera o painel (admin, pastor, tesouraria, secretaria,
 * coordenacao) costuma nao ter cadastro de membro, e exigir vinculo ali fechava
 * a tela para quem tem a permissao no backend.
 *
 * As telas sem modulo no backend (ministerios, setlists, repertorio, bandas,
 * escola biblica, turmas) sairam desta lista e ficam em ROTAS_OCULTAS
 * (navigation.ts): a rota nao renderiza tela vazia nem entra no menu.
 */
const MEMBER_PATHS = ["/profile", "/statement", "/contribution", "/schedules", "/agenda", "/notifications"];

/**
 * Rotas de gestao: exigem capacidade. O backend continua sendo a autoridade
 * final (403), mas o app nao oferece o caminho a quem nao pode usar — e, se a
 * URL for digitada na mao, avisa em portugues em vez de abrir a tela vazia.
 */
const ROTAS_DE_GESTAO: Record<string, Capacidade[]> = {
  "/settings": ["manage_all"],
  "/member-link-requests": ["manage_members", "manage_all"],
  "/schedule-create": CAPACIDADES_DE_ESCALA,
  "/finance-review": ["review_contributions", "manage_all"],
  "/finance": ["manage_finance"],
  "/finance-management": ["manage_finance"],
  "/members": CAPACIDADES_DE_DIRETORIO,
  "/visitors": CAPACIDADES_DE_DIRETORIO,
  "/events": ["member", "manage_events"],
  "/content": ["member", "manage_content"],
  // Compromisso na agenda e da lideranca de ministerio ou de celula.
  "/agenda-new": CAPACIDADES_DE_COMPROMISSO,
};

/**
 * Rotas de gestao com id na URL (detalhe). O prefixo cobre `/schedule-admin` e
 * `/schedule-admin/<id>` sem precisar listar cada tela.
 */
const PREFIXOS_DE_GESTAO: Array<{ prefixo: string; capacidades: Capacidade[] }> = [
  { prefixo: "/schedule-admin", capacidades: CAPACIDADES_DE_ESCALA },
];

function capacidadesDaRota(pathname: string): Capacidade[] | null {
  if (ROTAS_DE_GESTAO[pathname]) return ROTAS_DE_GESTAO[pathname];
  const porPrefixo = PREFIXOS_DE_GESTAO.find(
    (rota) => pathname === rota.prefixo || pathname.startsWith(`${rota.prefixo}/`),
  );
  if (porPrefixo) return porPrefixo.capacidades;
  // Sub-rota herda a capacidade da area (ex.: `/content/1` -> `/content`). Sem
  // isto `/content/1` nao era area de gestao: quem nao tinha a capacidade abria
  // o detalhe pela URL, e a sub-rota nem contava como area de membro, entao a
  // sessao expirada ficava na tela em vez de voltar ao login (fase 6).
  return ROTAS_DE_GESTAO[`/${raizDaRota(pathname)}`] ?? null;
}

/** A gestao de escalas tem aviso na propria tela (sem redirecionar). */
function rotaRestritaDeEscalas(pathname: string): boolean {
  return pathname === "/schedule-admin" || pathname.startsWith("/schedule-admin/");
}

function isMemberPath(pathname: string): boolean {
  return (
    MEMBER_PATHS.includes(pathname) || ["/onboarding", "/welcome", "/service-times"].includes(pathname) ||
    pathname.startsWith("/schedule/") ||
    pathname.startsWith("/song/") ||
    pathname.startsWith("/notification/") ||
    capacidadesDaRota(pathname) !== null
  );
}

function LayoutComGuarda() {
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading, refreshProfile } = useAuth();
  useOnResume(() => {
    if (me) {
      void refreshProfile();
      if (me.onboarding_completed) void loadNotifications(me.id, true).catch(() => undefined);
    }
  });
  const toast = useToast();
  const exige = capacidadesDaRota(pathname);
  // Modulo ainda sem tela real (ver ROTAS_OCULTAS em navigation.ts): a rota nao
  // renderiza o placeholder nem entra na guarda de membro — quem digitou a URL
  // recebe o aviso em portugues e volta para a home.
  const rotaOculta = moduloOculto(pathname);
  const precisaLogin = Boolean(!loading && !me && (isMemberPath(pathname) || rotaOculta));
  const moduloIndisponivel = Boolean(me && rotaOculta && !precisaLogin);
  const contaSemMembroPermitida = ["/onboarding", "/welcome", "/service-times", "/profile", "/notifications"].includes(pathname) || pathname.startsWith("/notification/");
  const precisaOnboarding = Boolean(!loading && me && me.onboarding_completed === false && pathname !== "/onboarding");
  const semVinculo = Boolean(me && !me.member_id && isMemberPath(pathname) && !exige && !me.can_access_management && !contaSemMembroPermitida);
  const destinoSemVinculo = me && podeGerenciarEscalas(me.capabilities || []) ? "/schedule-create" : "/home";
  const semCapacidade = Boolean(me && exige && !exige.some((capacidade) => (me.capabilities || []).includes(capacidade)));
  // Gestao de escalas avisa na propria pagina: jogar o membro direto em
  // "Minhas escalas" sem explicacao parecia tela quebrada (fase 1).
  const avisoNaTela = Boolean(me && semCapacidade && rotaRestritaDeEscalas(pathname));

  useEffect(() => {
    if (precisaLogin) router.replace("/");
    else if (precisaOnboarding) {
      if (me) rememberOnboardingDestination(me.id, pathname);
      router.replace("/onboarding" as never);
    }
    else if (moduloIndisponivel) {
      toast("Este módulo ainda não está disponível.", { tone: "error", title: "Em breve" });
      router.replace("/home");
    } else if (semVinculo) router.replace(destinoSemVinculo);
    else if (semCapacidade && !avisoNaTela) {
      const rotaFinanceira = pathname === "/finance-review";
      const rotaDeEscala = pathname === "/schedule-create" || pathname.startsWith("/schedule-admin");
      toast(
        rotaFinanceira
          ? "Sua conta não tem permissão para revisar contribuições."
          : rotaDeEscala
            ? "Sua conta não tem permissão para criar escalas."
            : "Sua conta não tem permissão para acessar esta área.",
        { tone: "error", title: "Acesso restrito" },
      );
      router.replace(rotaDeEscala ? "/schedules" : "/home");
    }
  }, [precisaLogin, precisaOnboarding, moduloIndisponivel, semVinculo, semCapacidade, avisoNaTela, destinoSemVinculo, me?.id, pathname, router, toast]);

  if (loading && (isMemberPath(pathname) || rotaOculta)) return null;
  if (precisaOnboarding) return null;
  if (avisoNaTela) return <AcessoRestritoEscalas />;
  if (precisaLogin || moduloIndisponivel || semVinculo || semCapacidade) return null;
  return <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? "none" : "default" }} />;
}

/**
 * Tela de acesso restrito a gestao de escalas.
 *
 * Nao redireciona: quem digitou a URL na mao (ou recebeu o link) precisa ler o
 * motivo, e a lista administrativa nunca pode aparecer para quem nao coordena.
 */
function AcessoRestritoEscalas() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.restritoSafeArea}>
      <View style={styles.restritoCard}>
        <Text accessibilityRole="header" style={styles.restritoTitulo}>
          Acesso restrito
        </Text>
        <Text style={styles.restritoTexto}>
          A gestão de escalas é da coordenação e da liderança da igreja. Sua conta não tem permissão
          para montar, publicar ou cancelar escalas.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para minhas escalas"
          onPress={() => router.replace("/schedules")}
          style={({ pressed }) => [styles.restritoBotao, pressed && styles.restritoBotaoPressed]}
        >
          <Text style={styles.restritoBotaoTexto}>Minhas escalas</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  restritoSafeArea: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  restritoCard: {
    width: "100%",
    maxWidth: 460,
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  restritoTitulo: { fontSize: 20, fontWeight: "800", color: colors.ink },
  restritoTexto: { fontSize: 14, lineHeight: 20, color: colors.inkBody },
  restritoBotao: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.field,
  },
  restritoBotaoPressed: { opacity: 0.85 },
  restritoBotaoTexto: { color: colors.onAccent, fontSize: 14, fontWeight: "700" },
});

export default function Layout() {
  return (
    <ToastProvider>
      <WebEffects />
      <LayoutComGuarda />
    </ToastProvider>
  );
}
