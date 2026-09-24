import { useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react-native";

import { Badge, Button, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { ChurchContent, ChurchEvent, Contribution, EventAnnouncement, MeResponse, PersonalCommitment, ScheduleAssignment } from "@/types/api";
import { colors, formatBRL, formatDate, spacing, statusLabel } from "@/theme";

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

type NoticeSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
  route: string;
  imageUrl?: string;
};

function NoticeCarousel({
  announcements,
  events,
  contents,
  onNavigate,
  compact = false,
}: {
  announcements: EventAnnouncement[];
  events: ChurchEvent[];
  contents: ChurchContent[];
  onNavigate: (route: string) => void;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const slides = useMemo<NoticeSlide[]>(() => [
    ...announcements.map((announcement) => ({
      id: `announcement-${announcement.id}`,
      eyebrow: "AVISO DE EVENTO",
      title: announcement.title || announcement.event_name,
      description: announcement.event_location || "Confira os detalhes deste evento na agenda.",
      meta: formatDate(announcement.event_start_at, true),
      route: `agenda?event=${announcement.event}`,
      imageUrl: announcement.image_url,
    })),
    ...contents.map((content) => ({
      id: `content-${content.id}`,
      eyebrow: "COMUNICADO",
      title: content.title,
      description: content.summary || content.body,
      meta: content.published_at ? formatDate(content.published_at, true) : "Publicado pela igreja",
      route: `content/${content.id}`,
    })),
    ...events.map((event) => ({
      id: `event-${event.id}`,
      eyebrow: event.event_type_display || "EVENTO",
      title: event.name,
      description: event.description || "Confira os detalhes deste evento da igreja.",
      meta: `${formatDate(event.start_at, true)}${event.location ? ` · ${event.location}` : ""}`,
      route: `agenda?event=${event.id}`,
    })),
  ].slice(0, 4), [announcements, contents, events]);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) {
    return (
      <View style={compact ? styles.noticeEmptyMobile : styles.noticeEmptyDesktop}>
        <Text style={styles.noticeEmptyText}>Nenhum aviso ou evento publicado no momento.</Text>
      </View>
    );
  }

  const slide = slides[index];
  const goTo = (nextIndex: number) => setIndex((nextIndex + slides.length) % slides.length);

  return (
    <View style={compact ? styles.noticeCarouselMobile : styles.noticeCarouselDesktop}>
      {slide.imageUrl ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${slide.title}`} onPress={() => onNavigate(slide.route)}>
          <Image source={{ uri: slide.imageUrl }} resizeMode="cover" style={compact ? styles.noticeImageMobile : styles.noticeImageDesktop} />
        </Pressable>
      ) : null}
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeEyebrow}>{slide.eyebrow}</Text>
        <Text numberOfLines={2} style={styles.noticeTitle}>{slide.title}</Text>
        <Text numberOfLines={3} style={styles.noticeDescription}>{slide.description}</Text>
        <Text numberOfLines={1} style={styles.noticeMeta}>{slide.meta}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${slide.title}`} onPress={() => onNavigate(slide.route)} style={styles.noticeLink}>
          <Text style={styles.noticeLinkText}>Ver detalhes</Text>
          <ChevronRight size={14} color={colors.accent} />
        </Pressable>
      </View>
      <View style={styles.noticeControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Aviso anterior" onPress={() => goTo(index - 1)} style={styles.noticeArrow}>
          <ChevronLeft size={16} color={colors.inkBody} />
        </Pressable>
        <View style={styles.noticeDots}>
          {slides.map((item, itemIndex) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Ir para aviso ${itemIndex + 1}`} onPress={() => goTo(itemIndex)} style={[styles.noticeDot, itemIndex === index && styles.noticeDotActive]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Próximo aviso" onPress={() => goTo(index + 1)} style={styles.noticeArrow}>
          <ChevronRight size={16} color={colors.inkBody} />
        </Pressable>
      </View>
    </View>
  );
}


function DesktopDashboard({
  me,
  canAccessManagement,
  schedule,
  contributions,
  commitment,
  announcements,
  events,
  contents,
  onNavigate,
}: {
  me: MeResponse;
  canAccessManagement: boolean;
  schedule: ScheduleAssignment | null;
  contributions: Contribution[];
  commitment: PersonalCommitment | null;
  announcements: EventAnnouncement[];
  events: ChurchEvent[];
  contents: ChurchContent[];
  onNavigate: (route: string) => void;
}) {
  const contributionTotal = contributions.reduce((total, item) => total + Number(item.amount || 0), 0);
  const metrics = [
    { label: "Membros ativos", value: "248", detail: "+8 este mês" },
    { label: "Contribuições no mês", value: contributions.length ? formatBRL(contributionTotal) : "R$ 12.450", detail: "87% confirmado" },
    { label: "Próximos cultos", value: "6", detail: "Nos próximos 30 dias" },
    { label: "Escalas pendentes", value: schedule ? "1" : "0", detail: schedule ? "Aguardando resposta" : "Tudo em dia" },
  ];

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
      <NoticeCarousel announcements={announcements} events={events} contents={contents} onNavigate={onNavigate} />
      <View style={styles.desktopDashboardRow}>
        <View style={styles.desktopChartCard}>
          <Text style={styles.desktopPanelTitle}>Contribuições — últimos 6 meses</Text>
          <Text style={styles.desktopPanelMeta}>Visão consolidada da Igreja Moriah</Text>
          <View style={styles.chartArea}>
            {[52, 78, 64, 92, 70, 86].map((height, index) => (
              <View key={String(index)} style={styles.chartColumn}>
                <View style={[styles.chartBar, { height }]} />
                <Text style={styles.chartLabel}>{["Abr", "Mai", "Jun", "Jul", "Ago", "Set"][index]}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.desktopQuickCard}>
          <Text style={styles.desktopPanelTitle}>Ações rápidas</Text>
          {[["Registrar contribuição", "statement"], ["Adicionar membro", "profile"], ["Criar culto", "agenda"], ["Criar escala", "schedule-create"], ["Criar turma", "agenda"]].map(([label, route], index) => (
            <Pressable key={label} accessibilityRole="button" onPress={() => onNavigate(route)} style={({ pressed }) => [styles.quickAction, index === 0 && styles.quickActionPrimary, pressed && styles.pressed]}>
              <Text style={[styles.quickActionText, index === 0 && styles.quickActionTextPrimary]}>{label}</Text>
              <Text style={[styles.quickActionArrow, index === 0 && styles.quickActionTextPrimary]}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.desktopBottomRow}>
        <View style={styles.desktopBottomCard}>
          <Text style={styles.desktopPanelTitle}>Próximos cultos e eventos</Text>
          {[["Dom 19h", "Celebração · Templo"], ["Qua 20h", "Ensino e oração · Sala 2"], ["Sáb 17h", "Encontro jovens · Auditório"]].map(([date, label]) => (
            <View key={date} style={styles.desktopListItem}><Text style={styles.desktopListDate}>{date}</Text><Text style={styles.desktopListText}>{label}</Text></View>
          ))}
        </View>
        <View style={styles.desktopBottomCard}>
          <Text style={styles.desktopPanelTitle}>Próximas escalas</Text>
          <View style={styles.desktopListItem}><Text style={styles.desktopListDate}>Louvor</Text><Text style={styles.desktopListText}>{schedule ? schedule.event_name + " · " + schedule.role_name : "Culto 19h · Vocal"}</Text></View>
          <View style={styles.desktopListItem}><Text style={styles.desktopListDate}>Mídia</Text><Text style={styles.desktopListText}>Ensino quarta · Projeção</Text></View>
          <View style={styles.desktopListItem}><Text style={styles.desktopListDate}>Recepção</Text><Text style={styles.desktopListText}>Domingo 10h · Equipe</Text></View>
        </View>
        <View style={styles.desktopBottomCard}>
          <Text style={styles.desktopPanelTitle}>Atividades recentes</Text>
          <View style={styles.desktopActivity}><Text style={styles.activityDot}>●</Text><Text style={styles.desktopListText}>Nova contribuição registrada</Text></View>
          <View style={styles.desktopActivity}><Text style={styles.activityDot}>●</Text><Text style={styles.desktopListText}>Novo membro cadastrado</Text></View>
          <View style={styles.desktopActivity}><Text style={styles.activityDot}>●</Text><Text style={styles.desktopListText}>Escala confirmada</Text></View>
          <View style={styles.desktopActivity}><Text style={styles.activityDot}>●</Text><Text style={styles.desktopListText}>Evento criado pela gestão</Text></View>
        </View>
      </View>
      {!canAccessManagement ? <Text style={styles.desktopFooterText}>Moriah · {me.email}{commitment ? " · Próximo compromisso: " + commitment.title : ""}</Text> : null}
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
  const [schedule, setSchedule] = useState<ScheduleAssignment | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [commitment, setCommitment] = useState<PersonalCommitment | null>(null);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [contents, setContents] = useState<ChurchContent[]>([]);
  const [announcements, setAnnouncements] = useState<EventAnnouncement[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      api.get<ChurchEvent[]>("/me/events/"),
      api.get<ChurchContent[]>("/content/"),
      api.get<EventAnnouncement[]>("/event-announcements/"),
    ]).then(([eventsResult, contentsResult, announcementsResult]) => {
      if (!mounted) return;
      if (eventsResult.status === "fulfilled") setEvents(eventsResult.value);
      if (contentsResult.status === "fulfilled") setContents(contentsResult.value);
      if (announcementsResult.status === "fulfilled") setAnnouncements(announcementsResult.value.slice(0, 4));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isMember) return;
    let mounted = true;
    Promise.allSettled([
      api.get<ScheduleAssignment[]>("/me/schedules/"),
      api.get<Contribution[]>("/me/statement/"),
      api.get<PersonalCommitment[]>("/me/agenda/"),
    ]).then(([scheduleResult, contributionResult, agendaResult]) => {
      if (!mounted) return;
      if (scheduleResult.status === "fulfilled") {
        const now = Date.now();
        const next = [...scheduleResult.value]
          .filter((item) => {
            const startsAt = new Date(item.event_start_at).getTime();
            return (
              !Number.isNaN(startsAt) &&
              startsAt >= now &&
              !["declined", "unavailable"].includes(item.status)
            );
          })
          .sort((left, right) => new Date(left.event_start_at).getTime() - new Date(right.event_start_at).getTime())[0];
        setSchedule(next || null);
      }
      if (contributionResult.status === "fulfilled") setContributions(contributionResult.value);
      if (agendaResult.status === "fulfilled") {
        const next = [...agendaResult.value].sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime())[0];
        setCommitment(next || null);
      }
    });
    return () => { mounted = false; };
  }, [isMember]);

  const contributionTotal = useMemo(() => contributions.reduce((total, item) => total + Number(item.amount || 0), 0), [contributions]);

  return (
    <Screen
      title={`Olá, ${firstName(me)} 👋`}
      headerSubtitle={headerDate()}
      showBottomNav={isMember}
      headerAccessory={!desktop ? (<View style={styles.headerActions}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(me)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Notificações" onPress={() => onNavigate("notifications")} style={styles.notificationButton}>
            <Bell size={20} strokeWidth={1.8} color={colors.accent} />
            <View style={styles.notificationBadge}><Text style={styles.notificationCount}>3</Text></View>
          </Pressable>
        </View>) : undefined}
    >
      {desktop ? <DesktopDashboard me={me} canAccessManagement={canAccessManagement} schedule={schedule} contributions={contributions} commitment={commitment} announcements={announcements} events={events} contents={contents} onNavigate={onNavigate} /> : <>
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
        </Card>
      ) : null}

      <NoticeCarousel announcements={announcements} events={events} contents={contents} onNavigate={onNavigate} compact />

      {isMember ? <>
      <Card style={styles.scheduleCard}>
        <Text style={styles.eyebrow}>MINHA PRÓXIMA ESCALA</Text>
        {schedule ? (
          <>
            <Text style={styles.scheduleTitle}>{schedule.event_name}</Text>
            <Text style={styles.meta}>{formatDate(schedule.event_start_at, true)}</Text>
            <Badge label={schedule.status === "pending" ? "Convite pendente" : statusLabel(schedule.status)} tone={scheduleTone(schedule.status)} />
            <Text style={styles.role}>{schedule.ministry_name} · {schedule.role_name}</Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonFlex}><Button size="compact" onPress={() => onNavigate("schedule/" + schedule.id)}>Confirmar</Button></View>
              <View style={[styles.buttonFlex, styles.buttonFlexSmall]}><Button size="compact" variant="secondary" onPress={() => onNavigate("schedule/" + schedule.id)}>Não posso</Button></View>
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
          {contributions.length ? `Última contribuição  •  ${formatBRL(contributionTotal)}` : "Última contribuição  •  R$ 450"}
        </Text>
        <Text style={styles.successMeta}>{contributions[0] ? `${formatDate(contributions[0].contribution_date)} • ${statusLabel(contributions[0].category)} • ${statusLabel(contributions[0].status)}` : "12/09 • Dízimo • Confirmada"}</Text>
        <View style={styles.contributionActions}>
          <Button size="compact" onPress={() => onNavigate("contribution")}>Enviar comprovante</Button>
          <Pressable accessibilityRole="button" onPress={() => onNavigate("statement")} style={styles.historyButton}><Text style={styles.linkText}>Ver histórico</Text></Pressable>
        </View>
      </Card>

      <Card style={styles.upcomingCard}>
        <Text style={styles.cardTitle}>Próximos</Text>
        <View style={styles.eventRow}><Text style={styles.day}>Hoje</Text><Text style={styles.event}>19h30 · Célula</Text></View>
        <View style={styles.eventRow}><Text style={styles.day}>Domingo</Text><Text style={styles.event}>09h · Escola Bíblica</Text></View>
        <View style={styles.eventRow}><Text style={styles.day}>Domingo</Text><Text style={styles.event}>{commitment?.title || "19h · Culto de celebração"}</Text></View>
      </Card>

      <Card style={styles.schoolCard}>
        <Text style={styles.cardTitle}>Continuar na Escola Bíblica</Text>
        <Text style={styles.mutedSmall}>Fundamentos da Fé · 7 de 12 aulas</Text>
        <View style={styles.progressTrack}><View style={styles.progressValue} /></View>
        <Text style={styles.mutedSmall}>Próxima aula: Domingo · 09h</Text>
      </Card>

      <Card style={styles.wordCard}>
        <Text style={styles.cardTitle}>Última palavra</Text>
        <Text style={styles.wordTitle}>O Deus que vê</Text>
        <Text style={styles.mutedSmall}>Pr. André · “Ele conhece cada detalhe.”</Text>
        <Pressable accessibilityRole="button" onPress={() => onNavigate("content")} style={styles.readButton}><Text style={styles.linkText}>Ler palavra</Text></Pressable>
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
  notificationBadge: { position: "absolute", top: 2, right: 1, width: 17, height: 17, borderRadius: 9, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  notificationCount: { fontSize: 9, fontWeight: "700", color: colors.onAccent },
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
  upcomingCard: { minHeight: 126 },
  eventRow: { flexDirection: "row", gap: 48, alignItems: "center" },
  day: { width: 44, fontSize: 10, fontWeight: "700", color: colors.accent },
  event: { fontSize: 11, color: colors.inkBody },
  schoolCard: { minHeight: 100 },
  mutedSmall: { fontSize: 10, color: colors.inkMuted },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: "#EAECF0", overflow: "hidden" },
  progressValue: { width: "58%", height: 8, borderRadius: 99, backgroundColor: colors.accent },
  wordCard: { minHeight: 94, position: "relative" },
  wordTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
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
  noticeCarouselDesktop: { minHeight: 176, flexDirection: "row", justifyContent: "space-between", backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#DDE3FF", borderRadius: 12, padding: 20, overflow: "hidden" },
  noticeCarouselMobile: { minHeight: 168, flexDirection: "row", backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#DDE3FF", borderRadius: 12, padding: 16, overflow: "hidden" },
  noticeEmptyDesktop: { minHeight: 96, justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 20 },
  noticeEmptyMobile: { minHeight: 96, justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  noticeEmptyText: { color: colors.inkMuted, fontSize: 12 },
  noticeImageDesktop: { width: 240, minHeight: 134, borderRadius: 8, backgroundColor: colors.surface, marginRight: 18 },
  noticeImageMobile: { width: 112, minHeight: 134, borderRadius: 8, backgroundColor: colors.surface, marginRight: 14 },
  noticeCopy: { flex: 1, gap: 6, minWidth: 0 },
  noticeEyebrow: { color: colors.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  noticeTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  noticeDescription: { color: colors.inkBody, fontSize: 12, lineHeight: 17, maxWidth: 720 },
  noticeMeta: { color: colors.inkMuted, fontSize: 11 },
  noticeLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  noticeLinkText: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  noticeControls: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 12 },
  noticeArrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  noticeDots: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 100 },
  noticeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#B8C1F0" },
  noticeDotActive: { width: 18, backgroundColor: colors.accent },
  desktopDashboardRow: { flexDirection: "row", gap: 24 },
  desktopChartCard: { flex: 1.84, height: 336, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 20 },
  desktopQuickCard: { flex: 1, height: 336, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 20, gap: 9 },
  desktopPanelTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  desktopPanelMeta: { color: colors.inkMuted, fontSize: 11, marginTop: 5 },
  chartArea: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: 36, paddingBottom: 4 },
  chartColumn: { alignItems: "center", justifyContent: "flex-end", gap: 8, height: 190 },
  chartBar: { width: 28, minHeight: 26, borderRadius: 5, backgroundColor: colors.accent },
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
