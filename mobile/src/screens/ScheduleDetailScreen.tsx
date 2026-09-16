import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Badge, Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ScheduleAssignmentDetail } from "@/types/api";
import { colors, formatDate, spacing, statusLabel } from "@/theme";

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "confirmed") return "success";
  if (status === "declined") return "danger";
  if (status === "pending") return "warning";
  return "neutral";
}

export function ScheduleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<ScheduleAssignmentDetail | null>(null);
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await api.get<ScheduleAssignmentDetail>(`/me/schedules/${id}/`));
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar a escala"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function act(action: "confirm" | "decline" | "unavailable") {
    setActing(true);
    try {
      await api.post(`/me/schedules/${id}/action/`, { action, justification });
      setJustification("");
      await load();
    } catch (err) {
      const { title, message } = describeError(
        err,
        action === "confirm" ? "Nao foi possivel confirmar" : "Nao foi possivel recusar",
      );
      Alert.alert(title, message);
    } finally {
      setActing(false);
    }
  }

  return (
    <Screen title="Detalhe da Escala">
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {loading && !detail ? <Text style={styles.meta}>Carregando…</Text> : null}

      {detail ? (
        <>
          <Card>
            <View style={styles.eventHeader}>
              <View style={styles.eventHeaderCol}>
                <Text style={styles.eventName}>{detail.event_name}</Text>
                <Text style={styles.meta}>{formatDate(detail.event_start_at, true)}</Text>
                {detail.event_location ? <Text style={styles.meta}>{detail.event_location}</Text> : null}
              </View>
              <Badge label={statusLabel(detail.status)} tone={statusTone(detail.status)} />
            </View>
            <Text style={styles.meta}>
              {detail.ministry_name} / {detail.role_name} · {detail.schedule_name}
            </Text>
          </Card>

          {detail.schedule_notes ? (
            <Card>
              <Text style={styles.sectionTitle}>Observacoes</Text>
              <Text style={styles.body}>{detail.schedule_notes}</Text>
            </Card>
          ) : null}

          <Card>
            <Text style={styles.sectionTitle}>Repertorio ({detail.repertoire.length})</Text>
            {detail.repertoire.length ? (
              detail.repertoire.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.orderCircle}>
                    <Text style={styles.orderText}>{item.order}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.meta}>
                      {item.item_type_display}
                      {item.song_key ? ` · Tom ${item.song_key}` : ""}
                    </Text>
                    {item.notes ? <Text style={styles.meta}>{item.notes}</Text> : null}
                    <Button
                      variant="ghost"
                      onPress={() => router.push({ pathname: "/song/[id]", params: { id: item.id, scheduleId: detail.schedule } })}
                    >
                      Ver detalhes da musica
                    </Button>
                    {item.reference_url ? (
                      <Text
                        accessibilityRole="link"
                        onPress={() => Linking.openURL(item.reference_url)}
                        style={styles.link}
                      >
                        Abrir cifra/referencia ↗
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.meta}>Repertorio ainda nao publicado.</Text>
            )}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Equipe escalada ({detail.team.length})</Text>
            {detail.team.map((member) => (
              <View key={member.id} style={styles.teamRow}>
                <View style={styles.rowBody}>
                  <Text style={[styles.itemTitle, member.is_me && styles.me]}>
                    {member.member_name}
                    {member.is_me ? " (voce)" : ""}
                  </Text>
                  <Text style={styles.meta}>
                    {member.ministry_name} / {member.role_name}
                  </Text>
                </View>
                <Badge label={statusLabel(member.status)} tone={statusTone(member.status)} />
              </View>
            ))}
          </Card>

          {detail.status === "pending" ? (
            <Card>
              <Text style={styles.sectionTitle}>Sua resposta</Text>
              <Field
                value={justification}
                onChangeText={setJustification}
                placeholder="Justificativa (recusa ou indisponibilidade)"
              />
              <View style={styles.buttonRow}>
                <View style={styles.buttonFlex}>
                  <Button disabled={acting} loading={acting} onPress={() => act("confirm")}>
                    {acting ? "Enviando..." : "Confirmar"}
                  </Button>
                </View>
                <View style={styles.buttonFlex}>
                  <Button disabled={acting} variant="secondary" onPress={() => act("decline")}>
                    Recusar
                  </Button>
                </View>
              </View>
              <Button disabled={acting} variant="ghost" onPress={() => act("unavailable")}>
                Marcar indisponivel
              </Button>
            </Card>
          ) : (
            <View style={styles.respondedNote}>
              <Text style={styles.meta}>
                {detail.status === "confirmed" ? "Voce confirmou presenca." : "Voce recusou esta escala."}
                {detail.responded_at ? ` (${formatDate(detail.responded_at, true)})` : ""}
              </Text>
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  eventHeaderCol: {
    flex: 1,
    gap: 2,
  },
  eventName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  meta: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  body: {
    fontSize: 14,
    color: colors.inkBody,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  orderCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceSelected,
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  me: {
    color: colors.accent,
  },
  link: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  buttonFlex: {
    flex: 1,
  },
  respondedNote: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
});
