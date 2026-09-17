import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/theme";

export type DateInputMode = "date" | "datetime";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateInput(date: Date, mode: DateInputMode = "datetime"): string {
  const value = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  return mode === "date" ? value : `${value} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function maskDateInput(value: string, mode: DateInputMode = "datetime"): string {
  const digits = value.replace(/\D/g, "").slice(0, mode === "date" ? 8 : 12);
  const chunks = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  let result = chunks.filter(Boolean).join("/");
  if (mode === "datetime" && digits.length > 8) {
    const time = digits.slice(8);
    result += ` ${time.slice(0, 2)}${time.length > 2 ? `:${time.slice(2, 4)}` : ""}`;
  }
  return result;
}

export function parseDateInput(value: string, mode: DateInputMode = "datetime"): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!match || (mode === "datetime" && (!match[4] || !match[5]))) return null;
  const [, day, month, year, hours = "0", minutes = "0"] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hours) ||
    date.getMinutes() !== Number(minutes)
  ) return null;
  return date;
}

export function dateInputToIso(value: string, mode: DateInputMode = "datetime"): string | null {
  const date = parseDateInput(value, mode);
  if (!date) return null;
  return mode === "date"
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : date.toISOString();
}

export function isoToDateInput(value: string | null | undefined, mode: DateInputMode = "datetime"): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatDateInput(date, mode);
}

function monthTitle(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(date)
    .replace(/^./, (char) => char.toUpperCase());
}

function calendarDays(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

export function DateTimeField({
  value,
  onChangeText,
  mode = "datetime",
  placeholder,
  accessibilityLabel,
  disabled = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  mode?: DateInputMode;
  placeholder?: string;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseDateInput(value, mode);
  const [cursor, setCursor] = useState(() => parsed || new Date());
  const [selected, setSelected] = useState(() => parsed || new Date());
  const [timeText, setTimeText] = useState(() => parsed ? `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` : "19:00");

  useEffect(() => {
    if (parsed) {
      setSelected(parsed);
      setCursor(parsed);
      setTimeText(`${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`);
    }
  }, [value]);

  const days = useMemo(() => calendarDays(cursor), [cursor]);

  function openPicker() {
    const next = parseDateInput(value, mode) || new Date();
    setSelected(next);
    setCursor(next);
    setOpen(true);
  }

  function chooseDay(day: Date) {
    const next = new Date(selected);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setSelected(next);
    if (mode === "date") onChangeText(formatDateInput(next, mode));
  }

  function closePicker() {
    onChangeText(formatDateInput(selected, mode));
    setOpen(false);
  }

  return (
    <>
      <View style={styles.fieldRow}>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          value={value}
          onChangeText={(text) => onChangeText(maskDateInput(text, mode))}
          placeholder={placeholder || (mode === "date" ? "dd/mm/aaaa" : "dd/mm/aaaa hh:mm")}
          placeholderTextColor={colors.inkPlaceholder}
          editable={!disabled}
          keyboardType={Platform.OS === "web" ? "default" : "numeric"}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir calendário para ${accessibilityLabel}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={openPicker}
          style={({ pressed }) => [styles.calendarButton, pressed && styles.pressed, disabled && styles.disabled]}
        >
          <Text style={styles.calendarIcon}>▣</Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{mode === "date" ? "Selecionar data" : "Selecionar data e horário"}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar calendário" onPress={() => setOpen(false)}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>
            <View style={styles.monthHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={styles.monthButton}>
                <Text style={styles.monthButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{monthTitle(cursor)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={styles.monthButton}>
                <Text style={styles.monthButtonText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.weekRow}>{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
            <View style={styles.calendarGrid}>
              {days.map((day) => {
                const sameDay = day.toDateString() === selected.toDateString();
                const inMonth = day.getMonth() === cursor.getMonth();
                return (
                  <Pressable key={day.toISOString()} accessibilityRole="button" accessibilityState={{ selected: sameDay }} onPress={() => chooseDay(day)} style={[styles.day, !inMonth && styles.outsideDay, sameDay && styles.selectedDay]}>
                    <Text style={[styles.dayText, !inMonth && styles.outsideText, sameDay && styles.selectedText]}>{day.getDate()}</Text>
                  </Pressable>
                );
              })}
            </View>
            {mode === "datetime" ? (
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Horário</Text>
                <TextInput
                  accessibilityLabel="Horário"
                  value={timeText}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, "").slice(0, 4);
                    const masked = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
                    setTimeText(masked);
                    if (digits.length !== 4) return;
                    const hours = Number(digits.slice(0, 2));
                    const minutes = Number(digits.slice(2, 4));
                    if (hours > 23 || minutes > 59) return;
                    const next = new Date(selected);
                    next.setHours(hours, minutes, 0, 0);
                    setSelected(next);
                  }}
                  keyboardType="numeric"
                  style={styles.timeInput}
                  maxLength={5}
                />
                <Text style={styles.timeHint}>24 horas</Text>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={closePicker} style={styles.confirmButton}><Text style={styles.confirmText}>Selecionar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fieldRow: { flexDirection: "row", alignItems: "stretch", gap: spacing.xs },
  input: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.field, paddingHorizontal: spacing.lg - 2, paddingVertical: spacing.md, minHeight: 48, backgroundColor: colors.surfaceTint, color: colors.ink, fontSize: 15 },
  calendarButton: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.field, backgroundColor: colors.surfaceTint },
  calendarIcon: { color: colors.accent, fontSize: 22, fontWeight: "800" },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg, backgroundColor: "rgba(15, 23, 42, 0.42)" },
  modal: { width: "100%", maxWidth: 460, maxHeight: "94%", backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm, ...Platform.select({ web: { boxShadow: "0 16px 40px rgba(15, 23, 42, 0.22)" }, default: { elevation: 8 } }) },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  close: { color: colors.inkMuted, fontSize: 28, lineHeight: 28 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  monthButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.field, backgroundColor: colors.surfaceTint },
  monthButtonText: { color: colors.accent, fontSize: 24, lineHeight: 24 },
  weekRow: { flexDirection: "row", justifyContent: "space-around" },
  weekday: { width: "14.28%", textAlign: "center", color: colors.inkMuted, fontSize: 11, fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  day: { width: "14.28%", minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  outsideDay: { opacity: 0.4 },
  selectedDay: { backgroundColor: colors.accent },
  dayText: { color: colors.inkBody, fontSize: 13, fontWeight: "700" },
  outsideText: { color: colors.inkMuted },
  selectedText: { color: colors.onAccent },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderDivider, paddingTop: spacing.md },
  timeLabel: { color: colors.inkBody, fontSize: 14, fontWeight: "700" },
  timeInput: { width: 84, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.field, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.ink, fontSize: 15, textAlign: "center" },
  timeHint: { color: colors.inkMuted, fontSize: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  cancelButton: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.field },
  confirmButton: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderRadius: radius.field },
  cancelText: { color: colors.inkBody, fontWeight: "700" },
  confirmText: { color: colors.onAccent, fontWeight: "700" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
