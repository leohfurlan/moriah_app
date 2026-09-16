/**
 * Fonte unica da navegacao do app (Fase 2 do plano de execucao do MVP).
 *
 * Antes, a Sidebar e a BottomNav tinham listas proprias, cheias de itens
 * decorativos apontando para telas que nao tinham nada a ver com o rotulo
 * ("Visitantes" abria o perfil, "Setlists" abria escalas, "Palavras" abria a
 * home). Aqui cada item declara a rota real, a capacidade exigida e as rotas
 * que o mantem ativo; quem renderiza apenas filtra. Item sem tela nao entra no
 * menu — nada de rota vazia para "preencher" o desenho.
 */
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  HandCoins,
  House,
  LayoutDashboard,
  UserRound,
} from "lucide-react-native";

export type NavIcon = typeof House;

/** Capacidades publicadas por `GET /api/me/` (ver apps/accounts/permissions.py). */
export type Capacidade =
  | "member"
  | "manage_all"
  | "manage_pastoral"
  | "manage_members"
  | "review_contributions"
  | "manage_schedules"
  | "manage_cells";

export type NavItem = {
  id: string;
  label: string;
  route: string;
  Icon: NavIcon;
  /** Capacidades que liberam o item; vazio = qualquer conta autenticada. */
  required: Capacidade[];
  /** Rotas que mantem o item marcado como ativo. */
  matches: string[];
};

export type NavGroup = { label: string; items: NavItem[] };

function criarItem(dados: Omit<NavItem, "required"> & { required?: Capacidade[] }): NavItem {
  return { required: [], ...dados };
}

/**
 * Quem pode operar escalas. Espelha `IsScheduleCoordinatorOrAdmin` no backend
 * (ADMIN, PASTOR, COORDINATOR) — capacidade e permissao andam juntas, senao o
 * app oferece um caminho que o servidor recusa.
 */
export const CAPACIDADES_DE_ESCALA: Capacidade[] = ["manage_schedules", "manage_all", "manage_pastoral"];

export function podeGerenciarEscalas(capabilities: string[]): boolean {
  return CAPACIDADES_DE_ESCALA.some((capacidade) => capabilities.includes(capacidade));
}

/** Menu lateral (desktop). */
export const MENU_LATERAL: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      criarItem({ id: "visao-geral", label: "Visão geral", route: "home", Icon: LayoutDashboard, matches: ["home"] }),
    ],
  },
  {
    label: "Cultos e eventos",
    items: [
      criarItem({ id: "agenda", label: "Agenda", route: "agenda", Icon: CalendarDays, required: ["member"], matches: ["agenda"] }),
    ],
  },
  {
    label: "Ministérios",
    items: [
      criarItem({ id: "escalas", label: "Escalas", route: "schedules", Icon: CalendarCheck, required: ["member"], matches: ["schedules", "schedule", "song", "schedule-create"] }),
    ],
  },
  {
    label: "Financeiro",
    items: [
      criarItem({ id: "extrato", label: "Meu extrato", route: "statement", Icon: HandCoins, required: ["member"], matches: ["statement", "contribution"] }),
    ],
  },
  {
    label: "Gestão",
    items: [
      criarItem({
        id: "criar-escala",
        label: "Criar escala",
        route: "schedule-create",
        Icon: CalendarPlus,
        // Backend: `IsScheduleCoordinatorOrAdmin` (ADMIN, PASTOR, COORDINATOR).
        required: CAPACIDADES_DE_ESCALA,
        matches: ["schedule-create"],
      }),
    ],
  },
];

/** Abas (mobile). Rotulos conforme a decisao D3 do plano (Contribuicoes, nao Conteudo). */
export const ABAS: NavItem[] = [
  criarItem({ id: "aba-inicio", label: "Início", route: "home", Icon: House, matches: ["home"] }),
  criarItem({ id: "aba-agenda", label: "Agenda", route: "agenda", Icon: CalendarDays, required: ["member"], matches: ["agenda"] }),
  criarItem({ id: "aba-escalas", label: "Escalas", route: "schedules", Icon: CalendarCheck, required: ["member"], matches: ["schedules", "schedule", "song", "schedule-create"] }),
  criarItem({ id: "aba-contribuicoes", label: "Contribuições", route: "statement", Icon: HandCoins, required: ["member"], matches: ["statement", "contribution"] }),
  criarItem({ id: "aba-perfil", label: "Perfil", route: "profile", Icon: UserRound, required: ["member"], matches: ["profile"] }),
];

/** Primeiro segmento da rota — o "modulo" em que o usuario esta. */
export function raizDaRota(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] || "home";
}

export function rotaAtiva(pathname: string, matches: string[]): boolean {
  return matches.includes(raizDaRota(pathname));
}

export function temAcesso(item: NavItem, capabilities: string[]): boolean {
  if (item.required.length === 0) return true;
  return item.required.some((capacidade) => capabilities.includes(capacidade));
}

/** Grupos do menu ja filtrados pelas capacidades da conta. */
export function gruposVisiveis(capabilities: string[]): NavGroup[] {
  return MENU_LATERAL
    .map((grupo) => ({ ...grupo, items: grupo.items.filter((item) => temAcesso(item, capabilities)) }))
    .filter((grupo) => grupo.items.length > 0);
}

/** Itens de navegacao visiveis, sem agrupar — usado por buscas e testes. */
export function itensVisiveis(capabilities: string[]): NavItem[] {
  return gruposVisiveis(capabilities).flatMap((grupo) => grupo.items);
}

export type ResultadoBusca = { id: string; label: string; route: string; Icon: NavIcon; grupo: string };

/** Normaliza para busca sem acento e sem caixa ("ESCAlas" -> "escalas"). */
export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Busca na navegacao: so o que existe de verdade no menu desta conta. */
export function buscaItens(termo: string, grupos: NavGroup[]): ResultadoBusca[] {
  const alvo = semAcento(termo.trim());
  if (!alvo) return [];
  return grupos.flatMap((grupo) =>
    grupo.items
      .filter((item) => semAcento(item.label).includes(alvo))
      .map((item) => ({ id: item.id, label: item.label, route: item.route, Icon: item.Icon, grupo: grupo.label })),
  );
}
