import {useEffect, useState} from "react";
import {SafeAreaView, ScrollView, StyleSheet, Text, View} from "react-native";
import {useRouter} from "expo-router";
import {Button, Card, Field} from "@/components/Form";
import {InlineNotice} from "@/components/Feedback";
import {DateField} from "@/components/DateField";
import {OnboardingTransition} from "@/components/OnboardingTransition";
import {WhatsAppAccess} from "@/components/WhatsAppAccess";
import {useAuth} from "@/hooks/useAuth";
import {api} from "@/services/api";
import {describeError} from "@/services/errors";
import {birthDateLabel, birthDateToISO, OnboardingState, Relationship, takeOnboardingDestination} from "@/services/onboarding";
import {colors, spacing} from "@/theme";

const RELATIONS: Array<[Relationship, string]> = [["discovering", "Estou conhecendo a igreja"],
  ["attending", "Já frequento, mas ainda não sou membro"], ["member", "Já sou membro"]];

export function OnboardingScreen() {
  const {me, logout, refreshProfile} = useAuth();
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [relation, setRelation] = useState<Relationship | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  async function load() {
    setError("");
    try {
      const data = await api.get<OnboardingState>("/me/onboarding/");
      setState(data); setName(data.profile.name); setBirth(birthDateLabel(data.profile.birth_date)); setRelation(data.profile.relationship);
    } catch (e) {setError(describeError(e, "Não foi possível carregar sua acolhida").message);}
  }
  useEffect(() => {if (me) void load();}, [me?.id]);
  async function act(action: () => Promise<void>) {
    setBusy(true); setError(""); setSaved(false);
    try {await action();} catch (e) {setError(describeError(e, "Não foi possível continuar").message);} finally {setBusy(false);}
  }
  async function save(complete = false) {
    const saved = await api.patch<OnboardingState>("/me/onboarding/", {
      name, birth_date: birth ? birthDateToISO(birth) : null, ...(relation ? {relationship: relation} : {}), step: "profile",
    });
    setState(saved);
    setSaved(!complete);
    if (complete) {
      const completed = await api.post<OnboardingState>("/me/onboarding/complete/", {});
      await refreshProfile();
      setState(completed);
      if (me) setDestination(takeOnboardingDestination(me.id));
    }
  }
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.content}>
      <Text style={styles.brand}>MORIAH</Text>
      <Text style={styles.title}>{state?.status === "completed" ? "Que bom ter você aqui!" : "Bem-vindo à nossa comunidade"}</Text>
      <Text style={styles.text}>Um lugar para caminhar juntos, participar e servir.</Text>
      {error ? <InlineNotice tone="error" title="Vamos tentar novamente" message={error}/> : null}
      {saved ? <InlineNotice tone="success" title="Progresso salvo" message="Você pode sair e retomar esta etapa depois."/> : null}
      <OnboardingTransition step={!state ? "loading" : state.status === "completed" ? "completed" : state.step}>
      {!state ? <Button loading={busy} onPress={() => void act(load)}>Carregar acolhida</Button> : state.status === "completed" ? <Card>
        <Text style={styles.subtitle}>Seu cadastro inicial está completo</Text>
        {state.member_link.state === "pending" ? <Text style={styles.text}>Sua solicitação foi enviada. A secretaria vai conferir seu vínculo com a igreja.</Text> : null}
        {state.member_link.state === "confirmed" ? <Text style={styles.text}>Seu vínculo com a igreja está confirmado.</Text> : null}
        {state.next_actions.map(action => <Button key={action.key} disabled={busy} variant="secondary" onPress={() => router.push(action.route as never)}>{action.label}</Button>)}
        {destination ? <Button disabled={busy} variant="secondary" onPress={() => router.replace(destination as never)}>Voltar à tela solicitada</Button> : null}
        <Button disabled={busy} onPress={() => router.replace("/home")}>Ir para o início</Button>
      </Card> : state.step === "welcome" ? <Card>
        <Text style={styles.subtitle}>Vamos nos conhecer?</Text>
        <Text style={styles.text}>Confira seu perfil em poucos passos. Depois, encontre os horários dos cultos e as próximas oportunidades de participar.</Text>
        {state.journey === "admin" ? <Text style={styles.text}>Depois do seu perfil, você poderá configurar a igreja aos poucos e acompanhar o percentual de conclusão.</Text> : null}
        <Button loading={busy} onPress={() => void act(async () => setState(await api.patch<OnboardingState>("/me/onboarding/", {step: "profile"})))}>Começar</Button>
        <Button variant="ghost" disabled={busy} onPress={() => void act(async () => setState(await api.patch<OnboardingState>("/me/onboarding/", {step: "profile"})))}>Pular apresentação</Button>
      </Card> : <Card>
        <Text style={styles.subtitle}>Seu perfil essencial</Text>
        <Text style={styles.text}>Os campos abaixo são necessários para concluir esta etapa.</Text>
        <Text style={styles.label}>Nome completo</Text>
        <Field accessibilityLabel="Nome completo" placeholder="Nome completo" value={name} onChangeText={setName} maxLength={150} editable={!busy}/>
        <Text style={styles.label}>E-mail</Text>
        <Field accessibilityLabel="E-mail" value={state.profile.email} editable={false}/>
        <DateField label="Data de nascimento" value={birth} onChange={setBirth} maximumDate={new Date()} disabled={busy}/>
        <Text style={styles.text}>Usamos sua data de nascimento para conhecer melhor o perfil etário da nossa comunidade.</Text>
        <Text style={styles.subtitle}>Como você se relaciona com a Moriah?</Text>
        {RELATIONS.map(([value, label]) => <Button key={value} variant={relation === value ? "primary" : "secondary"} disabled={busy} onPress={() => setRelation(value)}>{`${relation === value ? "✓ " : ""}${label}`}</Button>)}
        {relation === "member" && state.member_link.state !== "confirmed" ? <Text style={styles.text}>Ao concluir, encaminharemos automaticamente seu cadastro para conferência da secretaria. Uma solicitação pendente será aproveitada.</Text> : null}
        {state.whatsapp_verified ? <InlineNotice tone="success" title="WhatsApp verificado" message="Seu vínculo atual será aproveitado."/> : <><WhatsAppAccess link/><Button variant="ghost" onPress={() => void act(load)}>Já vinculei: atualizar verificação</Button></>}
        <Button variant="secondary" loading={busy} onPress={() => void act(() => save())}>Salvar e continuar depois</Button>
        <Button loading={busy} disabled={!name.trim() || !birth || !relation || !state.whatsapp_verified} onPress={() => void act(() => save(true))}>Concluir perfil</Button>
      </Card>}
      </OnboardingTransition>
      <Button variant="ghost" disabled={busy} onPress={() => void act(async () => {await logout(); router.replace("/");})}>Sair da conta</Button>
    </View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({safe: {flex: 1, backgroundColor: colors.canvas}, container: {padding: spacing.lg, alignItems: "center"},
  content: {width: "100%", maxWidth: 620, gap: spacing.lg, paddingVertical: spacing.xl}, brand: {color: colors.accent, fontWeight: "800", letterSpacing: 4},
  title: {fontSize: 30, fontWeight: "800", color: colors.ink}, subtitle: {fontSize: 18, fontWeight: "700", color: colors.ink}, label: {fontSize: 14, fontWeight: "600", color: colors.ink}, text: {fontSize: 15, lineHeight: 23, color: colors.inkBody, textAlign: "justify"}});
