/** Datas civis do backend não são instantes UTC. */
export function parseDate(value: string): Date {
  const civil = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!civil) return new Date(value);
  const [, year, month, day] = civil.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date : new Date(NaN);
}

export type StatementPeriod = "all" | "3m" | "6m" | "year";

/** Limite inclusivo à meia-noite, preservando o último dia em meses menores. */
export function statementCutoff(period: StatementPeriod, now = new Date()): Date | null {
  if (period === "all") return null;
  const months = period === "year" ? 12 : period === "6m" ? 6 : 3;
  const target = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(now.getDate(), lastDay));
  return target;
}

export function statementBarHeight(total: number, maximum: number): number {
  return total > 0 && maximum > 0 ? (total / maximum) * 150 : 0;
}
