import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Field } from "@/components/Form";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { colors } from "@/theme";

type ChurchContent = {
  id: number; title: string; summary: string; body: string;
  status: "draft" | "published"; published_at: string | null;
};

export function ContentScreen({ id }: { id?: string }) {
  const router = useRouter();
  const { me } = useAuth();
  const canManage = Boolean(me?.capabilities.includes("manage_content"));
  const [items, setItems] = useState<ChurchContent[]>([]);
  const [item, setItem] = useState<ChurchContent | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<UserFacingError | null>(null);
  const [actionError, setActionError] = useState<UserFacingError | null>(null);
  const generation = useRef(0);
  const saving = useRef(false);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError(null); setItem(null); setItems([]);
    try {
      if (id) {
        const result = await api.get<ChurchContent>(`/content/${id}/`);
        if (current === generation.current) setItem(result);
      } else {
        const result = await api.getPage<ChurchContent>("/content/", page);
        if (current === generation.current) {
          setItems(result.items); setHasNext(result.hasNext);
        }
      }
    } catch (failure) {
      if (current === generation.current) setError(describeError(failure, "Não foi possível carregar o conteúdo"));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [id, page, me?.id]);

  useEffect(() => {
    setEditing(false); setActionError(null); setBusy(false);
    if (me) void load();
    return () => { generation.current += 1; };
  }, [load, me?.id]);

  const edit = () => {
    setTitle(item?.title || ""); setSummary(item?.summary || ""); setBody(item?.body || "");
    setActionError(null); setEditing(true);
  };

  const mutate = async (action: "save" | "publish" | "unpublish") => {
    if (saving.current || !canManage) return;
    saving.current = true; setBusy(true); setActionError(null);
    const current = generation.current;
    try {
      const result = action === "save"
        ? item
          ? await api.patch<ChurchContent>(`/content/${item.id}/`, { title, summary, body })
          : await api.post<ChurchContent>("/content/", { title, summary, body })
        : await api.post<ChurchContent>(`/content/${item!.id}/${action}/`);
      if (current !== generation.current) return;
      setEditing(false);
      if (!id) router.push(`/content/${result.id}`);
      else setItem(result);
    } catch (failure) {
      if (current === generation.current) setActionError(describeError(failure, "Não foi possível salvar o conteúdo"));
    } finally {
      saving.current = false;
      if (current === generation.current) setBusy(false);
    }
  };

  return (
    <Screen title="Conteúdo" headerSubtitle="Materiais e comunicados da sua igreja">
      <Text style={styles.title}>Conteúdo da igreja</Text>
      {id ? <Button variant="ghost" onPress={() => router.replace("/content")}>Voltar aos conteúdos</Button> : null}
      {loading ? <View><ActivityIndicator /><Text>Carregando conteúdo…</Text></View> : null}
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      {!loading && !error && !editing ? <>
        {!id && canManage ? <Button onPress={edit}>Novo conteúdo</Button> : null}
        {!id && items.length === 0 ? <Card><Text>Nenhum conteúdo disponível.</Text></Card> : null}
        {!id ? items.map((entry) => <Card key={entry.id} onPress={() => router.push(`/content/${entry.id}`)}>
          <Text style={styles.title}>{entry.title}</Text><Text>{entry.summary}</Text>
          {canManage ? <Text>{entry.status === "draft" ? "Rascunho" : "Publicado"}</Text> : null}
        </Card>) : null}
        {!id && (page > 1 || hasNext) ? <View style={styles.actions}>
          <Button disabled={page === 1} onPress={() => setPage(page - 1)}>Página anterior</Button>
          <Text>Página {page}</Text><Button disabled={!hasNext} onPress={() => setPage(page + 1)}>Próxima página</Button>
        </View> : null}
        {item ? <Card><Text style={styles.title}>{item.title}</Text><Text>{item.summary}</Text>
          <Text selectable style={styles.body}>{item.body}</Text>
          <Text>{item.status === "draft" ? "Rascunho" : "Publicado"}</Text>
          {canManage ? <View style={styles.actions}>
            {item.status === "draft" ? <>
              <Button disabled={busy} onPress={edit}>Editar rascunho</Button>
              <Button loading={busy} onPress={() => mutate("publish")}>Publicar conteúdo</Button>
            </> : <Button loading={busy} variant="secondary" onPress={() => mutate("unpublish")}>Retirar do ar</Button>}
          </View> : null}
        </Card> : null}
      </> : null}
      {editing ? <Card>
        <Text>Título</Text><Field accessibilityLabel="Título do conteúdo" value={title} onChangeText={setTitle} maxLength={255} editable={!busy} />
        <Text>Resumo</Text><Field accessibilityLabel="Resumo do conteúdo" value={summary} onChangeText={setSummary} maxLength={500} editable={!busy} />
        <Text>Texto</Text><Field accessibilityLabel="Texto do conteúdo" value={body} onChangeText={setBody} multiline maxLength={50000} editable={!busy} />
        <Button loading={busy} disabled={!title.trim() || !body.trim()} onPress={() => mutate("save")}>Salvar rascunho</Button>
        <Button disabled={busy} variant="ghost" onPress={() => setEditing(false)}>Cancelar edição</Button>
      </Card> : null}
      {actionError ? <ErrorNotice title={actionError.title} message={actionError.message} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  body: { color: colors.inkBody, fontSize: 15, lineHeight: 23 },
  actions: { gap: 10 },
});
