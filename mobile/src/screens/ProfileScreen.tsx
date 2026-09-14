import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { MemberProfile } from "@/types/api";

export function ProfileScreen() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await api.get<MemberProfile>("/me/member/"));
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar o perfil"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen title="Meu Perfil">
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {profile ? (
        <Card>
          <Text>Nome: {profile.full_name}</Text>
          <Text>Celula: {profile.cell_name || "Nao vinculada"}</Text>
          <Text>Telefone: {profile.phone || "-"}</Text>
          <Text>E-mail: {profile.email || "-"}</Text>
          <Text>Ministerios: {profile.ministry_names.join(", ") || "-"}</Text>
          <Text>Status: {profile.status}</Text>
        </Card>
      ) : null}
      {loading ? <Text>Carregando...</Text> : null}
    </Screen>
  );
}
