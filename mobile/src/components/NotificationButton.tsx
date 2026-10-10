import { Pressable, StyleSheet, View } from "react-native";
import { Bell } from "lucide-react-native";
import { useNotifications } from "@/hooks/useNotifications";
import { colors } from "@/theme";

export function NotificationButton({ onPress }: { onPress: () => void }) {
  const { unreadCount } = useNotifications();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={unreadCount > 0 ? "Notificações, há avisos não lidos" : "Notificações"} onPress={onPress} style={styles.button}>
      <Bell size={20} strokeWidth={1.8} color={colors.accent} />
      {unreadCount > 0 ? <View testID="notification-badge" style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
});
