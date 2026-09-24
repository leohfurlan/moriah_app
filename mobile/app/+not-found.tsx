import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { Button, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { colors, spacing } from "@/theme";

/**
 * 404 do app. Antes, uma URL desconhecida (inclusive no desktop, onde a igreja
 * opera) caia no 404 padrao do expo-router, em ingles e sem caminho de volta.
 */
export default function PaginaNaoEncontrada() {
  const router = useRouter();

  return (
    <Screen title="Página não encontrada" headerSubtitle="Este endereço não existe no Moriah">
      <Card>
        <Text style={styles.codigo}>404</Text>
        <Text style={styles.titulo}>Não encontramos esta página</Text>
        <Text style={styles.corpo}>
          O link pode estar desatualizado ou a tela ainda não faz parte desta versão do app. Use um dos caminhos abaixo
          para continuar.
        </Text>
      </Card>
      <Button onPress={() => router.replace("/home")}>Ir para a visão geral</Button>
      <Button variant="secondary" onPress={() => router.replace("/schedules")}>Ver minhas escalas</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codigo: { fontSize: 28, fontWeight: "800", color: colors.accent },
  titulo: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: spacing.xs },
  corpo: { fontSize: 14, color: colors.inkBody, marginTop: spacing.xs, lineHeight: 20 },
});
