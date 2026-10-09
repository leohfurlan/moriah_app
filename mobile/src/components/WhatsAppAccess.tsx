import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { api } from "@/services/api";
import { describeError } from "@/services/errors";
import { LoginResponse } from "@/types/api";
import { InlineNotice } from "./Feedback";
import { Button, Field } from "./Form";
import { colors, spacing } from "@/theme";

type Verification = LoginResponse | { registration_required: true; proof: string } | { linked: true };

export function WhatsAppAccess({ onTokens, link = false }: { onTokens?: (tokens: LoginResponse) => Promise<void>; link?: boolean }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [proof, setProof] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState<{title: string; message: string} | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const prefix = `/auth/whatsapp/${link ? "link/" : ""}`;
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); } catch (e) { setError(describeError(e, "Não foi possível continuar")); }
    finally { setBusy(false); }
  }
  const send = () => run(async () => {
    const result = await api.post<{challenge: string; resend_in: number}>(prefix + "request/", {phone});
    setChallenge(result.challenge); setCode(""); setProof("");
    setRetryAt(Date.now() + result.resend_in * 1000);
  });
  const verify = () => run(async () => {
    const result = await api.post<Verification>(prefix + "verify/", {challenge, code});
    if ("access" in result) await onTokens?.(result);
    else if ("proof" in result) setProof(result.proof);
    else setLinked(true);
  });
  const register = () => run(async () => {
    const result = await api.post<LoginResponse>("/auth/whatsapp/register/", {proof, name, email});
    await onTokens?.(result);
  });
  return <View style={{gap: spacing.sm}}>
    <Text style={{fontWeight: "700", color: colors.inkBody}}>{link ? "Vincular WhatsApp para entrar sem senha" : "Entrar ou cadastrar pelo WhatsApp"}</Text>
    {linked ? <InlineNotice tone="success" title="WhatsApp vinculado" message="No próximo acesso, use este número e o código enviado pelo WhatsApp." /> : proof ? <>
      <Text>Seu WhatsApp foi validado. Complete seu cadastro na Igreja Moriah.</Text>
      <Field accessibilityLabel="Nome completo" placeholder="Nome completo" value={name} onChangeText={setName} maxLength={150} />
      <Field accessibilityLabel="E-mail do cadastro" placeholder="Seu e-mail" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
      <Text style={{color: colors.inkMuted}}>Você será cadastrado como visitante. A secretaria poderá conferir e atualizar seu vínculo com a igreja.</Text>
      <Button loading={busy} disabled={!name.trim() || !email.trim()} onPress={register}>Concluir cadastro</Button>
      <Button variant="ghost" disabled={busy} onPress={() => {setProof(""); setChallenge(""); setCode("");}}>Validar outro número</Button>
    </> : <>
      <Field accessibilityLabel="Número do WhatsApp" placeholder="WhatsApp com DDD" keyboardType="phone-pad" autoComplete="tel" value={phone} editable={!challenge && !busy} onChangeText={setPhone} maxLength={32} />
      {challenge ? <>
        <Text>Digite o código de 6 dígitos enviado ao seu WhatsApp. Ele vale por 5 minutos.</Text>
        <Field accessibilityLabel="Código de seis dígitos" placeholder="000000" keyboardType="number-pad" autoComplete="one-time-code" value={code} onChangeText={value => setCode(value.replace(/\D/g, "").slice(0,6))} maxLength={6} />
        <Button loading={busy} disabled={code.length !== 6} onPress={verify}>{link ? "Confirmar vínculo" : "Validar código"}</Button>
        <Button variant="ghost" disabled={busy || wait > 0} onPress={send}>{wait ? `Reenviar em ${wait}s` : "Reenviar código"}</Button>
        <Button variant="ghost" disabled={busy} onPress={() => {setChallenge(""); setCode(""); setError(null);}}>Alterar número</Button>
      </> : <Button loading={busy} disabled={!phone.trim() || wait > 0} onPress={send}>{wait ? `Aguarde ${wait}s` : "Receber código no WhatsApp"}</Button>}
    </>}
    {error ? <InlineNotice tone="error" title={error.title} message={error.message} /> : null}
  </View>;
}
