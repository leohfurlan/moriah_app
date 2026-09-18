import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Badge, Button, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { Contribution } from "@/types/api";
import { colors, formatDate, formatBRL, spacing, statusLabel } from "@/theme";

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "received" || status === "approved") return "success";
  if (status === "pending_confirmation") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}


type FilterKey = "period" | "category" | "status";
type FilterOption = { value: string; label: string };

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

function DesktopStatement({
  items,
  onRegister,
  canReview,
  onAccept,
  acceptingId,
}: {
  items: Contribution[];
  onRegister: () => void;
  canReview: boolean;
  onAccept: (item: Contribution) => void;
  acceptingId: number | null;
}) {
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [period, setPeriod] = useState("3m");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const periodOptions: FilterOption[] = [
    { value: "3m", label: "Últimos 3 meses" },
    { value: "6m", label: "Últimos 6 meses" },
    { value: "year", label: "Último ano" },
    { value: "all", label: "Todo o período" },
  ];
  const categoryOptions = useMemo<FilterOption[]>(() => [
    { value: "all", label: "Todas as categorias" },
    ...["tithe", "offering", "campaign", "missions", "event", "other"]
      .filter((value) => items.some((item) => item.category === value))
      .map((value) => ({ value, label: statusLabel(value) })),
  ], [items]);
  const statusOptions = useMemo<FilterOption[]>(() => [
    { value: "all", label: "Todos os status" },
    ...["pending", "approved", "rejected", "needs_review"]
      .filter((value) => items.some((item) => item.status === value))
      .map((value) => ({ value, label: statusLabel(value) })),
  ], [items]);
  const filteredItems = useMemo(() => {
    const now = new Date();
    const months = period === "3m" ? 3 : period === "6m" ? 6 : period === "year" ? 12 : 0;
    const cutoff = months ? new Date(now.getFullYear(), now.getMonth() - months + 1, 1) : null;
    return items.filter((item) => {
      const date = new Date(`${item.contribution_date}T00:00:00`);
      return (!cutoff || date >= cutoff) && (category === "all" || item.category === category) && (status === "all" || item.status === status);
    });
  }, [category, items, period, status]);
  const total = filteredItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const approved = filteredItems.filter((item) => ["approved", "received"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pending = filteredItems.filter((item) => ["pending", "pending_confirmation", "needs_review"].includes(item.status)).length;
  const changeFilter = (key: FilterKey, value: string) => {
    if (key === "period") setPeriod(value);
    if (key === "category") setCategory(value);
    if (key === "status") setStatus(value);
    setOpenFilter(null);
  };
  return (
    <View style={styles.desktopStatement}>
      <View style={styles.statementSummaryRow}>
        <View style={styles.statementSummaryCard}><Text style={styles.statementSummaryLabel}>{canReview ? "Total recebido" : "Total contribuído"}</Text><Text style={styles.statementSummaryValue}>{formatBRL(total)}</Text><Text style={styles.statementSummaryMeta}>No período registrado</Text></View>
        <View style={styles.statementSummaryCard}><Text style={styles.statementSummaryLabel}>Contribuições</Text><Text style={styles.statementSummaryValue}>{items.length}</Text><Text style={styles.statementSummaryMeta}>{canReview ? "Lançamentos da igreja" : "Lançamentos pessoais"}</Text></View>
        <View style={styles.statementSummaryCard}><Text style={styles.statementSummaryLabel}>{canReview ? "Aceito" : "Confirmado"}</Text><Text style={styles.statementSummaryValue}>{formatBRL(approved)}</Text><Text style={styles.statementSummaryMeta}>{canReview ? "Já lançado no financeiro" : "Validado pela tesouraria"}</Text></View>
        <View style={styles.statementSummaryCard}><Text style={styles.statementSummaryLabel}>{canReview ? "Aguardando aceite" : "Em análise"}</Text><Text style={styles.statementSummaryValue}>{pending}</Text><Text style={styles.statementSummaryMeta}>{canReview ? "Ação da tesouraria" : "Aguardando conferência"}</Text></View>
      </View>

      <View style={styles.statementChartCard}>
        <View style={styles.statementChartHeader}><View><Text style={styles.panelTitle}>Evolução mensal</Text><Text style={styles.panelMeta}>Contribuições registradas nos últimos 6 meses</Text></View><Text style={styles.chartLegend}>Total por mês</Text></View>
        <View style={styles.statementBars}>
          {[42, 72, 58, 96, 64, 82].map((height, index) => <View key={String(index)} style={styles.statementBarColumn}><View style={[styles.statementBar, { height }]} /><Text style={styles.chartLabel}>{["Abr", "Mai", "Jun", "Jul", "Ago", "Set"][index]}</Text></View>)}
        </View>
      </View>

      <View style={styles.statementFilters}>
        <DesktopFilter label="Filtrar por período" options={periodOptions} value={period} open={openFilter === "period"} onToggle={() => setOpenFilter(openFilter === "period" ? null : "period")} onChange={(value) => changeFilter("period", value)} />
        <DesktopFilter label="Filtrar por categoria" options={categoryOptions} value={category} open={openFilter === "category"} onToggle={() => setOpenFilter(openFilter === "category" ? null : "category")} onChange={(value) => changeFilter("category", value)} />
        <DesktopFilter label="Filtrar por status" options={statusOptions} value={status} open={openFilter === "status"} onToggle={() => setOpenFilter(openFilter === "status" ? null : "status")} onChange={(value) => changeFilter("status", value)} />
        {!canReview ? <Button size="compact" onPress={onRegister}>+ Registrar contribuição</Button> : null}
      </View>

      <View style={styles.statementTable}>
        <View style={styles.tableHeader}><Text style={styles.tableHeaderCell}>Data</Text><Text style={styles.tableHeaderCell}>Categoria</Text><Text style={styles.tableHeaderCell}>Valor</Text><Text style={styles.tableHeaderCell}>Status</Text>{canReview ? <Text style={styles.tableHeaderCell}>Ação</Text> : null}</View>
        {filteredItems.length ? filteredItems.map((item) => (
          <View key={item.id} style={styles.tableRow}><Text style={styles.tableCell}>{formatDate(item.contribution_date)}</Text><Text style={styles.tableCell}>{statusLabel(item.category)}</Text><Text style={[styles.tableCell, styles.tableAmount]}>{formatBRL(item.amount)}</Text><View style={styles.tableCell}><Badge label={statusLabel(item.status)} tone={item.status === "approved" || item.status === "received" ? "success" : item.status === "rejected" ? "danger" : "warning"} /></View>{canReview ? <View style={styles.tableCell}>{["pending", "needs_review"].includes(item.status) ? <Button size="compact" loading={acceptingId === item.id} disabled={acceptingId !== null} onPress={() => onAccept(item)}>Aceitar</Button> : null}</View> : null}</View>
        )) : <View style={styles.tableEmpty}><Text style={styles.panelMeta}>Nenhuma contribuição encontrada para os filtros.</Text>{!canReview ? <Button size="compact" onPress={onRegister}>+ Enviar comprovante</Button> : null}</View>}
      </View>
    </View>
  );
}

export function StatementScreen() {
  const router = useRouter();
  const { me, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const canReview = Boolean(me?.capabilities.includes("manage_finance"));
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await api.get<Contribution[]>(canReview ? "/contributions/" : "/me/statement/"));
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar o extrato"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canReview]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    void load();
  }, [authLoading, load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  async function acceptContribution(item: Contribution) {
    setAcceptingId(item.id);
    setError(null);
    try {
      await api.post<Contribution>(`/contributions/${item.id}/review/`, { status: "approved" });
      await load();
    } catch (failure) {
      setError(describeError(failure, "Não foi possível aceitar a contribuição"));
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <Screen
      title={canReview ? "Contribuições" : "Minhas contribuições"}
      headerSubtitle={canReview ? "Aceite e acompanhamento das contribuições da igreja" : "Apenas seu histórico pessoal"}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerAccessory={!canReview ? <Button size="compact" onPress={() => router.push("/contribution" as never)}>+ Enviar comprovante</Button> : undefined}
    >
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}

        {desktop && !error ? <DesktopStatement items={items} canReview={canReview} acceptingId={acceptingId} onAccept={(item) => void acceptContribution(item)} onRegister={() => router.push("/contribution" as never)} /> : !desktop && !error && items.length ? (
          canReview ? <>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Contribuições aguardando aceite</Text>
            {items.map((item) => <Card key={item.id}><View style={styles.row}><View style={styles.rowCol}><Text style={styles.itemTitle}>{item.member_name || "Membro"}</Text><Text style={styles.meta}>{statusLabel(item.category)} · {formatDate(item.contribution_date)}</Text></View><View style={styles.amountCol}><Text style={styles.amount}>{formatBRL(item.amount)}</Text><Badge label={statusLabel(item.status)} tone={statusTone(item.status)} /></View></View>{["pending", "needs_review"].includes(item.status) ? <Button size="compact" loading={acceptingId === item.id} disabled={acceptingId !== null} onPress={() => void acceptContribution(item)}>Aceitar contribuição</Button> : null}</Card>)}
          </> : <>
            <Card>
              <Text style={styles.summaryLabel}>Total registrado</Text>
              <Text style={styles.summaryValue}>{formatBRL(total)}</Text>
              <Text style={styles.summaryMeta}>
                {items.length} {items.length === 1 ? "contribuicao" : "contribuicoes"}
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
            <Text style={styles.emptyTitle}>{canReview ? "Nenhuma contribuição para revisar" : "Nenhuma contribuicao ainda"}</Text>
            <Text style={styles.emptyText}>{canReview ? "As contribuições enviadas aparecerão aqui para aceite." : "Quando voce enviar um dizimo ou oferta, ele aparece aqui."}</Text>
            {!canReview ? <Button size="compact" onPress={() => router.push("/contribution" as never)}>+ Enviar comprovante</Button> : null}
          </View>
        ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  statementBars: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingHorizontal: 60, paddingTop: 24, paddingBottom: 5 },
  statementBarColumn: { height: 180, alignItems: "center", justifyContent: "flex-end", gap: 8 },
  statementBar: { width: 44, minHeight: 24, borderRadius: 6, backgroundColor: colors.accent },
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
  pressed: { opacity: 0.72 },
  statementTable: { minHeight: 312, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" },
  tableHeader: { height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  tableHeaderCell: { flex: 1, color: colors.inkMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  tableRow: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  tableCell: { flex: 1, color: colors.inkBody, fontSize: 12 },
  tableAmount: { color: colors.ink, fontWeight: "800" },
  tableEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 30 },
});
