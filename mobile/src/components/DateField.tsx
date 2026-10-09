import {useState} from "react";
import {Modal, Pressable, StyleSheet, Text, View} from "react-native";
import {CalendarDays} from "lucide-react-native";
import {Button, Field} from "./Form";
import {useReducedMotion} from "./Motion";
import {colors, spacing} from "@/theme";

export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.slice(0, 2) + (digits.length > 2 ? "/" + digits.slice(2, 4) : "") + (digits.length > 4 ? "/" + digits.slice(4) : "");
}
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = (value: number) => String(value).padStart(2, "0");
export function DateField({label, value, onChange, maximumDate, disabled = false}: {
  label: string; value: string; onChange: (value: string) => void; maximumDate?: Date; disabled?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState("2000");
  const yearNumber = Number(year);
  const validYear = /^\d{4}$/.test(year) && yearNumber >= 1900 && yearNumber <= 2100;
  const days = validYear ? new Date(yearNumber, month + 1, 0).getDate() : 0;
  const offset = validYear ? (new Date(yearNumber, month, 1).getDay() + 6) % 7 : 0;
  function show() {
    const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    const date = parts ? new Date(+parts[3], +parts[2] - 1, +parts[1]) : new Date();
    setMonth(date.getMonth()); setYear(String(date.getFullYear())); setOpen(true);
  }
  function move(delta: number) {
    if (!validYear) return;
    const date = new Date(yearNumber, month + delta, 1);
    if (date.getFullYear() < 1900 || date.getFullYear() > 2100) return;
    setMonth(date.getMonth()); setYear(String(date.getFullYear()));
  }
  return <View style={{gap: spacing.sm}}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      <View style={{flex: 1}}><Field accessibilityLabel={label} placeholder="DD/MM/AAAA" value={value} onChangeText={text => onChange(formatDateInput(text))} keyboardType="number-pad" maxLength={10} editable={!disabled}/></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Selecionar ${label.toLowerCase()} no calendário`} disabled={disabled} onPress={show} style={styles.calendarButton}><CalendarDays color={colors.accent} size={22}/></Pressable>
    </View>
    <Modal visible={open} transparent animationType={reducedMotion ? "none" : "fade"} onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.label}>Ano</Text>
        <Field accessibilityLabel="Ano do calendário" value={year} onChangeText={text => setYear(text.replace(/\D/g, "").slice(0,4))} keyboardType="number-pad" maxLength={4}/>
        <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" style={styles.calendarButton} onPress={() => move(-1)}><Text style={styles.label}>‹</Text></Pressable><Text style={styles.label}>{MONTHS[month]}</Text><Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" style={styles.calendarButton} onPress={() => move(1)}><Text style={styles.label}>›</Text></Pressable></View>
        {!validYear ? <Text style={styles.copy}>Informe um ano entre 1900 e 2100.</Text> : <>
          <View style={styles.grid}>{["S", "T", "Q", "Q", "S", "S", "D"].map((day,index) => <Text key={index} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.grid}>{Array.from({length: offset + days}, (_,index) => {
            const day = index - offset + 1;
            if (day < 1) return <View key={index} style={styles.day}/>;
            const date = new Date(yearNumber, month, day);
            const unavailable = Boolean(maximumDate && date > maximumDate);
            const dateValue = `${pad(day)}/${pad(month+1)}/${year}`;
            const selected = value === dateValue;
            return <Pressable key={index} accessibilityRole="button" accessibilityLabel={dateValue} accessibilityState={{disabled: unavailable, selected}} disabled={unavailable} style={[styles.day, selected && styles.selected, unavailable && {opacity: 0.3}]} onPress={() => {onChange(dateValue); setOpen(false);}}><Text style={{color: selected ? colors.onAccent : colors.ink}}>{day}</Text></Pressable>;
          })}</View>
        </>}
        <Button variant="secondary" onPress={() => setOpen(false)}>Fechar calendário</Button>
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  label: {fontSize: 14, fontWeight: "600", color: colors.ink}, title: {fontSize: 20, fontWeight: "700", color: colors.ink},
  copy: {color: colors.inkBody, textAlign: "justify"}, row: {flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: "space-between"},
  calendarButton: {padding: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 12},
  overlay: {flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", alignItems: "center", padding: 16},
  dialog: {width: "100%", maxWidth: 430, borderRadius: 20, backgroundColor: colors.surface, padding: 20, gap: 12},
  grid: {flexDirection: "row", flexWrap: "wrap"}, weekday: {width: "14.2857%", textAlign: "center", color: colors.inkMuted},
  day: {width: "14.2857%", minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 8}, selected: {backgroundColor: colors.accent},
});
