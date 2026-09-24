import { useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";

import { DateTimeField, dateInputToIso } from "@/components/DateTimeField";
import { FeedbackTone, InlineNotice, useToast } from "@/components/Feedback";
import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError } from "@/services/errors";
import { PersonalCommitment } from "@/types/api";
import { colors, spacing } from "@/theme";

export function NewCommitmentScreen() {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [aviso, setAviso] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);

  async function submit() {
    if (submitting || submittingRef.current) return;
    if (!title.trim() || !startsAt.trim()) {
      setAviso({ tone: "warning", title: "Dados incompletos", message: "Informe o título e o início do compromisso." });
      return;
    }
    const inicio = dateInputToIso(startsAt, "datetime");
    const fim = endsAt.trim() ? dateInputToIso(endsAt, "datetime") : null;
    if (!inicio || (endsAt.trim() && !fim)) {
      setAviso({ tone: "warning", title: "Data inválida", message: "Use dd/mm/aaaa hh:mm. O horário deve estar no formato 24 horas." });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setAviso(null);
    try {
      await api.post<PersonalCommitment>("/me/agenda/", {
        title: title.trim(),
        commitment_type: "personal",
        starts_at: inicio,
        ends_at: fim,
        notes,
      });
      toast("O compromisso já aparece na sua agenda.", { tone: "success", title: "Compromisso adicionado" });
      router.replace("/agenda" as never);
    } catch (err) {
      const result = describeError(err, "Não foi possível salvar");
      toast(result.message, { tone: "error", title: result.title });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Novo compromisso" headerSubtitle="Adicione um compromisso pessoal à sua agenda">
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>Detalhes do compromisso</Text>
        <Field value={title} onChangeText={setTitle} placeholder="Ex.: Ensaio do Louvor" accessibilityLabel="Título do compromisso" />
        <DateTimeField accessibilityLabel="Início do compromisso" value={startsAt} onChangeText={setStartsAt} placeholder="dd/mm/aaaa hh:mm" />
        <DateTimeField accessibilityLabel="Fim do compromisso" mode="datetime" value={endsAt} onChangeText={setEndsAt} placeholder="dd/mm/aaaa hh:mm (opcional)" />
        <Field value={notes} onChangeText={setNotes} placeholder="Observações (opcional)" multiline accessibilityLabel="Observações do compromisso" />
        {aviso ? <InlineNotice tone={aviso.tone} title={aviso.title} message={aviso.message} onDismiss={() => setAviso(null)} /> : null}
        <Button loading={submitting} disabled={submitting} onPress={() => void submit()}>Adicionar à agenda</Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formCard: { gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
});
