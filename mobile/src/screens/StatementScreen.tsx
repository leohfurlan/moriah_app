import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { ErrorNotice } from "@/components/ErrorNotice";
import { PaginationControls } from "@/components/PaginationControls";
import { Badge, Button, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { Contribution } from "@/types/api";
import { parseDate, statementBarHeight, statementCutoff, type StatementPeriod } from "@/services/dates";
import { colors, formatDate, formatBRL, spacing, statusLabel, statusTone } from "@/theme";

type FilterKey = "period" | "category" | "status";
type FilterOption = { value: string; label: string };

/**
 * Dropdown de filtro: abre a lista de opcoes e deixa escolher qualquer uma.
 * Antes era um botao que avancava para o proximo valor a cada clique — nao
 * mostrava a lista e nao deixava voltar direto para uma opcao.
 */
function DesktopFilter({
  label,
  options,
  value,
  open,
  onToggle,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value) || options[0];
  return (
    <View style={styles.filterWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.filterPill, pressed && styles.pressed]}
      >
        <Text style={styles.filterText}>{selected.label}</Text>
        <Text style={styles.filterChevron}>⌄</Text>
      </Pressable>
      {open ? (
        <View style={styles.filterMenu}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: option.value === value }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.filterOption, option.value === value && styles.filterOptionSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.filterOptionText, option.value === value && styles.filterOptionTextSelected]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DesktopStatement({ items, onRegister }: { items: Contribution[]; onRegister: () => void }) {
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [period, setPeriod] = useState<StatementPeriod>("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const periodOptions: FilterOption[] = [
    { value: "all", label: "Todo o período" },
    { value: "3m", label: "Últimos 3 meses" },
    { value: "6m", label: "Últimos 6 meses" },
    { value: "year", label: "Último ano" },
  ];
  // Categoria e status saem do que existe neste extrato: sem opcao que nao filtra nada.
  const categoryOptions = useMemo<FilterOption[]>(() => [
    { value: "all", label: "Todas as categorias" },
    ...Array.from(new Set(items.map((item) => item.category))).sort().map((value) => ({ value, label: statusLabel(value) })),
  ], [items]);
  const statusOptions = useMemo<FilterOption[]>(() => [
    { value: "all", label: "Todos os status" },
    ...Array.from(new Set(items.map((item) => item.status))).sort().map((value) => ({ value, label: statusLabel(value) })),
  ], [items]);
  const changeFilter = (key: FilterKey, value: string) => {
    if (key === "period") setPeriod(value as StatementPeriod);
    if (key === "category") setCategory(value);
    if (key === "status") setStatus(value);
    setOpenFilter(null);
  };
  const filteredItems = useMemo(() => {
    const cutoff = statementCutoff(period);
    return items.filter((item) => (!cutoff || parseDate(item.contribution_date) >= cutoff)
      && (category === "all" || item.category === category)
      && (status === "all" || item.status === status));
  }, [category, items, period, status]);
  const filteredTotal = filteredItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const approved = filteredItems.filter((item) => item.status === "approved").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pending = filteredItems.filter((item) => ["pending", "needs_review"].includes(item.status)).length;
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") };
    });
  }, []);
  const monthlyTotals = months.map((month) => filteredItems.filter((item) => item.contribution_date.startsWith(month.key)).reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const maxMonthly = Math.max(...monthlyTotals, 0);
  return (
    <View style={styles.desktopStatement}>
      <View style={styles.statementSummaryRow}>
        <View style={styles.statementSummaryCard}><Text style={styles.statementSummaryLabel}>Total contribuído</Text><Text style={styles.statementSummaryValue}>{formatBRL(filteredTotal)}</Text><Text style={styles.statementSummaryMeta}>No período selecionado</Text></View>
        <View style={styles.statementSummaryCard}><Text style={styles.statementSummaryLabel}>Contribuições</Text><Text style={styles.statementSummaryValue}>{filteredItems.length}</Text><Text style={styles.statementSummaryMeta}>Lançamentos pessoais</Text></View>
        <View style={styles.statementSummaryCard}><Text style={styles.statementSummaryLabel}>Confirmado</Text><Text style={styles.statementSummaryValue}>{formatBRL(approved)}</Text><Text style={styles.statementSummaryMeta}>Validado pela tesouraria</Text></View>
        <View style={styles.statementSummaryCard}><Text style={styles.statementSummaryLabel}>Em análise</Text><Text style={styles.statementSummaryValue}>{pending}</Text><Text style={styles.statementSummaryMeta}>Aguardando conferência</Text></View>
      </View>

      <View style={styles.statementChartCard}>
        <View style={styles.statementChartHeader}><View><Text style={styles.panelTitle}>Evolução mensal</Text><Text style={styles.panelMeta}>Contribuições registradas nos últimos 6 meses</Text></View><Text style={styles.chartLegend}>Total por mês</Text></View>
        {maxMonthly ? <View style={styles.statementBars}>
          {months.map((month, index) => <View key={month.key} style={styles.statementBarColumn} accessibilityLabel={`${month.label}: ${formatBRL(monthlyTotals[index])}`}><Text style={styles.chartLabel}>{formatBRL(monthlyTotals[index])}</Text><View testID={`statement-bar-${month.key}`} style={[styles.statementBar, { height: statementBarHeight(monthlyTotals[index], maxMonthly) }]} /><Text style={styles.chartLabel}>{month.label}</Text></View>)}
        </View> : <Text style={styles.chartEmpty}>Sem contribuições no período selecionado.</Text>}
      </View>

      <View style={styles.statementFilters}>
        <DesktopFilter label="Filtrar por período" options={periodOptions} value={period} open={openFilter === "period"} onToggle={() => setOpenFilter(openFilter === "period" ? null : "period")} onChange={(value) => changeFilter("period", value)} />
        <DesktopFilter label="Filtrar por categoria" options={categoryOptions} value={category} open={openFilter === "category"} onToggle={() => setOpenFilter(openFilter === "category" ? null : "category")} onChange={(value) => changeFilter("category", value)} />
        <DesktopFilter label="Filtrar por status" options={statusOptions} value={status} open={openFilter === "status"} onToggle={() => setOpenFilter(openFilter === "status" ? null : "status")} onChange={(value) => changeFilter("status", value)} />
        <Button size="compact" onPress={onRegister}>+ Registrar contribuição</Button>
      </View>

      <View style={styles.statementTable}>
        <View style={styles.tableHeader}><Text style={styles.tableHeaderCell}>Data</Text><Text style={styles.tableHeaderCell}>Categoria</Text><Text style={styles.tableHeaderCell}>Valor</Text><Text style={styles.tableHeaderCell}>Status</Text></View>
        {filteredItems.length ? filteredItems.map((item) => (
          <View key={item.id} style={styles.tableRow}><Text style={styles.tableCell}>{formatDate(item.contribution_date)}</Text><Text style={styles.tableCell}>{statusLabel(item.category)}</Text><Text style={[styles.tableCell, styles.tableAmount]}>{formatBRL(item.amount)}</Text><Badge label={statusLabel(item.status)} tone={item.status === "approved" || item.status === "received" ? "success" : item.status === "rejected" ? "danger" : "warning"} /></View>
        )) : <View style={styles.tableEmpty}><Text style={styles.panelMeta}>Nenhuma contribuição registrada.</Text><Button size="compact" onPress={onRegister}>+ Enviar comprovante</Button></View>}
      </View>
    </View>
  );
}

export function StatementScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 25, count: 0, hasNext: false, hasPrevious: false });

  const load = useCallback(async (targetPage = 1) => {
    setError(null);
    try {
      const result = await api.getPage<Contribution>("/me/statement/", targetPage);
      setItems(result.items);
      setPageInfo(result);
    } catch (err) {
      setError(describeError(err, "Não foi possível carregar o extrato"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const isAdmin = me?.capabilities.includes("manage_all") ?? false;
  const canReview = Boolean(me?.capabilities.some((capability) => ["review_contributions", "manage_all"].includes(capability)));

  return (
    <Screen
      title={isAdmin ? "Contribuições" : "Minhas contribuições"}
      headerSubtitle={isAdmin ? "Contribuições da sua igreja" : "Apenas seu histórico pessoal"}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerAccessory={<Button size="compact" onPress={() => router.push("/contribution" as never)}>+ Enviar comprovante</Button>}
    >
      {!desktop ? (
        <View style={styles.contextNav}>
          <View style={[styles.contextTab, styles.contextTabActive]}>
            <Text style={styles.contextTabActiveText}>Contribuições</Text>
          </View>
          {canReview ? (
            <Button size="compact" variant="ghost" onPress={() => router.replace("/finance-review" as never)}>
              Revisão
            </Button>
          ) : null}
        </View>
      ) : null}
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}

        {desktop && !error ? <DesktopStatement items={items} onRegister={() => router.push("/contribution" as never)} /> : !error && items.length ? (
          <>
            <Card>
              <Text style={styles.summaryLabel}>Total registrado</Text>
              <Text style={styles.summaryValue}>{formatBRL(total)}</Text>
              <Text style={styles.summaryMeta}>
                {items.length} {items.length === 1 ? "contribuição" : "contribuições"}
              </Text>
            </Card>

            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Historico
            </Text>
            {items.map((item) => (
              <Card key={item.id}>
                <View style={styles.row}>
                  <View style={styles.rowCol}>
                    <Text style={styles.itemTitle}>{statusLabel(item.category)}</Text>
                    <Text style={styles.meta}>{formatDate(item.contribution_date)}</Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amount}>{formatBRL(item.amount)}</Text>
                    <Badge label={statusLabel(item.status)} tone={statusTone(item.status)} />
                  </View>
                </View>
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
                {item.attachments.length ? (
                  <Text style={styles.attach}>{item.attachments.length} comprovante(s) anexado(s)</Text>
                ) : null}
              </Card>
            ))}
          </>
        ) : null}

        {!desktop && !loading && !error && !items.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>≣</Text>
            <Text style={styles.emptyTitle}>Nenhuma contribuição ainda</Text>
            <Text style={styles.emptyText}>Quando você enviar um dízimo ou oferta, ele aparecerá aqui.</Text>
            <Button size="compact" onPress={() => router.push("/contribution" as never)}>+ Enviar comprovante</Button>
          </View>
        ) : null}
        <PaginationControls {...pageInfo} disabled={loading} onPageChange={(nextPage) => { void load(nextPage); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  contextNav: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  contextTab: { minHeight: 36, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: 10 },
  contextTabActive: { backgroundColor: colors.surfaceSelected },
  contextTabActiveText: { color: colors.accent, fontSize: 13, fontWeight: "800" },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.accent,
  },
  summaryMeta: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rowCol: {
    flex: 1,
    gap: 2,
  },
  amountCol: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  amount: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  meta: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  notes: {
    fontSize: 13,
    color: colors.inkBody,
  },
  attach: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "600",
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

  desktopStatement: { gap: 20 },
  statementSummaryRow: { flexDirection: "row", gap: 16 },
  statementSummaryCard: { flex: 1, minHeight: 112, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 7 },
  statementSummaryLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: "700" },
  statementSummaryValue: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  statementSummaryMeta: { color: colors.inkMuted, fontSize: 10 },
  chartLabel: { color: colors.inkMuted, fontSize: 10 },
  statementChartCard: { height: 292, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 20 },
  statementChartHeader: { flexDirection: "row", justifyContent: "space-between" },
  panelTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  panelMeta: { color: colors.inkMuted, fontSize: 11 },
  chartLegend: { color: colors.accent, fontSize: 11, fontWeight: "700" },
  chartEmpty: { color: colors.inkMuted, textAlign: "center", paddingVertical: 80 },
  statementBars: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingHorizontal: 60, paddingTop: 24, paddingBottom: 5 },
  statementBarColumn: { height: 180, alignItems: "center", justifyContent: "flex-end", gap: 8 },
  statementBar: { width: 44, borderRadius: 6, backgroundColor: colors.accent },
  statementFilters: { height: 52, flexDirection: "row", alignItems: "center", gap: 10, zIndex: 20 },
  filterWrap: { position: "relative", zIndex: 21 },
  filterPill: { height: 40, minWidth: 154, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, paddingHorizontal: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8 },
  filterText: { color: colors.inkBody, fontSize: 11 },
  filterChevron: { color: colors.inkMuted, fontSize: 16 },
  filterMenu: { position: "absolute", top: 44, left: 0, minWidth: 190, padding: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8, zIndex: 30 },
  filterOption: { minHeight: 36, justifyContent: "center", paddingHorizontal: 10, borderRadius: 6 },
  filterOptionSelected: { backgroundColor: colors.surfaceSelected },
  filterOptionText: { color: colors.inkBody, fontSize: 11 },
  filterOptionTextSelected: { color: colors.accent, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  statementTable: { minHeight: 312, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" },
  tableHeader: { height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  tableHeaderCell: { flex: 1, color: colors.inkMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  tableRow: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  tableCell: { flex: 1, color: colors.inkBody, fontSize: 12 },
  tableAmount: { color: colors.ink, fontWeight: "800" },
  tableEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 30 },
});
