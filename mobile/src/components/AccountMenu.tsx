import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, LogOut, UserRound } from "lucide-react-native";
import { useAuth } from "@/hooks/useAuth";
import { colors, radius } from "@/theme";
import { MotionView, useReducedMotion } from "./Motion";
import { InlineNotice } from "./Feedback";

export function AccountMenu({compact = false}: {compact?: boolean}) {
  const {me, logout} = useAuth();
  const router = useRouter();
  const {width, height} = useWindowDimensions();
  const reduced = useReducedMotion();
  const anchor = useRef<View>(null);
  const trigger = useRef<View>(null);
  const [position, setPosition] = useState({top:72,left:16});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const escape = (event: KeyboardEvent) => {if (event.key === "Escape" && !busy) setOpen(false);};
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open,busy]);
  if (!me) return null;
  const name = [me.first_name,me.last_name].filter(Boolean).join(" ") || me.email;
  const initials = name.split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
  const menuWidth = Math.min(280, width-32);
  const close = () => {if (!busy) setOpen(false);};
  return <>
    <View ref={anchor} collapsable={false}>
      <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel="Abrir menu da conta" accessibilityState={{expanded:open}}
        onPress={() => {setError(false); anchor.current?.measureInWindow((x,y,w,h) => {
          setPosition({left:Math.max(16,Math.min(x+w-menuWidth,width-menuWidth-16)),top:Math.max(16,Math.min(y+h+8,height-260))}); setOpen(true);
        });}} style={({pressed}) => [styles.trigger,compact && styles.compact,pressed && {opacity:.85}]}>
        <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
        {!compact ? <><Text numberOfLines={1} style={styles.name}>{name}</Text><ChevronDown size={14} color={colors.inkMuted}/></> : null}
      </Pressable>
    </View>
    <Modal visible={open} transparent animationType={reduced ? "none" : "fade"} onRequestClose={close} onDismiss={() => trigger.current?.focus()}>
      <View style={styles.layer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu da conta" onPress={close} style={StyleSheet.absoluteFill}/>
        <MotionView testID="account-menu" style={[styles.menu,{width:menuWidth,top:position.top,left:position.left}]}>
          <Text style={styles.heading}>{name}</Text><Text numberOfLines={1} style={styles.email}>{me.email}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Meu Perfil" disabled={busy} onPress={() => {setOpen(false);router.push("/profile");}} style={({pressed}) => [styles.item,pressed && styles.pressed]}>
            <UserRound size={18} color={colors.inkBody}/><Text style={styles.itemText}>Meu Perfil</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Sair da conta" disabled={busy} accessibilityState={{busy,disabled:busy}} onPress={async () => {
            setBusy(true);setError(false);
            try {await logout();setOpen(false);router.replace("/");} catch {setError(true);} finally {setBusy(false);}
          }} style={({pressed}) => [styles.item,pressed && styles.pressed]}>
            <LogOut size={18} color={colors.danger}/><Text style={[styles.itemText,{color:colors.danger}]}>{busy ? "Saindo…" : "Sair"}</Text>
          </Pressable>
          {error ? <InlineNotice tone="error" message="Não foi possível sair. Tente novamente."/> : null}
        </MotionView>
      </View>
    </Modal>
  </>;
}
const styles=StyleSheet.create({
  trigger:{minHeight:44,flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:10,backgroundColor:colors.avatar,borderRadius:10,maxWidth:250},
  compact:{paddingHorizontal:6},avatar:{width:28,height:28,borderRadius:7,backgroundColor:colors.surface,alignItems:"center",justifyContent:"center"},
  initials:{fontSize:11,fontWeight:"800",color:colors.accent},name:{flexShrink:1,color:colors.ink,fontSize:12,fontWeight:"700"},
  layer:{flex:1},menu:{position:"absolute",backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.card,padding:12,gap:4,shadowColor:"#101828",shadowOpacity:.16,shadowRadius:20,shadowOffset:{width:0,height:8},elevation:8},
  heading:{color:colors.ink,fontSize:14,fontWeight:"700",paddingHorizontal:8,paddingTop:4},email:{color:colors.inkMuted,fontSize:12,paddingHorizontal:8,marginBottom:8},
  item:{minHeight:44,flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:10,borderRadius:8},itemText:{fontSize:14,color:colors.inkBody,fontWeight:"600"},pressed:{backgroundColor:colors.surfaceSelected},
});
