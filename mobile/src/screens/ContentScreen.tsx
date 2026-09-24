import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { ErrorNotice } from "@/components/ErrorNotice";
import { MarkdownView } from "@/components/Markdown";
import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { colors, formatDate } from "@/theme";
import { ChurchContent } from "@/types/api";

type Selection = { start: number; end: number };

const toolbarItems = [
  { label: "H1", before: "# ", after: "", placeholder: "Título" },
  { label: "H2", before: "## ", after: "", placeholder: "Subtítulo" },
  { label: "B", before: "**", after: "**", placeholder: "texto em negrito" },
  { label: "I", before: "*", after: "*", placeholder: "texto em itálico" },
  { label: "• Lista", before: "- ", after: "", placeholder: "item" },
  { label: "> Citação", before: "> ", after: "", placeholder: "citação" },
];

function excerpt(value: string) {
  return value.replace(/[#>*_`-]/g, "").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/\s+/g, " ").trim();
}

export function ContentScreen({ id }: { id?: string }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const { me } = useAuth();
  const canManage = Boolean(me?.capabilities.includes("manage_content"));
  const bodyRef = useRef<TextInput>(null);
  const [items, setItems] = useState<ChurchContent[]>([]);
  const [item, setItem] = useState<ChurchContent | null>(null);
  const canManageItem = canManage || Boolean(item?.can_manage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (id) setItem(await api.get<ChurchContent>(`/content/${id}/`));
      else setItems(await api.get<ChurchContent[]>("/content/"));
    } catch (failure) { setError(describeError(failure, "Não foi possível carregar o conteúdo")); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  function startEditing() {
    setTitle(item?.title || "");
    setBody(item?.body || "");
    setSelection({ start: 0, end: 0 });
    setEditing(true);
  }

  function insertMarkdown(before: string, after: string, placeholder: string) {
    const start = selection.start;
    const end = selection.end;
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    const caret = start + before.length + selected.length + after.length;
    requestAnimationFrame(() => bodyRef.current?.focus());
    setSelection({ start: caret, end: caret });
  }

  async function saveDraft() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true); setError(null);
    try {
      const saved = item
        ? await api.patch<ChurchContent>(`/content/${item.id}/`, { title: title.trim(), body })
        : await api.post<ChurchContent>("/content/", { title: title.trim(), body });
      setItem(saved); setEditing(false);
      if (!item) router.push(`/content/${saved.id}`);
    } catch (failure) { setError(describeError(failure, "Não foi possível salvar o conteúdo")); }
    finally { setSaving(false); }
  }

  async function publish() {
    if (!item) return;
    setSaving(true); setError(null);
    try { setItem(await api.post<ChurchContent>(`/content/${item.id}/publish/`)); }
    catch (failure) { setError(describeError(failure, "Não foi possível publicar o conteúdo")); }
    finally { setSaving(false); }
  }

  function removeContent() {
    if (!item) return;
    Alert.alert("Excluir palavra", `Excluir “${item.title}”? Essa ação não pode ser desfeita.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => void (async () => {
          setSaving(true); setError(null);
          try {
            await api.delete(`/content/${item.id}/`);
            router.replace("/content");
          } catch (failure) {
            setError(describeError(failure, "Não foi possível excluir o conteúdo"));
          } finally { setSaving(false); }
        })(),
      },
    ]);
  }

  return (
    <Screen title="Palavras" headerSubtitle="Mensagens e comunicados da Igreja Moriah" refreshing={loading} onRefresh={() => void load()}>
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text>Carregando conteúdo…</Text></View> : null}
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}

      {!loading && !error && !editing && !id && canManage ? <Button onPress={startEditing}>+ Nova palavra</Button> : null}

      {!loading && !error && !editing && id && item ? (
        <Card style={styles.readCard}>
          <View style={styles.documentHeader}>
            <View style={styles.documentHeading}>
              <Text style={styles.documentTitle}>{item.title}</Text>
              <Text style={styles.publicationMeta}>Por {item.author_name || "Equipe Moriah"} · {item.published_at ? `Publicado em ${formatDate(item.published_at)}` : "Rascunho"}</Text>
            </View>
            {canManageItem ? <View style={styles.topActions}>
              <Button size="compact" variant="secondary" disabled={saving} onPress={startEditing}>Editar</Button>
              <Button size="compact" variant="ghost" disabled={saving} onPress={removeContent}>Excluir</Button>
            </View> : null}
          </View>
          <MarkdownView value={item.body} />
          {canManageItem && item.status === "draft" ? <View style={styles.actions}><Button loading={saving} onPress={() => void publish()}>Publicar conteúdo</Button></View> : null}
        </Card>
      ) : null}

      {!loading && !error && !editing && !id ? items.length ? items.map((entry) => (
        <Card key={entry.id} onPress={() => router.push(`/content/${entry.id}`)}>
          <Text style={styles.title}>{entry.title}</Text>
          <Text numberOfLines={3} style={styles.summary}>{excerpt(entry.body)}</Text>
          <Text style={styles.meta}>Por {entry.author_name || "Equipe Moriah"} · {entry.published_at ? `Publicado em ${formatDate(entry.published_at)}` : "Rascunho"}</Text>
        </Card>
      )) : <Card><Text style={styles.meta}>Nenhum conteúdo publicado ainda.</Text></Card> : null}

      {editing ? (
        <Card style={[styles.editorCard, desktop && styles.editorCardDesktop]}>
          <View style={styles.editorHeader}>
            <View style={styles.editorHeading}><Text style={styles.title}>{item ? "Editar palavra" : "Nova palavra"}</Text><Text style={styles.meta}>Escreva em Markdown. O texto será exibido formatado para os irmãos.</Text></View>
            <Text style={styles.markdownHint}>Markdown</Text>
          </View>
          <Field placeholder="Título" value={title} onChangeText={setTitle} maxLength={255} editable={!saving} />
          <View style={styles.toolbar}>{toolbarItems.map((tool) => <Pressable key={tool.label} accessibilityRole="button" onPress={() => insertMarkdown(tool.before, tool.after, tool.placeholder)} style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}><Text style={styles.toolbarLabel}>{tool.label}</Text></Pressable>)}</View>
          <TextInput
            ref={bodyRef}
            value={body}
            onChangeText={setBody}
            onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
            placeholder="Comece a escrever sua palavra…"
            placeholderTextColor={colors.inkPlaceholder}
            multiline
            editable={!saving}
            textAlignVertical="top"
            style={[styles.editorInput, desktop && styles.editorInputDesktop]}
          />
          <View style={styles.editorFooter}><Text style={styles.meta}>Use títulos, negrito, itálico, listas e citações.</Text><Text style={styles.meta}>{body.length} caracteres</Text></View>
          <View style={styles.actions}><Button loading={saving} disabled={!title.trim() || !body.trim()} onPress={() => void saveDraft()}>Salvar rascunho</Button><Button variant="ghost" disabled={saving} onPress={() => setEditing(false)}>Cancelar</Button></View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", gap: 8, padding: 24 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  documentTitle: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: "800", letterSpacing: -0.5 },
  summary: { color: colors.inkBody, fontSize: 14, lineHeight: 21 },
  meta: { color: colors.inkMuted, fontSize: 12 },
  publicationMeta: { color: colors.inkMuted, fontSize: 12 },
  readCard: { gap: 14 },
  documentHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  documentHeading: { flex: 1, gap: 7, minWidth: 0 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  actions: { gap: 8, marginTop: 8 },
  editorCard: { gap: 14 },
  editorCardDesktop: { minHeight: 700, width: "100%" },
  editorHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  editorHeading: { flex: 1, gap: 5 },
  markdownHint: { color: colors.accent, backgroundColor: colors.surfaceSelected, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "800" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: "#F9FAFB" },
  toolbarButton: { minHeight: 32, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  toolbarLabel: { color: colors.inkBody, fontSize: 11, fontWeight: "800" },
  editorInput: { minHeight: 480, flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, padding: 16, backgroundColor: colors.surface, color: colors.inkBody, fontSize: 15, lineHeight: 24 },
  editorInputDesktop: { minHeight: 510 },
  editorFooter: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  pressed: { opacity: 0.7 },
});
