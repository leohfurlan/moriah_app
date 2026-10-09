import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Card, Field } from "@/components/Form";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { colors, statusLabel } from "@/theme";
import { MemberProfile } from "@/types/api";

export function PeopleDirectoryScreen({ kind }: { kind: "members" | "visitors" }) {
  const isVisitor = kind === "visitors";
  const [items, setItems] = useState<MemberProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.get<MemberProfile[]>(`/members/?status=${isVisitor ? "visitor" : "active"}`));
    } catch (failure) {
      setError(describeError(failure, "Não foi possível carregar a lista"));
    } finally {
      setLoading(false);
    }
  }, [isVisitor]);

  useEffect(() => { void load(); }, [load]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => [item.full_name, item.email, item.phone].some((value) => value?.toLocaleLowerCase().includes(normalized)));
  }, [items, query]);

  return (
    <Screen
      title={isVisitor ? "Visitantes" : "Membros"}
      headerSubtitle={isVisitor ? "Pessoas que visitam a Igreja Moriah" : "Cadastro de membros da Igreja Moriah"}
      refreshing={loading}
      onRefresh={() => void load()}
    >
      <View style={styles.toolbar}>
        <Field value={query} onChangeText={setQuery} placeholder={isVisitor ? "Buscar visitante" : "Buscar membro"} />
        <Text style={styles.count}>{filteredItems.length} {isVisitor ? "visitante(s)" : "membro(s)"}</Text>
      </View>
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.meta}>Carregando…</Text></View> : null}
      {!loading && !error && filteredItems.length ? filteredItems.map((item) => (
        <Card key={item.id} style={styles.personCard}>
          <View style={styles.personCopy}>
            <Text style={styles.name}>{item.preferred_name || item.full_name}</Text>
            <Text style={styles.meta}>{item.email || "Sem e-mail"}{item.phone ? ` · ${item.phone}` : ""}</Text>
            <Text style={styles.meta}>{item.cell_name || "Sem célula"}{item.ministry_names.length ? ` · ${item.ministry_names.join(" · ")}` : ""}</Text>
          </View>
          <Text style={styles.status}>{statusLabel(item.status)}</Text>
        </Card>
      )) : null}
      {!loading && !error && !filteredItems.length ? <Card><Text style={styles.meta}>{query ? "Nenhum cadastro corresponde à busca." : `Nenhum ${isVisitor ? "visitante" : "membro"} cadastrado.`}</Text></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: 8, marginBottom: 8 },
  count: { color: colors.inkMuted, fontSize: 12 },
  loading: { alignItems: "center", gap: 8, padding: 24 },
  personCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  personCopy: { flex: 1, gap: 4 },
  name: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  meta: { color: colors.inkMuted, fontSize: 12 },
  status: { color: colors.accent, fontSize: 11, fontWeight: "700" },
});
