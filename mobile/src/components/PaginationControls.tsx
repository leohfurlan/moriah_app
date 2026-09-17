import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Form";
import { colors, spacing } from "@/theme";

export function PaginationControls({
  page,
  pageSize,
  count,
  hasNext,
  hasPrevious,
  disabled = false,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  count: number;
  hasNext: boolean;
  hasPrevious: boolean;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}) {
  if (count <= pageSize && !hasPrevious && !hasNext) return null;
  const first = count ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, count);
  return (
    <View style={styles.root}>
      <Text style={styles.summary}>{first}–{last} de {count}</Text>
      <View style={styles.actions}>
        <Button size="compact" variant="secondary" disabled={disabled || !hasPrevious} onPress={() => onPageChange(page - 1)}>Anterior</Button>
        <Button size="compact" variant="secondary" disabled={disabled || !hasNext} onPress={() => onPageChange(page + 1)}>Próxima</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingVertical: spacing.sm },
  summary: { color: colors.inkMuted, fontSize: 12 },
  actions: { flexDirection: "row", gap: spacing.xs },
});
