import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";

import { ErrorNotice } from "@/components/ErrorNotice";
import { DateTimeField, dateInputToIso, formatDateInput } from "@/components/DateTimeField";
import { InlineNotice, useToast } from "@/components/Feedback";
import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { Ministry, ScheduleCreateRequest, ScheduleAdminDetail } from "@/types/api";
import { colors, radius, spacing } from "@/theme";

function dataPadrao(): Date {
  const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  date.setHours(19, 0, 0, 0);
  return date;
}

/** Data/hora no formato que a igreja digita: "20/12/2026 19:00". */
export function paraTextoBr(date: Date): string {
  return formatDateInput(date, "datetime");
}

/**
 * Aceita "DD/MM/AAAA HH:mm" (formato do formulario) ou qualquer data que o
 * proprio JavaScript entenda, e devolve ISO-8601 para a API. O backend guarda
 * em UTC; sem esta conversao o campo "20/12/2026 19:00" virava 400 na API.
 */
export function paraIso(valor: string): string | null {
  return dateInputToIso(valor, "datetime");
}

export function ScheduleCreateScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [eventName, setEventName] = useState("Culto de celebração");
  const [startAt, setStartAt] = useState(() => paraTextoBr(dataPadrao()));
  const [location, setLocation] = useState("Templo principal");
  const [scheduleName, setScheduleName] = useState("Escala de domingo");
  const [notes, setNotes] = useState("");
  const [ministerios, setMinisterios] = useState<Ministry[]>([]);
  const [ministryId, setMinistryId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string; tone: "warning" | "error" } | null>(null);
  const [erro, setErro] = useState<UserFacingError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const toast = useToast();

  const carregarMinisterios = useCallback(async () => {
    setErro(null);
    try {
      const lista = await api.get<Ministry[]>("/ministries/");
      setMinisterios(lista);
      // Um unico ministerio: pre-seleciona para nao pedir o obvio.
      if (lista.length === 1) setMinistryId(lista[0].id);
      else if (lista.length > 1) setMinistryId((atual) => atual ?? lista[0].id);
    } catch (error) {
      setErro(describeError(error, "Não foi possível carregar os ministérios"));
    }
  }, []);

  useEffect(() => {
    carregarMinisterios();
  }, [carregarMinisterios]);

  const ministerioEscolhido = useMemo(
    () => ministerios.find((item) => item.id === ministryId) ?? null,
    [ministerios, ministryId],
  );

  async function submit(intent: "draft" | "publish") {
    // Trava de reentrancia: sem isto o clique duplo criava duas escalas. O ref
    // cobre o mesmo tick (dois cliques antes do re-render); o estado cobre o resto.
    if (submitting || submittingRef.current) return;
    if (!eventName.trim() || !scheduleName.trim()) {
      setNotice({ tone: "warning", title: "Dados incompletos", message: "Informe o evento e o nome da escala." });
      return;
    }
    const inicio = paraIso(startAt);
    if (!inicio) {
      setNotice({
        tone: "warning",
        title: "Data inválida",
        message: "Use o formato 20/12/2026 19:00 (dia/mês/ano e horário).",
      });
      return;
    }
    if (!ministryId) {
      setNotice({
        tone: "warning",
        title: "Ministério obrigatório",
        message: "Escolha o ministério que você coordena para criar a escala.",
      });
      return;
    }
    setNotice(null);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const corpo: ScheduleCreateRequest = {
        event_name: eventName.trim(),
        event_type: "culto",
        start_at: inicio,
        location: location.trim(),
        schedule_name: scheduleName.trim(),
        notes: notes.trim(),
        ministry_id: ministryId,
        // Regra da fase 4: a escala nasce como rascunho. Publicar e uma acao
        // explicita da gestao, feita na tela da escala.
        // A equipe ainda nao existe nesta tela; publicar fica disponivel no detalhe.
        status: "draft",
      };
      const criada = await api.post<ScheduleAdminDetail>("/schedules/", corpo);
      toast(
        intent === "draft"
          ? "A escala foi salva como rascunho. Monte a equipe e publique quando estiver pronta."
          : "A escala foi salva como rascunho. Adicione integrantes na tela seguinte e publique quando a equipe estiver pronta.",
        { tone: "success", title: intent === "draft" ? "Rascunho criado" : "Equipe necessária para publicar" },
      );
      router.replace(`/schedule-admin/${criada.id}` as never);
    } catch (error) {
      const { title, message } = describeError(error, "Não foi possível criar a escala");
      toast(message, { tone: "error", title });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Adicionar escala" headerSubtitle="Crie o evento, escolha o ministério e monte a equipe">
      <Card>
        <Text style={styles.label}>Evento da igreja</Text>
        <Field
          accessibilityLabel="Nome do evento"
          value={eventName}
          onChangeText={setEventName}
          placeholder="Ex.: Culto de celebração"
        />
        <Text style={styles.label}>Data e horário</Text>
        <DateTimeField
          accessibilityLabel="Data e horário do evento"
          value={startAt}
          onChangeText={setStartAt}
          placeholder="dd/mm/aaaa hh:mm"
        />
        <Text style={styles.hint}>Digite dd/mm/aaaa hh:mm ou use o calendário. Horário em formato 24 horas.</Text>
        <Text style={styles.label}>Local</Text>
        <Field
          accessibilityLabel="Local do evento"
          value={location}
          onChangeText={setLocation}
          placeholder="Templo principal"
        />
        <Text style={styles.label}>Nome da escala</Text>
        <Field
          accessibilityLabel="Nome da escala"
          value={scheduleName}
          onChangeText={setScheduleName}
          placeholder="Ex.: Louvor - domingo"
        />
        <Text style={styles.label}>Observações</Text>
        <Field
          accessibilityLabel="Observações da escala"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Chegada, ensaio e orientações"
        />
      </Card>

      <Card>
        <Text style={styles.label}>Ministério</Text>
        <Text style={styles.hint}>
          Você só cria escala do ministério que coordena. O ministério define as funções disponíveis.
        </Text>
        {erro ? <ErrorNotice title={erro.title} message={erro.message} onRetry={carregarMinisterios} /> : null}
        {!erro && !ministerios.length ? <Text style={styles.hint}>Carregando ministérios…</Text> : null}
        <View style={styles.chips}>
          {ministerios.map((ministerio) => {
            const escolhido = ministerio.id === ministryId;
            return (
              <Pressable
                key={ministerio.id}
                accessibilityRole="button"
                accessibilityLabel={`Ministério ${ministerio.name}`}
                accessibilityState={{ selected: escolhido }}
                onPress={() => setMinistryId(ministerio.id)}
                style={({ pressed }) => [
                  styles.chip,
                  escolhido && styles.chipAtivo,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipTexto, escolhido && styles.chipTextoAtivo]}>
                  {ministerio.name} · {ministerio.members_count} membros
                </Text>
              </Pressable>
            );
          })}
        </View>
        {ministerioEscolhido ? (
          <Text style={styles.hint}>
            Funções de {ministerioEscolhido.name}: {ministerioEscolhido.roles.map((funcao) => funcao.name).join(", ") || "nenhuma cadastrada"}
          </Text>
        ) : null}
      </Card>

      <Card>
        {notice ? (
          <InlineNotice
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        ) : null}
        <Text style={styles.hint}>
          A escala nasce como rascunho para você montar a equipe com calma. Publicar é o que a torna
          visível para o membro escalado.
        </Text>
        <View style={desktop ? styles.acoesLinha : undefined}>
          <View style={styles.acaoPrincipal}>
            <Button loading={submitting} disabled={submitting} onPress={() => submit("draft")}>
              Salvar como rascunho
            </Button>
          </View>
          <View style={styles.acaoPrincipal}>
            <Button
              variant="secondary"
              loading={submitting}
              disabled={submitting}
              onPress={() => submit("publish")}
            >
              Salvar e montar equipe
            </Button>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.inkMuted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.sm },
  hint: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 40,
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
  acoesLinha: { flexDirection: "row", gap: spacing.md },
  acaoPrincipal: { flex: 1 },
});
