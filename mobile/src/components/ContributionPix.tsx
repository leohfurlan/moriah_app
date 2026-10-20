import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import { api, normalizePage } from "@/services/api";
import { ApiError, describeError } from "@/services/errors";
import { Button, Card, Field } from "@/components/Form";
import { InlineNotice } from "@/components/Feedback";

export type ContributionPixIntent = {
  id: string; state: string; amount: string; category: string; due_date: string;
  past_due: boolean; recipient_name: string; emv?: string | null; qr_svg?: string | null;
  contribution_id: number | null;
};

type Props = { amount: string; category: string; onSelect: (intent: ContributionPixIntent | null) => void };

export function ContributionPix({ amount, category, onSelect }: Props) {
  const [config, setConfig] = useState<{ enabled: boolean; has_saved_cpf: boolean; cpf_suffix?: string } | null>(null);
  const [cpf, setCpf] = useState("");
  const [intent, setIntent] = useState<ContributionPixIntent | null>(null);
  const [recent, setRecent] = useState<ContributionPixIntent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Chave mantida mesmo quando a resposta se perde; só limpar após sucesso conhecido.
  const attempt = useRef<{ key: string; amount: string; category: string; cpf: string } | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    api.get<typeof config>("/contributions/pix-intents/config/").then(value => { if (active) setConfig(value); }).catch(() => {});
    api.get<unknown>("/contributions/pix-intents/").then(value => { if (active) setRecent(normalizePage<ContributionPixIntent>(value).items); }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function generate() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    if (!attempt.current) attempt.current = { key: Crypto.randomUUID(), amount: amount.replace(",", "."), category, cpf };
    const current = attempt.current;
    try {
      const value = await api.post<ContributionPixIntent>("/contributions/pix-intents/", {
        amount: current.amount, category: current.category, ...(current.cpf ? { cpf: current.cpf } : {}),
      }, { "Idempotency-Key": current.key });
      setConfig(previous => previous ? { ...previous, has_saved_cpf: true, cpf_suffix: current.cpf ? current.cpf.slice(-2) : previous.cpf_suffix } : previous);
      attempt.current = null;
      setCpf(""); setIntent(value);
      if (value.state === "ready") onSelect(value);
      setRecent(items => [value, ...items.filter(item => item.id !== value.id)]);
      if (value.state !== "ready") setMessage("A geração não foi concluída. Guarde esta tentativa e fale com a tesouraria antes de gerar outra cobrança.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) attempt.current = null;
      setMessage(describeError(error, "Não foi possível gerar o Pix").message);
    } finally { lock.current = false; setBusy(false); }
  }

  async function resume(id: string, retry = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const value = retry
        ? await api.post<ContributionPixIntent>(`/contributions/pix-intents/${id}/retry/`)
        : await api.get<ContributionPixIntent>(`/contributions/pix-intents/${id}/`);
      setIntent(value); onSelect(value.state === "ready" ? value : null);
    } catch (error) { setMessage(describeError(error, "Erro ao retomar Pix").message); }
    finally { lock.current = false; setBusy(false); }
  }

  return <Card>
    <Text style={{ fontWeight: "700" }}>Contribuir com Pix</Text>
    {config?.enabled && !intent ? <>
      <Text>{config.has_saved_cpf ? `CPF salvo com final ${config.cpf_suffix || "**"}. Para trocar, informe outro abaixo.` : "Informe o CPF de quem fará a contribuição. Ele ficará salvo para as próximas contribuições."}</Text>
      <Field accessibilityLabel="CPF do pagador" value={cpf} onChangeText={setCpf} keyboardType="number-pad" placeholder={config.has_saved_cpf ? "Usar CPF salvo" : "CPF do pagador"} />
      <Button disabled={busy} loading={busy} onPress={generate}>{attempt.current ? "Retomar tentativa de geração" : "Gerar QR Pix"}</Button>
    </> : !intent ? <Text>Pix indisponível. Você pode enviar o comprovante normalmente.</Text> : null}
    {intent ? <>
      <Text>{intent.recipient_name} · R$ {intent.amount} · Vencimento {intent.due_date.split("-").reverse().join("/")}</Text>
      <Text>Pagamento ainda não confirmado. Após pagar, anexe o comprovante abaixo para revisão da tesouraria.</Text>
      {intent.past_due ? <Text>O vencimento desta cobrança passou. Um comprovante de pagamento ainda pode ser enviado para revisão.</Text> : null}
      {intent.state === "ready" && !intent.past_due && intent.qr_svg ? <View style={{ alignItems: "center", backgroundColor: "white", padding: 12 }}><SvgXml xml={intent.qr_svg} width={240} height={240} /></View> : null}
      {intent.emv && !intent.past_due ? <Button variant="secondary" onPress={async () => { try { await Clipboard.setStringAsync(intent.emv!); setMessage("Código Pix copiado."); } catch { setMessage("Não foi possível copiar. Tente novamente."); } }}>Copiar código Pix</Button> : null}
      {intent.state !== "ready" && !intent.past_due ? <Button disabled={busy} loading={busy} onPress={() => resume(intent.id, true)}>Retomar a mesma emissão</Button> : null}
      {intent.state !== "ready" ? <Text>A geração ainda não foi concluída. Retome a mesma emissão; se continuar pendente, fale com a tesouraria.</Text> : null}
      {intent.contribution_id ? <Text>O comprovante desta cobrança já foi enviado.</Text> : null}
      <Button variant="secondary" disabled={busy} onPress={() => { onSelect(null); setIntent(null); attempt.current = null; setMessage(""); }}>Voltar ao envio de comprovante</Button>
    </> : null}
    {recent.slice(0, 10).map(item => <Button key={item.id} variant="secondary" disabled={busy} onPress={() => resume(item.id)}>Retomar Pix R$ {item.amount} · {item.due_date}</Button>)}
    {message ? <InlineNotice tone="info" title="Pix" message={message} onDismiss={() => setMessage("")} /> : null}
  </Card>;
}
