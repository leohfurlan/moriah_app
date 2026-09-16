import { ComponentProps, PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";

import { colors, radius, spacing } from "@/theme";

export function Field(props: ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.inkPlaceholder} style={styles.input} {...props} />;
}

export function Button({
  children,
  disabled = false,
  loading = false,
  onPress,
  variant = "primary",
  size = "regular",
}: PropsWithChildren<{
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  size?: "regular" | "compact";
}>) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === "compact" && styles.compactButton,
        variant === "secondary" && styles.secondaryButton,
        variant === "ghost" && styles.ghostButton,
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.onAccent : colors.accent} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            size === "compact" && styles.compactButtonText,
            variant === "secondary" && styles.secondaryButtonText,
            variant === "ghost" && styles.ghostButtonText,
            isDisabled && variant === "primary" && styles.disabledButtonText,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, onPress, style }: PropsWithChildren<{ onPress?: () => void; style?: StyleProp<ViewStyle> }>) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Chip de status (Confirmado / Pendente / Recusado etc.). */
export function Badge({ label, tone = "neutral" }: { label: string; tone?: "success" | "warning" | "danger" | "neutral" }) {
  return (
    <View
      style={[
        styles.badge,
        tone === "success" && styles.badgeSuccess,
        tone === "warning" && styles.badgeWarning,
        tone === "danger" && styles.badgeDanger,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          tone === "success" && styles.badgeTextSuccess,
          tone === "warning" && styles.badgeTextWarning,
          tone === "danger" && styles.badgeTextDanger,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.md,
    minHeight: 48,
    backgroundColor: colors.surfaceTint,
    color: colors.ink,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    minHeight: 50,
    borderRadius: radius.field,
    alignItems: "center",
    justifyContent: "center",
  },
  compactButton: {
    minHeight: 30,
    paddingVertical: 0,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghostButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: "700",
  },
  compactButtonText: {
    fontSize: 13,
  },
  secondaryButtonText: {
    color: colors.inkBody,
  },
  ghostButtonText: {
    color: colors.accent,
  },
  disabledButtonText: {
    color: colors.buttonTextDisabled,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    backgroundColor: colors.canvas,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeSuccess: {
    backgroundColor: colors.badgeSuccessBg,
    borderColor: colors.badgeSuccessBorder,
  },
  badgeWarning: {
    backgroundColor: colors.badgeWarningBg,
    borderColor: colors.badgeWarningBorder,
  },
  badgeDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkBody,
  },
  badgeTextSuccess: {
    color: colors.success,
  },
  badgeTextWarning: {
    color: colors.warning,
  },
  badgeTextDanger: {
    color: colors.danger,
  },
});
