import { StyleSheet, Text } from "react-native";

import { Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme";

export function ModulePlaceholderScreen({ title, description }: { title: string; description: string }) {
  return (
    <Screen title={title} headerSubtitle="Gestão da Igreja Moriah">
      <Card style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.meta}>Esta área está preparada para receber os próximos fluxos administrativos.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 220, justifyContent: "center" },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  description: { color: colors.inkBody, fontSize: 14, lineHeight: 21 },
  meta: { color: colors.inkMuted, fontSize: 12 },
});
