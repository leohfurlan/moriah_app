import { Notification } from "@/types/api";

export function notificationSection(createdAt: string): "Hoje" | "Ontem" | "Anteriores" {
  const now = new Date();
  const date = new Date(createdAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.round((startOfToday - startOfDate) / 86400000);
  if (daysAgo <= 0) return "Hoje";
  if (daysAgo === 1) return "Ontem";
  return "Anteriores";
}

export function notificationTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export type MvpNotification = Notification;
