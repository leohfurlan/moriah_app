import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Badge, Button, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ScheduleAdminItem, ScheduleStatus } from "@/types/api";
import { colors, formatDate, radius, spacing, statusLabel } from "@/theme";

type Filtro = "todos" | ScheduleStatus;

const FILTROS: Array<{ id: Filtro; label: string; vazio: string }> = [
  { id: "todos", label: "Todas", vazio: "Nenhuma escala cadastrada ainda." },
  { id: "draft", label: "Rascunhos", vazio: "Nenhum rascunho pendente." },
  { id: "published", label: "Publicadas", vazio: "Nenhuma escala publicada." },
  { id: "cancelled", label: "Canceladas", vazio: "Nenhuma escala cancelada." },
];

function tomDoStatus(status: ScheduleStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "draft") return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
}

export function ScheduleAdminScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [escalas, setEscalas] = useState<ScheduleAdminItem[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const consulta = filtro === "todos" ? "" : `?status=${filtro}`;
      setEscalas(await api.get<ScheduleAdminItem[]>(`/schedules/${consulta}`));
    } catch (err) {
      setError(describeError(err, "Não foi possível carregar as escalas"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtro]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  const filtroAtual = FILTROS.find((item) => item.id === filtro) ?? FILTROS[0];

  return (
    <Screen
      title="Gestão de escalas"
      headerSubtitle="Monte a equipe, publique e acompanhe as respostas"
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerAccessory={
        <Button size="compact" onPress={() => router.push("/schedule-create" as never)}>
          Nova escala
        </Button>
      }
    >
      <View style={styles.filtros}>
        {FILTROS.map((opcao) => {
          const ativo = opcao.id === filtro;
          return (
            <Pressable
              key={opcao.id}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar: ${opcao.label}`}
              accessibilityState={{ selected: ativo }}
              onPress={() => setFiltro(opcao.id)}
              style={({ pressed }) => [styles.filtro, ativo && styles.filtroAtivo, pressed && styles.pressed]}
            >
              <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>{opcao.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {loading && !escalas.length ? <Text style={styles.meta}>Carregando escalas…</Text> : null}

      {!error && !loading && !escalas.length ? (
        <Card>
          <Text style={styles.vazioTitulo}>Nenhuma escala por aqui</Text>
          <Text style={styles.meta}>{filtroAtual.vazio} Use "Nova escala" para criar o evento e montar a equipe.</Text>
        </Card>
      ) : null}

      <View style={desktop ? styles.lista : undefined}>
        {escalas.map((escala) => (
          <Card
            key={escala.id}
            onPress={() => router.push({ pathname: "/schedule-admin/[id]", params: { id: escala.id } } as never)}
            style={desktop ? styles.linha : undefined}
          >
            <View style={styles.linhaCabecalho}>
              <View style={styles.linhaTexto}>
                <Text style={styles.nomeEscala}>{escala.name}</Text>
                <Text style={styles.meta}>
                  {escala.ministry_name || "Sem ministério"} · {escala.event_name}
                </Text>
                <Text style={styles.meta}>
                  {formatDate(escala.event_start_at, true)}
                  {escala.event_location ? ` · ${escala.event_location}` : ""}
                </Text>
              </View>
              <View style={styles.linhaLado}>
                <Badge label={statusLabel(escala.status)} tone={tomDoStatus(escala.status)} />
                <Text style={styles.contagem}>
                  {escala.counts.total} {escala.counts.total === 1 ? "integrante" : "integrantes"}
                </Text>
              </View>
            </View>
            <Text style={styles.resumo}>
              {escala.counts.confirmed} confirmados · {escala.counts.pending} pendentes
              {escala.counts.declined ? ` · ${escala.counts.declined} recusas` : ""}
              {escala.counts.replacement_needed ? ` · ${escala.counts.replacement_needed} substituição pendente` : ""}
            </Text>
            <Text style={styles.gerenciar}>Gerenciar equipe e publicação →</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  filtro: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  filtroAtivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  filtroTexto: { color: colors.inkBody, fontSize: 13, fontWeight: "700" },
  filtroTextoAtivo: { color: colors.onAccent },
  pressed: { opacity: 0.85 },
  lista: { gap: spacing.md },
  linha: { gap: spacing.xs },
  linhaCabecalho: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  linhaTexto: { flex: 1, gap: 2 },
  linhaLado: { alignItems: "flex-end", gap: spacing.xs },
  nomeEscala: { fontSize: 16, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 13, color: colors.inkMuted },
  contagem: { fontSize: 12, fontWeight: "700", color: colors.inkBody },
  resumo: { fontSize: 12, color: colors.inkMuted },
  gerenciar: { fontSize: 13, fontWeight: "700", color: colors.accent },
  vazioTitulo: { fontSize: 16, fontWeight: "800", color: colors.ink },
});
