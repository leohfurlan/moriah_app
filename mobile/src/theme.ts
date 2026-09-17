import { TextStyle } from "react-native";

/**
 * Design tokens do Moriah app.
 *
 * Tokens extraidos do layout canônico moriah_next.pen.
 */
export const colors = {
  canvas: "#F6F7FB",
  surface: "#FFFFFF",
  surfaceTint: "#FFFFFF",
  surfaceSelected: "#EEF2FF",
  border: "#E4E7EC",
  borderStrong: "#D0D5DD",
  borderDivider: "#E4E7EC",
  ink: "#101828",
  inkBody: "#344054",
  inkMuted: "#667085",
  inkPlaceholder: "#98A2B3",
  accent: "#4F46E5",
  accentDeep: "#344054",
  avatar: "#E0E7FF",
  danger: "#F04438",
  dangerBg: "#FEF3F2",
  dangerBorder: "#FECDCA",
  success: "#12B76A",
  successText: "#067647",
  warning: "#F79009",
  warningText: "#B54708",
  onAccent: "#FFFFFF",
  badgeSuccessBg: "#ECFDF3",
  badgeSuccessBorder: "#ABEFC6",
  badgeWarningBg: "#FFFAEB",
  badgeWarningBorder: "#FEDF89",
  buttonTextDisabled: "#D0D5DD",
} as const;

/** Escala 4pt: use apenas estes valores de espacamento. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  field: 12,
  card: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  body: { fontSize: 15, color: colors.inkBody },
  meta: { fontSize: 14, color: colors.inkMuted },
  caption: { fontSize: 12, color: colors.inkMuted },
} satisfies Record<string, TextStyle>;

/** Rota de tela -> rotulo humano. Uma unica fonte de verdade. */
export const routeLabels: Record<string, string> = {
  index: "Entrar",
  home: "Inicio",
  profile: "Meu Perfil",
  statement: "Extrato",
  contribution: "Contribuicao",
  schedules: "Minha Escala",
  schedule: "Minha Escala",
  agenda: "Minha Agenda",
  notifications: "Notificações",
  notification: "Notificação",
  "schedule-create": "Adicionar escala",
  "schedule-admin": "Gestão de escalas",
  "finance-review": "Revisão financeira",
};

/** Converte status do backend em rotulo humano, se existir. */
const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Recusado",
  unavailable: "Indisponivel",
  conflict: "Conflito de horario",
  replacement_needed: "Substituicao necessaria",
  draft: "Rascunho",
  published: "Publicada",
  cancelled: "Cancelada",
  planned: "Planejado",
  active: "Ativo",
  approved: "Aprovado",
  received: "Recebido",
  pending_confirmation: "Aguardando confirmacao",
  rejected: "Recusado",
  needs_review: "Precisa revisao",
  tithe: "Dízimo",
  offering: "Oferta",
  campaign: "Campanha",
  missions: "Missões",
  event: "Evento",
  other: "Outros",
};

export function statusLabel(value: string): string {
  return statusLabels[value] || value;
}

/** Data ISO -> "12/09/2026 19:30" ou "--" se invalida. */
export function formatDate(iso: string, withTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return withTime ? date.toLocaleString("pt-BR") : date.toLocaleDateString("pt-BR");
}

/** Valor decimal string -> "R$ 120,00" com separadores pt-BR. */
export function formatBRL(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "--";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
