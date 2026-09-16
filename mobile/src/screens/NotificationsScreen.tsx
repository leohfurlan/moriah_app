import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Badge, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { MVP_NOTIFICATIONS } from "@/notifications";
import { colors, spacing } from "@/theme";

const filters = ["Todas", "Não lidas", "Escalas", "Igreja"] as const;
type Filter = (typeof filters)[number];

export function NotificationsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("Todas");
  const [read, setRead] = useState<string[]>([]);
  const unreadCount = MVP_NOTIFICATIONS.length - read.length;
  const visible = useMemo(
    () => MVP_NOTIFICATIONS.filter((item) => {
      if (filter === "Não lidas") return !read.includes(item.id);
      if (filter === "Escalas" || filter === "Igreja") return item.category === filter;
      return true;
    }),
    [filter, read],
  );

  function markRead(id: string) {
    setRead((current) => (current.includes(id) ? current : [...current, id]));
    router.push(`/notification/${id}` as never);
  }

  return (
    <Screen title="Notificações" headerSubtitle="Avisos e atualizações da igreja">
      <Pressable accessibilityRole="button" onPress={() => setRead(MVP_NOTIFICATIONS.map((item) => item.id))}>
        <Text style={styles.markAll}>Marcar todas como lidas{unreadCount ? ` (${unreadCount})` : ""}</Text>
      </Pressable>

      <View style={styles.filters}>
        {filters.map((item) => (
          <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {filters.length && visible.length ? null : <Text style={styles.empty}>Nenhuma notificação neste filtro.</Text>}
      {(["Hoje", "Ontem", "Anteriores"] as const).map((section) => {
        const items = visible.filter((item) => item.section === section);
        if (!items.length) return null;
        return (
          <View key={section} style={styles.group}>
            <Text style={styles.section}>{section.toUpperCase()}</Text>
            {items.map((item) => {
              const isRead = read.includes(item.id);
              return (
                <Card key={item.id} onPress={() => markRead(item.id)} style={!isRead ? styles.unreadCard : undefined}>
                  <View style={styles.row}>
                    <View style={[styles.dot, isRead && styles.dotRead]} />
                    <View style={styles.copy}>
                      <Text style={styles.title}>{item.title}</Text>
                      <Text style={styles.body}>{item.body}</Text>
                      <Text style={styles.time}>{item.time}</Text>
                    </View>
                    <Badge label={item.category} tone="neutral" />
                  </View>
                </Card>
              );
            })}
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
