import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { Contribution } from "@/types/api";

export function StatementScreen() {
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.get<Contribution[]>("/me/statement/"));
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar o extrato"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen title="Meu Extrato">
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {items.map((item) => (
        <Card key={item.id}>
          <Text>Categoria: {item.category}</Text>
          <Text>Valor: R$ {item.amount}</Text>
          <Text>Data: {item.contribution_date}</Text>
          <Text>Status: {item.status}</Text>
          <Text>Anexos: {item.attachments.length}</Text>
        </Card>
      ))}
      {loading ? <Text>Carregando...</Text> : null}
      {!loading && !error && !items.length ? <Text>Nenhuma contribuicao encontrada.</Text> : null}
    </Screen>
  );
}
