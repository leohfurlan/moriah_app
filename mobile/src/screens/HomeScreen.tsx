import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Bell, BookOpen, CalendarCheck, CalendarDays, ChevronRight, HandCoins, MoreHorizontal, Settings2 } from "lucide-react-native";

import { Badge, Button, Card } from "@/components/Form";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Screen } from "@/components/Screen";
import { podeGerenciarEscalas } from "@/navigation";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ChurchEvent, Contribution, MeResponse, PersonalCommitment, ScheduleAssignment } from "@/types/api";
import { colors, formatBRL, formatDate, radius, spacing, statusLabel } from "@/theme";

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

type QuickShortcutId = "contribution" | "agenda" | "schedules" | "content" | "statement" | "finance-review" | "schedule-create";

type QuickShortcut = {
  id: QuickShortcutId;
  label: string;
  route: string;
  Icon: typeof HandCoins;
};

const QUICK_SHORTCUTS: QuickShortcut[] = [
  { id: "contribution", label: "Contribuir", route: "contribution", Icon: HandCoins },
  { id: "agenda", label: "Agenda", route: "agenda", Icon: CalendarDays },
  { id: "schedules", label: "Escalas", route: "schedules", Icon: CalendarCheck },
  { id: "content", label: "Conteúdo", route: "content", Icon: BookOpen },
  { id: "statement", label: "Extrato", route: "statement", Icon: HandCoins },
  { id: "finance-review", label: "Revisão", route: "finance-review", Icon: BookOpen },
  { id: "schedule-create", label: "Criar escala", route: "schedule-create", Icon: CalendarCheck },
];

const DEFAULT_SHORTCUTS: QuickShortcutId[] = ["contribution", "agenda", "schedules"];

function shortcutsKey(me: MeResponse): string {
  return `moriah:home-shortcuts:${me.id}`;
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
  const canLoadHome = isMember || canAccessManagement;
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [schedules, setSchedules] = useState<ScheduleAssignment[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [commitments, setCommitments] = useState<PersonalCommitment[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [shortcuts, setShortcuts] = useState<QuickShortcutId[]>(DEFAULT_SHORTCUTS);
  const [shortcutDraft, setShortcutDraft] = useState<QuickShortcutId[]>(DEFAULT_SHORTCUTS);
  const [editingShortcuts, setEditingShortcuts] = useState(false);

  const load = useCallback(async () => {
    if (!canLoadHome) {
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
  }, [canLoadHome]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    let ativo = true;
    void AsyncStorage.getItem(shortcutsKey(me)).then((value) => {
      if (!ativo || !value) return;
      try {
        const saved = JSON.parse(value) as QuickShortcutId[];
        const valid = saved.filter((id) => QUICK_SHORTCUTS.some((shortcut) => shortcut.id === id)).slice(0, 3);
        if (valid.length) {
          setShortcuts(valid);
          setShortcutDraft(valid);
        }
      } catch {
        // Uma preferência inválida não impede a Home de carregar.
      }
    });
    return () => { ativo = false; };
  }, [me]);

  function onRefresh() {
    setRefreshing(true);
    void load();
  }

  const proximaEscala = useMemo(
    () => futuros(schedules.filter((item) => !["declined", "unavailable"].includes(item.status)), (item) => item.event_start_at)[0] || null,
    [schedules],
  );
  const proximoCompromisso = useMemo(() => futuros(commitments, (item) => item.starts_at)[0] || null, [commitments]);
  const canCreateSchedule = podeGerenciarEscalas(me.capabilities || []);
  const canReviewContributions = (me.capabilities || []).some(capability => ["review_contributions", "manage_all"].includes(capability));
  const availableShortcuts = useMemo(
    () => QUICK_SHORTCUTS.filter((shortcut) => {
      if (["contribution", "agenda", "schedules", "content", "statement"].includes(shortcut.id)) return true;
      if (shortcut.id === "finance-review") return canReviewContributions;
      return shortcut.id === "schedule-create" && canCreateSchedule;
    }),
    [canCreateSchedule, canReviewContributions],
  );
  const visibleShortcuts = shortcuts.filter((id) => availableShortcuts.some((shortcut) => shortcut.id === id));

  const destaque = useMemo(() => {
    const escala = proximaEscala ? {
      kind: "Escala",
      title: proximaEscala.event_name,
      detail: formatDate(proximaEscala.event_start_at, true),
      badge: [proximaEscala.ministry_name, proximaEscala.role_name].filter(Boolean).join(" · "),
      route: `schedule/${proximaEscala.id}`,
    } : null;
    if (escala) return escala;
    if (proximoCompromisso) {
      return {
        kind: "Próximo compromisso",
        title: proximoCompromisso.title,
        detail: `${formatDate(proximoCompromisso.starts_at)} · ${rotuloHora(proximoCompromisso.starts_at)}`,
        badge: "Agenda pessoal",
        route: "agenda",
      };
    }
    const evento = futuros(events, (item) => item.start_at)[0];
    if (evento) {
      return {
        kind: "Próximo compromisso",
        title: evento.name,
        detail: [formatDate(evento.start_at), evento.location].filter(Boolean).join(" · "),
        badge: evento.event_type_display || "Agenda da igreja",
        route: "agenda",
      };
    }
    return null;
  }, [events, proximaEscala, proximoCompromisso]);

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

  function abrirEditorAtalhos() {
    setShortcutDraft(shortcuts);
    setEditingShortcuts(true);
  }

  function alternarAtalho(id: QuickShortcutId) {
    setShortcutDraft((atual) => {
      if (atual.includes(id)) return atual.filter((item) => item !== id);
      if (atual.length >= 3) return atual;
      return [...atual, id];
    });
  }

  async function salvarAtalhos() {
    const next = shortcutDraft.length ? shortcutDraft : DEFAULT_SHORTCUTS;
    setShortcuts(next);
    setEditingShortcuts(false);
    await AsyncStorage.setItem(shortcutsKey(me), JSON.stringify(next));
  }

  return (
    <Screen
      title={`Olá, ${firstName(me)} 👋`}
      headerSubtitle={headerDate()}
      showBottomNav={canLoadHome || canReviewContributions}
      refreshing={refreshing || loading}
      onRefresh={onRefresh}
      headerAccessory={!desktop && canLoadHome ? (<View style={styles.headerActions}>
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
      {!canLoadHome ? (
        <Card style={styles.managementCard}>
          <Text style={styles.cardTitle}>Acesso limitado</Text>
          <Text style={styles.meta}>Vincule um cadastro de membro para personalizar sua experiência no Moriah.</Text>
        </Card>
      ) : (
        <View style={styles.mobileHome}>
          {canAccessManagement && !isMember ? (
            <Card style={styles.adminHomeCard}>
              <View style={styles.adminHomeCopy}>
                <Text style={styles.eyebrow}>ACESSO DE GESTÃO</Text>
                <Text style={styles.cardTitle}>Visão administrativa</Text>
                <Text style={styles.meta}>Você pode visualizar as áreas da igreja e gerenciar os conteúdos disponíveis.</Text>
              </View>
              {canReviewContributions ? <Button size="compact" onPress={() => onNavigate("finance-review")}>Abrir revisão</Button> : null}
            </Card>
          ) : null}

          <View style={styles.homeSearch}>
            <TextInput accessibilityLabel="Buscar na igreja" placeholder="Buscar na igreja" placeholderTextColor={colors.inkPlaceholder} style={styles.homeSearchInput} />
            <Text style={styles.homeSearchHint}>⌕</Text>
          </View>

          <Card style={styles.quickCard}>
            <View style={styles.quickHeader}>
              <Text style={styles.sectionTitle}>Acessos rápidos</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Editar acessos rápidos" onPress={abrirEditorAtalhos} style={styles.editShortcutButton}>
                <Settings2 size={13} color={colors.accent} />
                <Text style={styles.linkText}>Editar</Text>
              </Pressable>
            </View>
            <View style={styles.quickGrid}>
              {visibleShortcuts.map((id) => {
                const shortcut = QUICK_SHORTCUTS.find((item) => item.id === id);
                if (!shortcut) return null;
                const Icon = shortcut.Icon;
                return (
                  <Pressable key={shortcut.id} accessibilityRole="button" accessibilityLabel={shortcut.label} onPress={() => onNavigate(shortcut.route)} style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}>
                    <Icon size={17} strokeWidth={1.8} color={colors.accent} />
                    <Text numberOfLines={1} style={styles.quickTileText}>{shortcut.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable accessibilityRole="button" accessibilityLabel="Mais acessos rápidos" onPress={abrirEditorAtalhos} style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}>
                <MoreHorizontal size={17} strokeWidth={1.8} color={colors.inkMuted} />
                <Text numberOfLines={1} style={styles.quickTileText}>Mais</Text>
              </Pressable>
            </View>
          </Card>

          <Card style={styles.priorityCard} onPress={() => destaque && onNavigate(destaque.route)}>
            <View style={styles.priorityAccent} />
            <View style={styles.priorityCopy}>
              <View style={styles.priorityHeader}>
                <Text style={styles.eyebrow}>{destaque?.kind.toUpperCase() || "PRÓXIMO COMPROMISSO"}</Text>
                <ChevronRight size={18} color={colors.accent} />
              </View>
              <Text style={styles.priorityTitle}>{destaque?.title || "Nenhum compromisso próximo"}</Text>
              <Text style={styles.meta}>{destaque?.detail || "Quando houver uma escala ou evento, ele aparecerá aqui."}</Text>
              {destaque?.badge ? <Badge label={destaque.badge} tone="neutral" /> : null}
            </View>
          </Card>

          <View style={styles.offerBanner}>
            <View style={styles.offerCopy}>
              <Text style={styles.offerEyebrow}>GENEROSIDADE</Text>
              <Text style={styles.offerTitle}>Oferta com propósito.</Text>
              <Text style={styles.offerMeta}>Contribua com a igreja de forma simples e segura.</Text>
              <Button size="compact" onPress={() => onNavigate("contribution")}>Contribuir agora</Button>
            </View>
            <View style={styles.offerArt}>
              <View style={styles.offerArtCircle} />
              <HandCoins size={54} strokeWidth={1.45} color={colors.accent} />
            </View>
          </View>

          <Card style={styles.todayCard}>
            <View style={styles.todayHeader}>
              <Text style={styles.sectionTitle}>Hoje na igreja</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Ver agenda" onPress={() => onNavigate("agenda")}><Text style={styles.linkText}>Ver agenda</Text></Pressable>
            </View>
            {itensProximos.length === 0 ? <Text style={styles.mutedSmall}>Sem compromissos ou eventos publicados.</Text> : itensProximos.slice(0, 2).map((item) => (
              <View key={item.id} style={styles.todayRow}>
                <View style={styles.todayDay}><Text style={styles.todayDayText}>{item.dia}</Text></View>
                <Text numberOfLines={2} style={styles.todayEvent}>{item.texto}</Text>
              </View>
            ))}
          </Card>

          <View style={styles.footer}><Text style={styles.footerText}>Moriah · {me.email}</Text><Pressable accessibilityRole="button" onPress={onLogout} style={styles.logoutButton}><Text style={styles.logoutText}>Sair</Text></Pressable></View>
        </View>
      )}
      </>}
      <Modal visible={editingShortcuts} transparent animationType="slide" onRequestClose={() => setEditingShortcuts(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.shortcutModal}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>Editar acessos rápidos</Text><Text style={styles.meta}>Escolha até 3 atalhos para a Home.</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar editor de acessos rápidos" onPress={() => setEditingShortcuts(false)}><Text style={styles.modalClose}>×</Text></Pressable>
            </View>
            {availableShortcuts.map((shortcut) => {
              const selected = shortcutDraft.includes(shortcut.id);
              const Icon = shortcut.Icon;
              return (
                <Pressable key={shortcut.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => alternarAtalho(shortcut.id)} style={styles.shortcutOption}>
                  <Icon size={17} color={selected ? colors.accent : colors.inkMuted} />
                  <Text style={styles.shortcutOptionText}>{shortcut.label}</Text>
                  <View style={[styles.shortcutCheck, selected && styles.shortcutCheckSelected]}>{selected ? <Text style={styles.shortcutCheckText}>✓</Text> : null}</View>
                </Pressable>
              );
            })}
            <Button size="compact" onPress={() => void salvarAtalhos()}>Salvar acessos</Button>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 36, height: 36, borderRadius: 6, backgroundColor: colors.avatar, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700", color: colors.accent },
  notificationButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  mobileHome: { gap: spacing.md },
  adminHomeCard: { gap: spacing.sm, backgroundColor: colors.surfaceSelected, borderColor: "#C7D2FE" },
  adminHomeCopy: { gap: spacing.xs },
  homeSearch: { height: 46, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.field, paddingHorizontal: spacing.md },
  homeSearchInput: { flex: 1, color: colors.inkBody, fontSize: 13, paddingVertical: 0 },
  homeSearchHint: { color: colors.inkMuted, fontSize: 23, lineHeight: 23, transform: [{ rotate: "-20deg" }] },
  quickCard: { gap: spacing.md, padding: spacing.md },
  quickHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  editShortcutButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xs },
  quickGrid: { flexDirection: "row", gap: spacing.sm },
  quickTile: { flex: 1, minWidth: 0, minHeight: 58, alignItems: "center", justifyContent: "center", gap: spacing.xs, borderRadius: 10, backgroundColor: "#F8F9FF", borderWidth: 1, borderColor: "#EEF0FF", paddingHorizontal: spacing.xs },
  quickTileText: { color: colors.inkBody, fontSize: 10, fontWeight: "700" },
  priorityCard: { minHeight: 116, flexDirection: "row", padding: 0, overflow: "hidden" },
  priorityAccent: { width: 4, backgroundColor: colors.accent },
  priorityCopy: { flex: 1, gap: spacing.xs, padding: spacing.md },
  priorityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priorityTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  offerBanner: { minHeight: 172, flexDirection: "row", overflow: "hidden", borderRadius: radius.card, backgroundColor: "#F4E9DE", borderWidth: 1, borderColor: "#F1DCCA", padding: spacing.lg },
  offerCopy: { flex: 1, alignItems: "flex-start", gap: spacing.sm },
  offerEyebrow: { color: "#A66D4B", fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  offerTitle: { color: colors.ink, fontSize: 19, lineHeight: 23, fontWeight: "800" },
  offerMeta: { maxWidth: 190, color: colors.inkMuted, fontSize: 11, lineHeight: 15 },
  offerArt: { width: 94, alignItems: "center", justifyContent: "center", position: "relative" },
  offerArtCircle: { position: "absolute", width: 96, height: 96, borderRadius: 48, backgroundColor: "#F8D6B9", opacity: 0.8 },
  todayCard: { gap: spacing.md, padding: spacing.md },
  todayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  todayRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  todayDay: { width: 48, minHeight: 31, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.surfaceSelected },
  todayDayText: { color: colors.accent, fontSize: 10, fontWeight: "800" },
  todayEvent: { flex: 1, color: colors.inkBody, fontSize: 11, lineHeight: 16 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,24,40,0.42)" },
  shortcutModal: { gap: spacing.sm, backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.xl, paddingBottom: 28 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: spacing.sm },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  modalClose: { color: colors.inkMuted, fontSize: 28, lineHeight: 26, paddingHorizontal: spacing.xs },
  shortcutOption: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  shortcutOptionText: { flex: 1, color: colors.inkBody, fontSize: 13, fontWeight: "600" },
  shortcutCheck: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  shortcutCheckSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  shortcutCheckText: { color: colors.onAccent, fontSize: 14, fontWeight: "800" },
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
