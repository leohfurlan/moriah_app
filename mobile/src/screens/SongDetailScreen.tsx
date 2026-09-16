import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, StyleSheet, Text } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { useToast } from "@/components/Feedback";
import { Button, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ScheduleAssignmentDetail, ScheduleItem } from "@/types/api";
import { colors, spacing } from "@/theme";

export function SongDetailScreen() {
  const { id, scheduleId } = useLocalSearchParams<{ id: string; scheduleId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [item, setItem] = useState<ScheduleItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);
  // Sem escala na URL nao existe musica para buscar: `undefined` no path gerava
  // uma chamada /me/schedules/undefined/ e um 404 confuso para o membro.
  const semContexto = !id || !scheduleId;

  const load = useCallback(async () => {
    if (semContexto) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const detail = await api.get<ScheduleAssignmentDetail>(`/me/schedules/${scheduleId}/`);
      setItem(detail.repertoire.find((candidate) => String(candidate.id) === String(id)) || null);
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar a musica"));
    } finally {
      setLoading(false);
    }
  }, [id, scheduleId, semContexto]);

  useEffect(() => { load(); }, [load]);

  if (semContexto) {
    return (
      <Screen title="Musica">
        <Card>
          <Text style={styles.sectionTitle}>Musica sem contexto</Text>
          <Text style={styles.body}>
            Esta musica pertence ao repertorio de uma escala. Abra a escala para ver a cifra, o tom e as observacoes.
          </Text>
        </Card>
        <Button onPress={() => router.replace("/schedules")}>Ver minhas escalas</Button>
      </Screen>
    );
  }

  if (loading && !item) return <Screen title="Musica"><Text style={styles.meta}>Carregando...</Text></Screen>;
  if (error) return <Screen title="Musica"><ErrorNotice title={error.title} message={error.message} onRetry={load} /></Screen>;
  if (!item) return <Screen title="Musica"><Text style={styles.meta}>Musica nao encontrada ou ainda nao publicada.</Text></Screen>;

  const open = async (url: string) => {
    try { await Linking.openURL(url); } catch { toast("Nao foi possivel abrir este link.", { tone: "warning", title: "Link indisponivel" }); }
  };

  return (
    <Screen title="Detalhe da musica">
      <Card>
        <Text style={styles.order}>#{item.order}</Text>
        <Text style={styles.title}>{item.song_title || item.title}</Text>
        {item.artist ? <Text style={styles.meta}>{item.artist}</Text> : null}
        <Text style={styles.meta}>Tom: {item.effective_key || "Nao informado"}</Text>
        {item.effective_bpm ? <Text style={styles.meta}>BPM: {item.effective_bpm}</Text> : null}
        {item.effective_duration_seconds ? <Text style={styles.meta}>Duracao: {Math.floor(item.effective_duration_seconds / 60)}:{String(item.effective_duration_seconds % 60).padStart(2, "0")}</Text> : null}
      </Card>
      {item.notes ? <Card><Text style={styles.sectionTitle}>Observacoes</Text><Text style={styles.body}>{item.notes}</Text></Card> : null}
      {item.reference_url ? <Button variant="secondary" onPress={() => open(item.reference_url)}>Abrir referencia</Button> : null}
      {item.chord_url ? <Button variant="ghost" onPress={() => open(item.chord_url as string)}>Abrir cifra</Button> : null}
      {item.spotify_url ? <Button variant="ghost" onPress={() => open(item.spotify_url as string)}>Ouvir no Spotify</Button> : null}
      {item.youtube_url ? <Button variant="ghost" onPress={() => open(item.youtube_url as string)}>Abrir no YouTube</Button> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  order: { fontSize: 13, color: colors.accent, fontWeight: "800" },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  body: { fontSize: 15, color: colors.inkBody },
  meta: { fontSize: 14, color: colors.inkMuted, marginTop: spacing.xs },
});