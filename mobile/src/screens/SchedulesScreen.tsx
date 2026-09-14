import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ScheduleAssignment } from "@/types/api";

export function SchedulesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ScheduleAssignment[]>([]);
  const [justifications, setJustifications] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.get<ScheduleAssignment[]>("/me/schedules/"));
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar suas escalas"));
    } finally {
      setLoading(false);
    }
  }, []);

  async function act(id: number, action: "confirm" | "decline") {
    await api.post(`/me/schedules/${id}/action/`, {
      action,
      justification: justifications[id] || "",
    });
    await load();
  }

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen title="Minha Escala">
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {items.map((item) => (
        <Card key={item.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Abre o detalhe da escala com equipe e repertorio"
            onPress={() => router.push({ pathname: "/schedule/[id]", params: { id: item.id } })}
          >
            <Text style={styles.eventName}>{item.event_name}</Text>
            <Text>{item.schedule_name}</Text>
            <Text>
              {item.ministry_name} / {item.role_name}
            </Text>
            <Text>Status: {item.status}</Text>
            <Text>Data: {new Date(item.event_start_at).toLocaleString()}</Text>
            <Text style={styles.link}>Ver equipe e repertorio</Text>
          </Pressable>
          <Field
            value={justifications[item.id] || ""}
            onChangeText={(value) => setJustifications((current) => ({ ...current, [item.id]: value }))}
            placeholder="Justificativa para recusa"
          />
          <View style={{ gap: 8 }}>
            <Button
              onPress={async () => {
                try {
                  await act(item.id, "confirm");
                } catch (error) {
                  const { title, message } = describeError(error, "Nao foi possivel confirmar");
                  Alert.alert(title, message);
                }
              }}
            >
              Confirmar
            </Button>
            <Button
              variant="secondary"
              onPress={async () => {
                try {
                  await act(item.id, "decline");
                } catch (error) {
                  const { title, message } = describeError(error, "Nao foi possivel recusar");
                  Alert.alert(title, message);
                }
              }}
            >
              Recusar
            </Button>
          </View>
        </Card>
      ))}
      {loading ? <Text>Carregando...</Text> : null}
      {!loading && !error && !items.length ? <Text>Nenhuma escala encontrada.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eventName: {
    fontWeight: "700",
    color: "#3f2f24",
  },
  link: {
    marginTop: 6,
    color: "#7a4d2d",
    fontWeight: "700",
  },
});
