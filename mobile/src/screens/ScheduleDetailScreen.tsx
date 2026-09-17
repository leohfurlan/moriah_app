import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { useToast } from "@/components/Feedback";
import { Badge, Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { ApiError, describeError, UserFacingError } from "@/services/errors";
import { ScheduleAssignmentDetail } from "@/types/api";
import { colors, formatDate, spacing, statusLabel } from "@/theme";

function ministryAllowsRepertoire(name: string): boolean {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  return ["louvor", "danca", "som", "projecao", "tecnica"].some((term) => normalized.includes(term));
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "confirmed") return "success";
  if (status === "declined" || status === "conflict") return "danger";
  if (status === "pending" || status === "unavailable") return "warning";
  return "neutral";
}
function responseNote(status: string): string {
  switch (status) {
    case "confirmed":
      return "Voce confirmou presenca.";
    case "declined":
      return "Voce recusou esta escala.";
    case "unavailable":
      return "Voce marcou indisponibilidade para esta escala.";
    case "conflict":
      return "Sua confirmacao encontrou um conflito de horario. Voce ainda pode recusar ou marcar indisponibilidade.";
    case "replacement_needed":
      return "Esta escala aguarda uma substituicao.";
    default:
      return "Aguardando sua resposta.";
  }
}

const ACTION_FEEDBACK: Record<"confirm" | "decline" | "unavailable", { title: string; message: string }> = {
  confirm: { title: "Presenca confirmada", message: "Sua presenca foi confirmada nesta escala." },
  decline: { title: "Resposta registrada", message: "Sua recusa foi registrada." },
  unavailable: { title: "Resposta registrada", message: "Sua indisponibilidade foi registrada." },
};

export function ScheduleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<ScheduleAssignmentDetail | null>(null);
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const actingRef = useRef(false);
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
    // Trava de reentrancia: clique duplo nao pode enviar a resposta duas vezes.
    // Ref cobre o mesmo tick, estado cobre o resto da operacao em andamento.
    if (acting || actingRef.current) return;
    actingRef.current = true;
    setActing(true);
    try {
      await api.post(`/me/schedules/${id}/action/`, { action, justification });
      setJustification("");
      await load();
      toast(ACTION_FEEDBACK[action].message, { tone: "success", title: ACTION_FEEDBACK[action].title });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) await load();
      const { title, message } = describeError(
        err,
        action === "confirm"
          ? "Nao foi possivel confirmar"
          : action === "decline"
            ? "Nao foi possivel recusar"
            : "Nao foi possivel registrar a indisponibilidade",
      );
      toast(message, { tone: "error", title });
    } finally {
      actingRef.current = false;
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

          {ministryAllowsRepertoire(detail.ministry_name) ? (
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
          ) : null}

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

          {detail.schedule_status === "cancelled" ? (
            <View style={styles.respondedNote}>
              <Text style={styles.meta}>Esta escala foi cancelada. O periodo de respostas foi encerrado.</Text>
            </View>
          ) : detail.status !== "replacement_needed" ? (
            <Card>
              <Text style={styles.sectionTitle}>{detail.status === "pending" ? "Sua resposta" : "Alterar resposta"}</Text>
              {detail.status === "conflict" ? (
                <Text style={styles.conflictNotice}>
                  {detail.conflict_reason || "Ha um conflito de horario nesta escala."}
                </Text>
              ) : null}
              <Field
                value={justification}
                onChangeText={setJustification}
                placeholder="Justificativa (recusa ou indisponibilidade)"
              />
              <View style={styles.buttonRow}>
                <View style={styles.buttonFlex}>
                  <Button disabled={acting} loading={acting} onPress={() => act("confirm")}>
                    {acting ? "Enviando..." : detail.status === "conflict" ? "Tentar confirmar" : "Confirmar"}
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
                {responseNote(detail.status)}
                {detail.responded_at ? " (" + formatDate(detail.responded_at, true) + ")" : ""}
              </Text>
            </View>
          )}        </>
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
  conflictNotice: { fontSize: 13, color: colors.warning, fontWeight: "700", marginBottom: spacing.sm },
  respondedNote: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
});
