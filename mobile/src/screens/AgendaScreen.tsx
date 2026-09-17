import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { ErrorNotice } from "@/components/ErrorNotice";
import { DateTimeField, dateInputToIso } from "@/components/DateTimeField";
import { FeedbackTone, InlineNotice, useToast } from "@/components/Feedback";
import { Badge, Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ChurchEvent, PersonalCommitment, ScheduleAssignment } from "@/types/api";
import { colors, formatDate, spacing, statusLabel } from "@/theme";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function dateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date).replace(/^./, (char) => char.toUpperCase());
}

function calendarDays(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function scheduleStatusTone(status: ScheduleAssignment["status"]): "success" | "warning" | "danger" {
  if (status === "conflict" || status === "replacement_needed") return "danger";
  if (status === "pending") return "warning";
  return "success";
}

type AgendaEntry = {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  detail: string;
  category: string;
};


function DesktopAgenda({
  cursor,
  days,
  selectedDate,
  setCursor,
  setSelectedDate,
  entries,
  selectedEntries,
  upcomingEvents,
  schedules,
  scheduleError,
  router,
}: {
  cursor: Date;
  days: Date[];
  selectedDate: string;
  setCursor: (value: Date) => void;
  setSelectedDate: (value: string) => void;
  entries: AgendaEntry[];
  selectedEntries: AgendaEntry[];
  upcomingEvents: ChurchEvent[];
  schedules: ScheduleAssignment[];
  scheduleError: UserFacingError | null;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View style={styles.desktopAgenda}>
      <View style={styles.desktopAgendaToolbar}>
        <View style={styles.monthNavigation}><Button size="compact" variant="ghost" onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</Button><Text style={styles.desktopMonth}>{monthLabel(cursor)}</Text><Button size="compact" variant="ghost" onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</Button></View>
        <View style={styles.agendaViewButtons}><View style={styles.agendaViewActive}><Text style={styles.agendaViewActiveText}>Calendário</Text></View><View style={styles.agendaViewButton}><Text style={styles.agendaViewText}>Lista</Text></View></View>
      </View>
      <View style={styles.desktopCalendar}>
        <View style={styles.desktopWeekRow}>{WEEKDAYS.map((day, index) => <Text key={String(index)} style={styles.desktopWeekday}>{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][index]}</Text>)}</View>
        <View style={styles.desktopCalendarGrid}>
          {days.map((day) => {
            const key = dateKey(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const selected = key === selectedDate;
            const hasEntry = entries.some((entry) => entry.date === key);
            return <Pressable key={key} onPress={() => setSelectedDate(key)} style={[styles.desktopCalendarDay, !inMonth && styles.desktopOutsideDay, selected && styles.desktopSelectedDay]}><Text style={[styles.desktopDayNumber, !inMonth && styles.desktopOutsideText, selected && styles.desktopSelectedText]}>{day.getDate()}</Text>{hasEntry ? <View style={[styles.desktopEventDot, selected && styles.desktopSelectedDot]} /> : null}</Pressable>;
          })}
        </View>
      </View>
      <View style={styles.desktopAgendaBottom}>
        <View style={styles.desktopAgendaListCard}><Text style={styles.sectionTitle}>Eventos da igreja</Text>{upcomingEvents.length ? upcomingEvents.slice(0, 4).map((event) => <Pressable key={event.id} onPress={() => setSelectedDate(dateKey(event.start_at))} style={styles.agendaListRow}><View style={styles.agendaListCopy}><Text style={styles.entryTitle}>{event.name}</Text><Text style={styles.meta}>{formatDate(event.start_at, true)} · {event.location || event.event_type_display}</Text></View><Text style={styles.link}>Ver no calendário</Text></Pressable>) : <Text style={styles.meta}>Nenhum evento futuro cadastrado.</Text>}</View>
        <View style={styles.desktopAgendaListCard}><Text style={styles.sectionTitle}>Compromissos em {selectedDate}</Text>{selectedEntries.length ? selectedEntries.map((entry) => <View key={entry.id} style={styles.agendaListRow}><View style={styles.agendaListCopy}><Text style={styles.entryTitle}>{entry.title}</Text><Text style={styles.meta}>{entry.subtitle} · {entry.detail}</Text></View><Badge label={entry.category} tone={entry.category === "Escala" ? "warning" : "neutral"} /></View>) : <Text style={styles.meta}>Nenhum compromisso para este dia.</Text>}{scheduleError ? <Text style={styles.meta}>Nao foi possivel carregar suas escalas agora.</Text> : null}{schedules.length ? <Text style={styles.agendaFootnote}>{schedules.length} escala(s) vinculada(s)</Text> : null}</View>
      </View>
    </View>
  );
}

export function AgendaScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [items, setItems] = useState<PersonalCommitment[]>([]);
  const [schedules, setSchedules] = useState<ScheduleAssignment[]>([]);
  const [churchEvents, setChurchEvents] = useState<ChurchEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [cursor, setCursor] = useState(new Date());
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [scheduleError, setScheduleError] = useState<UserFacingError | null>(null);
  // Aviso de validacao fica preso ao formulario, logo acima do botao.
  const [aviso, setAviso] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);
  const isAdminWithoutMember = Boolean(me?.capabilities.includes("manage_all") && !me.member_id);

  const load = useCallback(async () => {
    setError(null);
    setScheduleError(null);
    const [agendaResult, schedulesResult, eventsResult] = await Promise.allSettled([
      api.get<PersonalCommitment[]>("/me/agenda/"),
      api.get<ScheduleAssignment[]>("/me/schedules/"),
      api.get<ChurchEvent[]>("/me/events/"),
    ]);

    if (agendaResult.status === "fulfilled") setItems(agendaResult.value);
    else setError(describeError(agendaResult.reason, "Nao foi possivel carregar a agenda"));

    if (schedulesResult.status === "fulfilled") setSchedules(schedulesResult.value);
    else {
      setSchedules([]);
      setScheduleError(describeError(schedulesResult.reason, "Nao foi possivel carregar suas escalas"));
    }

    if (eventsResult.status === "fulfilled") setChurchEvents(eventsResult.value);
    else setChurchEvents([]);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const entries = useMemo<AgendaEntry[]>(() => [
    ...churchEvents.map((event) => ({
      id: "event-" + event.id,
      date: dateKey(event.start_at),
      title: event.name,
      subtitle: formatDate(event.start_at, true),
      detail: event.location || event.event_type_display,
      category: "Igreja",
    })),
    ...schedules.map((item) => ({
      id: "schedule-" + item.id,
      date: dateKey(item.event_start_at),
      title: item.event_name,
      subtitle: formatDate(item.event_start_at, true),
      detail: item.ministry_name + " · " + item.role_name,
      category: "Escala",
    })),
    ...items.map((item) => ({
      id: "commitment-" + item.id,
      date: dateKey(item.starts_at),
      title: item.title,
      subtitle: formatDate(item.starts_at, true),
      detail: item.notes || "Compromisso pessoal",
      category: "Minha agenda",
    })),
  ], [churchEvents, items, schedules]);

  const days = useMemo(() => calendarDays(cursor), [cursor]);
  const selectedEntries = entries.filter((entry) => entry.date === selectedDate);
  const upcomingEvents = churchEvents.filter((event) => new Date(event.start_at).getTime() >= Date.now()).slice(0, 5);

  async function submit() {
    if (submitting || submittingRef.current) {
      return;
    }
    if (!title.trim() || !startsAt.trim()) {
      setAviso({
        tone: "warning",
        title: "Dados incompletos",
        message: "Informe o título e o início do compromisso.",
      });
      return;
    }
    const inicio = dateInputToIso(startsAt, "datetime");
    const fim = endsAt.trim() ? dateInputToIso(endsAt, "datetime") : null;
    if (!inicio || (endsAt.trim() && !fim)) {
      setAviso({
        tone: "warning",
        title: "Data inválida",
        message: "Use dd/mm/aaaa hh:mm. O horário deve estar no formato 24 horas.",
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setAviso(null);
    try {
      await api.post<PersonalCommitment>("/me/agenda/", {
        title: title.trim(),
        commitment_type: "personal",
        starts_at: inicio,
        ends_at: fim,
        notes,
      });
      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setNotes("");
      toast("O compromisso ja aparece na sua agenda.", { tone: "success", title: "Compromisso adicionado" });
      await load();
    } catch (err) {
      const result = describeError(err, "Nao foi possivel salvar");
      toast(result.message, { tone: "error", title: result.title });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen title={isAdminWithoutMember ? "Agenda da igreja" : "Agenda"} headerSubtitle={isAdminWithoutMember ? "Eventos, escalas e compromissos da igreja" : "Seu calendário pessoal e os eventos da igreja"} refreshing={refreshing || loading} onRefresh={() => { setRefreshing(true); load(); }}>
      {!desktop ? (
        <View style={styles.contextNav}>
          <View style={[styles.contextTab, styles.contextTabActive]}>
            <Text style={styles.contextTabActiveText}>Agenda</Text>
          </View>
          <Button size="compact" variant="ghost" onPress={() => router.replace("/schedules" as never)}>
            Escalas
          </Button>
        </View>
      ) : null}
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}

      <Card>
        <View style={styles.calendarHeader}>
          <Button size="compact" variant="ghost" onPress={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</Button>
          <Text style={styles.month}>{monthLabel(cursor)}</Text>
          <Button size="compact" variant="ghost" onPress={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</Button>
        </View>
        <View style={styles.weekRow}>{WEEKDAYS.map((day, index) => <Text key={String(index)} style={styles.weekday}>{day}</Text>)}</View>
        <View style={styles.calendarGrid}>
          {days.map((day) => {
            const key = dateKey(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const selected = key === selectedDate;
            const hasEntry = entries.some((entry) => entry.date === key);
            return (
              <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setSelectedDate(key)} style={[styles.calendarDay, !inMonth && styles.outsideDay, selected && styles.selectedDay]}>
                <Text style={[styles.dayNumber, !inMonth && styles.outsideText, selected && styles.selectedText]}>{day.getDate()}</Text>
                {hasEntry ? <View style={[styles.eventDot, selected && styles.selectedDot]} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{selectedDate === dateKey(new Date()) ? "Hoje" : "Compromissos do dia"}</Text>
        {selectedEntries.length ? selectedEntries.map((entry) => (
          <View key={entry.id} style={styles.entryRow}>
            <View style={styles.entryCopy}>
              <Text style={styles.entryTitle}>{entry.title}</Text>
              <Text style={styles.meta}>{entry.subtitle}</Text>
              <Text style={styles.meta}>{entry.detail}</Text>
            </View>
            <Badge label={entry.category} tone={entry.category === "Escala" ? "warning" : "neutral"} />
          </View>
        )) : <Text style={styles.meta}>Nenhum compromisso para este dia.</Text>}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Eventos da igreja</Text>
        {upcomingEvents.length ? upcomingEvents.map((event) => (
          <Pressable key={event.id} accessibilityRole="button" onPress={() => setSelectedDate(dateKey(event.start_at))} style={styles.entryRow}>
            <View style={styles.entryCopy}>
              <Text style={styles.entryTitle}>{event.name}</Text>
              <Text style={styles.meta}>{formatDate(event.start_at, true)}</Text>
              <Text style={styles.meta}>{event.location || event.event_type_display}</Text>
            </View>
            <Text style={styles.link}>Ver no calendário</Text>
          </Pressable>
        )) : <Text style={styles.meta}>Nenhum evento futuro cadastrado.</Text>}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{isAdminWithoutMember ? "Escalas da igreja" : "Minhas escalas"}</Text>
        {scheduleError ? <Text style={styles.meta}>Nao foi possivel carregar suas escalas agora.</Text> : null}
        {schedules.length ? schedules.slice(0, 3).map((item) => (
          <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/schedule/[id]", params: { id: item.id } })} style={styles.entryRow}>
            <View style={styles.entryCopy}>
              <Text style={styles.entryTitle}>{item.event_name}</Text>
              <Text style={styles.meta}>{formatDate(item.event_start_at, true)}</Text>
              <Text style={styles.meta}>{item.ministry_name} · {item.role_name}</Text>
            </View>
            <Badge label={statusLabel(item.status)} tone={scheduleStatusTone(item.status)} />
          </Pressable>
        )) : <Text style={styles.meta}>Nenhuma escala próxima.</Text>}
        <Button variant="ghost" onPress={() => router.push("/schedules" as never)}>{isAdminWithoutMember ? "Ver escalas" : "Ver minhas escalas"}</Button>
      </Card>

      {!isAdminWithoutMember ? <Card>
        <Text style={styles.sectionTitle}>Novo compromisso</Text>
        <Field value={title} onChangeText={setTitle} placeholder="Ex.: Ensaio do Louvor" />
        <DateTimeField accessibilityLabel="Início do compromisso" value={startsAt} onChangeText={setStartsAt} placeholder="dd/mm/aaaa hh:mm" />
        <DateTimeField accessibilityLabel="Fim do compromisso" mode="datetime" value={endsAt} onChangeText={setEndsAt} placeholder="dd/mm/aaaa hh:mm (opcional)" />
        <Field value={notes} onChangeText={setNotes} placeholder="Observações (opcional)" multiline />
        {aviso ? (
          <InlineNotice tone={aviso.tone} title={aviso.title} message={aviso.message} onDismiss={() => setAviso(null)} />
        ) : null}
        <Button loading={submitting} disabled={submitting} onPress={submit}>Adicionar à agenda</Button>
      </Card> : null}

      {!loading && !items.length ? <Text style={styles.meta}>{isAdminWithoutMember ? "Nenhum compromisso da igreja cadastrado." : "Sua agenda pessoal ainda não tem compromissos."}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  month: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  contextNav: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  contextTab: { minHeight: 36, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: 10 },
  contextTabActive: { backgroundColor: colors.surfaceSelected },
  contextTabActiveText: { color: colors.accent, fontSize: 13, fontWeight: "800" },
  weekRow: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.md },
  weekday: { width: "14.28%", textAlign: "center", color: colors.inkMuted, fontSize: 11, fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.xs },
  calendarDay: { width: "14.28%", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, gap: 2 },
  outsideDay: { opacity: 0.42 },
  selectedDay: { backgroundColor: colors.accent },
  dayNumber: { color: colors.inkBody, fontSize: 13, fontWeight: "700" },
  outsideText: { color: colors.inkMuted },
  selectedText: { color: colors.onAccent },
  eventDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  selectedDot: { backgroundColor: colors.onAccent },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  entryCopy: { flex: 1, gap: 2 },
  entryTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  meta: { color: colors.inkMuted, fontSize: 12 },
  link: { color: colors.accent, fontSize: 11, fontWeight: "700" },

  desktopAgenda: { gap: 20 },
  desktopAgendaToolbar: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthNavigation: { flexDirection: "row", alignItems: "center", gap: 10 },
  desktopMonth: { color: colors.ink, fontSize: 16, fontWeight: "800", minWidth: 150, textAlign: "center" },
  agendaViewButtons: { flexDirection: "row", gap: 6 },
  agendaViewActive: { height: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderRadius: 8 },
  agendaViewActiveText: { color: colors.onAccent, fontSize: 11, fontWeight: "800" },
  agendaViewButton: { height: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8 },
  agendaViewText: { color: colors.inkBody, fontSize: 11, fontWeight: "700" },
  desktopCalendar: { height: 700, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" },
  desktopWeekRow: { height: 34, flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  desktopWeekday: { width: "14.28%", textAlign: "center", color: colors.inkMuted, fontSize: 10, fontWeight: "800" },
  desktopCalendarGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  desktopCalendarDay: { width: "14.28%", height: 111, padding: 10, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.borderDivider, gap: 9 },
  desktopOutsideDay: { backgroundColor: "#FCFCFD" },
  desktopSelectedDay: { backgroundColor: "#F1F3FF" },
  desktopDayNumber: { color: colors.inkBody, fontSize: 12, fontWeight: "800" },
  desktopOutsideText: { color: colors.inkPlaceholder },
  desktopSelectedText: { color: colors.accent },
  desktopEventDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  desktopSelectedDot: { backgroundColor: colors.accent },
  desktopAgendaBottom: { flexDirection: "row", gap: 20 },
  desktopAgendaListCard: { flex: 1, minHeight: 190, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 18, gap: 12 },
  agendaListRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  agendaListCopy: { flex: 1, gap: 3 },
  agendaFootnote: { color: colors.accent, fontSize: 11, fontWeight: "700" },
});
