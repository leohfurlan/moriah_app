import {useCallback, useEffect, useState} from "react";
import {Text, View} from "react-native";
import {Screen} from "@/components/Screen";
import {Button, Card, Field} from "@/components/Form";
import {InlineNotice} from "@/components/Feedback";
import {useAuth} from "@/hooks/useAuth";
import {useOnResume} from "@/hooks/useOnResume";
import {api} from "@/services/api";
import {describeError} from "@/services/errors";
import {ServiceTime, WEEKDAYS} from "@/services/onboarding";
import {colors, spacing} from "@/theme";

export function ServiceTimesScreen() {
  const {me} = useAuth(); const admin = Boolean(me?.capabilities.includes("manage_all"));
  const [items, setItems] = useState<ServiceTime[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [weekday, setWeekday] = useState(6); const [time, setTime] = useState(""); const [location, setLocation] = useState("");
  const [editing, setEditing] = useState<number | null>(null); const [removing, setRemoving] = useState<number | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {setItems(await api.get<ServiceTime[]>(`/church/service-times/${admin ? "?include_inactive=true" : ""}`)); setError("");}
    catch (e) {setError(describeError(e, "Não foi possível carregar os horários").message);} finally {setLoading(false);}
  }, [admin]);
  useEffect(() => {void load();}, [load]); useOnResume(load);
  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try {await action(); await load();} catch (e) {setError(describeError(e, "Não foi possível salvar o horário").message);} finally {setBusy(false);}
  }
  return <Screen title="Horários dos cultos" refreshing={loading} onRefresh={() => void load()}>
    {error ? <InlineNotice tone="error" title="Horários dos cultos" message={error}/> : null}
    <Button variant="ghost" disabled={busy} onPress={() => void load()}>Atualizar horários</Button>
    {!loading && !error && !items.length ? <Card><Text>A grade semanal ainda não foi cadastrada. Consulte a secretaria para conhecer os horários.</Text></Card> : null}
    {items.map(item => <Card key={item.id}>
      <Text style={{fontSize: 18, fontWeight: "700", color: colors.ink}}>{WEEKDAYS[item.weekday]} · {item.time}</Text>
      <Text style={{color: colors.inkBody}}>{item.location}{item.active ? "" : " · Inativo"}</Text>
      {admin ? <>
        <Button variant="secondary" disabled={busy} onPress={() => {setEditing(item.id); setWeekday(item.weekday); setTime(item.time); setLocation(item.location);}}>Editar horário</Button>
        <Button variant="ghost" disabled={busy} onPress={() => void act(async () => {await api.patch(`/church/service-times/${item.id}/`, {active: !item.active});})}>{item.active ? "Desativar horário" : "Ativar horário"}</Button>
        {removing === item.id ? <><Text>Excluir este horário da grade semanal?</Text><Button disabled={busy} onPress={() => void act(async () => {await api.delete(`/church/service-times/${item.id}/`); setRemoving(null);})}>Confirmar exclusão</Button><Button variant="ghost" disabled={busy} onPress={() => setRemoving(null)}>Cancelar exclusão</Button></> : <Button variant="ghost" disabled={busy} onPress={() => setRemoving(item.id)}>Excluir horário</Button>}
      </> : null}
    </Card>)}
    {admin ? <Card>
      <Text style={{fontSize: 18, fontWeight: "700"}}>{editing ? "Editar horário" : "Adicionar horário semanal"}</Text>
      <Text style={{fontWeight: "600", color: colors.ink}}>Dia da semana</Text>
      <View style={{flexDirection: "row", flexWrap: "wrap", gap: spacing.sm}}>{WEEKDAYS.map((day, index) => <Button key={day} size="compact" disabled={busy} variant={weekday === index ? "primary" : "secondary"} onPress={() => setWeekday(index)}>{day}</Button>)}</View>
      <Text style={{fontWeight: "600", color: colors.ink}}>Horário do culto (HH:MM)</Text>
      <Field accessibilityLabel="Horário do culto" placeholder="Horário (HH:MM)" value={time} onChangeText={setTime} maxLength={5}/>
      <Text style={{fontWeight: "600", color: colors.ink}}>Local do culto</Text>
      <Field accessibilityLabel="Local do culto" placeholder="Local do culto" value={location} onChangeText={setLocation} maxLength={255}/>
      <Button loading={busy} disabled={!time || !location.trim()} onPress={() => void act(async () => {
        const body = {weekday, time, location};
        if (editing) await api.patch(`/church/service-times/${editing}/`, body); else await api.post("/church/service-times/", body);
        setEditing(null); setTime(""); setLocation("");
      })}>Salvar horário</Button>
      {editing ? <Button variant="ghost" disabled={busy} onPress={() => {setEditing(null); setTime(""); setLocation("");}}>Cancelar edição</Button> : null}
    </Card> : null}
  </Screen>;
}
