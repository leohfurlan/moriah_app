import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { Button, Card, Field } from "@/components/Form";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { describeError, UserFacingError } from "@/services/errors";
import { colors, formatDate, spacing } from "@/theme";
import { ChurchEvent, EventAnnouncement } from "@/types/api";

type SelectedImage = { uri: string; name: string; mimeType?: string };

async function toFormDataValue(file: SelectedImage): Promise<Blob | never> {
  const type = file.mimeType || "application/octet-stream";
  if (Platform.OS === "web") {
    const blob = await (await fetch(file.uri)).blob();
    return new File([blob], file.name, { type: file.mimeType || blob.type || type });
  }
  return { uri: file.uri, name: file.name, type } as never;
}

function fallbackName(mimeType?: string) {
  return `folder-evento-${Date.now()}.${mimeType?.includes("png") ? "png" : "jpg"}`;
}

export function EventAnnouncementsScreen() {
  const { width } = useWindowDimensions();
  const { me } = useAuth();
  const canManage = Boolean(me?.capabilities.includes("manage_events") || me?.capabilities.includes("manage_all"));
  const desktop = Platform.OS === "web" && width >= 900;
  const [announcements, setAnnouncements] = useState<EventAnnouncement[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [position, setPosition] = useState(1);
  const [active, setActive] = useState(true);
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [announcementsResult, eventsResult] = await Promise.allSettled([
      api.get<EventAnnouncement[]>("/event-announcements/"),
      api.get<ChurchEvent[]>("/me/events/"),
    ]);
    if (announcementsResult.status === "fulfilled") setAnnouncements(announcementsResult.value.slice(0, 4));
    else setError(describeError(announcementsResult.reason, "Não foi possível carregar os avisos"));
    if (eventsResult.status === "fulfilled") setEvents(eventsResult.value);
    else setEvents([]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setEditingId(null);
    setEventId(null);
    setTitle("");
    setPosition(1);
    setActive(true);
    setImage(null);
  }

  function editAnnouncement(item: EventAnnouncement) {
    setEditingId(item.id);
    setEventId(item.event);
    setTitle(item.title);
    setPosition(item.position);
    setActive(item.active);
    setImage(null);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setImage({ uri: asset.uri, name: asset.fileName || fallbackName(asset.mimeType), mimeType: asset.mimeType });
    }
  }

  async function save() {
    if (!eventId || (!editingId && !image)) {
      Alert.alert("Dados incompletos", "Selecione o evento e uma imagem JPG ou PNG.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("event", String(eventId));
      form.append("title", title.trim());
      form.append("position", String(position));
      form.append("active", String(active));
      if (image) form.append("image", await toFormDataValue(image));
      if (editingId) await api.patchForm<EventAnnouncement>(`/event-announcements/${editingId}/`, form);
      else await api.postForm<EventAnnouncement>("/event-announcements/", form);
      resetForm();
      await load();
    } catch (failure) {
      setError(describeError(failure, "Não foi possível salvar o aviso"));
    } finally {
      setSaving(false);
    }
  }

  function remove(item: EventAnnouncement) {
    Alert.alert("Remover aviso", `Remover o aviso de ${item.event_name}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => {
        try { await api.delete(`/event-announcements/${item.id}/`); await load(); }
        catch (failure) { setError(describeError(failure, "Não foi possível remover o aviso")); }
      } },
    ]);
  }

  return (
    <Screen title="Cultos e eventos" headerSubtitle="Avisos visuais e eventos da Igreja Moriah" refreshing={loading} onRefresh={() => void load()}>
      {error ? <ErrorNotice title={error.title} message={error.message} onRetry={load} /> : null}
      <View style={desktop ? styles.desktopLayout : undefined}>
        <View style={styles.listColumn}>
          <View style={styles.headingRow}>
            <View><Text style={styles.sectionTitle}>Avisos do carrossel</Text><Text style={styles.meta}>{announcements.length}/4 posições utilizadas</Text></View>
            {canManage ? <Button size="compact" onPress={resetForm}>+ Novo aviso</Button> : null}
          </View>
          {loading ? <ActivityIndicator color={colors.accent} /> : null}
          {!loading && !announcements.length ? <Card><Text style={styles.meta}>Nenhum aviso cadastrado. Crie o primeiro folder do carrossel.</Text></Card> : null}
          {announcements.map((item) => (
            <Card key={item.id} style={styles.announcementCard}>
              <Image source={{ uri: item.image_url }} resizeMode="cover" style={styles.thumbnail} />
              <View style={styles.announcementCopy}>
                <Text style={styles.position}>POSIÇÃO {item.position}</Text>
                <Text style={styles.itemTitle}>{item.title || item.event_name}</Text>
                <Text style={styles.meta}>{item.event_name}</Text>
                <Text style={styles.meta}>{formatDate(item.event_start_at, true)}{item.event_location ? ` · ${item.event_location}` : ""}</Text>
                {canManage ? <View style={styles.itemActions}><Button size="compact" variant="secondary" onPress={() => editAnnouncement(item)}>Editar</Button><Button size="compact" variant="ghost" onPress={() => remove(item)}>Remover</Button></View> : null}
              </View>
            </Card>
          ))}
        </View>

        {canManage ? <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>{editingId ? "Editar aviso" : "Novo aviso"}</Text>
          <Text style={styles.help}>Use um folder em JPG ou PNG. Dimensão recomendada: 1200 × 675 px (proporção 16:9). Tamanho máximo: 8 MB.</Text>
          <Text style={styles.fieldLabel}>Evento de destino</Text>
          <ScrollView style={styles.optionGroup} contentContainerStyle={styles.optionGroupContent} nestedScrollEnabled showsVerticalScrollIndicator>
            {events.slice(0, 20).map((event) => <Pressable key={event.id} accessibilityRole="button" accessibilityState={{ selected: eventId === event.id }} onPress={() => setEventId(event.id)} style={[styles.option, eventId === event.id && styles.optionSelected]}><Text style={[styles.optionText, eventId === event.id && styles.optionTextSelected]}>{event.name}</Text><Text style={[styles.optionMeta, eventId === event.id && styles.optionTextSelected]}>{formatDate(event.start_at, true)}</Text></Pressable>)}
            {!events.length ? <Text style={styles.meta}>Nenhum evento futuro disponível para vincular.</Text> : null}
          </ScrollView>
          <Text style={styles.fieldLabel}>Título curto (opcional)</Text>
          <Field value={title} onChangeText={setTitle} placeholder="Ex.: Conferência Moriah 2026" maxLength={255} editable={!saving} />
          <Text style={styles.fieldLabel}>Posição no carrossel</Text>
          <View style={styles.positionGroup}>{[1, 2, 3, 4].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: position === value }} onPress={() => setPosition(value)} style={[styles.positionOption, position === value && styles.optionSelected]}><Text style={[styles.optionText, position === value && styles.optionTextSelected]}>{value}</Text></Pressable>)}</View>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setActive((current) => !current)} style={styles.activeToggle}><View style={[styles.check, active && styles.checkActive]} /> <Text style={styles.optionText}>{active ? "Exibir no carrossel" : "Manter oculto"}</Text></Pressable>
          <Button variant="secondary" disabled={saving} onPress={() => void pickImage()}>{image ? `Trocar imagem · ${image.name}` : "Selecionar folder"}</Button>
          {image ? <Image source={{ uri: image.uri }} resizeMode="cover" style={styles.preview} /> : null}
          <Button loading={saving} disabled={saving || !eventId || (!editingId && !image)} onPress={() => void save()}>{editingId ? "Salvar alterações" : "Criar aviso"}</Button>
          {editingId ? <Button variant="ghost" disabled={saving} onPress={resetForm}>Cancelar edição</Button> : null}
        </Card> : <Card style={styles.formCard}><Text style={styles.sectionTitle}>Avisos publicados</Text><Text style={styles.help}>Os avisos são administrados pela equipe responsável por eventos da igreja.</Text></Card>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  desktopLayout: { flexDirection: "row", alignItems: "flex-start", gap: 20 },
  listColumn: { flex: 1, gap: 12 },
  formCard: { flex: 0.9, gap: 10 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  fieldLabel: { color: colors.inkBody, fontSize: 12, fontWeight: "800", marginTop: spacing.sm },
  help: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  meta: { color: colors.inkMuted, fontSize: 11 },
  announcementCard: { flexDirection: "row", gap: 12, padding: 12 },
  thumbnail: { width: 132, height: 74, borderRadius: 8, backgroundColor: colors.canvas },
  announcementCopy: { flex: 1, gap: 3 },
  position: { color: colors.accent, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  itemTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  itemActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  optionGroup: { height: 220, flexGrow: 0, flexShrink: 1 },
  optionGroupContent: { gap: 6, paddingRight: 2 },
  option: { padding: 10, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceSelected },
  optionText: { color: colors.inkBody, fontSize: 12, fontWeight: "700" },
  optionTextSelected: { color: colors.accent },
  optionMeta: { color: colors.inkMuted, fontSize: 10, marginTop: 2 },
  positionGroup: { flexDirection: "row", gap: 8 },
  positionOption: { width: 42, height: 38, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  activeToggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  check: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  checkActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  preview: { width: "100%", aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: colors.canvas },
});
