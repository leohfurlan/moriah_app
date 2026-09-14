import { StyleSheet, Text, View } from "react-native";

import { Button } from "./Form";

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
    gap: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6c3bc",
    backgroundColor: "#fdf3f1",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8a3c2d",
  },
  message: {
    color: "#5f5148",
  },
});
