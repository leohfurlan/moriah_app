import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { FeedbackTone, InlineNotice, useToast } from "@/components/Feedback";
import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError } from "@/services/errors";
import { colors, radius, spacing } from "@/theme";

type UploadableFile = {
  uri: string;
  name: string;
  mimeType?: string;
};

/**
 * Nome de arquivo quando o seletor nao informa um.
 *
 * A extensao precisa bater com o conteudo real: o backend valida a assinatura
 * (magic bytes) do arquivo contra a extensao, entao chutar ".jpg" para um PNG
 * faz o upload ser recusado.
 */
function fallbackFileName(mimeType?: string): string {
  const type = (mimeType || "").toLowerCase();
  const extension = type.includes("png") ? "png" : type.includes("pdf") ? "pdf" : "jpg";
  return `comprovante-${Date.now()}.${extension}`;
}

/**
 * Converte o arquivo escolhido no formato que cada plataforma exige.
 *
 * No React Native, o FormData aceita o objeto `{uri, name, type}`. No
 * navegador esse objeto vira a string "[object Object]" e o upload chega
 * vazio ao servidor — na web e preciso anexar um Blob/File de verdade.
 */
async function toFormDataValue(file: UploadableFile): Promise<Blob | never> {
  const type = file.mimeType || "application/octet-stream";

  if (Platform.OS === "web") {
    const blob = await (await fetch(file.uri)).blob();
    return new File([blob], file.name, { type: file.mimeType || blob.type || type });
  }

  return { uri: file.uri, name: file.name, type } as never;
}

const contributionCategories = [
  { label: "Dízimo", value: "tithe" },
  { label: "Oferta", value: "offering" },
  { label: "Campanha", value: "campaign" },
  { label: "Missões", value: "missions" },
  { label: "Evento", value: "event" },
  { label: "Outros", value: "other" },
] as const;

type ContributionCategory = (typeof contributionCategories)[number]["value"];

export function NewContributionScreen() {
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const submittingRef = useRef(false);
  const [amount, setAmount] = useState("100.00");
  const [category, setCategory] = useState<ContributionCategory>("tithe");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Aviso de validacao fica colado no formulario, acima do botao de envio.
  const [aviso, setAviso] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setFiles((current) => [
        ...current,
        {
          uri: result.assets[0].uri,
          name: result.assets[0].fileName || fallbackFileName(result.assets[0].mimeType),
          mimeType: result.assets[0].mimeType,
        },
      ]);
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (!result.canceled) {
      setFiles((current) => [
        ...current,
        ...result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
        })),
      ]);
    }
  }

  function removeFile(uri: string, name: string) {
    setFiles((current) => current.filter((file) => !(file.uri === uri && file.name === name)));
  }

  async function submit() {
    if (submittingRef.current) {
      return;
    }
    // Sem esta trava a contribuicao e criada sem comprovante nenhum, e o
    // membro so descobre depois — foi exatamente assim que anexos "sumiram".
    if (!files.length) {
      setAviso({
        tone: "warning",
        title: "Comprovante obrigatorio",
        message: "Anexe ao menos uma imagem ou PDF do comprovante antes de enviar.",
      });
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setAviso(null);
    const form = new FormData();
    form.append("amount", amount);
    form.append("category", category);
    form.append("contribution_date", date);
    form.append("notes", notes);
    try {
      for (const file of files) {
        form.append("files", await toFormDataValue(file));
      }
      await api.postForm("/contributions/", form);
      setFiles([]);
      setNotes("");
      toast("Sua contribuicao foi registrada e ja aparece no seu extrato.", {
        tone: "success",
        title: "Contribuicao enviada",
      });
      router.replace("/statement");
    } catch (error) {
      const { title, message } = describeError(error, "Erro ao enviar");
      toast(message, { tone: "error", title });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Registrar contribuição" headerSubtitle="Registre seu dízimo, oferta ou contribuição">
      <View style={desktop ? styles.desktopContributionForm : undefined}>
      <Text style={styles.sectionTitle}>Valor</Text>
      <Field value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />

      <Text style={styles.sectionTitle}>Tipo de contribuição</Text>
      <View style={styles.categoryGroup}>
        {contributionCategories.map((item) => {
          const selected = category === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={submitting}
              onPress={() => setCategory(item.value)}
              style={[styles.categoryOption, selected && styles.categoryOptionSelected, submitting && styles.disabledOption]}
            >
              <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Data da contribuição</Text>
      <Field value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" />

      <Text style={styles.sectionTitle}>Observações (opcional)</Text>
      <Field value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholder="Ex.: campanha de missões" />

      <Text style={styles.sectionTitle}>Comprovante</Text>
      <Card>
        {files.length ? (
          files.map((file) => (
            <View key={`${file.uri}-${file.name}`} style={styles.fileRow}>
              <Text numberOfLines={1} style={styles.fileName}>
                {file.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remover ${file.name}`}
                hitSlop={8}
                onPress={() => removeFile(file.uri, file.name)}
              >
                <Text style={styles.fileRemove}>✕</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.fileEmpty}>Nenhum arquivo anexado. Anexe uma imagem ou PDF.</Text>
        )}
        <View style={styles.pickerRow}>
          <View style={styles.pickerFlex}>
            <Button disabled={submitting} variant="secondary" onPress={pickImage}>
              Imagem
            </Button>
          </View>
          <View style={styles.pickerFlex}>
            <Button disabled={submitting} variant="secondary" onPress={pickDocument}>
              PDF/Documento
            </Button>
          </View>
        </View>
      </Card>

      {aviso ? (
        <InlineNotice tone={aviso.tone} title={aviso.title} message={aviso.message} onDismiss={() => setAviso(null)} />
      ) : null}
      <Button disabled={submitting} loading={submitting} onPress={submit}>
        {submitting ? "Enviando..." : "Enviar contribuicao"}
      </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  desktopContributionForm: { width: "100%", maxWidth: 768, alignSelf: "center", padding: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 4 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  categoryGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryOption: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 96,
    paddingHorizontal: spacing.sm,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.field,
    backgroundColor: colors.surfaceTint,
  },
  categoryOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  disabledOption: {
    opacity: 0.55,
  },
  categoryText: {
    color: colors.inkBody,
    fontWeight: "700",
  },
  categoryTextSelected: {
    color: colors.onAccent,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    fontWeight: "600",
  },
  fileRemove: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "700",
  },
  fileEmpty: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  pickerRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pickerFlex: {
    flex: 1,
  },
});
