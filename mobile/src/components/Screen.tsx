import { PropsWithChildren } from "react";
import { usePathname, useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, routeLabels, spacing } from "@/theme";

/**
 * Rota filha? No web, usePathname devolve a URL resolvida (/schedule/5); no
 * native, o template (/schedule/[id]). Nos dois casos, um ultimo segmento que
 * NAO e uma raiz conhecida (ver routeLabels) indica dinamica -> tem pai.
 */
function parentOf(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "";
  const last = segments[segments.length - 1];
  if (last in routeLabels) return "";
  const parent = segments[segments.length - 2];
  return routeLabels[parent] || "";
}

export function Screen({
  children,
  title,
  refreshing = false,
  onRefresh,
}: PropsWithChildren<{ title: string; refreshing?: boolean; onRefresh?: () => void }>) {
  const router = useRouter();
  const pathname = usePathname();

  const parentLabel = parentOf(pathname);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          ) : undefined
        }
      >
        <View style={styles.header}>
          {parentLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Voltar para ${parentLabel}`}
              hitSlop={12}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Text style={styles.backIcon}>←</Text>
              <Text style={styles.backLabel}>Voltar</Text>
            </Pressable>
          ) : null}
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl + spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  backIcon: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  backLabel: {
    color: colors.inkBody,
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  body: {
    gap: spacing.md,
  },
});
