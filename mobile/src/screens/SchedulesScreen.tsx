import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { useToast } from "@/components/Feedback";
import { Badge, Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { podeGerenciarEscalas } from "@/navigation";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ScheduleAssignment } from "@/types/api";
import { colors, formatDate, spacing, statusLabel } from "@/theme";

function statusTone(status: ScheduleAssignment["status"]): "success" | "warning" | "danger" {
  if (status === "confirmed") return "success";
  if (status === "declined") return "danger";
  return "warning";
}


type ScheduleView = "calendar" | "list" | "ministry";
type FilterOption = { value: string; label: string };

function FilterMenu({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value)?.label || label;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.scheduleFilter, pressed && styles.pressed]}
      >
        <Text style={styles.scheduleFilterText}>{selected}</Text>
        <Text style={styles.filterChevron}>⌄</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.filterOverlay} onPress={() => setOpen(false)}>
          <View style={styles.filterMenu}>
            <Text style={styles.filterMenuTitle}>{label}</Text>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.value === value }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.filterOption, option.value === value && styles.filterOptionActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.filterOptionText, option.value === value && styles.filterOptionTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function ministryAllowsRepertoire(name: string): boolean {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  return ["louvor", "danca", "som", "projecao", "tecnica"].some((term) => normalized.includes(term));
}

function DesktopSchedules({
  items,
  canCreate,
  error,
  onRetry,
  router,
}: {
  items: ScheduleAssignment[];
  canCreate: boolean;
  error: UserFacingError | null;
  onRetry: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [view, setView] = useState<ScheduleView>("ministry");
  const [eventFilter, setEventFilter] = useState("all");
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const eventOptions = [
    { value: "all", label: "Evento: todos" },
    ...Array.from(new Set(items.map((item) => item.event_name))).sort().map((name) => ({ value: name, label: `Evento: ${name}` })),
  ];
  const ministryOptions = [
    { value: "all", label: "Todos os ministérios" },
    ...Array.from(new Set(items.map((item) => item.ministry_name || "Sem ministério"))).sort().map((name) => ({ value: name, label: name })),
  ];
  const statusOptions = [
    { value: "all", label: "Status: todos" },
    ...Array.from(new Set(items.map((item) => item.status))).sort().map((status) => ({ value: status, label: `Status: ${statusLabel(status as ScheduleAssignment["status"])}` })),
  ];
  const filteredItems = items.filter((item) =>
    (eventFilter === "all" || item.event_name === eventFilter)
      && (ministryFilter === "all" || (item.ministry_name || "Sem ministério") === ministryFilter)
      && (statusFilter === "all" || item.status === statusFilter),
  );
  const groups = Array.from(new Set(filteredItems.map((item) =>
    view === "calendar" ? new Date(item.event_start_at).toLocaleDateString("pt-BR") : item.ministry_name || "Sem ministério",
  )));
  const renderRow = (item: ScheduleAssignment) => (
    <View key={item.id} style={styles.scheduleBoardRow}>
      <View style={styles.scheduleBoardCopy}>
        <Text style={styles.scheduleBoardTitle}>{item.event_name}</Text>
        <Text style={styles.meta}>{formatDate(item.event_start_at, true)} · {item.schedule_name} · {item.role_name}</Text>
      </View>
      <Badge label={statusLabel(item.status)} tone={statusTone(item.status)} />
      <Button size="compact" variant="ghost" onPress={() => router.push({ pathname: "/schedule/[id]", params: { id: item.id } })}>Detalhes</Button>
    </View>
  );
  return (
    <View style={styles.desktopSchedules}>
      <View style={styles.scheduleViews}>
        {(["calendar", "list", "ministry"] as ScheduleView[]).map((item) => {
          const active = view === item;
          const label = item === "calendar" ? "Calendário" : item === "list" ? "Lista" : "Por ministério";
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={`Visualização ${label}`}
              accessibilityState={{ selected: active }}
              onPress={() => setView(item)}
              style={({ pressed }) => [active ? styles.scheduleViewActive : styles.scheduleViewButton, pressed && styles.pressed]}
            >
              <Text style={active ? styles.scheduleViewActiveText : styles.scheduleViewText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.scheduleFilters}>
        <FilterMenu label="Evento" options={eventOptions} value={eventFilter} onChange={setEventFilter} />
        <FilterMenu label="Ministério" options={ministryOptions} value={ministryFilter} onChange={setMinistryFilter} />
        <FilterMenu label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
      </View>
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={onRetry} /> : null}
      {canCreate ? <View style={styles.managementBanner}><Text style={styles.managementBannerTitle}>Gestão de escalas</Text><Text style={styles.managementBannerText}>Crie o evento, monte a equipe e acompanhe as respostas.</Text><Button size="compact" onPress={() => router.push("/schedule-admin" as never)}>Gerenciar escalas</Button><Button size="compact" onPress={() => router.push("/schedule-create" as never)}>+ Criar escala</Button></View> : null}
      <View style={styles.scheduleBoard}>
        {groups.length ? view === "list" ? filteredItems.map(renderRow) : groups.map((group) => {
          const groupItems = view === "calendar"
            ? filteredItems.filter((item) => new Date(item.event_start_at).toLocaleDateString("pt-BR") === group)
            : filteredItems.filter((item) => (item.ministry_name || "Sem ministério") === group);
          return (
            <View key={group} style={styles.scheduleGroup}>
              <View style={styles.scheduleGroupHeader}>
                <Text style={styles.scheduleGroupTitle}>{view === "calendar" ? group : group}</Text>
                <Text style={styles.scheduleGroupCount}>{groupItems.length} participações</Text>
              </View>
              {groupItems.map(renderRow)}
            </View>
          );
        }) : <View style={styles.scheduleEmpty}><Text style={styles.emptyTitle}>Nenhuma escala encontrada</Text><Text style={styles.emptyText}>Ajuste os filtros ou aguarde uma escala publicada.</Text></View>}
      </View>
    </View>
  );
}

export function SchedulesScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [items, setItems] = useState<ScheduleAssignment[]>([]);
  const [justifications, setJustifications] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const actingRef = useRef(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const isAdmin = Boolean(me?.capabilities.includes("manage_all"));
  const canCreate = Boolean(me?.can_access_management);
  // Atalho para a gestao existe so para quem realmente opera escalas
  // (coordenacao/lideranca). `can_access_management` e mais amplo que isso.
  const podeGerenciar = podeGerenciarEscalas(me?.capabilities || []);
  const toast = useToast();

  const load = useCallback(async () => {
    setError(null);
    if (!me?.member_id && !isAdmin) {
      setLoading(false);
      return;
    }
    try {
      setItems(await api.get<ScheduleAssignment[]>("/me/schedules/"));
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar suas escalas"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me?.member_id, isAdmin]);

  async function act(id: number, action: "confirm" | "decline" | "unavailable") {
    if (actingId !== null || actingRef.current) return;
    actingRef.current = true;
    setActingId(id);
    try {
      await api.post("/me/schedules/" + id + "/action/", {
        action,
        justification: justifications[id] || "",
      });
      await load();
      toast(action === "confirm" ? "Presença confirmada na escala." : "A coordenação foi avisada da sua resposta.", {
        tone: "success",
        title: action === "confirm" ? "Escala confirmada" : "Resposta registrada",
      });
    } catch (err) {
      const result = describeError(err, action === "confirm" ? "Nao foi possivel confirmar" : "Nao foi possivel recusar");
      toast(result.message, { tone: "error", title: result.title });
    } finally {
      actingRef.current = false;
      setActingId(null);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  return (
    <Screen
      title={isAdmin ? "Escalas da igreja" : "Minhas escalas"}
      headerSubtitle={isAdmin ? "Visualize as escalas e equipes da igreja" : "Responda e acompanhe suas participações"}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerAccessory={canCreate ? <Button size="compact" onPress={() => router.push("/schedule-create" as never)}>+ Adicionar escala</Button> : null}
    >
      {desktop ? <DesktopSchedules items={items} canCreate={canCreate} error={error} onRetry={load} router={router} /> : <>
      {canCreate ? (
        <Card>
          <Text style={styles.managementTitle}>Gestão de escalas</Text>
          <Text style={styles.meta}>Monte a equipe, publique e acompanhe as respostas.</Text>
          <View style={styles.buttonRow}>
            {podeGerenciar ? (
              <View style={styles.buttonFlex}><Button onPress={() => router.push("/schedule-admin" as never)}>Gerenciar escalas</Button></View>
            ) : null}
            <View style={styles.buttonFlex}><Button variant="ghost" onPress={() => router.push("/schedule-create" as never)}>Adicionar escala</Button></View>
          </View>
        </Card>
      ) : null}

      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}

      {items.map((item) => (
        <Card key={item.id}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCol}>
              <Text style={styles.eventName}>{item.event_name}</Text>
              <Text style={styles.meta}>{item.schedule_name} · {item.ministry_name} / {item.role_name}</Text>
              <Text style={styles.meta}>{formatDate(item.event_start_at, true)}</Text>
            </View>
            <Badge label={statusLabel(item.status)} tone={statusTone(item.status)} />
          </View>

          <Button variant="ghost" onPress={() => router.push({ pathname: "/schedule/[id]", params: { id: item.id } })}>
            {ministryAllowsRepertoire(item.ministry_name) ? "Ver equipe e repertório" : "Ver equipe"}
          </Button>

          {item.status === "pending" && !isAdmin ? (
            <View style={styles.respondBox}>
              <Field
                value={justifications[item.id] || ""}
                onChangeText={(value) => setJustifications((current) => ({ ...current, [item.id]: value }))}
                placeholder="Justificativa (recusa ou indisponibilidade)"
              />
              <View style={styles.buttonRow}>
                <View style={styles.buttonFlex}><Button disabled={actingId !== null} loading={actingId === item.id} onPress={() => act(item.id, "confirm")}>Confirmar</Button></View>
                <View style={styles.buttonFlex}><Button disabled={actingId !== null} variant="secondary" onPress={() => act(item.id, "decline")}>Recusar</Button></View>
              </View>
              <Button disabled={actingId !== null} variant="ghost" onPress={() => act(item.id, "unavailable")}>Marcar indisponível</Button>
            </View>
          ) : null}
        </Card>
      ))}

      {!loading && !error && (me?.member_id || isAdmin) && !items.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>♪</Text>
          <Text style={styles.emptyTitle}>Nenhuma escala no momento</Text>
          <Text style={styles.emptyText}>Quando uma escala for publicada, ela aparecerá aqui.</Text>
        </View>
      ) : null}
      </>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  managementTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  cardHeaderCol: { flex: 1, gap: 2 },
  eventName: { fontSize: 16, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 13, color: colors.inkMuted },
  respondBox: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderDivider, paddingTop: spacing.md },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  buttonFlex: { flex: 1 },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl + spacing.md },
  emptyGlyph: { fontSize: 32, color: colors.inkPlaceholder },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  emptyText: { fontSize: 13, color: colors.inkMuted, textAlign: "center" },

  desktopSchedules: { gap: 16 },
  scheduleViews: { height: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  scheduleViewButton: { height: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8 },
  scheduleViewActive: { height: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderRadius: 8 },
  scheduleViewText: { color: colors.inkBody, fontSize: 11, fontWeight: "700" },
  scheduleViewActiveText: { color: colors.onAccent, fontSize: 11, fontWeight: "800" },
  scheduleFilters: { flexDirection: "row", gap: 10, height: 48, alignItems: "center" },
  scheduleFilter: { height: 40, minWidth: 180, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8 },
  filterChevron: { color: colors.inkMuted, fontSize: 16 },
  scheduleFilterText: { color: colors.inkBody, fontSize: 11 },
  pressed: { opacity: 0.82 },
  filterOverlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg, backgroundColor: "rgba(15, 23, 42, 0.42)" },
  filterMenu: { width: "100%", maxWidth: 420, maxHeight: "75%", padding: spacing.md, gap: spacing.sm, borderRadius: 12, backgroundColor: colors.surface },
  filterMenuTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", paddingHorizontal: spacing.sm },
  filterOption: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: 8 },
  filterOptionActive: { backgroundColor: colors.surfaceSelected },
  filterOptionText: { color: colors.inkBody, fontSize: 13 },
  filterOptionTextActive: { color: colors.accent, fontWeight: "800" },
  managementBanner: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE", borderRadius: 10 },
  managementBannerTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  managementBannerText: { flex: 1, color: colors.inkMuted, fontSize: 11 },
  scheduleBoard: { minHeight: 650, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 18, gap: 14 },
  scheduleGroup: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" },
  scheduleGroupHeader: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  scheduleGroupTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  scheduleGroupCount: { color: colors.inkMuted, fontSize: 10 },
  scheduleBoardRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  scheduleBoardCopy: { flex: 1, gap: 3 },
  scheduleBoardTitle: { color: colors.inkBody, fontSize: 12, fontWeight: "700" },
  scheduleEmpty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
});
