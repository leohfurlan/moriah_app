import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { DateTimeField, dateInputToIso } from "@/components/DateTimeField";
import { FeedbackTone, InlineNotice, useToast } from "@/components/Feedback";
import { Badge, Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { Contribution } from "@/types/api";
import { colors, formatBRL, formatDate, spacing, statusLabel } from "@/theme";

type StatusFilter = "all" | "pending" | "needs_review" | "approved" | "rejected";

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: "Todas", value: "all" },
  { label: "Pendentes", value: "pending" },
  { label: "Em revisão", value: "needs_review" },
  { label: "Aprovadas", value: "approved" },
  { label: "Rejeitadas", value: "rejected" },
];

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function statusFilterPath(status: StatusFilter, dateFrom: string, dateTo: string): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (dateFrom.trim()) params.set("date_from", dateFrom.trim());
  if (dateTo.trim()) params.set("date_to", dateTo.trim());
  const query = params.toString();
  return query ? `/contributions/?${query}` : "/contributions/";
}

export function FinanceReviewScreen() {
  const toast = useToast();
  const submittingRef = useRef(false);
  const loadSequence = useRef(0);
  const [items, setItems] = useState<Contribution[]>([]);
  const [selected, setSelected] = useState<Contribution | null>(null);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [period, setPeriod] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [aviso, setAviso] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    try {
      const nextItems = await api.get<Contribution[]>(statusFilterPath(status, period.from, period.to));
      if (sequence !== loadSequence.current) return;
      setItems(nextItems);
      setSelected((current) => current ? nextItems.find((item) => item.id === current.id) || null : null);
    } catch (err) {
      if (sequence === loadSequence.current) setError(describeError(err, "Não foi possível carregar as contribuições"));
    } finally {
      if (sequence === loadSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [period, status]);

  useEffect(() => {
    setItems([]);
    setSelected(null);
    load();
    return () => { ++loadSequence.current; };
  }, [load]);

  function selectContribution(item: Contribution) {
    setSelected(item);
    setReviewNotes(item.review_notes || "");
    setAviso(null);
  }

  async function review(nextStatus: "approved" | "rejected") {
    if (!selected || submittingRef.current) return;
    const notes = reviewNotes.trim();
    if (nextStatus === "rejected" && !notes) {
      setAviso({
        tone: "warning",
        title: "Motivo obrigatório",
        message: "Informe o motivo antes de rejeitar esta contribuição.",
      });
      return;
    }

    submittingRef.current = true;
    ++loadSequence.current;
    setSubmitting(true);
    setAviso(null);
    try {
      const updated = await api.post<Contribution>(`/contributions/${selected.id}/review/`, {
        status: nextStatus,
        review_notes: notes,
      });
      setItems((current) => current.flatMap((item) => item.id !== updated.id ? [item] : status === "all" || status === updated.status ? [updated] : []));
      setSelected(updated);
      setReviewNotes(updated.review_notes || "");
      toast(nextStatus === "approved" ? "Contribuição aprovada." : "Contribuição rejeitada.", {
        title: "Revisão registrada",
      });
      await load();
    } catch (err) {
      setAviso({
        tone: "error",
        title: "Não foi possível registrar",
        message: describeError(err, "Falha na revisão").message,
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen
      title="Revisão financeira"
      headerSubtitle="Contribuições da sua igreja"
      refreshing={refreshing}
      onRefresh={() => { if (!submitting) { setRefreshing(true); load(); } }}
    >
      <Card>
        <Text style={styles.sectionTitle}>Filtros</Text>
        <Text style={styles.label}>Status</Text>
        <View style={styles.filterRow}>
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              size="compact"
              variant={status === filter.value ? "primary" : "secondary"}
              disabled={submitting}
              onPress={() => setStatus(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </View>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.label}>De</Text>
            <DateTimeField accessibilityLabel="Data inicial do filtro" mode="date" disabled={submitting} value={dateFrom} onChangeText={setDateFrom} placeholder="dd/mm/aaaa" />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.label}>Até</Text>
            <DateTimeField accessibilityLabel="Data final do filtro" mode="date" disabled={submitting} value={dateTo} onChangeText={setDateTo} placeholder="dd/mm/aaaa" />
          </View>
        </View>
        <Button variant="secondary" disabled={submitting} onPress={() => {
          const from = dateFrom.trim() ? (dateInputToIso(dateFrom, "date") || "") : "";
          const to = dateTo.trim() ? (dateInputToIso(dateTo, "date") || "") : "";
          if ((dateFrom.trim() && !from) || (dateTo.trim() && !to)) {
            setAviso({ tone: "warning", title: "Data inválida", message: "Use o formato dd/mm/aaaa." });
            return;
          }
          if (from === period.from && to === period.to) load();
          else setPeriod({ from, to });
        }}>Aplicar filtros</Button>
      </Card>

      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {aviso ? <InlineNotice tone={aviso.tone} title={aviso.title} message={aviso.message} onDismiss={() => setAviso(null)} /> : null}

      {loading && !items.length ? <Text style={styles.feedback}>Carregando contribuições...</Text> : null}
      {!loading && !error && !items.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhuma contribuição encontrada</Text>
          <Text style={styles.emptyText}>Ajuste os filtros ou aguarde novos lançamentos.</Text>
        </View>
      ) : null}

      {items.length ? (
        <View style={styles.list}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Lançamentos ({items.length})
          </Text>
          {items.map((item) => (
            <Card key={item.id} onPress={() => { if (!submitting) selectContribution(item); }} style={selected?.id === item.id ? styles.selectedCard : undefined}>
              <View style={styles.row}>
                <View style={styles.copy}>
                  <Text style={styles.itemTitle}>{item.member_name || "Membro não identificado"}</Text>
                  <Text style={styles.meta}>{statusLabel(item.category)} · {formatDate(item.contribution_date)}</Text>
                </View>
                <View style={styles.amount}>
                  <Text style={styles.amountText}>{formatBRL(item.amount)}</Text>
                  <Badge label={statusLabel(item.status)} tone={statusTone(item.status)} />
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {selected ? (
        <Card>
          <View style={styles.detailHeader}>
            <View style={styles.copy}>
              <Text style={styles.sectionTitle}>Detalhe da contribuição</Text>
              <Text style={styles.meta}>{selected.member_name || "Membro não identificado"} · {formatDate(selected.contribution_date)}</Text>
            </View>
            <Badge label={statusLabel(selected.status)} tone={statusTone(selected.status)} />
          </View>
          <Text style={styles.detailAmount}>{formatBRL(selected.amount)}</Text>
          <Text style={styles.label}>Comprovantes</Text>
          {selected.attachments.length ? selected.attachments.map((attachment) => (
            <Button key={attachment.id} variant="secondary" onPress={async () => {
              try { await Linking.openURL(attachment.file_url); }
              catch { setAviso({ tone: "error", title: "Comprovante indisponível", message: "Não foi possível abrir o comprovante. Tente novamente." }); }
            }}>{attachment.original_name || "Abrir comprovante"}</Button>
          )) : <Text style={styles.meta}>Nenhum comprovante anexado.</Text>}
          {selected.notes ? <Text style={styles.detailText}>{selected.notes}</Text> : null}
          {selected.reviewed_by_name ? <Text style={styles.meta}>Revisado por {selected.reviewed_by_name}</Text> : null}
          {selected.review_notes ? <Text style={styles.reviewNote}>Motivo/observação: {selected.review_notes}</Text> : null}

          {selected.review_history?.length ? (
            <View style={styles.history}>
              <Text style={styles.label}>Histórico</Text>
              {selected.review_history.map((entry, index) => (
                <Text key={`${entry.created_at}-${index}`} style={styles.meta}>
                  {formatDate(entry.created_at, true)} · {statusLabel(entry.status_before || "novo")} → {statusLabel(entry.status_after)} · {entry.reviewed_by_name || "Sistema"}
                </Text>
              ))}
            </View>
          ) : null}

          {selected.status === "pending" || selected.status === "needs_review" ? (
            <>
              <Text style={styles.label}>Observação da revisão</Text>
              <Field
                value={reviewNotes}
                onChangeText={setReviewNotes}
                multiline
                numberOfLines={3}
                placeholder="Obrigatória para rejeitar"
              />
              <View style={styles.actionRow}>
                <Button disabled={submitting} loading={submitting} onPress={() => review("approved")}>Aprovar</Button>
                <Button variant="secondary" disabled={submitting} onPress={() => review("rejected")}>Rejeitar</Button>
              </View>
            </>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  label: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  dateRow: { flexDirection: "row", gap: spacing.sm },
  dateField: { flex: 1, gap: spacing.xs },
  feedback: { color: colors.inkMuted, fontSize: 14 },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  emptyText: { color: colors.inkMuted, fontSize: 13, textAlign: "center" },
  list: { gap: spacing.sm },
  selectedCard: { borderColor: colors.accent, backgroundColor: colors.surfaceSelected },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  itemTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  meta: { color: colors.inkMuted, fontSize: 12 },
  amount: { alignItems: "flex-end", gap: spacing.xs },
  amountText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  detailAmount: { color: colors.accent, fontSize: 26, fontWeight: "800" },
  detailText: { color: colors.inkBody, fontSize: 14 },
  reviewNote: { color: colors.inkBody, fontSize: 13, fontStyle: "italic" },
  history: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderDivider, paddingTop: spacing.md },
  actionRow: { flexDirection: "row", gap: spacing.sm },
});
