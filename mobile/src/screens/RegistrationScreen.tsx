import {useCallback, useEffect, useState} from "react";
import {StyleSheet, Text, View} from "react-native";
import {useRouter} from "expo-router";
import {Screen} from "@/components/Screen";
import {Button, Card, Field} from "@/components/Form";
import {DateField} from "@/components/DateField";
import {InlineNotice} from "@/components/Feedback";
import {useAuth} from "@/hooks/useAuth";
import {api} from "@/services/api";
import {describeError} from "@/services/errors";
import {birthDateToISO, WEEKDAYS} from "@/services/onboarding";
import {colors, spacing} from "@/theme";

type Kind = "church" | "team" | "events" | "cells" | "ministries";
type Entry = {id: number; name: string; [key: string]: unknown};
type Draft = Record<string, unknown>;
type Option = {value: string; label: string};
type Options = {users: Array<{id: number; name: string}>; members: Array<{id: number; full_name: string}>; roles: Option[]; event_types: Option[]};
const TITLES: Record<Kind, string> = {church: "Dados da igreja", team: "Equipe e permissões", events: "Cadastro de eventos", cells: "Cadastro de células", ministries: "Cadastro de ministérios"};
const EMPTY: Record<Kind, Draft> = {
  church: {name: "", legal_name: "", tax_id: "", city: "", state: ""},
  team: {name: "", email: "", role: "member", additional_roles: [], is_active: true, password: ""},
  events: {name: "", event_type: "culto", start_date: "", start_time: "", end_date: "", end_time: "", location: "", description: "", active: true},
  cells: {name: "", leader: null, assistant_leader: null, meeting_day: "", meeting_time: "", location: "", notes: ""},
  ministries: {name: "", description: "", members: [], coordinators: []},
};
function localParts(value: unknown) {
  if (!value) return {date: "", time: ""};
  const date = new Date(String(value));
  const pad = (n: number) => String(n).padStart(2,"0");
  return {date: `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}`};
}
function eventTimestamp(date: string, time: string) {
  const iso = birthDateToISO(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Informe a data e o horário no formato indicado.");
  const parsed = new Date(`${iso}T${time}:00`);
  const parts = localParts(parsed.toString());
  if (parts.date !== date || parts.time !== time) throw new Error("Informe uma data e um horário válidos.");
  return parsed.toISOString();
}
export function RegistrationScreen({kind}: {kind: Kind}) {
  const router = useRouter(); const {me} = useAuth();
  const [items, setItems] = useState<Entry[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [draft, setDraft] = useState<Draft>({...EMPTY[kind]});
  const [editing, setEditing] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(kind === "church");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const endpoint = kind === "church" ? "/church/details/" : `/church/registrations/${kind}/`;
  const allowed = Boolean(me?.capabilities.includes("manage_all"));
  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const [data, choices] = await Promise.all([api.get<Entry | Entry[]>(endpoint), api.get<Options>("/church/registrations/options/")]);
      setItems(Array.isArray(data) ? data : [data]); setOptions(choices);
      if (kind === "church" && !Array.isArray(data)) {setDraft(data); setEditing(data.id);}
      setError("");
    } catch (e) {setError(describeError(e, "Não foi possível carregar o cadastro").message);} finally {setLoading(false);}
  }, [endpoint, allowed, kind]);
  useEffect(() => {void load();}, [load]);
  const put = (key: string, value: unknown) => setDraft(current => ({...current, [key]: value}));
  const text = (key: string) => String(draft[key] ?? "");
  const selected = (key: string): number[] => Array.isArray(draft[key]) ? draft[key] as number[] : [];
  function field(key: string, label: string, maxLength = 255, multiline = false) {
    return <View key={key} style={styles.field}><Text style={styles.label}>{label}</Text><Field accessibilityLabel={label} value={text(key)} editable={!busy} onChangeText={value => put(key, key === "state" ? value.toUpperCase() : value)} maxLength={maxLength} multiline={multiline}/></View>;
  }
  function choices(key: string, label: string, values: Option[], multiple = false) {
    const picked: string[] = multiple && Array.isArray(draft[key]) ? draft[key] as string[] : [text(key)];
    return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.choices}>{values.map(option => <Button key={option.value} size="compact" disabled={busy} variant={picked.includes(option.value) ? "primary" : "secondary"} onPress={() => put(key, multiple ? picked.includes(option.value) ? picked.filter(value => value !== option.value) : [...picked, option.value] : option.value)}>{option.label}</Button>)}</View></View>;
  }
  function people(key: string, label: string, values: Array<{id: number; name: string}>, multiple = false) {
    return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.choices}>
      {!multiple ? <Button size="compact" variant={draft[key] == null ? "primary" : "secondary"} disabled={busy} onPress={() => put(key,null)}>Não definido</Button> : null}
      {values.map(person => <Button key={person.id} size="compact" disabled={busy} variant={(multiple ? selected(key).includes(person.id) : draft[key] === person.id) ? "primary" : "secondary"} onPress={() => put(key,multiple ? selected(key).includes(person.id) ? selected(key).filter(id => id !== person.id) : [...selected(key),person.id] : person.id)}>{person.name}</Button>)}
    </View>{!values.length ? <Text style={styles.copy}>Ainda não há pessoas disponíveis neste cadastro.</Text> : null}</View>;
  }
  function edit(item: Entry) {
    setError(""); setSuccess(""); setEditing(item.id); setFormOpen(true);
    if (kind === "events") {
      const start = localParts(item.start_at); const end = localParts(item.end_at);
      setDraft({...item,start_date:start.date,start_time:start.time,end_date:end.date,end_time:end.time});
    } else setDraft({...item, meeting_time: item.meeting_time ? String(item.meeting_time).slice(0,5) : ""});
  }
  async function save() {
    setBusy(true); setError(""); setSuccess("");
    try {
      let body: Draft = {};
      for (const key of Object.keys(EMPTY[kind])) body[key] = draft[key];
      if (kind === "team" && editing) {delete body.email; delete body.password;}
      if (kind === "events") {
        body = {name: draft.name, event_type: draft.event_type, location: draft.location, description: draft.description, active: draft.active,
          start_at: eventTimestamp(text("start_date"),text("start_time")),
          end_at: text("end_date") || text("end_time") ? eventTimestamp(text("end_date"),text("end_time")) : null};
      }
      if (kind === "cells") body.meeting_time = text("meeting_time") || null;
      if (kind === "church" || editing) await api.patch(kind === "church" ? endpoint : `${endpoint}${editing}/`,body);
      else await api.post(endpoint,body);
      await load(); setSuccess("Cadastro salvo com sucesso.");
      if (kind !== "church") {setFormOpen(false); setEditing(null); setDraft({...EMPTY[kind]});}
    } catch (e) {setError(e instanceof Error && !("status" in e) ? e.message : describeError(e,"Não foi possível salvar o cadastro").message);} finally {setBusy(false);}
  }
  if (!allowed) return <Screen title={TITLES[kind]}><InlineNotice tone="error" message="Esta área é exclusiva da administração da igreja."/></Screen>;
  return <Screen title={TITLES[kind]} headerSubtitle="Cadastros e configurações da igreja" refreshing={loading} onRefresh={() => {if (!formOpen || kind === "church") void load();}}>
    <Button variant="ghost" disabled={busy} onPress={() => router.push("/settings" as never)}>Voltar às configurações</Button>
    {error ? <InlineNotice tone="error" title="Confira os dados" message={error}/> : null}
    {success ? <InlineNotice tone="success" message={success}/> : null}
    {loading ? <Text style={styles.copy}>Carregando cadastro…</Text> : options ? <>
      {kind !== "church" && !formOpen ? <Button onPress={() => {setDraft({...EMPTY[kind]}); setEditing(null); setFormOpen(true); setSuccess("");}}>Adicionar cadastro</Button> : null}
      {kind !== "church" ? items.map(item => <Card key={item.id}>
        <Text style={styles.heading}>{item.name || item.email as string}</Text>
        {kind === "team" ? <Text style={styles.copy}>{String(item.email)} · {options?.roles.find(role => role.value === item.role)?.label}{item.is_active ? "" : " · Inativo"}</Text> : null}
        {kind === "events" ? <Text style={styles.copy}>{localParts(item.start_at).date} · {localParts(item.start_at).time} · {item.active ? "Publicado" : "Rascunho"}</Text> : null}
        {item.location ? <Text style={styles.copy}>{String(item.location)}</Text> : null}
        {item.description ? <Text style={styles.copy}>{String(item.description)}</Text> : null}
        {kind === "team" && (item.protected || item.id === me?.id) ? <Text style={styles.copy}>Conta protegida. Alterações pessoais são feitas pelo próprio titular.</Text> : <Button variant="secondary" disabled={busy} onPress={() => edit(item)}>Editar {item.name}</Button>}
      </Card>) : null}
      {kind !== "church" && !items.length ? <Text style={styles.copy}>Nenhum cadastro encontrado. Adicione o primeiro para começar.</Text> : null}
      {formOpen ? <Card>
        <Text style={styles.heading}>{kind === "church" ? "Informações da igreja" : editing ? "Editar cadastro" : "Novo cadastro"}</Text>
        {field("name",kind === "team" ? "Nome completo" : "Nome",kind === "team" ? 150 : 255)}
        {kind === "church" ? <>{field("legal_name","Razão social")}{field("tax_id","CNPJ",18)}{field("city","Cidade",120)}{field("state","UF",2)}</> : null}
        {kind === "team" ? <>
          {editing ? <><Text style={styles.label}>E-mail</Text><Field accessibilityLabel="E-mail" value={text("email")} editable={false}/></> : <>
            {field("email","E-mail",254)}<Text style={styles.label}>Senha inicial</Text><Field accessibilityLabel="Senha inicial" secureTextEntry value={text("password")} editable={!busy} onChangeText={value => put("password",value)}/>
            <Text style={styles.copy}>Compartilhe a senha inicial com o titular por um canal privado. A conta deverá concluir o perfil e verificar o próprio WhatsApp.</Text>
          </>}
          {choices("role","Papel principal",options?.roles || [])}
          {choices("additional_roles","Papéis adicionais (opcional)",(options?.roles || []).filter(role => role.value !== draft.role),true)}
          <Text style={styles.copy}>Os papéis liberam as áreas correspondentes no app. O painel técnico Django é exclusivo do administrador responsável.</Text>
          <Button variant="secondary" disabled={busy} onPress={() => put("is_active",!draft.is_active)}>{draft.is_active ? "Conta ativa" : "Conta inativa"}</Button>
        </> : null}
        {kind === "events" ? <>
          {choices("event_type","Tipo de evento",options?.event_types || [])}
          <DateField label="Data de início" value={text("start_date")} onChange={value => put("start_date",value)} disabled={busy}/>
          {field("start_time","Horário de início (HH:MM)",5)}
          <DateField label="Data de término (opcional)" value={text("end_date")} onChange={value => put("end_date",value)} disabled={busy}/>
          {field("end_time","Horário de término (opcional, HH:MM)",5)}
          {field("location","Local")}{field("description","Descrição",5000,true)}
          <Button variant="secondary" disabled={busy} onPress={() => put("active",!draft.active)}>{draft.active ? "Evento publicado" : "Evento em rascunho"}</Button>
        </> : null}
        {kind === "cells" ? <>
          {people("leader","Líder",options?.users || [])}{people("assistant_leader","Auxiliar",options?.users || [])}
          {choices("meeting_day","Dia do encontro",[{value:"",label:"Não definido"},...WEEKDAYS.map(day => ({value:day,label:day}))])}
          {field("meeting_time","Horário do encontro (HH:MM)",5)}{field("location","Local")}{field("notes","Observações",5000,true)}
        </> : null}
        {kind === "ministries" ? <>
          {field("description","Descrição",5000,true)}{people("coordinators","Coordenadores",options?.users || [],true)}
          {people("members","Participantes",(options?.members || []).map(member => ({id:member.id,name:member.full_name})),true)}
        </> : null}
        <Button loading={busy} disabled={!text("name").trim()} onPress={() => void save()}>Salvar cadastro</Button>
        {kind !== "church" ? <Button variant="ghost" disabled={busy} onPress={() => {setFormOpen(false); setEditing(null);}}>Cancelar edição</Button> : null}
      </Card> : null}
    </> : <Button onPress={() => void load()}>Tentar novamente</Button>}
  </Screen>;
}
const styles = StyleSheet.create({field: {gap: spacing.sm}, label: {fontSize: 14,fontWeight: "600",color:colors.ink}, heading: {fontSize:20,fontWeight:"700",color:colors.ink}, copy: {fontSize:15,lineHeight:23,color:colors.inkBody,textAlign:"justify"}, choices: {flexDirection:"row",flexWrap:"wrap",gap:spacing.sm}});
