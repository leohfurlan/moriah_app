import { StyleSheet, Text } from "react-native";

import { Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme";

export function ContentScreen() {
  return (
    <Screen title="Conteúdo" headerSubtitle="Materiais e comunicados da Igreja Moriah">
      <Card>
        <Text style={styles.title}>Conteúdo da igreja</Text>
        <Text style={styles.body}>
        Este domínio ainda não faz parte do MVP e não está disponível para publicação.
        </Text>
        <Text style={styles.meta}>A área será liberada quando houver modelo, permissões e fluxo de publicação.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  body: { color: colors.inkBody, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.inkMuted, fontSize: 13 },
});
