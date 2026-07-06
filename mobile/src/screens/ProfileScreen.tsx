import { useEffect, useState } from "react";
import { Text } from "react-native";

import { Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { MemberProfile } from "@/types/api";

export function ProfileScreen() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);

  useEffect(() => {
    api.get<MemberProfile>("/me/member/").then(setProfile);
  }, []);

  return (
    <Screen title="Meu Perfil">
      {profile ? (
        <Card>
          <Text>Nome: {profile.full_name}</Text>
          <Text>Celula: {profile.cell_name || "Nao vinculada"}</Text>
          <Text>Telefone: {profile.phone || "-"}</Text>
          <Text>E-mail: {profile.email || "-"}</Text>
          <Text>Ministerios: {profile.ministry_names.join(", ") || "-"}</Text>
          <Text>Status: {profile.status}</Text>
        </Card>
      ) : (
        <Text>Carregando...</Text>
      )}
    </Screen>
  );
}
