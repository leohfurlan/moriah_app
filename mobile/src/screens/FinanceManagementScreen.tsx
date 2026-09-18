import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Badge, Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { FinancialEntry } from "@/types/api";
import { colors, formatBRL, formatDate, spacing, statusLabel } from "@/theme";

const expenseCategories = [
  { value: "utilities", label: "Contas e serviços" },
  { value: "card", label: "Cartão" },
  { value: "payroll", label: "Pessoal" },
  { value: "other", label: "Outros" },
] as const;

type ExpenseCategory = (typeof expenseCategories)[number]["value"];

function tone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "paid") return "success";
  if (status === "cancelled") return "danger";
  return "warning";
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function FinanceManagementScreen() {
  const [items, setItems] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("utilities");
  const [error, setError] = useState<UserFacingError | null>(null);
  const [actionError, setActionError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setItems(await api.get<FinancialEntry[]>("/finance/entries/"));
    } catch (failure) {
      setError(describeError(failure, "Não foi possível carregar a gestão financeira"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const expenses = useMemo(() => items.filter((item) => item.entry_type === "expense"), [items]);
  const incomes = useMemo(() => items.filter((item) => item.entry_type === "income"), [items]);
  const totals = useMemo(() => items.reduce((result, item) => {
    const value = Number(item.amount) || 0;
    if (item.status === "paid") {
      if (item.entry_type === "income") result.income += value;
      else result.expense += value;
    } else if (item.status === "scheduled" && item.entry_type === "expense") {
      result.upcoming += value;
    }
    return result;
  }, { income: 0, expense: 0, upcoming: 0 }), [items]);

  const incomeLines = useMemo(() => {
    const grouped = new Map<string, { label: string; amount: number; count: number }>();
    incomes.forEach((item) => {
      const current = grouped.get(item.category) || { label: item.category_display, amount: 0, count: 0 };
      current.amount += Number(item.amount) || 0;
      current.count += 1;
      grouped.set(item.category, current);
    });
    return [...grouped.values()].sort((left, right) => right.amount - left.amount);
  }, [incomes]);

  const monthly = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return { key: monthKey(date), label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date), income: 0, expense: 0 };
    });
    const byKey = new Map(months.map((month) => [month.key, month]));
    items.filter((item) => item.status === "paid").forEach((item) => {
      const date = new Date(`${item.due_date}T00:00:00`);
      const month = byKey.get(monthKey(date));
      if (!month) return;
      if (item.entry_type === "income") month.income += Number(item.amount) || 0;
      else month.expense += Number(item.amount) || 0;
    });
    const max = Math.max(1, ...months.flatMap((month) => [month.income, month.expense]));
    return months.map((month) => ({ ...month, incomeHeight: Math.max(6, (month.income / max) * 128), expenseHeight: Math.max(6, (month.expense / max) * 128) }));
  }, [items]);

  async function createExpense() {
    if (!description.trim() || !amount.trim() || !dueDate.trim()) return;
    setSaving(true); setActionError(null);
    try {
      await api.post<FinancialEntry>("/finance/entries/", {
        entry_type: "expense", category, source: "manual", status: "scheduled",
        description: description.trim(), amount, due_date: dueDate,
      });
      setDescription(""); setAmount(""); setDueDate(""); setShowForm(false); await load();
    } catch (failure) {
      setActionError(describeError(failure, "Não foi possível criar a saída"));
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(item: FinancialEntry) {
    setActionError(null);
    try {
      await api.patch<FinancialEntry>(`/finance/entries/${item.id}/`, { status: "paid" });
      await load();
    } catch (failure) {
      setActionError(describeError(failure, "Não foi possível atualizar a saída"));
    }
  }

  return (
    <Screen title="Visão geral" headerSubtitle="Dashboard consolidado de entradas e saídas" headerAccessory={<Button size="compact" onPress={() => setShowForm((value) => !value)}>+ Nova saída</Button>}>
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {actionError ? <ErrorNotice title={actionError.title} message={actionError.message} /> : null}

      <View style={styles.metrics}>
        <Card style={styles.metric}><Text style={styles.label}>Entradas realizadas</Text><Text style={styles.value}>{formatBRL(totals.income)}</Text><Text style={styles.meta}>Contribuições aceitas</Text></Card>
        <Card style={styles.metric}><Text style={styles.label}>Saídas realizadas</Text><Text style={styles.value}>{formatBRL(totals.expense)}</Text><Text style={styles.meta}>Contas já pagas</Text></Card>
        <Card style={styles.metric}><Text style={styles.label}>Saldo financeiro</Text><Text style={[styles.value, totals.income - totals.expense < 0 && styles.negative]}>{formatBRL(totals.income - totals.expense)}</Text><Text style={styles.meta}>Entradas menos saídas</Text></Card>
        <Card style={styles.metric}><Text style={styles.label}>Próximos vencimentos</Text><Text style={styles.value}>{formatBRL(totals.upcoming)}</Text><Text style={styles.meta}>Saídas agendadas</Text></Card>
      </View>

      <Card>
        <View style={styles.panelHeader}><View><Text style={styles.sectionTitle}>Fluxo financeiro</Text><Text style={styles.meta}>Valores pagos nos últimos 6 meses</Text></View><View style={styles.legend}><Text style={styles.incomeLegend}>● Entradas</Text><Text style={styles.expenseLegend}>● Saídas</Text></View></View>
        <View style={styles.chart}>
          {monthly.map((month) => <View key={month.key} style={styles.chartColumn}><View style={styles.bars}><View style={[styles.bar, styles.incomeBar, { height: month.incomeHeight }]} /><View style={[styles.bar, styles.expenseBar, { height: month.expenseHeight }]} /></View><Text style={styles.chartLabel}>{month.label}</Text></View>)}
        </View>
      </Card>

      {showForm ? <Card>
        <Text style={styles.sectionTitle}>Agendar nova saída</Text>
        <Text style={styles.meta}>Entradas são criadas automaticamente quando uma contribuição é aceita.</Text>
        <View style={styles.categoryRow}>{expenseCategories.map((option) => <Button key={option.value} size="compact" variant={category === option.value ? "primary" : "secondary"} onPress={() => setCategory(option.value)}>{option.label}</Button>)}</View>
        <Field placeholder="Descrição (ex.: conta de energia)" value={description} onChangeText={setDescription} />
        <Field placeholder="Valor" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field placeholder="Vencimento (AAAA-MM-DD)" value={dueDate} onChangeText={setDueDate} />
        <Button loading={saving} disabled={!description.trim() || !amount.trim() || !dueDate.trim()} onPress={() => void createExpense()}>Salvar saída</Button>
      </Card> : null}

      <View style={styles.columns}>
        <Card style={styles.columnCard}>
          <Text style={styles.sectionTitle}>Entradas por categoria</Text>
          <Text style={styles.meta}>Aceites de contribuições lançados no saldo</Text>
          {incomeLines.length ? incomeLines.map((line) => <View key={line.label} style={styles.line}><View style={styles.copy}><Text style={styles.title}>{line.label}</Text><Text style={styles.meta}>{line.count} contribuição(ões)</Text></View><Text style={styles.amountText}>{formatBRL(line.amount)}</Text></View>) : <Text style={styles.emptyText}>Nenhuma contribuição aceita ainda.</Text>}
        </Card>
        <Card style={styles.columnCard}>
          <Text style={styles.sectionTitle}>Saídas e próximos vencimentos</Text>
          <Text style={styles.meta}>Detalhamento e histórico das despesas</Text>
          {loading ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.meta}>Carregando saídas…</Text></View> : expenses.length ? expenses.map((item) => <View key={item.id} style={styles.expenseRow}><View style={styles.copy}><Text style={styles.title}>{item.description}</Text><Text style={styles.meta}>{item.category_display} · vence {formatDate(item.due_date)}</Text>{item.notes ? <Text style={styles.meta}>{item.notes}</Text> : null}</View><View style={styles.amount}><Text style={styles.amountText}>{formatBRL(item.amount)}</Text><Badge label={item.status_display || statusLabel(item.status)} tone={tone(item.status)} />{item.status === "scheduled" ? <Button size="compact" variant="secondary" onPress={() => void markPaid(item)}>Marcar como pago</Button> : null}</View></View>) : <Text style={styles.emptyText}>Nenhuma saída cadastrada ainda.</Text>}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  metric: { flex: 1, minWidth: 180 },
  label: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  value: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  negative: { color: colors.danger },
  meta: { color: colors.inkMuted, fontSize: 12 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  legend: { flexDirection: "row", gap: spacing.sm },
  incomeLegend: { color: colors.accent, fontSize: 11, fontWeight: "700" },
  expenseLegend: { color: colors.danger, fontSize: 11, fontWeight: "700" },
  chart: { height: 188, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: spacing.lg },
  chartColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: spacing.xs },
  bars: { height: 140, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 13, minHeight: 6, borderRadius: 4 },
  incomeBar: { backgroundColor: colors.accent },
  expenseBar: { backgroundColor: colors.danger },
  chartLabel: { color: colors.inkMuted, fontSize: 10 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  columnCard: { flex: 1, minWidth: 320 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  expenseRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  copy: { flex: 1, gap: spacing.xs },
  title: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  amount: { alignItems: "flex-end", gap: spacing.xs },
  amountText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  loading: { alignItems: "center", gap: spacing.sm, padding: spacing.lg },
  emptyText: { color: colors.inkMuted, fontSize: 13, paddingVertical: spacing.md },
});
