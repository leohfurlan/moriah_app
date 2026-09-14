import { TextStyle } from "react-native";

/**
 * Design tokens do Moriah app.
 *
 * Paleta terracota/creme do rascunho aprovado no Pen.dev, centralizada aqui
 * para que as telas usem SEMPRE tokens em vez de hex solto. Corrupcao de
 * literal de cor em edicao de arquivo ja causou UI inconsistente; editar um
 * token unico e a superficie de mudanca minima.
 */
export const colors = {
  canvas: "#f7f3ec", // fundo da tela
  surface: "#ffffff", // cards
  surfaceTint: "#fffdf9", // inputs
  surfaceSelected: "#efe4d7", // secondary button
  border: "#eadfce", // borda de card
  borderStrong: "#d6cbbb", // borda de input
  borderDivider: "#efe6d9", // divisores internos

  ink: "#3f2f24", // texto principal
  inkBody: "#4b4038", // texto secundario
  inkMuted: "#5f5148", // meta/legendas
  inkPlaceholder: "#87786c",

  accent: "#7a4d2d", // marrom-terracota (acoes)
  accentDeep: "#6b4c37", // texto sobre fundo claro selecionado

  danger: "#8a3c2d",
  dangerBg: "#fdf3f1",
  dangerBorder: "#e6c3bc",

  success: "#2f7a4d",
  warning: "#9a6b1f",

  onAccent: "#ffffff", // texto sobre o botao primario
  badgeSuccessBg: "#eef6ef",
  badgeSuccessBorder: "#cfe4d2",
  badgeWarningBg: "#faf3e2",
  badgeWarningBorder: "#ecdcb4",
  buttonTextDisabled: "#f5efe7",
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
  title: { fontSize: 28, fontWeight: "700", color: colors.ink },
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
};

/** Converte status do backend em rotulo humano, se existir. */
const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Recusado",
  active: "Ativo",
  approved: "Aprovado",
  received: "Recebido",
  pending_confirmation: "Aguardando confirmacao",
  rejected: "Recusado",
  tithe: "Dizimo",
  offering: "Oferta",
  campaign: "Campanha",
  missions: "Missoes",
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
