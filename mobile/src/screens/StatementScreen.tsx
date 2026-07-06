import { useEffect, useState } from "react";
import { Text } from "react-native";

import { Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { Contribution } from "@/types/api";

export function StatementScreen() {
  const [items, setItems] = useState<Contribution[]>([]);

  useEffect(() => {
    api.get<Contribution[]>("/me/statement/").then(setItems);
  }, []);

  return (
    <Screen title="Meu Extrato">
      {items.map((item) => (
        <Card key={item.id}>
          <Text>Categoria: {item.category}</Text>
          <Text>Valor: R$ {item.amount}</Text>
          <Text>Data: {item.contribution_date}</Text>
          <Text>Status: {item.status}</Text>
          <Text>Anexos: {item.attachments.length}</Text>
        </Card>
      ))}
      {!items.length ? <Text>Nenhuma contribuicao encontrada.</Text> : null}
    </Screen>
  );
}
