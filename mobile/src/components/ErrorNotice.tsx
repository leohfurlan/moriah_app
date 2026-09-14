import { StyleSheet, Text, View } from "react-native";

import { Button } from "./Form";
import { colors, radius, spacing } from "@/theme";

/**
 * Aviso de erro para falhas de carregamento de tela.
 *
 * Diferente das acoes do usuario (que usam `Alert`), uma tela que nao
 * carregou precisa manter o erro visivel e oferecer nova tentativa — sem
 * isso o membro fica olhando uma lista vazia sem saber se nao ha dados ou
 * se algo falhou.
 */
export function ErrorNotice({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button variant="secondary" onPress={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.danger,
  },
  message: {
    color: colors.inkMuted,
    fontSize: 14,
  },
});
