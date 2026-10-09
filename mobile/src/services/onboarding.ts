export type Relationship = "discovering" | "attending" | "member";
export type OnboardingState = {
  version: number; journey: "personal" | "admin"; step: "welcome" | "profile" | "next_steps" | "done";
  status: "not_started" | "in_progress" | "completed";
  profile: {name: string; email: string; birth_date: string | null; relationship: Relationship | null};
  whatsapp_verified: boolean; completed_at: string | null;
  member_link: {state: "none" | "pending" | "confirmed" | "rejected"; request_id: number | null};
  next_actions: Array<{key: string; label: string; route: string}>;
};
export type SetupState = {
  completed_count: number; total_count: number; percentage: number; card_visible: boolean;
  items: Array<{key: string; label: string; completed: boolean; mode: "confirmation" | "automatic"; action_url: string | null}>;
};
export type ServiceTime = {id: number; weekday: number; time: string; location: string; active: boolean};
export const WEEKDAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

// Keep attempted internal navigation isolated by account. Route guards recheck
// current capabilities when the user chooses to resume after completing profile.
const destinations = new Map<number, string>();
export function rememberOnboardingDestination(userId: number, path: string) {
  if (path !== "/" && path !== "/home" && path !== "/onboarding") destinations.set(userId, path);
}
export function takeOnboardingDestination(userId: number): string | null {
  const path = destinations.get(userId) || null;
  destinations.delete(userId);
  return path;
}

export function birthDateToISO(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}
export function birthDateLabel(value: string | null): string {
  return value ? value.split("-").reverse().join("/") : "";
}
