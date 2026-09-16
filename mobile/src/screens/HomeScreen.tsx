import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Bell } from "lucide-react-native";

import { Badge, Button, Card } from "@/components/Form";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Screen } from "@/components/Screen";
import { podeGerenciarEscalas } from "@/navigation";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ChurchEvent, Contribution, MeResponse, PersonalCommitment, ScheduleAssignment } from "@/types/api";
import { colors, formatBRL, formatDate, spacing, statusLabel } from "@/theme";

/**
 * Painel pessoal do membro.
 *
 * Regra desta tela (fase 1.6 do plano): todo numero exibido vem de um endpoint
 * real — `/me/schedules/`, `/me/statement/`, `/me/agenda/`, `/me/events/`.
 * Quando nao ha dado, a tela diz "Sem dados disponiveis" em vez de mostrar um
 * valor plausivel inventado (antes: "248 membros ativos", "R$ 12.450",
 * "87% confirmado", grafico fixo, "7 de 12 aulas", listas de cultos e
 * atividades decoradas). Indicadores da igreja inteira continuam no painel de
 * gestao — este painel e o do membro.
 */

function firstName(me: MeResponse): string {
  return me.member_name?.split(" ")[0] || me.first_name || "membro";
}

function initials(me: MeResponse): string {
  const name = me.member_name || `${me.first_name} ${me.last_name}`;
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "MC";
}

function headerDate(): string {
  const value = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function scheduleTone(status: ScheduleAssignment["status"]): "success" | "warning" | "danger" {
  if (status === "confirmed") return "success";
  if (status === "declined" || status === "unavailable") return "danger";
  return "warning";
}

function dataValida(valor?: string | null): number {
  if (!valor) return Number.NaN;
  return new Date(valor).getTime();
}

/** Itens futuros, do mais proximo para o mais distante. */
function futuros<T>(lista: T[], campo: (item: T) => string): T[] {
  const agora = Date.now();
  return [...lista]
    .filter((item) => {
      const quando = dataValida(campo(item));
      return !Number.isNaN(quando) && quando >= agora;
    })
    .sort((left, right) => dataValida(campo(left)) - dataValida(campo(right)));
}

function rotuloDia(valor?: string | null): string {
  const quando = dataValida(valor);
  if (Number.isNaN(quando)) return "—";
  const data = new Date(quando);
  if (data.toDateString() === new Date().toDateString()) return "Hoje";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(data).replace(".", "");
}

function rotuloHora(valor?: string | null): string {
  const quando = dataValida(valor);
  if (Number.isNaN(quando)) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(quando));
}

function DesktopDashboard({
  me,
  canAccessManagement,
  schedules,
  contributions,
  commitments,
  events,
  canCreateSchedule,
  hasError,
  onNavigate,
}: {
  me: MeResponse;
  canAccessManagement: boolean;
  schedules: ScheduleAssignment[];
  contributions: Contribution[];
  commitments: PersonalCommitment[];
  events: ChurchEvent[];
  canCreateSchedule: boolean;
  hasError: boolean;
  onNavigate: (route: string) => void;
}) {
  const contributionTotal = contributions.reduce((total, item) => total + Number(item.amount || 0), 0);
  const hoje = new Date();
  const contributionsDoMes = contributions.filter((item) => {
    const quando = dataValida(item.contribution_date);
    if (Number.isNaN(quando)) return false;
    const data = new Date(quando);
    return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
  });
  const totalDoMes = contributionsDoMes.reduce((total, item) => total + Number(item.amount || 0), 0);
  const pendentes = schedules.filter((item) => item.status === "pending").length;
  const confirmadas = schedules.filter((item) => item.status === "confirmed").length;
  const eventosFuturos = futuros(events, (item) => item.start_at);
  const escalasFuturas = futuros(
    schedules.filter((item) => !["declined", "unavailable"].includes(item.status)),
    (item) => item.event_start_at,
  );
  const compromissosFuturos = futuros(commitments, (item) => item.starts_at);

  const metrics = [
    {
      label: "Contribuições no mês",
      value: contributionsDoMes.length ? formatBRL(totalDoMes) : "—",
      detail: contributionsDoMes.length
        ? `${contributionsDoMes.length} lançamento${contributionsDoMes.length > 1 ? "s" : ""} no mês`
        : "Sem dados disponíveis",
    },
    {
      label: "Próximos cultos e eventos",
      value: eventosFuturos.length ? String(eventosFuturos.length) : "—",
      detail: eventosFuturos.length ? "Publicados na agenda da igreja" : "Sem dados disponíveis",
    },
    {
      label: "Escalas pendentes",
      value: hasError ? "—" : String(pendentes),
      detail: hasError ? "Dados indisponíveis" : pendentes ? "Aguardando sua resposta" : "Nada pendente por aqui",
    },
    {
      label: "Escalas confirmadas",
      value: hasError ? "—" : String(confirmadas),
      detail: hasError ? "Dados indisponíveis" : confirmadas ? "Você confirmou presença" : "Nenhuma confirmação registrada",
    },
  ];

  // Serie real do extrato pessoal: nao existe consolidado da igreja no app do membro.
  const serieMensal = useMemo(() => {
    const meses: Array<{ rotulo: string; total: number }> = [];
    for (let deslocamento = 5; deslocamento >= 0; deslocamento -= 1) {
      const referencia = new Date(hoje.getFullYear(), hoje.getMonth() - deslocamento, 1);
      const total = contributions.reduce((soma, item) => {
        const quando = dataValida(item.contribution_date);
        if (Number.isNaN(quando)) return soma;
        const data = new Date(quando);
        const mesmoMes = data.getMonth() === referencia.getMonth() && data.getFullYear() === referencia.getFullYear();
        return mesmoMes ? soma + Number(item.amount || 0) : soma;
      }, 0);
      meses.push({ rotulo: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(referencia).replace(".", ""), total });
    }
    return meses;
  }, [contributions]);
  const maiorMes = serieMensal.reduce((maior, mes) => Math.max(maior, mes.total), 0);

  const acoes: Array<[string, string]> = [["Registrar contribuição", "contribution"]];
  if (canCreateSchedule) acoes.push(["Criar escala", "schedule-create"]);
  acoes.push(["Minha agenda", "agenda"], ["Meu extrato", "statement"], ["Ver escalas", "schedules"]);

  return (
    <View style={styles.desktopDashboard}>
      <View style={styles.metricGrid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.desktopMetricCard}>
            <Text style={styles.desktopMetricLabel}>{metric.label}</Text>
            <Text style={styles.desktopMetricValue}>{metric.value}</Text>
            <Text style={styles.desktopMetricDetail}>{metric.detail}</Text>
          </View>
        ))}
      </View>
      <View style={styles.desktopDashboardRow}>
        <View style={styles.desktopChartCard}>
          <Text style={styles.desktopPanelTitle}>Minhas contribuições — últimos 6 meses</Text>
          <Text style={styles.desktopPanelMeta}>
            {maiorMes > 0 ? "Valores registrados no seu extrato" : "Sem dados disponíveis"}
          </Text>
          <View style={styles.chartArea}>
            {serieMensal.map((mes) => (
              <View key={mes.rotulo} style={styles.chartColumn}>
                <View style={[styles.chartBar, { height: maiorMes > 0 ? Math.max(6, Math.round((mes.total / maiorMes) * 150)) : 6 }]} />
                <Text style={styles.chartLabel}>{mes.rotulo}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.desktopQuickCard}>
          <Text style={styles.desktopPanelTitle}>Ações rápidas</Text>
          {acoes.map(([label, route], index) => (
            <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => onNavigate(route)} style={({ pressed }) => [styles.quickAction, index === 0 && styles.quickActionPrimary, pressed && styles.pressed]}>
              <Text style={[styles.quickActionText, index === 0 && styles.quickActionTextPrimary]}>{label}</Text>
              <Text style={[styles.quickActionArrow, index === 0 && styles.quickActionTextPrimary]}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.desktopBottomRow}>
        <View style={styles.desktopBottomCard}>
          <Text style={styles.desktopPanelTitle}>Próximos cultos e eventos</Text>
          {eventosFuturos.length === 0 ? (
            <Text style={styles.desktopListText}>Sem dados disponíveis</Text>
          ) : (
            eventosFuturos.slice(0, 3).map((evento) => (
              <View key={evento.id} style={styles.desktopListItem}>
                <Text style={styles.desktopListDate}>{rotuloDia(evento.start_at)}</Text>
                <Text style={styles.desktopListText}>{[evento.name, evento.location].filter(Boolean).join(" · ")}</Text>
              </View>
            ))
          )}
        </View>
        <View style={styles.desktopBottomCard}>
          <Text style={styles.desktopPanelTitle}>Minhas próximas escalas</Text>
          {escalasFuturas.length === 0 ? (
            <Text style={styles.desktopListText}>Sem dados disponíveis</Text>
          ) : (
            escalasFuturas.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.desktopListItem}>
                <Text style={styles.desktopListDate}>{item.ministry_name || item.role_name}</Text>
                <Text style={styles.desktopListText}>
                  {[item.event_name, `${rotuloDia(item.event_start_at)} ${rotuloHora(item.event_start_at)}`.trim()].filter(Boolean).join(" · ")}
                </Text>
              </View>
            ))
          )}
        </View>
        <View style={styles.desktopBottomCard}>
          <Text style={styles.desktopPanelTitle}>Últimas contribuições</Text>
          {contributions.length === 0 ? (
            <Text style={styles.desktopListText}>Sem dados disponíveis</Text>
          ) : (
            contributions.slice(0, 4).map((item) => (
              <View key={item.id} style={styles.desktopActivity}>
                <Text style={styles.activityDot}>●</Text>
                <Text style={styles.desktopListText}>
                  {formatDate(item.contribution_date)} · {statusLabel(item.category)} · {statusLabel(item.status)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
      <Text style={styles.desktopFooterText}>
        Moriah · {me.email}
        {compromissosFuturos[0] ? ` · Próximo compromisso: ${compromissosFuturos[0].title}` : ""}
        {` · Total no extrato: ${formatBRL(contributionTotal)}`}
        {canAccessManagement ? " · Indicadores da igreja ficam no painel de gestão" : ""}
      </Text>
    </View>
  );
}

export function HomeScreen({
  me,
  canAccessManagement,
  onNavigate,
  onLogout,
}: {
  me: MeResponse;
  canAccessManagement: boolean;
  onNavigate: (route: string) => void;
  onLogout: () => void;
}) {
  const isMember = Boolean(me.member_id);
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [schedules, setSchedules] = useState<ScheduleAssignment[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [commitments, setCommitments] = useState<PersonalCommitment[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    if (!isMember) {
      setLoading(false);
      return;
    }
    setError(null);
    const [escalas, extrato, agenda, eventos] = await Promise.allSettled([
      api.get<ScheduleAssignment[]>("/me/schedules/"),
      api.get<Contribution[]>("/me/statement/"),
      api.get<PersonalCommitment[]>("/me/agenda/"),
      api.get<ChurchEvent[]>("/me/events/"),
    ]);
    const failures: UserFacingError[] = [];
    if (escalas.status === "fulfilled") setSchedules(escalas.value);
    else failures.push(describeError(escalas.reason, "Nao foi possivel carregar suas escalas"));
    if (extrato.status === "fulfilled") setContributions(extrato.value);
    else failures.push(describeError(extrato.reason, "Nao foi possivel carregar seu extrato"));
    if (agenda.status === "fulfilled") setCommitments(agenda.value);
    else failures.push(describeError(agenda.reason, "Nao foi possivel carregar sua agenda"));
    if (eventos.status === "fulfilled") setEvents(eventos.value);
    else failures.push(describeError(eventos.reason, "Nao foi possivel carregar os eventos"));
    setError(failures.length ? { title: "Dados incompletos", message: failures.map((item) => item.message).join(" ") } : null);
    setLoading(false);
    setRefreshing(false);
  }, [isMember]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    void load();
  }

  const contributionTotal = useMemo(
    () => contributions.reduce((total, item) => total + Number(item.amount || 0), 0),
    [contributions],
  );
  const proximaEscala = useMemo(
    () => futuros(schedules.filter((item) => !["declined", "unavailable"].includes(item.status)), (item) => item.event_start_at)[0] || null,
    [schedules],
  );
  const proximoCompromisso = useMemo(() => futuros(commitments, (item) => item.starts_at)[0] || null, [commitments]);
  const canCreateSchedule = podeGerenciarEscalas(me.capabilities || []);

  const itensProximos = useMemo(() => {
    const compromissos = futuros(commitments, (item) => item.starts_at).map((item) => ({
      id: `compromisso-${item.id}`,
      quando: item.starts_at,
      dia: rotuloDia(item.starts_at),
      texto: [rotuloHora(item.starts_at), item.title].filter(Boolean).join(" · "),
    }));
    const eventos = futuros(events, (item) => item.start_at).map((item) => ({
      id: `evento-${item.id}`,
      quando: item.start_at,
      dia: rotuloDia(item.start_at),
      texto: [rotuloHora(item.start_at), item.name].filter(Boolean).join(" · "),
    }));
    return [...compromissos, ...eventos].sort((left, right) => dataValida(left.quando) - dataValida(right.quando)).slice(0, 3);
  }, [commitments, events]);

  return (
    <Screen
      title={`Olá, ${firstName(me)} 👋`}
      headerSubtitle={headerDate()}
      showBottomNav={isMember}
      refreshing={refreshing || loading}
      onRefresh={onRefresh}
      headerAccessory={!desktop && isMember ? (<View style={styles.headerActions}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(me)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Notificações" onPress={() => onNavigate("notifications")} style={styles.notificationButton}>
            <Bell size={20} strokeWidth={1.8} color={colors.accent} />
          </Pressable>
        </View>) : undefined}
    >
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {desktop && isMember ? (
        <DesktopDashboard
          me={me}
          canAccessManagement={canAccessManagement}
          schedules={schedules}
          contributions={contributions}
          commitments={commitments}
          events={events}
          canCreateSchedule={canCreateSchedule}
          hasError={Boolean(error)}
          onNavigate={onNavigate}
        />
      ) : <>
      {canAccessManagement ? (
        <Card style={styles.managementCard}>
          <Text style={styles.eyebrow}>ACESSO DE GESTÃO</Text>
          <Text style={styles.cardTitle}>Painel de gestão</Text>
          <Text style={styles.meta}>Esta conta possui permissões administrativas além da experiência pessoal.</Text>
        </Card>
      ) : null}

      {!isMember ? (
        <Card style={styles.managementCard}>
          <Text style={styles.cardTitle}>Conta administrativa sem membro vinculado</Text>
          <Text style={styles.meta}>As áreas de perfil, contribuições, escalas e agenda ficam ocultas porque esta conta não possui um cadastro de membro associado.</Text>
          {canCreateSchedule ? <Button size="compact" onPress={() => onNavigate("schedule-create")}>Abrir gestão de escalas</Button> : null}
        </Card>
      ) : null}

      {isMember ? <>
      <Card style={styles.scheduleCard}>
        <Text style={styles.eyebrow}>MINHA PRÓXIMA ESCALA</Text>
        {proximaEscala ? (
          <>
            <Text style={styles.scheduleTitle}>{proximaEscala.event_name}</Text>
            <Text style={styles.meta}>{formatDate(proximaEscala.event_start_at, true)}</Text>
            <Badge label={proximaEscala.status === "pending" ? "Convite pendente" : statusLabel(proximaEscala.status)} tone={scheduleTone(proximaEscala.status)} />
            <Text style={styles.role}>{proximaEscala.ministry_name} · {proximaEscala.role_name}</Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonFlex}><Button size="compact" onPress={() => onNavigate("schedule/" + proximaEscala.id)}>Confirmar</Button></View>
              <View style={[styles.buttonFlex, styles.buttonFlexSmall]}><Button size="compact" variant="secondary" onPress={() => onNavigate("schedule/" + proximaEscala.id)}>Não posso</Button></View>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.scheduleTitle}>Nenhuma escala próxima</Text>
            <Text style={styles.meta}>Quando você for escalado, os detalhes aparecerão aqui.</Text>
          </>
        )}
      </Card>

      <Card style={styles.contributionCard}>
        <Text style={styles.cardTitle}>Contribuições</Text>
        <Text style={styles.contributionValue}>
          {contributions.length ? `Última contribuição  •  ${formatBRL(contributionTotal)}` : "Nenhuma contribuição registrada"}
        </Text>
        <Text style={styles.successMeta}>
          {contributions[0]
            ? `${formatDate(contributions[0].contribution_date)} • ${statusLabel(contributions[0].category)} • ${statusLabel(contributions[0].status)}`
            : "Sem dados disponíveis"}
        </Text>
        <View style={styles.contributionActions}>
          <Button size="compact" onPress={() => onNavigate("contribution")}>Enviar comprovante</Button>
          <Pressable accessibilityRole="button" accessibilityLabel="Ver histórico de contribuições" onPress={() => onNavigate("statement")} style={styles.historyButton}><Text style={styles.linkText}>Ver histórico</Text></Pressable>
        </View>
      </Card>

      <Card style={styles.upcomingCard}>
        <Text style={styles.cardTitle}>Próximos</Text>
        {itensProximos.length === 0 ? (
          <Text style={styles.mutedSmall}>Sem dados disponíveis</Text>
        ) : (
          itensProximos.map((item) => (
            <View key={item.id} style={styles.eventRow}><Text style={styles.day}>{item.dia}</Text><Text style={styles.event}>{item.texto}</Text></View>
          ))
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir minha agenda" onPress={() => onNavigate("agenda")} style={styles.readButton}><Text style={styles.linkText}>Ver agenda completa</Text></Pressable>
      </Card>

      <View style={styles.footer}><Text style={styles.footerText}>Moriah · {me.email}</Text><Pressable accessibilityRole="button" onPress={onLogout} style={styles.logoutButton}><Text style={styles.logoutText}>Sair</Text></Pressable></View>
      </> : <View style={styles.footer}><Text style={styles.footerText}>Moriah · {me.email}</Text><Pressable accessibilityRole="button" onPress={onLogout} style={styles.logoutButton}><Text style={styles.logoutText}>Sair</Text></Pressable></View>}
      </>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 36, height: 36, borderRadius: 6, backgroundColor: colors.avatar, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700", color: colors.accent },
  notificationButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  scheduleCard: { minHeight: 170 },
  managementCard: { minHeight: 112 },
  eyebrow: { fontSize: 10, fontWeight: "700", color: colors.inkMuted },
  scheduleTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 12, color: colors.inkMuted },
  role: { fontSize: 12, fontWeight: "600", color: colors.inkBody },
  buttonRow: { flexDirection: "row", gap: 10 },
  buttonFlex: { flex: 0, minWidth: 132 },
  buttonFlexSmall: { minWidth: 105 },
  contributionCard: { minHeight: 112 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  contributionValue: { fontSize: 12, fontWeight: "600", color: colors.ink },
  successMeta: { fontSize: 11, color: colors.successText },
  contributionActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  historyButton: { paddingVertical: 4 },
  linkText: { fontSize: 12, fontWeight: "700", color: colors.accent },
  upcomingCard: { minHeight: 126, gap: spacing.xs },
  eventRow: { flexDirection: "row", gap: 48, alignItems: "center" },
  day: { width: 44, fontSize: 10, fontWeight: "700", color: colors.accent },
  event: { flex: 1, fontSize: 11, color: colors.inkBody },
  mutedSmall: { fontSize: 10, color: colors.inkMuted },
  readButton: { alignSelf: "flex-end", paddingVertical: 4 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xs },
  footerText: { flex: 1, fontSize: 11, color: colors.inkPlaceholder },
  logoutButton: { padding: spacing.sm },
  logoutText: { fontSize: 12, fontWeight: "700", color: colors.danger },

  desktopDashboard: { gap: 24 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  desktopMetricCard: { width: "48.8%", minHeight: 106, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 18, gap: 7 },
  desktopMetricLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: "700" },
  desktopMetricValue: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  desktopMetricDetail: { color: colors.inkMuted, fontSize: 11 },
  desktopDashboardRow: { flexDirection: "row", gap: 24 },
  desktopChartCard: { flex: 1.84, height: 336, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 20 },
  desktopQuickCard: { flex: 1, height: 336, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 20, gap: 9 },
  desktopPanelTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  desktopPanelMeta: { color: colors.inkMuted, fontSize: 11, marginTop: 5 },
  chartArea: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: 36, paddingBottom: 4 },
  chartColumn: { alignItems: "center", justifyContent: "flex-end", gap: 8, height: 190 },
  chartBar: { width: 28, minHeight: 6, borderRadius: 5, backgroundColor: colors.accent },
  chartLabel: { color: colors.inkMuted, fontSize: 10 },
  quickAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 7, backgroundColor: "#F9FAFB" },
  quickActionPrimary: { backgroundColor: "#EEF2FF" },
  quickActionText: { color: colors.inkBody, fontSize: 11, fontWeight: "600" },
  quickActionTextPrimary: { color: colors.accent, fontWeight: "800" },
  quickActionArrow: { color: colors.inkMuted, fontSize: 20 },
  desktopBottomRow: { flexDirection: "row", gap: 24 },
  desktopBottomCard: { flex: 1, height: 252, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 18, gap: 16 },
  desktopListItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  desktopListDate: { width: 62, color: colors.accent, fontSize: 10, fontWeight: "800" },
  desktopListText: { flex: 1, color: colors.inkBody, fontSize: 11, lineHeight: 16 },
  desktopActivity: { flexDirection: "row", alignItems: "center", gap: 9 },
  activityDot: { color: colors.accent, fontSize: 9 },
  desktopFooterText: { color: colors.inkPlaceholder, fontSize: 11 },
});
