import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FeedbackTone, InlineNotice } from "@/components/Feedback";
import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { describeError } from "@/services/errors";
import { colors, radius, spacing } from "@/theme";

export function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("membro@moriah.app");
  const [password, setPassword] = useState("membro123");
  const [submitting, setSubmitting] = useState(false);
  // Falha de login fica presa ao formulario: o membro precisa ver a mensagem
  // enquanto corrige o que digitou, sem ela sumir da tela.
  const [aviso, setAviso] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);

  async function submit() {
    if (submitting) {
      return;
    }
    try {
      setAviso(null);
      setSubmitting(true);
      await onLogin(email, password);
    } catch (error) {
      const { title, message } = describeError(error, "Falha no login");
      setAviso({ tone: "error", title, message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Moriah App" showBottomNav={false}>
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <Text style={styles.tagline}>Perfil, extrato, escalas e contribuições da igreja.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>E-mail</Text>
        <Field
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="seu@email.com"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.label}>Senha</Text>
        <Field secureTextEntry placeholder="Sua senha" value={password} onChangeText={setPassword} />
        {aviso ? (
          <InlineNotice tone={aviso.tone} title={aviso.title} message={aviso.message} onDismiss={() => setAviso(null)} />
        ) : null}
        <Button loading={submitting} onPress={submit}>
          Entrar
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.onAccent,
    fontSize: 30,
    fontWeight: "800",
  },
  tagline: {
    color: colors.inkMuted,
    fontSize: 14,
    textAlign: "center",
  },
  form: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkBody,
    marginTop: spacing.sm,
  },
});
