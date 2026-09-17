import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "./useAuth";
import { getNotificationsSnapshot, loadNotifications, readAllNotifications, readNotification, subscribeNotifications } from "@/services/notificationStore";

export function useNotifications() {
  const { me } = useAuth();
  const userId = me?.id ?? null;
  const snapshot = useSyncExternalStore(subscribeNotifications, getNotificationsSnapshot, getNotificationsSnapshot);
  useEffect(() => { void loadNotifications(userId).catch(() => undefined); }, [userId]);
  const reload = useCallback(() => loadNotifications(userId, true), [userId]);
  const markRead = useCallback((id: number) => {
    if (userId === null) return Promise.reject(new Error("Sessão expirada"));
    return readNotification(userId, id);
  }, [userId]);
  const markAllRead = useCallback(() => {
    if (userId === null) return Promise.reject(new Error("Sessão expirada"));
    return readAllNotifications(userId);
  }, [userId]);
  const ownsSnapshot = snapshot.userId === userId;
  return {
    items: ownsSnapshot ? snapshot.items : [],
    unreadCount: ownsSnapshot ? snapshot.unreadCount : 0,
    loading: ownsSnapshot ? snapshot.loading : userId !== null,
    error: ownsSnapshot ? snapshot.error : null,
    reload, markRead, markAllRead,
  };
}
