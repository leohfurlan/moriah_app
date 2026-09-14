import { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";

import { Button, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { describeError } from "@/services/errors";

export function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("membro@moriah.app");
  const [password, setPassword] = useState("membro123");

  return (
    <Screen title="Moriah App">
      <Text style={styles.subtitle}>Entre para acessar perfil, extrato, escalas e contribuicoes.</Text>
      <Field value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="E-mail" />
      <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="Senha" />
      <Button
        onPress={async () => {
          try {
            await onLogin(email, password);
          } catch (error) {
            const { title, message } = describeError(error, "Falha no login");
            Alert.alert(title, message);
          }
        }}
      >
        Entrar
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: "#5f5148",
    marginBottom: 8,
  },
});
