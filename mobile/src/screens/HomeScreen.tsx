import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { MeResponse } from "@/types/api";

const actions = [
  { key: "profile", label: "Meu Perfil" },
  { key: "statement", label: "Meu Extrato" },
  { key: "contribution", label: "Nova Contribuicao" },
  { key: "schedules", label: "Minha Escala" },
];

export function HomeScreen({
  me,
  onNavigate,
  onLogout,
}: {
  me: MeResponse;
  onNavigate: (route: string) => void;
  onLogout: () => void;
}) {
  return (
    <Screen title={`Ola, ${me.member_name || me.first_name}`}>
      <Card>
        <Text style={styles.meta}>Igreja: {me.church_name || "Sem igreja"}</Text>
        <Text style={styles.meta}>Perfil: {me.role}</Text>
      </Card>
      <View style={styles.grid}>
        {actions.map((action) => (
          <Pressable key={action.key} style={styles.action} onPress={() => onNavigate(action.key)}>
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onLogout}>
        <Text style={styles.logout}>Sair</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    color: "#5f5148",
  },
  grid: {
    gap: 12,
  },
  action: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e7dccd",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3f2f24",
  },
  logout: {
    textAlign: "center",
    color: "#8a3c2d",
    fontWeight: "700",
    marginTop: 8,
  },
});
