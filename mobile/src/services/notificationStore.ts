import { api } from "./api";
import { describeError, UserFacingError } from "./errors";
import { Notification } from "@/types/api";

type PageInfo = { page: number; pageSize: number; count: number; hasNext: boolean; hasPrevious: boolean };
type Snapshot = { userId: number | null; items: Notification[]; unreadCount: number; loading: boolean; error: UserFacingError | null; pageInfo: PageInfo };
const empty = (): Snapshot => ({ userId: null, items: [], unreadCount: 0, loading: false, error: null, pageInfo: { page: 1, pageSize: 25, count: 0, hasNext: false, hasPrevious: false } });
let snapshot = empty();
let accountGeneration = 0;
let requestGeneration = 0;
let loaded = false;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export const getNotificationsSnapshot = () => snapshot;
export function subscribeNotifications(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function resetNotifications() {
  accountGeneration += 1;
  requestGeneration += 1;
  loaded = false;
  pending = null;
  publish(empty());
}

export function loadNotifications(userId: number | null, force = false, page = 1): Promise<void> {
  if (snapshot.userId !== userId) {
    resetNotifications();
    publish({ ...snapshot, userId });
  }
  if (userId === null) return Promise.resolve();
  if (pending && !force) return pending;
  if (!force && loaded) return Promise.resolve();
  const account = accountGeneration;
  const request = ++requestGeneration;
  publish({ ...snapshot, loading: true, error: null });
  const current = () => account === accountGeneration && request === requestGeneration;
  const loadPage = async () => {
    const path = `/me/notifications/?page=${page}&page_size=25`;
    if (typeof api.getPage === "function") return api.getPage<Notification>("/me/notifications/", page, 25);
    const payload = await api.get<unknown>(path);
    if (Array.isArray(payload)) return { items: payload as Notification[], count: payload.length, page, pageSize: 25, hasNext: false, hasPrevious: page > 1 };
    const response = payload as { results?: Notification[]; count?: number; next?: unknown; previous?: unknown };
    return { items: response.results || [], count: response.count || 0, page, pageSize: 25, hasNext: Boolean(response.next), hasPrevious: Boolean(response.previous) };
  };
  pending = Promise.all([
    loadPage(),
    api.get<{ count: number }>("/me/notifications/unread-count/"),
  ]).then(([items, count]) => {
    if (current()) {
      loaded = true;
      publish({ userId, items: items.items, unreadCount: count.count, loading: false, error: null, pageInfo: items });
    }
  }).catch((err) => {
    if (current()) publish({ ...snapshot, loading: false, error: describeError(err, "Não foi possível carregar as notificações") });
    throw err;
  }).finally(() => { if (current()) pending = null; });
  return pending;
}

export async function readNotification(userId: number, id: number): Promise<Notification> {
  const account = accountGeneration;
  const item = await api.post<Notification>(`/me/notifications/${id}/read/`);
  if (account === accountGeneration && snapshot.userId === userId) await loadNotifications(userId, true);
  return item;
}

export async function readAllNotifications(userId: number): Promise<void> {
  const account = accountGeneration;
  await api.post("/me/notifications/mark-all-read/");
  if (account === accountGeneration && snapshot.userId === userId) await loadNotifications(userId, true);
}
