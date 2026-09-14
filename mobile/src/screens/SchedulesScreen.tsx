import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Badge, Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ScheduleAssignment } from "@/types/api";
import { colors, formatDate, spacing, statusLabel } from "@/theme";

function statusTone(status: ScheduleAssignment["status"]): "success" | "warning" | "danger" {
  if (status === "confirmed") return "success";
  if (status === "declined") return "danger";
  return "warning";
}

export function SchedulesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ScheduleAssignment[]>([]);
  const [justifications, setJustifications] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await api.get<ScheduleAssignment[]>("/me/schedules/"));
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar suas escalas"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function act(id: number, action: "confirm" | "decline") {
    setActingId(id);
    try {
      await api.post(`/me/schedules/${id}/action/`, {
        action,
        justification: justifications[id] || "",
      });
      await load();
    } catch (err) {
      const { title, message } = describeError(
        err,
        action === "confirm" ? "Nao foi possivel confirmar" : "Nao foi possivel recusar",
      );
      Alert.alert(title, message);
    } finally {
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
    <Screen title="Minha Escala" refreshing={refreshing} onRefresh={onRefresh}>
        {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}

        {items.map((item) => (
          <Card key={item.id}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCol}>
                <Text style={styles.eventName}>{item.event_name}</Text>
                <Text style={styles.meta}>
                  {item.ministry_name} / {item.role_name}
                </Text>
                <Text style={styles.meta}>{formatDate(item.event_start_at, true)}</Text>
              </View>
              <Badge label={statusLabel(item.status)} tone={statusTone(item.status)} />
            </View>

            <Button variant="ghost" onPress={() => router.push({ pathname: "/schedule/[id]", params: { id: item.id } })}>
              Ver equipe e repertorio
            </Button>

            {item.status === "pending" ? (
              <View style={styles.respondBox}>
                <Field
                  value={justifications[item.id] || ""}
                  onChangeText={(value) => setJustifications((current) => ({ ...current, [item.id]: value }))}
                  placeholder="Justificativa (para recusar)"
                />
                <View style={styles.buttonRow}>
                  <View style={styles.buttonFlex}>
                    <Button disabled={actingId !== null} loading={actingId === item.id} onPress={() => act(item.id, "confirm")}>
                      Confirmar
                    </Button>
                  </View>
                  <View style={styles.buttonFlex}>
                    <Button disabled={actingId !== null} variant="secondary" onPress={() => act(item.id, "decline")}>
                      Recusar
                    </Button>
                  </View>
                </View>
              </View>
            ) : null}
          </Card>
        ))}

        {!loading && !error && !items.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>♪</Text>
            <Text style={styles.emptyTitle}>Nenhuma escala no momento</Text>
            <Text style={styles.emptyText}>Quando a equipe for escalada para um culto, voce vera aqui.</Text>
          </View>
        ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cardHeaderCol: {
    flex: 1,
    gap: 2,
  },
  eventName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
  },
  meta: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  respondBox: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    paddingTop: spacing.md,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  buttonFlex: {
    flex: 1,
  },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl + spacing.md,
  },
  emptyGlyph: {
    fontSize: 32,
    color: colors.inkPlaceholder,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  emptyText: {
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
