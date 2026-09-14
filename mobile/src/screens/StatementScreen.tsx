import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Badge, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
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

export function StatementScreen() {
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await api.get<Contribution[]>("/me/statement/"));
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar o extrato"));
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

  return (
    <Screen title="Meu Extrato" refreshing={refreshing} onRefresh={onRefresh}>
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}

        {!error && items.length ? (
          <>
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

        {!loading && !error && !items.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>≣</Text>
            <Text style={styles.emptyTitle}>Nenhuma contribuicao ainda</Text>
            <Text style={styles.emptyText}>Quando voce enviar um dizimo ou oferta, ele aparece aqui.</Text>
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
});
