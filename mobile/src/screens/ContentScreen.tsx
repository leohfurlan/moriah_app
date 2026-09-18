import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { colors, formatDate } from "@/theme";
import { ChurchContent } from "@/types/api";

export function ContentScreen({ id }: { id?: string }) {
  const router = useRouter();
  const { me } = useAuth();
  const canManage = Boolean(me?.capabilities.includes("manage_content"));
  const [items, setItems] = useState<ChurchContent[]>([]);
  const [item, setItem] = useState<ChurchContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
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
    setTitle(item?.title || ""); setSummary(item?.summary || ""); setBody(item?.body || ""); setEditing(true);
  }
  async function saveDraft() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true); setError(null);
    try {
      const saved = item
        ? await api.patch<ChurchContent>(`/content/${item.id}/`, { title, summary, body })
        : await api.post<ChurchContent>("/content/", { title, summary, body });
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
  return <Screen title="Conteúdo" headerSubtitle="Palavras e comunicados da Igreja Moriah">
    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text>Carregando conteúdo…</Text></View> : null}
    {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
    {!loading && !error && !editing && !id && canManage ? <Button onPress={startEditing}>+ Novo conteúdo</Button> : null}
    {!loading && !error && !editing && id && item ? <Card><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.published_at ? formatDate(item.published_at, true) : "Rascunho"}</Text><Text style={styles.summary}>{item.summary}</Text><Text selectable style={styles.body}>{item.body}</Text>{canManage && item.status === "draft" ? <View style={styles.actions}><Button onPress={startEditing}>Editar rascunho</Button><Button loading={saving} onPress={() => void publish()}>Publicar conteúdo</Button></View> : null}</Card> : null}
    {!loading && !error && !editing && !id ? items.length ? items.map((entry) => <Card key={entry.id} onPress={() => router.push(`/content/${entry.id}`)}><Text style={styles.title}>{entry.title}</Text><Text style={styles.summary}>{entry.summary}</Text><Text style={styles.meta}>{entry.published_at ? formatDate(entry.published_at, true) : "Conteúdo da igreja"}</Text></Card>) : <Card><Text style={styles.meta}>Nenhum conteúdo publicado ainda.</Text></Card> : null}
    {editing ? <Card><Text style={styles.title}>Novo conteúdo</Text><Field placeholder="Título" value={title} onChangeText={setTitle} maxLength={255} editable={!saving} /><Field placeholder="Resumo" value={summary} onChangeText={setSummary} maxLength={500} editable={!saving} /><Field placeholder="Texto" value={body} onChangeText={setBody} multiline maxLength={50000} editable={!saving} /><Button loading={saving} disabled={!title.trim() || !body.trim()} onPress={() => void saveDraft()}>Salvar rascunho</Button><Button variant="ghost" disabled={saving} onPress={() => setEditing(false)}>Cancelar</Button></Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", gap: 8, padding: 24 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  summary: { color: colors.inkBody, fontSize: 14 },
  body: { color: colors.inkBody, fontSize: 15, lineHeight: 24 },
  meta: { color: colors.inkMuted, fontSize: 12 },
  actions: { gap: 8 },
});
