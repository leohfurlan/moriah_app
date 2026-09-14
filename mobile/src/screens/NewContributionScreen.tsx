import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Card, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { describeError } from "@/services/errors";

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
  const submittingRef = useRef(false);
  const [amount, setAmount] = useState("100.00");
  const [category, setCategory] = useState<ContributionCategory>("tithe");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  async function submit() {
    if (submittingRef.current) {
      return;
    }
    // Sem esta trava a contribuicao e criada sem comprovante nenhum, e o
    // membro so descobre depois — foi exatamente assim que anexos "sumiram".
    if (!files.length) {
      Alert.alert(
        "Comprovante obrigatorio",
        "Anexe ao menos uma imagem ou PDF do comprovante antes de enviar.",
      );
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
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
      router.replace("/statement");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Nova Contribuicao">
      <Field value={amount} onChangeText={setAmount} placeholder="Valor" keyboardType="decimal-pad" />
      <Text style={styles.categoryLabel}>Tipo de contribuição</Text>
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
      <Field value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      <Field value={notes} onChangeText={setNotes} placeholder="Observacoes" multiline />
      <Button disabled={submitting} onPress={pickImage} variant="secondary">
        Selecionar imagem
      </Button>
      <Button disabled={submitting} onPress={pickDocument} variant="secondary">
        Selecionar documento
      </Button>
      <Card>
        <Text>Arquivos anexados: {files.length}</Text>
        {files.map((file) => (
          <Text key={`${file.uri}-${file.name}`}>{file.name}</Text>
        ))}
      </Card>
      <Button
        disabled={submitting}
        onPress={async () => {
          try {
            await submit();
          } catch (error) {
            const { title, message } = describeError(error, "Erro ao enviar");
            Alert.alert(title, message);
          }
        }}
      >
        {submitting ? "Enviando..." : "Enviar contribuicao"}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  categoryLabel: {
    color: "#5f5148",
    fontWeight: "700",
  },
  categoryGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryOption: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 96,
    paddingHorizontal: 8,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d6cbbb",
    borderRadius: 12,
    backgroundColor: "#fffdf9",
  },
  categoryOptionSelected: {
    borderColor: "#7a4d2d",
    backgroundColor: "#7a4d2d",
  },
  disabledOption: {
    opacity: 0.55,
  },
  categoryText: {
    color: "#4b4038",
    fontWeight: "700",
  },
  categoryTextSelected: {
    color: "#fff",
  },
});
