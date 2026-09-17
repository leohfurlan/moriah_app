import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Badge, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useNotifications } from "@/hooks/useNotifications";
import { notificationSection, notificationTime } from "@/notifications";
import { describeError, UserFacingError } from "@/services/errors";
import { colors, spacing } from "@/theme";

const filters = ["Todas", "Não lidas", "Escalas", "Igreja"] as const;
type Filter = (typeof filters)[number];

export function NotificationsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("Todas");
  const { items, loading, error, unreadCount, reload, markRead: persistRead, markAllRead: persistAll } = useNotifications();
  const [mutationError, setMutationError] = useState<UserFacingError | null>(null);
  const [retryTarget, setRetryTarget] = useState<number | "all" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  useEffect(() => { void reload().catch(() => undefined); }, [reload]);
  const visible = useMemo(() => items.filter((item) => {
    if (filter === "Não lidas") return !item.is_read;
    if (filter === "Escalas" || filter === "Igreja") return item.category === filter;
    return true;
  }), [filter, items]);

  async function markRead(id: number) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMutationError(null);
    setRetryTarget(null);
    try {
      if (items.some((item) => item.id === id && !item.is_read)) await persistRead(id);
      router.push(`/notification/${id}` as never);
    } catch (err) {
      setMutationError(describeError(err, "Não foi possível marcar a notificação como lida"));
      setRetryTarget(id);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function markAllRead() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMutationError(null);
    setRetryTarget(null);
    try { await persistAll(); } catch (err) {
      setMutationError(describeError(err, "Não foi possível marcar as notificações como lidas"));
      setRetryTarget("all");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Notificações" headerSubtitle="Avisos e atualizações da igreja" refreshing={loading} onRefresh={() => { void reload().catch(() => undefined); }}>
      <Pressable accessibilityRole="button" disabled={submitting || loading || Boolean(error)} onPress={markAllRead}>
        <Text style={styles.markAll}>Marcar todas como lidas{unreadCount ? ` (${unreadCount})` : ""}</Text>
      </Pressable>
      <View style={styles.filters}>
        {filters.map((item) => (
          <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <Text style={styles.empty}>Carregando notificações…</Text> : null}
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={() => { void reload().catch(() => undefined); }} /> : null}
      {mutationError ? <ErrorNotice title={mutationError.title} message={mutationError.message} onRetry={retryTarget === null ? undefined : () => { void (retryTarget === "all" ? markAllRead() : markRead(retryTarget)); }} /> : null}
      {!loading && !error && !visible.length ? <Text style={styles.empty}>Nenhuma notificação neste filtro.</Text> : null}
      {(["Hoje", "Ontem", "Anteriores"] as const).map((section) => {
        const sectionItems = visible.filter((item) => notificationSection(item.created_at) === section);
        if (!sectionItems.length) return null;
        return (
          <View key={section} style={styles.group}>
            <Text style={styles.section}>{section.toUpperCase()}</Text>
            {sectionItems.map((item) => (
              <Card key={item.id} onPress={() => markRead(item.id)} style={!item.is_read ? styles.unreadCard : undefined}>
                <View style={styles.row}>
                  <View style={[styles.dot, item.is_read && styles.dotRead]} />
                  <View style={styles.copy}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                    <Text style={styles.time}>{notificationTime(item.created_at)}</Text>
                  </View>
                  <Badge label={item.category} tone="neutral" />
                </View>
              </Card>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong },
  filterActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.inkBody, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: colors.onAccent },
  group: { gap: spacing.sm },
  section: { color: colors.inkMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.7, marginTop: spacing.sm },
  unreadCard: { borderColor: colors.accent, backgroundColor: colors.surfaceSelected },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 5 },
  dotRead: { backgroundColor: colors.borderStrong },
  copy: { flex: 1, gap: 2 },
  title: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  body: { color: colors.inkBody, fontSize: 13 },
  time: { color: colors.inkMuted, fontSize: 12 },
  empty: { color: colors.inkMuted, textAlign: "center", paddingVertical: spacing.xxl },
});
