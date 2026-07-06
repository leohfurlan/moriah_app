import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";

import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { ScheduleAssignment } from "@/types/api";

export function SchedulesScreen() {
  const [items, setItems] = useState<ScheduleAssignment[]>([]);
  const [justifications, setJustifications] = useState<Record<number, string>>({});

  async function load() {
    const data = await api.get<ScheduleAssignment[]>("/me/schedules/");
    setItems(data);
  }

  async function act(id: number, action: "confirm" | "decline") {
    await api.post(`/me/schedules/${id}/action/`, {
      action,
      justification: justifications[id] || "",
    });
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen title="Minha Escala">
      {items.map((item) => (
        <Card key={item.id}>
          <Text>{item.event_name}</Text>
          <Text>{item.schedule_name}</Text>
          <Text>
            {item.ministry_name} / {item.role_name}
          </Text>
          <Text>Status: {item.status}</Text>
          <Text>Data: {new Date(item.event_start_at).toLocaleString()}</Text>
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
                  Alert.alert("Erro", String(error));
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
                  Alert.alert("Erro", String(error));
                }
              }}
            >
              Recusar
            </Button>
          </View>
        </Card>
      ))}
      {!items.length ? <Text>Nenhuma escala encontrada.</Text> : null}
    </Screen>
  );
}
