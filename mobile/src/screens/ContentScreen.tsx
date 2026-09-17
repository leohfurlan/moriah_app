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
          Este espaço reúne mensagens, materiais e comunicados publicados pela igreja.
        </Text>
        <Text style={styles.meta}>Nenhum conteúdo publicado ainda.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  body: { color: colors.inkBody, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.inkMuted, fontSize: 13 },
});