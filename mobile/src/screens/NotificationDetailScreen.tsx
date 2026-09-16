import { StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { findMvpNotification } from "@/notifications";
import { colors, spacing } from "@/theme";

export function NotificationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const notification = findMvpNotification(id);

  if (!notification) {
    return <Screen title="Notificação"><Text style={styles.empty}>Notificação não encontrada.</Text></Screen>;
  }

  return (
    <Screen title="Notificações">
      <Text style={styles.category}>{notification.category.toUpperCase()}</Text>
      <Text style={styles.title}>{notification.title}</Text>
      <Text style={styles.time}>{notification.time}</Text>
      <Card>
        <Text style={styles.detail}>{notification.detail}</Text>
        <Text style={styles.signature}>Secretaria{`\n`}Igreja Moriah</Text>
      </Card>
      {notification.actionRoute ? <Button onPress={() => router.push(notification.actionRoute as never)}>{notification.actionLabel || "Abrir"}</Button> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  category: { color: colors.inkMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.7 },
  title: { color: colors.ink, fontSize: 23, fontWeight: "800" },
  time: { color: colors.inkMuted, fontSize: 12 },
  detail: { color: colors.inkBody, fontSize: 15, lineHeight: 23 },
  signature: { color: colors.inkMuted, fontSize: 13, marginTop: spacing.lg },
  empty: { color: colors.inkMuted },
});
