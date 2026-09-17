import { useEffect } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { usePathname, useRouter } from "expo-router";

import { ToastProvider, useToast } from "@/components/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { Capacidade, CAPACIDADES_DE_ESCALA, podeGerenciarEscalas } from "@/navigation";
import { colors, radius, spacing } from "@/theme";

/** Rotas que exigem apenas estar logado com vinculo de membro. */
const MEMBER_PATHS = ["/profile", "/statement", "/contribution", "/schedules", "/agenda", "/agenda-new", "/content", "/notifications"];

/**
 * Rotas de gestao: exigem capacidade. O backend continua sendo a autoridade
 * final (403), mas o app nao oferece o caminho a quem nao pode usar — e, se a
 * URL for digitada na mao, avisa em portugues em vez de abrir a tela vazia.
 */
const ROTAS_DE_GESTAO: Record<string, Capacidade[]> = {
  "/schedule-create": CAPACIDADES_DE_ESCALA,
  "/finance-review": ["review_contributions", "manage_all"],
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
  return porPrefixo ? porPrefixo.capacidades : null;
}

/** A gestao de escalas tem aviso na propria tela (sem redirecionar). */
function rotaRestritaDeEscalas(pathname: string): boolean {
  return pathname === "/schedule-admin" || pathname.startsWith("/schedule-admin/");
}

function isMemberPath(pathname: string): boolean {
  return (
    MEMBER_PATHS.includes(pathname) ||
    pathname.startsWith("/schedule/") ||
    pathname.startsWith("/song/") ||
    pathname.startsWith("/notification/") ||
    capacidadesDaRota(pathname) !== null
  );
}

function LayoutComGuarda() {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useAuth();
  const toast = useToast();
  const exige = capacidadesDaRota(pathname);
  const precisaLogin = Boolean(!loading && !me && isMemberPath(pathname));
  const semVinculo = Boolean(me && !me.member_id && isMemberPath(pathname) && !exige && !me.can_access_management);
  const destinoSemVinculo = me && podeGerenciarEscalas(me.capabilities || []) ? "/schedule-create" : "/home";
  const semCapacidade = Boolean(me && exige && !exige.some((capacidade) => (me.capabilities || []).includes(capacidade)));
  // Gestao de escalas avisa na propria pagina: jogar o membro direto em
  // "Minhas escalas" sem explicacao parecia tela quebrada (fase 1).
  const avisoNaTela = Boolean(me && semCapacidade && rotaRestritaDeEscalas(pathname));

  useEffect(() => {
    if (precisaLogin) router.replace("/");
    else if (semVinculo) router.replace(destinoSemVinculo);
    else if (semCapacidade && !avisoNaTela) {
      const rotaFinanceira = pathname === "/finance-review";
      toast(rotaFinanceira ? "Sua conta não tem permissão para revisar contribuições." : "Sua conta não tem permissão para criar escalas.", { tone: "error", title: "Acesso restrito" });
      router.replace(rotaFinanceira ? "/home" : "/schedules");
    }
  }, [precisaLogin, semVinculo, semCapacidade, avisoNaTela, destinoSemVinculo, router, toast]);

  if (loading && isMemberPath(pathname)) return null;
  if (avisoNaTela) return <AcessoRestritoEscalas />;
  if (precisaLogin || semVinculo || semCapacidade) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
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
      <LayoutComGuarda />
    </ToastProvider>
  );
}
