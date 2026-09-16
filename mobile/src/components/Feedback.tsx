/**
 * Feedback dentro do app.
 *
 * Todo aviso ao membro precisa aparecer na propria tela. `Alert.alert` NAO
 * serve: no react-native-web ele e um stub vazio
 * (`react-native-web/dist/exports/Alert/index.js` -> `static alert() {}`),
 * entao no desktop do MVP — que e onde a igreja opera — erro, sucesso e
 * validacao desaparecem sem deixar rastro. Pior: navegacao colocada em
 * `onPress` do botao do Alert nunca executa.
 *
 * Dois formatos, um para cada situacao:
 * - `InlineNotice`: mensagem presa ao ponto da acao (validacao de formulario,
 *   falha de carregamento). Fica visivel ate o membro agir.
 * - `useToast`: mensagem de conclusao (salvou, enviou, confirmou). Vive acima
 *   das telas, entao sobrevive a navegacao disparada pela mesma acao.
 */
import { PropsWithChildren, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/theme";

export type FeedbackTone = "success" | "error" | "warning" | "info";

export function InlineNotice({
  tone = "info",
  title,
  message,
  onDismiss,
}: {
  tone?: FeedbackTone;
  title?: string;
  message: string;
  onDismiss?: () => void;
}) {
  const paleta = TONES[tone];
  return (
    <View accessibilityRole="alert" style={[styles.notice, paleta.box]}>
      <View style={styles.noticeCopy}>
        {title ? <Text style={[styles.noticeTitle, paleta.title]}>{title}</Text> : null}
        <Text style={styles.noticeMessage}>{message}</Text>
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          onPress={onDismiss}
          style={styles.dismiss}
        >
          <Text style={styles.dismissText}>Fechar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type Toast = { id: number; tone: FeedbackTone; title?: string; message: string };

/**
 * Estado do toast vive no MODULO, nao no React.
 *
 * Motivo (defeito visto na verificacao da fase 1): quem avisa "voce nao tem
 * permissao" faz `toast(...)` e em seguida `router.replace(...)`. Guardar o
 * toast em `useState` do provider fazia a mensagem morrer junto com a
 * remontagem da arvore na navegacao — o membro era jogado na tela seguinte sem
 * entender por que. Com o estado no modulo, o aviso sobrevive a remontagem; o
 * `ToastHost` apenas assina o valor atual.
 */
let toastAtual: Toast | null = null;
let timerDoToast: ReturnType<typeof setTimeout> | null = null;
let proximoId = 0;
const assinantes = new Set<(toast: Toast | null) => void>();

const TOM_DE_TOAST_MS = 6000;

function publicar(toast: Toast | null) {
  toastAtual = toast;
  for (const assinante of assinantes) assinante(toast);
}

/** Dispara o toast global. Sobrevive a navegacao disparada pela mesma acao. */
export function mostrarToast(message: string, options?: { tone?: FeedbackTone; title?: string }) {
  proximoId += 1;
  publicar({ id: proximoId, tone: options?.tone || "success", title: options?.title, message });
  if (timerDoToast) clearTimeout(timerDoToast);
  // Auto-dispensa longa: quem esta na igreja com o celular na mao precisa de
  // tempo para ler, mas a mensagem nao pode ficar presa na tela.
  timerDoToast = setTimeout(() => {
    timerDoToast = null;
    publicar(null);
  }, TOM_DE_TOAST_MS);
}

export function fecharToast() {
  if (timerDoToast) clearTimeout(timerDoToast);
  timerDoToast = null;
  publicar(null);
}

export function useToast() {
  return mostrarToast;
}

/** Camada flutuante: fica acima das telas e assina o toast atual do modulo. */
export function ToastHost() {
  const [toast, setToast] = useState<Toast | null>(toastAtual);

  useEffect(() => {
    assinantes.add(setToast);
    setToast(toastAtual);
    return () => {
      assinantes.delete(setToast);
    };
  }, []);

  if (!toast) return null;
  return (
    <View style={styles.toastLayer}>
      <View accessibilityRole="alert" testID="toast" style={[styles.toast, TONES[toast.tone].box]}>
        <View style={styles.noticeCopy}>
          {toast.title ? <Text style={[styles.noticeTitle, TONES[toast.tone].title]}>{toast.title}</Text> : null}
          <Text style={styles.noticeMessage}>{toast.message}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          onPress={fecharToast}
          style={styles.dismiss}
        >
          <Text style={styles.dismissText}>Fechar</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ToastProvider({ children }: PropsWithChildren) {
  return (
    <>
      {children}
      <ToastHost />
    </>
  );
}

const TONES = {
  success: { box: { borderColor: colors.successText, backgroundColor: colors.badgeSuccessBg }, title: { color: colors.successText } },
  error: { box: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }, title: { color: colors.danger } },
  warning: { box: { borderColor: colors.badgeWarningBorder, backgroundColor: colors.badgeWarningBg }, title: { color: colors.warning } },
  info: { box: { borderColor: colors.borderStrong, backgroundColor: colors.surface }, title: { color: colors.ink } },
} as const;

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.field,
    borderWidth: 1,
  },
  noticeCopy: { flex: 1, gap: 2 },
  noticeTitle: { fontSize: 14, fontWeight: "700" },
  noticeMessage: { color: colors.inkBody, fontSize: 13, lineHeight: 18 },
  dismiss: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  dismissText: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  toastLayer: { position: "absolute", top: spacing.lg, left: 0, right: 0, alignItems: "center", paddingHorizontal: spacing.lg, pointerEvents: "box-none" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    maxWidth: 560,
    width: "100%",
    padding: spacing.md,
    borderRadius: radius.field,
    borderWidth: 1,
    shadowColor: "#101828",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
