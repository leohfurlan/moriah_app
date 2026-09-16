import { useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { InlineNotice, useToast } from "@/components/Feedback";
import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError } from "@/services/errors";
import { colors, spacing } from "@/theme";

function defaultStart() {
  const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  date.setHours(19, 0, 0, 0);
  return date.toISOString();
}

export function ScheduleCreateScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [eventName, setEventName] = useState("Culto de celebração");
  const [startAt, setStartAt] = useState(useMemo(defaultStart, []));
  const [location, setLocation] = useState("Templo principal");
  const [scheduleName, setScheduleName] = useState("Escala de domingo");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const toast = useToast();

  async function submit() {
    // Trava de reentrancia: sem isto o clique duplo criava duas escalas. O ref
    // cobre o mesmo tick (dois cliques antes do re-render); o estado cobre o resto.
    if (submitting || submittingRef.current) return;
    if (!eventName.trim() || !startAt.trim() || !scheduleName.trim()) {
      setNotice({ title: "Dados incompletos", message: "Informe o evento, início e nome da escala." });
      return;
    }
    setNotice(null);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api.post("/schedules/", {
        event_name: eventName.trim(),
        event_type: "culto",
        start_at: startAt,
        location: location.trim(),
        schedule_name: scheduleName.trim(),
        notes: notes.trim(),
        status: "published",
      });
      toast("O evento foi adicionado à agenda da igreja.", { tone: "success", title: "Escala criada" });
      router.replace("/agenda");
    } catch (error) {
      const { title, message } = describeError(error, "Não foi possível criar a escala");
      toast(message, { tone: "error", title });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Adicionar escala" headerSubtitle="Crie o evento e publique a programação">
      <Card>
        <Text style={styles.label}>Evento da igreja</Text>
        <Field value={eventName} onChangeText={setEventName} placeholder="Ex.: Culto de celebração" />
        <Text style={styles.label}>Início</Text>
        <Field value={startAt} onChangeText={setStartAt} placeholder="2026-09-20T19:00:00-03:00" />
        <Text style={styles.label}>Local</Text>
        <Field value={location} onChangeText={setLocation} placeholder="Templo principal" />
        <Text style={styles.label}>Nome da escala</Text>
        <Field value={scheduleName} onChangeText={setScheduleName} placeholder="Ex.: Louvor - domingo" />
        <Text style={styles.label}>Observações</Text>
        <Field value={notes} onChangeText={setNotes} multiline placeholder="Chegada, ensaio e orientações" />
        {notice ? (
          <InlineNotice
            tone="warning"
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        ) : null}
        <Button loading={submitting} disabled={submitting} onPress={submit}>Adicionar escala</Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.inkMuted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.sm },
});
