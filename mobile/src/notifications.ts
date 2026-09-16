export type MvpNotification = {
  id: string;
  section: "Hoje" | "Ontem" | "Anteriores";
  title: string;
  body: string;
  time: string;
  category: "Escalas" | "Igreja" | "Contribuições";
  detail: string;
  actionLabel?: string;
  actionRoute?: string;
};

export const MVP_NOTIFICATIONS: MvpNotification[] = [
  {
    id: "schedule-new",
    section: "Hoje",
    title: "Nova escala para você",
    body: "Vocal apoio no Culto de celebração.",
    time: "Há 10 min",
    category: "Escalas",
    detail: "Você foi escalado para o Vocal apoio no Culto de celebração. Confira os detalhes e confirme sua presença.",
    actionLabel: "Abrir minhas escalas",
    actionRoute: "/schedules",
  },
  {
    id: "schedule-updated",
    section: "Hoje",
    title: "Escala atualizada",
    body: "A chegada do Louvor foi alterada para 17h45.",
    time: "Há 2h",
    category: "Escalas",
    detail: "A equipe de Louvor atualizou o horário de chegada. Planeje-se para estar no templo às 17h45.",
    actionLabel: "Ver agenda",
    actionRoute: "/agenda",
  },
  {
    id: "contribution-approved",
    section: "Anteriores",
    title: "Contribuição confirmada",
    body: "Seu comprovante de R$ 450 foi validado.",
    time: "12 set",
    category: "Contribuições",
    detail: "A tesouraria validou seu comprovante. O registro já está disponível no seu extrato.",
    actionLabel: "Ver contribuições",
    actionRoute: "/statement",
  },
];

export function findMvpNotification(id: string | undefined) {
  return MVP_NOTIFICATIONS.find((item) => item.id === id);
}
