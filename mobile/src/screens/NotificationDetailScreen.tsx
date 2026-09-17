import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { ErrorNotice } from "@/components/ErrorNotice";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { api } from "@/services/api";
import { ApiError, describeError, UserFacingError } from "@/services/errors";
import { Notification } from "@/types/api";
import { colors, spacing } from "@/theme";

export function NotificationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const { markRead } = useNotifications();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [readError, setReadError] = useState<UserFacingError | null>(null);
  const request = useRef(0);
  const reading = useRef<number | null>(null);
  const persistRead = useCallback(async (item: Notification, generation: number) => {
    if (reading.current === generation) return;
    reading.current = generation;
    setReadError(null);
    try {
      const updated = await markRead(item.id);
      if (request.current === generation) setNotification(updated);
    } catch (err) {
      if (request.current === generation) setReadError(describeError(err, "Não foi possível marcar a notificação como lida"));
    } finally {
      if (reading.current === generation) reading.current = null;
    }
  }, [markRead]);
  const load = useCallback(async () => {
    const generation = ++request.current;
    setNotification(null);
    setError(null);
    setReadError(null);
    setMissing(false);
    setLoading(true);
    if (!id || !me?.id) return;
    try {
      const item = await api.get<Notification>(`/me/notifications/${id}/`);
      if (request.current !== generation) return;
      setNotification(item);
      if (!item.is_read) await persistRead(item, generation);
    } catch (err) {
      if (request.current !== generation) return;
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else setError(describeError(err, "Não foi possível carregar a notificação"));
    } finally {
      if (request.current === generation) setLoading(false);
    }
  }, [id, me?.id, persistRead]);
  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);

  return (
    <Screen title="Notificações">
      {loading && !notification ? <Text style={styles.empty}>Carregando notificação…</Text> : null}
      {missing ? <><Text style={styles.empty}>Notificação não encontrada ou indisponível para esta conta.</Text><Button onPress={() => router.replace("/notifications" as never)}>Voltar às notificações</Button></> : null}
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={() => { void load(); }} /> : null}
      {readError && notification ? <ErrorNotice title={readError.title} message={readError.message} onRetry={() => { void persistRead(notification, request.current); }} /> : null}
      {notification ? (
        <>
          <Text style={styles.category}>{notification.category.toUpperCase()}</Text>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.time}>{new Date(notification.created_at).toLocaleString("pt-BR")}</Text>
          <Card>
            <Text style={styles.detail}>{notification.detail || notification.body}</Text>
            <Text style={styles.signature}>Secretaria{`\n`}Igreja Moriah</Text>
          </Card>
          {notification.action_route ? <Button onPress={() => router.push(notification.action_route as never)}>{notification.action_label || "Abrir"}</Button> : null}
        </>
      ) : null}
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
