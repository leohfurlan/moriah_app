import {useEffect, useState} from "react";
import {Text} from "react-native";
import {useRouter} from "expo-router";
import {Screen} from "@/components/Screen";
import {Button, Card} from "@/components/Form";
import {InlineNotice} from "@/components/Feedback";
import {api} from "@/services/api";
import {describeError} from "@/services/errors";
import {OnboardingState} from "@/services/onboarding";
import {ChurchEvent} from "@/types/api";
import {formatDate} from "@/theme";
export default function Welcome() {
  const router = useRouter(); const [state, setState] = useState<OnboardingState | null>(null);
  const [events, setEvents] = useState<ChurchEvent[]>([]); const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {const [profile, agenda] = await Promise.all([api.get<OnboardingState>("/me/onboarding/"), api.get<ChurchEvent[]>("/me/events/")]); setState(profile); setEvents(agenda); setError("");}
    catch (e) {setError(describeError(e, "Não foi possível carregar os próximos passos").message);} finally {setLoading(false);}
  }
  useEffect(() => {void load();}, []);
  return <Screen title="Seus próximos passos">
    {error ? <InlineNotice tone="error" title="Próximos passos" message={error}/> : null}
    <Button variant="ghost" onPress={() => void load()}>Atualizar próximos passos</Button>
    <Button onPress={() => router.push("/service-times" as never)}>Conhecer horários dos cultos</Button>
    {state?.profile.relationship === "attending" ? <Card><Text>Quer participar de uma célula? Procure a secretaria para conhecer os grupos e encontrar o melhor horário para você.</Text></Card> : null}
    {state?.profile.relationship === "member" ? <Card><Text>{state.member_link.state === "confirmed" ? "Seu vínculo está confirmado." : state.member_link.state === "rejected" ? "A conferência não foi aprovada. Confira os detalhes no Perfil." : "A secretaria vai conferir seu cadastro. Você pode acompanhar a situação no Perfil."}</Text><Button variant="secondary" onPress={() => router.push("/profile")}>Ver situação cadastral</Button></Card> : null}
    <Card><Text>Próximos eventos</Text>{loading ? <Text>Carregando próximos eventos…</Text> : error ? null : events.length ? events.map(event => <Text key={event.id}>{event.name} · {formatDate(event.start_at, true)} · {event.location}</Text>) : <Text>Não há próximos eventos cadastrados. Consulte a secretaria.</Text>}</Card>
    <Button variant="secondary" onPress={() => router.replace("/home")}>Ir para o início</Button>
  </Screen>;
}
