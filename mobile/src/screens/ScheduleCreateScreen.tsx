import { useMemo, useState } from "react";
import { Alert, Platform, StyleSheet, Text, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

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
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!eventName.trim() || !startAt.trim() || !scheduleName.trim()) {
      Alert.alert("Dados incompletos", "Informe o evento, início e nome da escala.");
      return;
    }
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
      Alert.alert("Escala criada", "O evento foi adicionado à agenda da igreja.", [{ text: "OK", onPress: () => router.replace("/agenda") }]);
    } catch (error) {
      const result = describeError(error, "Não foi possível criar a escala");
      Alert.alert(result.title, result.message);
    } finally {
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
        <Button loading={submitting} disabled={submitting} onPress={submit}>Adicionar escala</Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.inkMuted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.sm },
});
