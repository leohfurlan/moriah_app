import {useCallback, useEffect, useState} from "react";
import {Linking, Platform, Text, View} from "react-native";
import {useRouter} from "expo-router";
import {Button, Card} from "./Form";
import {InlineNotice} from "./Feedback";
import {useAuth} from "@/hooks/useAuth";
import {useOnResume} from "@/hooks/useOnResume";
import {api} from "@/services/api";
import {describeError} from "@/services/errors";
import {SetupState} from "@/services/onboarding";
import {colors, spacing} from "@/theme";

export function ChurchSetup({full = false}: {full?: boolean}) {
  const {me} = useAuth(); const router = useRouter();
  const [state, setState] = useState<SetupState | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const allowed = Boolean(me?.onboarding_completed && me.capabilities.includes("manage_all"));
  const load = useCallback(async () => {
    if (!allowed) return;
    try {setState(await api.get<SetupState>("/church/setup/")); setError("");}
    catch (e) {setError(describeError(e, "Não foi possível carregar as configurações").message);}
  }, [allowed, me?.id]);
  useEffect(() => {void load();}, [load]); useOnResume(load);
  if (!allowed) return null;
  async function action(path: string, body = {}) {
    setBusy(true); setError("");
    try {setState(await api.post<SetupState>(path, body));} catch (e) {setError(describeError(e, "Não foi possível atualizar").message);} finally {setBusy(false);}
  }
  async function navigate(url: string) {
    if (!url.startsWith("/admin/")) {router.push(url as never); return;}
    const origin = Platform.OS === "web" ? window.location.origin : new URL(process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/backend").origin;
    try {await Linking.openURL(origin + url);} catch {setError("Não foi possível abrir a administração. Tente novamente.");}
  }
  if (!state || error) return <Card>{error ? <InlineNotice tone="error" title="Configuração da igreja" message={error}/> : <Text>Carregando configurações…</Text>}<Button variant="ghost" onPress={() => void load()}>Atualizar configurações</Button></Card>;
  if (!full && !state.card_visible) return null;
  return <Card>
    <Text style={{fontSize: 20, fontWeight: "800", color: colors.ink}}>Configuração da igreja · {state.percentage}%</Text>
    <Text style={{color: colors.inkMuted}}>{state.completed_count} de {state.total_count} configurações concluídas</Text>
    <View accessibilityRole="progressbar" accessibilityValue={{min: 0, max: 100, now: state.percentage}} style={{height: 8, backgroundColor: colors.border, borderRadius: 8}}>
      <View style={{height: 8, borderRadius: 8, backgroundColor: colors.accent, width: `${state.percentage}%`}}/>
    </View>
    {state.items.filter(item => full || !item.completed).map(item => <View key={item.key} style={{gap: spacing.sm, paddingVertical: spacing.sm}}>
      <Text style={{fontWeight: "600", color: colors.inkBody}}>{item.completed ? "✓ " : "○ "}{item.label}</Text>
      {full ? <>
        {item.action_url ? <Button variant="secondary" disabled={busy} onPress={() => void navigate(item.action_url!)}>Abrir: {item.label}</Button> : <Text style={{color: colors.inkMuted}}>Procure a administração com acesso ao cadastro para realizar esta configuração.</Text>}
        {item.mode === "confirmation" && !item.completed ? <Button disabled={busy} onPress={() => void action("/church/setup/confirm/", {item: item.key})}>Confirmar que revisei: {item.label}</Button> : null}
      </> : null}
    </View>)}
    {!full ? <Button onPress={() => router.push("/settings" as never)}>Continuar configuração</Button> : <Button variant="ghost" disabled={busy} onPress={() => void load()}>Atualizar progresso</Button>}
    {state.percentage === 100 && state.card_visible ? <Button variant="ghost" loading={busy} onPress={() => void action("/church/setup/dismiss/", {})}>Dispensar card do painel</Button> : null}
  </Card>;
}
