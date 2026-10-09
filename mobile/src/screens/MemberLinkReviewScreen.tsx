import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { ErrorNotice } from "@/components/ErrorNotice";
import { PaginationControls } from "@/components/PaginationControls";
import { useToast } from "@/components/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { MemberLinkRequest } from "@/types/api";
import { colors, statusLabel } from "@/theme";

type Request = MemberLinkRequest & { user_id: number; requester_name: string; requester_email: string; candidate_member: number | null; candidate_name: string | null; reviewer_name: string | null };
type Candidate = { id: number; full_name: string; email: string; status: string };

export function MemberLinkReviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { me } = useAuth();
  const { reload } = useNotifications();
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<Request[]>([]);
  const [item, setItem] = useState<Request | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState<"approved" | "rejected" | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 25, count: 0, hasNext: false, hasPrevious: false });
  const submitting = useRef(false);
  const sequence = useRef(0);
  const load = useCallback(async (page = 1) => {
    const generation = ++sequence.current;
    setLoading(true); setError(null);
    setItem(null); setCandidates([]); setCandidate(null); setConfirm(null);
    if (!id) setItems([]);
    try {
      if (id) {
        const result = await api.get<Request>(`/member-link-requests/${id}/`);
        if (generation !== sequence.current) return;
        setItem(result); setCandidate(null); setConfirm(null);
        if (result.status === "pending") {
          const matches = await api.get<Candidate[]>(`/member-link-requests/${id}/candidates/`);
          if (generation === sequence.current) setCandidates(matches);
        }
      } else {
        const result = await api.getPage<Request>(`/member-link-requests/?status=${status}`, page);
        if (generation === sequence.current) { setItems(result.items); setPageInfo(result); }
      }
    } catch (err) { if (generation === sequence.current) setError(describeError(err, "Não foi possível carregar as solicitações")); }
    finally { if (generation === sequence.current) setLoading(false); }
  }, [id, status]);
  useFocusEffect(useCallback(() => { void load(); return () => { sequence.current += 1; }; }, [load]));

  async function searchCandidates() {
    setBusy(true); setError(null);
    try { setCandidates(await api.get<Candidate[]>(`/member-link-requests/${id}/candidates/?search=${encodeURIComponent(search)}`)); }
    catch (err) { setError(describeError(err, "Não foi possível buscar os cadastros")); }
    finally { setBusy(false); }
  }
  async function decide() {
    if (!item || !confirm || submitting.current) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      const updated = await api.post<Request>(`/member-link-requests/${item.id}/review/`, {
        decision: confirm, candidate_member: candidate?.id, review_notes: notes,
      });
      setItem(updated); setConfirm(null);
      toast(confirm === "approved" ? "Vínculo aprovado. O solicitante foi notificado." : "Solicitação rejeitada. O solicitante foi notificado.", { title: "Revisão concluída", tone: "success" });
      void reload().catch(() => undefined);
    } catch (err) {
      setError(describeError(err, "Não foi possível concluir a revisão. Atualize para conferir a situação atual."));
      setConfirm(null);
    } finally { submitting.current = false; setBusy(false); }
  }
  return <Screen title={id ? "Revisar vínculo cadastral" : "Solicitações de vínculo"} headerSubtitle="Conferência manual de contas e cadastros da igreja">
    {error ? <ErrorNotice title={error.title} message={error.message} onRetry={() => void load()} /> : null}
    {loading ? <Text>Carregando solicitações…</Text> : null}
    {!id ? <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[["pending", "Pendentes"], ["approved", "Aprovadas"], ["rejected", "Rejeitadas"]].map(([value, label]) => <Button key={value} size="compact" variant={status === value ? "primary" : "secondary"} onPress={() => setStatus(value)}>{label}</Button>)}
      </View>
      {!loading && !error && !items.length ? <Text>Nenhuma solicitação nesta situação.</Text> : null}
      {items.map(row => <Card key={row.id} onPress={() => router.push(`/member-link-requests/${row.id}` as never)}>
        <Text style={{ color: colors.ink, fontWeight: "700" }}>{row.requester_name}</Text>
        <Text>{row.requester_email}</Text><Text>{statusLabel(row.status)} · {new Date(row.created_at).toLocaleString("pt-BR")}</Text>
      </Card>)}
      <PaginationControls {...pageInfo} disabled={loading} onPageChange={page => void load(page)} />
    </> : item ? <>
      <Button variant="ghost" onPress={() => router.push("/member-link-requests" as never)}>Voltar às solicitações</Button>
      <Card><Text style={{ fontWeight: "700" }}>{item.requester_name}</Text><Text>{item.requester_email}</Text>
        <Text>Solicitada em {new Date(item.created_at).toLocaleString("pt-BR")}</Text><Text>Situação: {statusLabel(item.status)}</Text>
        {item.candidate_name ? <Text>Cadastro sugerido: {item.candidate_name}. Confira a identidade antes de aprovar.</Text> : null}
        {item.reviewed_at ? <Text>Revisada por {item.reviewer_name} em {new Date(item.reviewed_at).toLocaleString("pt-BR")}</Text> : null}
        {item.review_notes ? <Text>Observações: {item.review_notes}</Text> : null}
      </Card>
      {item.status === "pending" ? <>
        <Text>Selecione um cadastro existente. O vínculo não altera cargos nem permissões.</Text>
        <Field accessibilityLabel="Buscar cadastro de membro" placeholder="Nome ou e-mail do membro" value={search} onChangeText={setSearch} />
        <Button variant="secondary" loading={busy} onPress={() => void searchCandidates()}>Buscar cadastros</Button>
        {!candidates.length && !loading ? <Text>Nenhum cadastro disponível. Cadastre a pessoa na área de membros antes de aprovar.</Text> : null}
        {candidates.map(row => <Card key={row.id} onPress={busy ? undefined : () => { setCandidate(row); setConfirm(null); }}>
          <Text>{candidate?.id === row.id ? "Selecionado: " : "Selecionar: "}{row.full_name}</Text><Text>{row.email || "Sem e-mail"}</Text>
        </Card>)}
        <Field accessibilityLabel="Motivo ou observações" placeholder="Motivo da rejeição ou observações" multiline value={notes} onChangeText={value => { setNotes(value); setConfirm(null); }} maxLength={2000} />
        <Button disabled={!candidate || busy} onPress={() => setConfirm("approved")}>Aprovar vínculo</Button>
        <Button variant="secondary" disabled={!notes.trim() || busy} onPress={() => setConfirm("rejected")}>Rejeitar solicitação</Button>
        {confirm ? <Card>
          <Text>{item.user_id === me?.id ? "Você está revisando sua própria solicitação. " : ""}{confirm === "approved" ? `Confirmar vínculo de ${item.requester_name} ao cadastro ${candidate?.full_name}?` : "Confirmar rejeição com o motivo informado?"}</Text>
          <Button loading={busy} onPress={() => void decide()}>Confirmar {confirm === "approved" ? "aprovação" : "rejeição"}</Button>
          <Button variant="ghost" disabled={busy} onPress={() => setConfirm(null)}>Cancelar</Button>
        </Card> : null}
      </> : null}
    </> : null}
  </Screen>;
}
