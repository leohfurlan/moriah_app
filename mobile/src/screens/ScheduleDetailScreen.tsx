import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ScheduleAssignmentDetail } from "@/types/api";

const statusColors: Record<string, string> = {
  confirmed: "#2f7a4d",
  declined: "#8a3c2d",
  pending: "#9a6b1f",
};

export function ScheduleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<ScheduleAssignmentDetail | null>(null);
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
    load();
  }, [load]);

  async function act(action: "confirm" | "decline") {
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
      <Button variant="secondary" onPress={() => router.back()}>
        Voltar
      </Button>

      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {loading ? <Text>Carregando...</Text> : null}

      {detail ? (
        <>
          <Card>
            <Text style={styles.eventName}>{detail.event_name}</Text>
            <Text style={styles.meta}>{new Date(detail.event_start_at).toLocaleString()}</Text>
            {detail.event_location ? <Text style={styles.meta}>Local: {detail.event_location}</Text> : null}
            <Text style={styles.meta}>
              {detail.ministry_name} / {detail.role_name}
            </Text>
            <Text style={[styles.status, { color: statusColors[detail.status] || "#4b4038" }]}>
              Sua situacao: {detail.status_display}
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
                  <Text style={styles.order}>{item.order}</Text>
                  <View style={styles.rowBody}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.meta}>
                      {item.item_type_display}
                      {item.song_key ? ` · Tom ${item.song_key}` : ""}
                    </Text>
                    {item.notes ? <Text style={styles.meta}>{item.notes}</Text> : null}
                    {item.reference_url ? (
                      <Text
                        accessibilityRole="link"
                        style={styles.link}
                        onPress={() => Linking.openURL(item.reference_url)}
                      >
                        Abrir cifra/referencia
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
                <Text style={[styles.badge, { color: statusColors[member.status] || "#4b4038" }]}>
                  {member.status_display}
                </Text>
              </View>
            ))}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Sua resposta</Text>
            <Field
              value={justification}
              onChangeText={setJustification}
              placeholder="Justificativa (obrigatoria para recusar)"
            />
            <View style={{ gap: 8 }}>
              <Button disabled={acting} onPress={() => act("confirm")}>
                {acting ? "Enviando..." : "Confirmar"}
              </Button>
              <Button disabled={acting} variant="secondary" onPress={() => act("decline")}>
                Recusar
              </Button>
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eventName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3f2f24",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3f2f24",
    marginBottom: 8,
  },
  meta: {
    color: "#5f5148",
  },
  body: {
    color: "#4b4038",
  },
  status: {
    fontWeight: "700",
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#efe6d9",
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#efe6d9",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  order: {
    fontWeight: "700",
    color: "#7a4d2d",
    minWidth: 18,
  },
  itemTitle: {
    fontWeight: "700",
    color: "#3f2f24",
  },
  me: {
    color: "#7a4d2d",
  },
  badge: {
    fontWeight: "700",
    fontSize: 12,
  },
  link: {
    color: "#7a4d2d",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
