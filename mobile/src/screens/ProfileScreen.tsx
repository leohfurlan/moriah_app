import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Badge, Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { MemberProfile, MemberUpdateRequest } from "@/types/api";
import { colors, formatDate, spacing, statusLabel } from "@/theme";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "-"}</Text>
    </View>
  );
}

function AccountLink({ title, subtitle, onPress }: { title: string; subtitle: string; onPress?: () => void }) {
  const content = (
    <View style={styles.accountRow}>
      <View style={styles.accountCopy}>
        <Text style={styles.accountTitle}>{title}</Text>
        <Text style={styles.accountSubtitle}>{subtitle}</Text>
      </View>
      {onPress ? <Text style={styles.accountArrow}>›</Text> : null}
    </View>
  );
  return onPress ? <Card onPress={onPress}>{content}</Card> : <Card>{content}</Card>;
}


function DesktopProfile({
  profile,
  requests,
  phone,
  address,
  setPhone,
  setAddress,
  submitting,
  submitUpdateRequest,
  onNotifications,
}: {
  profile: MemberProfile;
  requests: MemberUpdateRequest[];
  phone: string;
  address: string;
  setPhone: (value: string) => void;
  setAddress: (value: string) => void;
  submitting: boolean;
  submitUpdateRequest: () => void;
  onNotifications: () => void;
}) {
  const initials = profile.full_name.split(" ").slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
  return (
    <View style={styles.desktopProfileCard}>
      <View style={styles.desktopProfileHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.headerCol}>
          <Text style={styles.name}>{profile.preferred_name || profile.full_name}</Text>
          <Text style={styles.meta}>{profile.email}</Text>
        </View>
        <Badge label={statusLabel(profile.status)} tone="neutral" />
        <Button size="compact" variant="ghost" onPress={onNotifications}>Notificações</Button>
      </View>

      <View style={styles.desktopProfileSummary}>
        <View style={styles.profileSummaryCell}><Text style={styles.profileSummaryLabel}>Membro desde</Text><Text style={styles.profileSummaryValue}>{profile.joined_at ? formatDate(profile.joined_at) : "-"}</Text></View>
        <View style={styles.profileSummaryCell}><Text style={styles.profileSummaryLabel}>Telefone</Text><Text style={styles.profileSummaryValue}>{profile.phone || "-"}</Text></View>
        <View style={styles.profileSummaryCell}><Text style={styles.profileSummaryLabel}>Ministérios</Text><Text style={styles.profileSummaryValue}>{profile.ministry_names.join(" · ") || "Nenhum vínculo"}</Text></View>
        <View style={styles.profileSummaryCell}><Text style={styles.profileSummaryLabel}>Célula</Text><Text style={styles.profileSummaryValue}>{profile.cell_name || "Não vinculada"}</Text></View>
      </View>

      <View style={styles.profileTabs}><Text style={styles.profileTabActive}>Dados pessoais</Text><Text style={styles.profileTab}>Vida na igreja</Text><Text style={styles.profileTab}>Solicitações</Text></View>

      <View style={styles.profileColumns}>
        <View style={styles.profileColumn}>
          <Text style={styles.profileSectionTitle}>Dados pessoais</Text>
          <View style={styles.profileInfoCard}>
            <Row label="Nome completo" value={profile.full_name} />
            <Row label="Nome preferido" value={profile.preferred_name} />
            <Row label="E-mail" value={profile.email} />
            <Row label="Telefone" value={profile.phone} />
            <Row label="Endereço" value={profile.address} />
            {profile.birth_date ? <Row label="Nascimento" value={formatDate(profile.birth_date)} /> : null}
          </View>
          <Text style={styles.profileSectionTitle}>Vida na igreja</Text>
          <View style={styles.profileInfoCard}>
            <Row label="Célula" value={profile.cell_name || "Não vinculada"} />
            <Row label="Ministérios" value={profile.ministry_names.join(", ")} />
          </View>
        </View>

        <View style={styles.profileColumn}>
          <Text style={styles.profileSectionTitle}>Solicitar alteração</Text>
          <View style={styles.profileInfoCard}>
            <Text style={styles.profileHelp}>Envie uma solicitação para a secretaria revisar seus dados cadastrais.</Text>
            <Field value={phone} onChangeText={setPhone} placeholder="Telefone" />
            <Field value={address} onChangeText={setAddress} placeholder="Endereço" multiline />
            <Button loading={submitting} disabled={submitting} onPress={submitUpdateRequest}>Enviar para a secretaria</Button>
            {requests.length ? <Text style={styles.meta}>Última solicitação: {statusLabel(requests[0].status)}</Text> : null}
          </View>
          <Text style={styles.profileSectionTitle}>Atalhos</Text>
          <View style={styles.profileInfoCard}>
            <Text style={styles.profileShortcut}>Minhas contribuições</Text>
            <Text style={styles.profileShortcutMeta}>Acesse seu histórico financeiro pelo menu Financeiro.</Text>
            <Text style={styles.profileShortcut}>Minhas escalas</Text>
            <Text style={styles.profileShortcutMeta}>Acompanhe convites e participações nos ministérios.</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [requests, setRequests] = useState<MemberUpdateRequest[]>([]);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [member, memberRequests] = await Promise.all([
        api.get<MemberProfile>("/me/member/"),
        api.get<MemberUpdateRequest[]>("/me/member-requests/"),
      ]);
      setProfile(member);
      setRequests(memberRequests);
      setPhone(member.phone);
      setAddress(member.address);
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

  async function submitUpdateRequest() {
    const requested_changes: Record<string, string> = {};
    if (profile && phone !== profile.phone) requested_changes.phone = phone;
    if (profile && address !== profile.address) requested_changes.address = address;
    if (!Object.keys(requested_changes).length) {
      Alert.alert("Nenhuma alteracao", "Altere telefone ou endereco antes de enviar.");
      return;
    }
    setSubmitting(true);
    try {
      const request = await api.post<MemberUpdateRequest>("/me/member-requests/", { requested_changes });
      setRequests((current) => [request, ...current]);
      Alert.alert("Solicitacao enviada", "A secretaria revisara seus dados.");
    } catch (err) {
      const result = describeError(err, "Nao foi possivel enviar");
      Alert.alert(result.title, result.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      title="Meu perfil"
      headerSubtitle="Seus dados, vínculos e atalhos pessoais"
      refreshing={refreshing}
      onRefresh={load}
      headerAccessory={<Button size="compact" variant="ghost" onPress={() => router.push("/notifications" as never)}>Notificações</Button>}
    >
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}

      {desktop && profile ? <DesktopProfile profile={profile} requests={requests} phone={phone} address={address} setPhone={setPhone} setAddress={setAddress} submitting={submitting} submitUpdateRequest={submitUpdateRequest} onNotifications={() => router.push("/notifications" as never)} /> : profile ? (
        <>
          <Card>
            <View style={styles.header}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.full_name.split(" ").slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?"}
                </Text>
              </View>
              <View style={styles.headerCol}>
                <Text style={styles.name}>{profile.preferred_name || profile.full_name}</Text>
                <Text style={styles.meta}>{profile.joined_at ? "Membro desde " + formatDate(profile.joined_at) : profile.full_name}</Text>
              </View>
              <Badge label={statusLabel(profile.status)} tone="neutral" />
            </View>
          </Card>

          <Text accessibilityRole="header" style={styles.sectionTitle}>Minha conta</Text>
          <AccountLink title="Dados pessoais" subtitle="Telefone, e-mail e endereço" />
          <AccountLink title="Minha família" subtitle="Vínculos familiares" />
          <AccountLink title="Meus ministérios" subtitle={profile.ministry_names.join(" · ") || "Nenhum ministério vinculado"} />
          <AccountLink title="Minhas contribuições" subtitle="Ver histórico" onPress={() => router.push("/statement" as never)} />

          <Text accessibilityRole="header" style={styles.sectionTitle}>Dados pessoais</Text>
          <Card>
            <Row label="Telefone" value={profile.phone} />
            <Row label="E-mail" value={profile.email} />
            <Row label="Endereço" value={profile.address} />
          </Card>

          <Text accessibilityRole="header" style={styles.sectionTitle}>Solicitar alteração</Text>
          <Card>
            <Field value={phone} onChangeText={setPhone} placeholder="Telefone" />
            <Field value={address} onChangeText={setAddress} placeholder="Endereço" multiline />
            <Button loading={submitting} disabled={submitting} onPress={submitUpdateRequest}>Enviar para a secretaria</Button>
            {requests.length ? <Text style={styles.meta}>Última solicitação: {statusLabel(requests[0].status)}</Text> : null}
          </Card>

          <Text accessibilityRole="header" style={styles.sectionTitle}>Vida na igreja</Text>
          <Card>
            <Row label="Célula" value={profile.cell_name || "Não vinculada"} />
            <Row label="Ministérios" value={profile.ministry_names.join(", ")} />
            {profile.birth_date ? <Row label="Nascimento" value={formatDate(profile.birth_date)} /> : null}
          </Card>
        </>
      ) : me ? (
        <Card>
          <Text style={styles.name}>{me.first_name || me.email}</Text>
          <Text style={styles.meta}>Esta conta administrativa ainda não possui um cadastro de membro completo.</Text>
          <Row label="E-mail" value={me.email} />
        </Card>
      ) : null}

      {loading && !profile && !error ? <Text style={styles.meta}>Carregando…</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceSelected, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontWeight: "800", color: colors.accent },
  headerCol: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 13, color: colors.inkMuted },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.md, marginBottom: spacing.xs },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.lg },
  rowLabel: { fontSize: 13, color: colors.inkMuted, flexShrink: 0 },
  rowValue: { fontSize: 14, fontWeight: "600", color: colors.ink, textAlign: "right", flex: 1 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  accountCopy: { flex: 1, gap: 2 },
  accountTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  accountSubtitle: { color: colors.inkMuted, fontSize: 12 },
  accountArrow: { color: colors.accent, fontSize: 28, lineHeight: 28 },

  desktopProfileCard: { minHeight: 820, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" },
  desktopProfileHeader: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  desktopProfileSummary: { minHeight: 112, flexDirection: "row", alignItems: "center", paddingHorizontal: 24, backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  profileSummaryCell: { flex: 1, gap: 6, paddingRight: 18 },
  profileSummaryLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: "700" },
  profileSummaryValue: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  profileTabs: { height: 44, flexDirection: "row", alignItems: "center", gap: 26, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.borderDivider },
  profileTab: { color: colors.inkMuted, fontSize: 12, fontWeight: "600" },
  profileTabActive: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  profileColumns: { flexDirection: "row", gap: 22, padding: 24 },
  profileColumn: { flex: 1, gap: 10 },
  profileSectionTitle: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 4 },
  profileInfoCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16, gap: 14, backgroundColor: colors.surface },
  profileHelp: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 },
  profileShortcut: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  profileShortcutMeta: { color: colors.inkMuted, fontSize: 11, lineHeight: 16, marginBottom: 5 },
});