import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { ErrorNotice } from "@/components/ErrorNotice";
import { InlineNotice, useToast } from "@/components/Feedback";
import { Badge, Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { ScheduleAdminDetail, ScheduleAdminTeamMember, ScheduleCandidate } from "@/types/api";
import { colors, formatDate, radius, spacing } from "@/theme";
import { paraIso, paraTextoBr } from "./ScheduleCreateScreen";

function tomDaSituacao(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "confirmed") return "success";
  if (status === "declined" || status === "conflict") return "danger";
  if (status === "pending" || status === "replacement_needed") return "warning";
  return "neutral";
}

function tomDoStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "draft") return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
}

/** Ficha de contato do integrante, sem inventar campo que a API nao traz. */
function contato(membro: ScheduleAdminTeamMember): string {
  return [membro.member_email, membro.member_phone].filter(Boolean).join(" · ");
}

type Painel = { tipo: "adicionar" } | { tipo: "substituir"; membro: ScheduleAdminTeamMember } | null;

export function ScheduleAdminDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const toast = useToast();
  const [detail, setDetail] = useState<ScheduleAdminDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<UserFacingError | null>(null);
  const [painel, setPainel] = useState<Painel>(null);
  const [candidatos, setCandidatos] = useState<ScheduleCandidate[]>([]);
  const [carregandoCandidatos, setCarregandoCandidatos] = useState(false);
  const [funcaoId, setFuncaoId] = useState<number | null>(null);
  const [candidatoId, setCandidatoId] = useState<number | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ name: "", notes: "", event_name: "", event_location: "", event_start_at: "" });

  const load = useCallback(async () => {
    setErro(null);
    try {
      const dados = await api.get<ScheduleAdminDetail>(`/schedules/${id}/`);
      setDetail(dados);
      setForm({
        name: dados.name,
        notes: dados.notes || "",
        event_name: dados.event_name,
        event_location: dados.event_location || "",
        event_start_at: paraTextoBr(new Date(dados.event_start_at)),
      });
      setFuncaoId((atual) => atual ?? dados.ministry_roles[0]?.id ?? null);
    } catch (error) {
      setErro(describeError(error, "Não foi possível carregar a escala"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const candidatoEscolhido = useMemo(
    () => candidatos.find((item) => item.id === candidatoId) ?? null,
    [candidatos, candidatoId],
  );

  async function abrirPainel(proximo: Painel) {
    if (!proximo) {
      setPainel(null);
      return;
    }
    setPainel(proximo);
    setFuncaoId(proximo.tipo === "substituir" ? proximo.membro.role_id : detail?.ministry_roles[0]?.id ?? null);
    setCandidatoId(null);
    setJustificativa("");
    setCarregandoCandidatos(true);
    try {
      setCandidatos(await api.get<ScheduleCandidate[]>(`/schedules/${id}/candidates/`));
    } catch (error) {
      const { title, message } = describeError(error, "Não foi possível carregar os candidatos");
      toast(message, { tone: "error", title });
      setCandidatos([]);
    } finally {
      setCarregandoCandidatos(false);
    }
  }

  /** Executa uma acao da gestao, recarrega o detalhe e avisa o usuario. */
  async function executar(acao: () => Promise<unknown>, sucesso: { title: string; message: string; tone?: "success" | "warning" }) {
    if (salvando || salvandoRef.current) return;
    salvandoRef.current = true;
    setSalvando(true);
    try {
      await acao();
      await load();
      toast(sucesso.message, { tone: sucesso.tone || "success", title: sucesso.title });
      return true;
    } catch (error) {
      const { title, message } = describeError(error, "Não foi possível concluir a ação");
      toast(message, { tone: "error", title });
      return false;
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  async function publicar() {
    await executar(() => api.post(`/schedules/${id}/publish/`), {
      title: "Escala publicada",
      message: "A equipe escalada já pode confirmar presença.",
    });
  }

  async function cancelar() {
    await executar(() => api.post(`/schedules/${id}/cancel/`), {
      title: "Escala cancelada",
      message: "A escala saiu da agenda da equipe.",
    });
  }

  async function remover(membro: ScheduleAdminTeamMember) {
    await executar(() => api.delete(`/schedules/${id}/assignments/${membro.id}/`), {
      title: "Integrante removido",
      message: `${membro.member_name} saiu desta escala.`,
    });
  }

  async function salvarEdicao() {
    const inicio = paraIso(form.event_start_at);
    if (!inicio) {
      toast("Use o formato 20/12/2026 19:00 (dia/mês/ano e horário).", { tone: "error", title: "Data inválida" });
      return;
    }
    const ok = await executar(
      () =>
        api.patch(`/schedules/${id}/`, {
          name: form.name.trim(),
          notes: form.notes.trim(),
          event_name: form.event_name.trim(),
          event_location: form.event_location.trim(),
          event_start_at: inicio,
        }),
      { title: "Escala atualizada", message: "As alterações foram salvas." },
    );
    if (ok) setEditando(false);
  }

  async function confirmarEscalacao() {
    if (!candidatoId || !funcaoId) {
      toast("Escolha a função e o integrante.", { tone: "error", title: "Faltam dados" });
      return;
    }
    const conflito = candidatoEscolhido && !candidatoEscolhido.available;
    const ok = await executar(
      () =>
        api.post(`/schedules/${id}/assignments/`, {
          member_id: candidatoId,
          ministry_role_id: funcaoId,
          justification: justificativa.trim(),
        }),
      conflito
        ? {
            title: "Escalado com aviso de agenda",
            message: `${candidatoEscolhido?.full_name}: ${candidatoEscolhido?.conflict_reason || "conflito de agenda"}`,
            tone: "warning",
          }
        : { title: "Integrante escalado", message: "O integrante entrou na equipe desta escala." },
    );
    if (ok) {
      setPainel(null);
      setCandidatoId(null);
      setJustificativa("");
    }
  }

  async function confirmarSubstituicao() {
    if (!candidatoId || painel?.tipo !== "substituir") return;
    const alvo = painel.membro;
    const conflito = candidatoEscolhido && !candidatoEscolhido.available;
    const ok = await executar(
      () =>
        api.post(`/schedules/${id}/assignments/${alvo.id}/substitute/`, {
          member_id: candidatoId,
          ministry_role_id: funcaoId ?? alvo.role_id,
          justification: justificativa.trim(),
        }),
      conflito
        ? {
            title: "Substituição com aviso de agenda",
            message: `${candidatoEscolhido?.full_name}: ${candidatoEscolhido?.conflict_reason || "conflito de agenda"}`,
            tone: "warning",
          }
        : {
            title: "Substituição registrada",
            message: `${candidatoEscolhido?.full_name} assume no lugar de ${alvo.member_name}.`,
          },
    );
    if (ok) {
      setPainel(null);
      setCandidatoId(null);
      setJustificativa("");
    }
  }

  if (erro && !detail) {
    return (
      <Screen title="Escala">
        <ErrorNotice title={erro.title} message={erro.message} onRetry={load} />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen title="Escala">
        <Text style={styles.meta}>{loading ? "Carregando escala…" : "Escala não encontrada."}</Text>
      </Screen>
    );
  }

  const contagem = detail.counts;

  return (
    <Screen title="Gestão da escala" headerSubtitle="Equipe, publicação e histórico">
      {erro ? <ErrorNotice title={erro.title} message={erro.message} onRetry={load} /> : null}

      <Card>
        <View style={styles.cabecalho}>
          <View style={styles.cabecalhoTexto}>
            <Text style={styles.titulo}>{detail.name}</Text>
            <Text style={styles.meta}>
              {detail.ministry_name || "Sem ministério"} · {detail.event_name}
            </Text>
            <Text style={styles.meta}>
              {formatDate(detail.event_start_at, true)}
              {detail.event_location ? ` · ${detail.event_location}` : ""}
            </Text>
            {detail.created_by_name ? <Text style={styles.meta}>Criada por {detail.created_by_name}</Text> : null}
          </View>
          <Badge label={detail.status_display} tone={tomDoStatus(detail.status)} />
        </View>

        {detail.notes ? <Text style={styles.corpo}>{detail.notes}</Text> : null}

        <View style={styles.acoes}>
          {detail.can_publish ? (
            <View style={styles.acao}>
              <Button loading={salvando} disabled={salvando} onPress={publicar}>
                Publicar
              </Button>
            </View>
          ) : null}
          {detail.can_edit ? (
            <View style={styles.acao}>
              <Button variant="secondary" onPress={() => setEditando((atual) => !atual)}>
                {editando ? "Fechar edição" : "Editar"}
              </Button>
            </View>
          ) : null}
          {detail.can_cancel ? (
            <View style={styles.acao}>
              <Button variant="ghost" loading={salvando} disabled={salvando} onPress={cancelar}>
                Cancelar escala
              </Button>
            </View>
          ) : null}
        </View>
        {detail.status === "published" && !detail.can_publish ? (
          <Text style={styles.meta}>Escala publicada — a equipe já pode responder.</Text>
        ) : null}
        {detail.status === "cancelled" ? (
          <Text style={styles.meta}>Escala cancelada: não pode ser publicada nem editada.</Text>
        ) : null}
      </Card>

      {editando ? (
        <Card>
          <Text style={styles.secao}>Editar escala</Text>
          <Text style={styles.rotulo}>Nome da escala</Text>
          <Field accessibilityLabel="Editar nome da escala" value={form.name} onChangeText={(valor) => setForm((atual) => ({ ...atual, name: valor }))} />
          <Text style={styles.rotulo}>Evento da igreja</Text>
          <Field accessibilityLabel="Editar nome do evento" value={form.event_name} onChangeText={(valor) => setForm((atual) => ({ ...atual, event_name: valor }))} />
          <Text style={styles.rotulo}>Data e horário</Text>
          <Field accessibilityLabel="Editar data e horário do evento" value={form.event_start_at} onChangeText={(valor) => setForm((atual) => ({ ...atual, event_start_at: valor }))} placeholder="20/12/2026 19:00" />
          <Text style={styles.rotulo}>Local</Text>
          <Field accessibilityLabel="Editar local do evento" value={form.event_location} onChangeText={(valor) => setForm((atual) => ({ ...atual, event_location: valor }))} />
          <Text style={styles.rotulo}>Observações</Text>
          <Field accessibilityLabel="Editar observações" value={form.notes} onChangeText={(valor) => setForm((atual) => ({ ...atual, notes: valor }))} multiline />
          <Button loading={salvando} disabled={salvando} onPress={salvarEdicao}>
            Salvar alterações
          </Button>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.secao}>
          Equipe ({contagem.total} {contagem.total === 1 ? "integrante" : "integrantes"})
        </Text>
        <Text style={styles.meta}>
          {contagem.confirmed} confirmados · {contagem.pending} pendentes · {contagem.declined} recusas
          {contagem.conflict ? ` · ${contagem.conflict} em conflito` : ""}
          {contagem.replacement_needed ? ` · ${contagem.replacement_needed} precisando substituição` : ""}
        </Text>

        {detail.team.length ? (
          detail.team.map((membro) => (
            <View key={membro.id} style={styles.membro}>
              <View style={styles.membroTexto}>
                <Text style={styles.nomeMembro}>
                  {membro.member_name}
                  {membro.replaced_member_name ? ` (no lugar de ${membro.replaced_member_name})` : ""}
                </Text>
                <Text style={styles.meta}>
                  {membro.ministry_name} / {membro.role_name}
                </Text>
                {contato(membro) ? <Text style={styles.meta}>{contato(membro)}</Text> : null}
                {membro.conflict_reason ? <Text style={styles.aviso}>{membro.conflict_reason}</Text> : null}
                {membro.justification ? <Text style={styles.meta}>Justificativa: {membro.justification}</Text> : null}
              </View>
              <View style={styles.membroLado}>
                <Badge label={membro.status_display} tone={tomDaSituacao(membro.status)} />
                <View style={styles.acoesMembro}>
                  <Button
                    size="compact"
                    variant="ghost"
                    disabled={salvando}
                    onPress={() => abrirPainel({ tipo: "substituir", membro })}
                  >
                    Substituir
                  </Button>
                  <Button size="compact" variant="ghost" disabled={salvando} onPress={() => remover(membro)}>
                    Remover
                  </Button>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.meta}>Ninguém escalado ainda. Use "Adicionar integrante" para montar a equipe.</Text>
        )}

        <Button variant="secondary" onPress={() => abrirPainel(painel?.tipo === "adicionar" ? null : { tipo: "adicionar" })}>
          Adicionar integrante
        </Button>
      </Card>

      {painel ? (
        <Card>
          <Text style={styles.secao}>
            {painel.tipo === "adicionar" ? "Adicionar integrante" : `Substituir ${painel.membro.member_name}`}
          </Text>
          <Text style={styles.rotulo}>Função</Text>
          <View style={styles.chips}>
            {detail.ministry_roles.map((funcao) => {
              const ativa = funcao.id === funcaoId;
              return (
                <Pressable
                  key={funcao.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Função ${funcao.name}`}
                  accessibilityState={{ selected: ativa }}
                  onPress={() => setFuncaoId(funcao.id)}
                  style={({ pressed }) => [styles.chip, ativa && styles.chipAtivo, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipTexto, ativa && styles.chipTextoAtivo]}>
                    {funcao.name}
                    {funcao.is_filled ? " (preenchida)" : ""}
                  </Text>
                </Pressable>
              );
            })}
            {!detail.ministry_roles.length ? (
              <Text style={styles.meta}>Este ministério ainda não tem funções cadastradas.</Text>
            ) : null}
          </View>

          <Text style={styles.rotulo}>Candidatos</Text>
          {carregandoCandidatos ? <Text style={styles.meta}>Carregando candidatos…</Text> : null}
          {!carregandoCandidatos && !candidatos.length ? (
            <Text style={styles.meta}>Nenhum membro ativo disponível para escalar.</Text>
          ) : null}
          <View style={desktop ? styles.listaCandidatos : undefined}>
            {candidatos.map((candidato) => {
              const escolhido = candidato.id === candidatoId;
              return (
                <Pressable
                  key={candidato.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Escalar ${candidato.full_name}`}
                  accessibilityState={{ selected: escolhido }}
                  onPress={() => setCandidatoId(candidato.id)}
                  style={({ pressed }) => [
                    styles.candidato,
                    escolhido && styles.candidatoEscolhido,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.nomeCandidato}>{candidato.full_name}</Text>
                  <Text style={styles.meta}>
                    {candidato.ministry_names.length ? candidato.ministry_names.join(", ") : "Sem ministério"}
                    {candidato.already_assigned ? " · já escalado nesta escala" : ""}
                  </Text>
                  {!candidato.available && candidato.conflict_reason ? (
                    <Text style={styles.aviso}>Indisponível: {candidato.conflict_reason}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.rotulo}>Justificativa (opcional)</Text>
          <Field
            accessibilityLabel="Justificativa da escalação"
            value={justificativa}
            onChangeText={setJustificativa}
            placeholder="Ex.: troca combinada com o coordenador"
          />

          {candidatoEscolhido && !candidatoEscolhido.available ? (
            <InlineNotice
              tone="warning"
              title="Conflito de agenda"
              message={`${candidatoEscolhido.full_name}: ${candidatoEscolhido.conflict_reason}. Escalar assim mesmo marca a situação como conflito.`}
            />
          ) : null}

          <View style={styles.acoes}>
            <View style={styles.acao}>
              <Button
                loading={salvando}
                disabled={salvando || !candidatoId}
                onPress={painel.tipo === "adicionar" ? confirmarEscalacao : confirmarSubstituicao}
              >
                {candidatoEscolhido && !candidatoEscolhido.available
                  ? "Escalar mesmo assim"
                  : painel.tipo === "adicionar"
                    ? "Confirmar escalação"
                    : "Confirmar substituição"}
              </Button>
            </View>
            <View style={styles.acao}>
              <Button variant="secondary" onPress={() => setPainel(null)}>
                Fechar
              </Button>
            </View>
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.secao}>Histórico de substituições ({detail.substitutions.length})</Text>
        {detail.substitutions.length ? (
          detail.substitutions.map((item) => (
            <View key={item.id} style={styles.substituicao}>
              <Text style={styles.nomeMembro}>
                {item.original_member_name} → {item.replacement_member_name}
              </Text>
              <Text style={styles.meta}>
                {item.role_name} · {item.status_display} · {formatDate(item.created_at, true)}
              </Text>
              {item.justification ? <Text style={styles.meta}>Justificativa: {item.justification}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.meta}>Nenhuma substituição registrada nesta escala.</Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 13, color: colors.inkMuted },
  corpo: { fontSize: 14, color: colors.inkBody },
  rotulo: { fontSize: 12, fontWeight: "800", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.sm },
  secao: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs },
  cabecalho: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  cabecalhoTexto: { flex: 1, gap: 2 },
  titulo: { fontSize: 18, fontWeight: "800", color: colors.ink },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  acao: { minWidth: 160, flexGrow: 1 },
  membro: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  membroTexto: { flex: 1, gap: 2 },
  membroLado: { alignItems: "flex-end", gap: spacing.xs },
  acoesMembro: { flexDirection: "row", gap: spacing.xs },
  nomeMembro: { fontSize: 14, fontWeight: "700", color: colors.ink },
  aviso: { fontSize: 12, color: colors.warning, fontWeight: "700" },
  substituicao: { gap: 2, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderDivider },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceTint,
  },
  chipAtivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTexto: { color: colors.inkBody, fontSize: 13, fontWeight: "700" },
  chipTextoAtivo: { color: colors.onAccent },
  pressed: { opacity: 0.85 },
  listaCandidatos: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  candidato: {
    flexGrow: 1,
    gap: 2,
    minWidth: 240,
    padding: spacing.md,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTint,
  },
  candidatoEscolhido: { borderColor: colors.accent, backgroundColor: colors.surfaceSelected },
  nomeCandidato: { fontSize: 14, fontWeight: "700", color: colors.ink },
});
