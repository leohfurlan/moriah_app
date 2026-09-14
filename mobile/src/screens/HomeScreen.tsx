import { StyleSheet, Text, View } from "react-native";

import { Badge, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { MeResponse } from "@/types/api";
import { colors, routeLabels, spacing, statusLabel } from "@/theme";

const actions = [
  { key: "profile", label: "Meu Perfil", hint: "Dados cadastrais", glyph: "◉" },
  { key: "statement", label: "Meu Extrato", hint: "Contribuicoes e comprovantes", glyph: "≣" },
  { key: "contribution", label: "Nova Contribuicao", hint: "Enviar dizimo ou oferta", glyph: "＋" },
  { key: "schedules", label: "Minha Escala", hint: "Cultos e repertorio", glyph: "♪" },
];

export function HomeScreen({
  me,
  onNavigate,
  onLogout,
}: {
  me: MeResponse;
  onNavigate: (route: string) => void;
  onLogout: () => void;
}) {
  return (
    <Screen title={`Ola, ${me.member_name || me.first_name}`}>
      <Card>
        <View style={styles.identityRow}>
          <View style={styles.identityCol}>
            <Text style={styles.church}>{me.church_name || "Sem igreja vinculada"}</Text>
            <Text style={styles.email}>{me.email}</Text>
          </View>
          <Badge label={statusLabel(me.role)} tone="neutral" />
        </View>
      </Card>

      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Acoes
      </Text>
      <View style={styles.grid}>
        {actions.map((action) => (
          <Card key={action.key} onPress={() => onNavigate(action.key)}>
            <View style={styles.actionRow}>
              <View style={styles.glyphCircle}>
                <Text style={styles.glyph}>{action.glyph}</Text>
              </View>
              <View style={styles.actionCol}>
                <Text style={styles.actionText}>{action.label}</Text>
                <Text style={styles.actionHint}>{action.hint}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerMuted}>Moriah · {routeLabels.home}</Text>
        <Text accessibilityRole="button" onPress={onLogout} style={styles.logout}>
          Sair
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  identityCol: {
    flex: 1,
    gap: spacing.xs,
  },
  church: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  email: {
    color: colors.inkMuted,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  grid: {
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  glyphCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSelected,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontSize: 18,
    color: colors.accent,
    fontWeight: "700",
  },
  actionCol: {
    flex: 1,
    gap: 2,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  actionHint: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  chevron: {
    fontSize: 20,
    color: colors.inkPlaceholder,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  footerMuted: {
    fontSize: 12,
    color: colors.inkPlaceholder,
  },
  logout: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
