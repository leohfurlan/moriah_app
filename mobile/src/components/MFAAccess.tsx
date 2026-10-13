import { useState } from "react";
import { Text, View } from "react-native";
import { api } from "@/services/api";
import { describeError } from "@/services/errors";
import { LoginResponse, MFAChallenge } from "@/types/api";
import { InlineNotice } from "./Feedback";
import { Button, Field } from "./Form";
import { spacing } from "@/theme";

export function MFAAccess({ challenge, onTokens, onCancel }: {
  challenge: MFAChallenge; onTokens: (tokens: LoginResponse) => Promise<void>; onCancel: () => void;
}) {
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [result, setResult] = useState<LoginResponse | null>(null);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await action(); } catch (e) { setError(describeError(e, "Verificação de segurança")); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: spacing.md }}>
    <Text style={{ fontWeight: "700" }}>Verificação em duas etapas</Text>
    {result?.recovery_codes ? <>
      <Text>Guarde estes códigos em um local seguro, separado do telefone. Cada código pode ser usado uma vez se você perder o autenticador.</Text>
      <Text selectable>{result.recovery_codes.join("\n")}</Text>
      <Button loading={busy} onPress={() => run(() => onTokens(result))}>Guardei os códigos. Continuar</Button>
    </> : <>
      {challenge.enrollment_required ? <>
        <Text>Adicione uma conta TOTP no seu aplicativo autenticador. Selecione inserir chave manualmente.</Text>
        {secret ? <Text selectable accessibilityLabel="Chave do autenticador">{secret}</Text> :
          <Button loading={busy} onPress={() => run(async () => {
            const setup = await api.post<{ secret: string }>("/auth/mfa/enroll/", { challenge: challenge.challenge });
            setSecret(setup.secret);
          })}>Configurar autenticador</Button>}
      </> : <Text>Digite o código do autenticador ou um dos seus códigos de recuperação.</Text>}
      <Field accessibilityLabel="Código do autenticador ou recuperação" placeholder="Código" autoCapitalize="none" autoComplete="one-time-code" value={code} onChangeText={setCode} maxLength={40} />
      <Button loading={busy} disabled={!code.trim()} onPress={() => run(async () => {
        const tokens = await api.post<LoginResponse>("/auth/mfa/verify/", { challenge: challenge.challenge, code });
        if (tokens.recovery_codes) setResult(tokens); else await onTokens(tokens);
      })}>Confirmar código</Button>
      <Button variant="ghost" disabled={busy} onPress={onCancel}>Voltar ao login</Button>
    </>}
    {error ? <InlineNotice tone="error" title={error.title} message={error.message} /> : null}
  </View>;
}
