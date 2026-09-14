import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Badge, Card } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { MemberProfile } from "@/types/api";
import { colors, formatDate, spacing, statusLabel } from "@/theme";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "-"}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProfile(await api.get<MemberProfile>("/me/member/"));
    } catch (err) {
      setError(describeError(err, "Nao foi possivel carregar o perfil"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  return (
    <Screen title="Meu Perfil" refreshing={refreshing} onRefresh={onRefresh}>
        {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}

        {profile ? (
          <>
            <Card>
              <View style={styles.header}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {profile.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0] || "")
                      .join("")
                      .toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.headerCol}>
                  <Text style={styles.name}>{profile.preferred_name || profile.full_name}</Text>
                  <Text style={styles.meta}>{profile.full_name}</Text>
                </View>
                <Badge label={statusLabel(profile.status)} tone="neutral" />
              </View>
            </Card>

            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Contato
            </Text>
            <Card>
              <Row label="Telefone" value={profile.phone} />
              <Row label="E-mail" value={profile.email} />
              {profile.address ? <Row label="Endereco" value={profile.address} /> : null}
            </Card>

            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Vida na igreja
            </Text>
            <Card>
              <Row label="Celula" value={profile.cell_name || "Nao vinculada"} />
              <Row label="Ministerios" value={profile.ministry_names.join(", ")} />
              {profile.birth_date ? <Row label="Nascimento" value={formatDate(profile.birth_date)} /> : null}
              {profile.joined_at ? <Row label="Membro desde" value={formatDate(profile.joined_at)} /> : null}
            </Card>
          </>
        ) : null}

        {loading && !profile && !error ? <Text style={styles.meta}>Carregando…</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSelected,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.accent,
  },
  headerCol: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
  },
  meta: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.lg,
  },
  rowLabel: {
    fontSize: 13,
    color: colors.inkMuted,
    flexShrink: 0,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "right",
    flex: 1,
  },
});
