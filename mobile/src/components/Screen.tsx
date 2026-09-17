import { PropsWithChildren, ReactNode, useMemo, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import {
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Bell, Menu, Search } from "lucide-react-native";

import { colors, radius, routeLabels, spacing } from "@/theme";
import { MVP_NOTIFICATIONS } from "@/notifications";
import { useAuth } from "@/hooks/useAuth";
import { ABAS, NavGroup, ResultadoBusca, buscaItens, gruposVisiveis, rotaAtiva, temAcesso } from "@/navigation";
import { MeResponse } from "@/types/api";

function parentOf(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "";
  const last = segments[segments.length - 1];
  if (last in routeLabels) return "";
  const parent = segments[segments.length - 2];
  return routeLabels[parent] || "";
}

function nomeDaConta(me: MeResponse | null): string {
  const completo = [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim();
  return completo || me?.member_name || me?.email || "";
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function Sidebar({ pathname, onNavigate, recolhida, grupos }: { pathname: string; onNavigate: (route: string) => void; recolhida: boolean; grupos: NavGroup[] }) {
  return (
    <View style={[styles.sidebar, recolhida && styles.sidebarRecolhida]}>
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>M</Text>
        </View>
        {recolhida ? null : (
          <View>
            <Text style={styles.brandTitle}>Moriah</Text>
            <Text style={styles.brandSubtitle}>Igreja Moriah</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarGroups}>
        {grupos.map((grupo) => (
          <View key={grupo.label} style={styles.sidebarGroup}>
            {recolhida ? null : <Text style={styles.sidebarGroupLabel}>{grupo.label.toUpperCase()}</Text>}
            {grupo.items.map((item) => {
              const ativo = rotaAtiva(pathname, item.matches);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: ativo }}
                  onPress={() => onNavigate(item.route)}
                  style={({ pressed }) => [styles.sidebarItem, recolhida && styles.sidebarItemRecolhida, ativo && styles.sidebarItemActive, pressed && styles.pressed]}
                >
                  <item.Icon size={15} strokeWidth={1.8} color={ativo ? colors.onAccent : "#98A2B3"} />
                  {recolhida ? null : <Text style={[styles.sidebarItemText, ativo && styles.sidebarItemTextActive]}>{item.label}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
function NotificationPopover({ onClose, onNavigate }: { onClose: () => void; onNavigate: (route: string) => void }) {
  return (
    <View style={styles.notificationPopover}>
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationTitle}>Notificações ({MVP_NOTIFICATIONS.length})</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar notificações" onPress={onClose}>
          <Text style={styles.markRead}>Fechar</Text>
        </Pressable>
      </View>
      {MVP_NOTIFICATIONS.slice(0, 3).map((notification, index) => (
        <Pressable
          key={notification.id}
          accessibilityRole="button"
          accessibilityLabel={"Abrir notificação: " + notification.title}
          onPress={() => { onClose(); onNavigate("notifications"); }}
          style={[styles.notificationRow, index === 0 && styles.notificationRowUnread]}
        >
          <View style={styles.notificationDot}><Bell size={14} color={colors.accent} /></View>
          <View style={styles.notificationCopy}>
            <Text numberOfLines={1} style={styles.notificationRowTitle}>{notification.title}</Text>
            <Text numberOfLines={1} style={styles.notificationMeta}>{notification.time}</Text>
          </View>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Ver todas as notificações" onPress={() => { onClose(); onNavigate("notifications"); }}>
        <Text style={styles.viewAll}>Ver todas</Text>
      </Pressable>
      <Text style={styles.notificationNote}>Conteúdo de demonstração do MVP.</Text>
    </View>
  );
}
export function Screen({
  children,
  title,
  refreshing = false,
  onRefresh,
  showBottomNav = true,
  headerSubtitle,
  headerAccessory,
}: PropsWithChildren<{
  title: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  showBottomNav?: boolean;
  headerSubtitle?: string;
  headerAccessory?: ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const appShell = desktop && pathname !== "/";
  const parentLabel = parentOf(pathname);
  const { me } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuRecolhido, setMenuRecolhido] = useState(false);
  const [busca, setBusca] = useState("");
  const capabilities = me?.capabilities ?? [];
  const grupos = useMemo(() => gruposVisiveis(capabilities), [me]);
  const resultados = useMemo(() => buscaItens(busca, grupos), [busca, grupos]);
  const nome = nomeDaConta(me);
  const sigla = iniciais(nome);
  const onNavigate = (route: string) => router.replace(("/" + route) as never);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={appShell ? styles.desktopShell : styles.mobileShell}>
        {appShell ? <Sidebar pathname={pathname} onNavigate={onNavigate} recolhida={menuRecolhido} grupos={grupos} /> : null}
        <View style={appShell ? styles.desktopMain : styles.mobileMain}>
          {appShell ? (
            <View style={styles.desktopTopbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={menuRecolhido ? "Expandir menu" : "Recolher menu"}
                accessibilityState={{ expanded: !menuRecolhido }}
                onPress={() => setMenuRecolhido((atual) => !atual)}
                style={({ pressed }) => [styles.sidebarToggle, pressed && styles.pressed]}
              >
                <Menu size={18} color={colors.inkBody} />
              </Pressable>
              <View style={styles.topbarGreeting}>
                <Text style={styles.topbarChurch}>Igreja Moriah</Text>
                <Text accessibilityRole="header" style={styles.topbarTitle}>{title}</Text>
              </View>
              <View style={styles.topbarActions}>
                <View style={styles.searchAnchor}>
                  <View style={styles.globalSearch}>
                    <Search size={16} color={colors.inkMuted} />
                    <TextInput
                      accessibilityLabel="Buscar no Moriah"
                      value={busca}
                      onChangeText={setBusca}
                      placeholder="Buscar no Moriah"
                      placeholderTextColor={colors.inkPlaceholder}
                      style={styles.globalSearchInput}
                    />
                  </View>
                  {busca.trim() ? (
                    <View style={styles.searchResults}>
                      {resultados.length === 0 ? (
                        <Text style={styles.searchEmptyText}>Nada encontrado nesta conta.</Text>
                      ) : (
                        resultados.map((resultado: ResultadoBusca) => (
                          <Pressable
                            key={resultado.id}
                            accessibilityRole="button"
                            accessibilityLabel={"Ir para " + resultado.label}
                            onPress={() => {
                              setBusca("");
                              onNavigate(resultado.route);
                            }}
                            style={({ pressed }) => [styles.searchResultRow, pressed && styles.pressed]}
                          >
                            <resultado.Icon size={15} strokeWidth={1.8} color={colors.inkBody} />
                            <Text style={styles.searchResultText}>{resultado.label}</Text>
                            <Text style={styles.searchResultGroup}>{resultado.grupo}</Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
                <View style={styles.notificationAnchor}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Abrir notificações"
                    accessibilityState={{ expanded: notificationsOpen }}
                    onPress={() => setNotificationsOpen((current) => !current)}
                    style={({ pressed }) => [styles.topbarIconButton, pressed && styles.pressed]}
                  >
                    <Bell size={17} color={colors.inkBody} />
                  </Pressable>
                  {notificationsOpen ? <NotificationPopover onClose={() => setNotificationsOpen(false)} onNavigate={onNavigate} /> : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={nome ? "Abrir perfil de " + nome : "Abrir perfil"}
                  onPress={() => onNavigate("profile")}
                  style={({ pressed }) => [styles.profilePill, pressed && styles.pressed]}
                >
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{sigla}</Text>
                  </View>
                  {nome ? (
                    <Text numberOfLines={1} style={styles.profileName}>{nome}</Text>
                  ) : null}
                </Pressable>
              </View>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={[
              styles.content,
              appShell && styles.desktopContent,
              !appShell && desktop && styles.authContent,
              showBottomNav && !appShell && styles.contentWithNav,
            ]}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
          >
            {!appShell ? (
              <View style={styles.header}>
                {parentLabel ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Voltar para " + parentLabel}
                    hitSlop={12}
                    onPress={() => router.back()}
                    style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.backIcon}>←</Text>
                    <Text style={styles.backLabel}>Voltar</Text>
                  </Pressable>
                ) : null}
                <View style={styles.headerRow}>
                  <View style={styles.headerText}>
                    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
                    {headerSubtitle ? <Text style={styles.headerSubtitle}>{headerSubtitle}</Text> : null}
                  </View>
                  {headerAccessory}
                </View>
              </View>
            ) : (
              <View style={styles.desktopPageHeader}>
                {parentLabel ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Voltar para " + parentLabel}
                    onPress={() => router.back()}
                    style={({ pressed }) => [styles.desktopBackButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.backIcon}>←</Text>
                    <Text style={styles.backLabel}>Voltar</Text>
                  </Pressable>
                ) : null}
                <View style={styles.desktopPageHeaderRow}>
                  <Text style={styles.desktopPageSubtitle}>{headerSubtitle || "Gestão e vida da Igreja Moriah"}</Text>
                  {headerAccessory}
                </View>
              </View>
            )}
            <View style={[styles.body, appShell && styles.desktopBody]}>{children}</View>
          </ScrollView>
        </View>
      </View>
      {showBottomNav && !appShell ? <BottomNav pathname={pathname} onNavigate={onNavigate} capabilities={capabilities} /> : null}
    </SafeAreaView>
  );
}

function BottomNav({ pathname, onNavigate, capabilities }: { pathname: string; onNavigate: (route: string) => void; capabilities: string[] }) {
  return (
    <View style={styles.bottomNav}>
      {ABAS.filter((item) => temAcesso(item, capabilities)).map((item) => {
        const ativo = rotaAtiva(pathname, item.matches);
        return (
          <Pressable
            key={item.id}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: ativo }}
            onPress={() => onNavigate(item.route)}
            style={({ pressed }) => [styles.navItem, ativo && styles.navItemActive, pressed && styles.pressed]}
          >
            <item.Icon size={19} strokeWidth={1.8} color={ativo ? colors.accent : colors.inkMuted} />
            <Text numberOfLines={1} style={[styles.navLabel, ativo && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  mobileShell: { flex: 1 },
  desktopShell: { flex: 1, flexDirection: "row", backgroundColor: colors.canvas },
  desktopMain: { flex: 1, minWidth: 0, backgroundColor: colors.canvas },
  mobileMain: { flex: 1 },
  sidebar: { width: 280, backgroundColor: "#101828", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 26 },
  brandMark: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: colors.onAccent, fontSize: 19, fontWeight: "800" },
  brandTitle: { color: colors.onAccent, fontSize: 17, fontWeight: "800" },
  brandSubtitle: { color: "#98A2B3", fontSize: 11, marginTop: 2 },
  sidebarGroups: { gap: 15, paddingBottom: 16 },
  sidebarGroup: { gap: 2 },
  sidebarGroupLabel: { color: "#667085", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginBottom: 5 },
  sidebarItem: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 27, borderRadius: 6, paddingHorizontal: 10 },
  sidebarItemActive: { backgroundColor: "#27315A" },
  sidebarItemText: { color: "#D0D5DD", fontSize: 12, fontWeight: "500" },
  sidebarItemTextActive: { color: colors.onAccent, fontWeight: "700" },
  sidebarRecolhida: { width: 76, paddingHorizontal: 12 },
  sidebarItemRecolhida: { justifyContent: "center", paddingHorizontal: 0, gap: 0 },
  desktopTopbar: { height: 92, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, position: "relative", zIndex: 40, overflow: "visible" },
  sidebarToggle: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  topbarGreeting: { marginLeft: 18, flex: 1, gap: 3 },
  topbarChurch: { color: colors.inkMuted, fontSize: 12 },
  topbarTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.2 },
  topbarActions: { flexDirection: "row", alignItems: "center", gap: 10, position: "relative", zIndex: 41 },
  globalSearch: { width: 300, height: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.field },
  globalSearchText: { color: colors.inkPlaceholder, fontSize: 12 },
  globalSearchInput: { flex: 1, height: 40, color: colors.ink, fontSize: 13, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0, backgroundColor: "transparent", outlineColor: "transparent", outlineWidth: 0 },
  searchAnchor: { position: "relative", zIndex: 43 },
  searchResults: { position: "absolute", top: 56, left: 0, width: 336, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.field, padding: 8, gap: 4, zIndex: 120, shadowColor: "#101828", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  searchResultRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40, paddingHorizontal: 10, borderRadius: 8 },
  searchResultText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: "600" },
  searchResultGroup: { color: colors.inkMuted, fontSize: 11 },
  searchEmptyText: { color: colors.inkMuted, fontSize: 12, paddingHorizontal: 10, paddingVertical: 10 },
  notificationAnchor: { position: "relative", zIndex: 42 },
  topbarIconButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  profilePill: { height: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, backgroundColor: colors.avatar, borderRadius: 6, maxWidth: 230 },
  profileName: { flexShrink: 1, color: colors.ink, fontSize: 12, fontWeight: "700" },
  profileAvatar: { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { color: colors.accent, fontSize: 11, fontWeight: "800" },
  notificationPopover: { position: "absolute", zIndex: 100, top: 50, right: 0, width: 300, minHeight: 310, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16, shadowColor: "#101828", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  notificationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  notificationTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  markRead: { color: colors.accent, fontSize: 11, fontWeight: "700" },
  notificationRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, borderRadius: 6 },
  notificationRowUnread: { backgroundColor: "#F8F9FF" },
  notificationDot: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  notificationCopy: { flex: 1, gap: 2 },
  notificationRowTitle: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  notificationMeta: { color: colors.inkMuted, fontSize: 10 },
  viewAll: { color: colors.accent, fontSize: 11, fontWeight: "700", marginTop: 16 },
  notificationNote: { color: colors.inkMuted, fontSize: 10, marginTop: 8 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl + spacing.lg },
  desktopContent: { width: "100%", maxWidth: 1088, alignSelf: "center", paddingHorizontal: 0, paddingTop: 0, paddingBottom: 44 },
  authContent: { flexGrow: 1, width: "100%", maxWidth: 760, alignSelf: "center", paddingTop: 48, paddingBottom: 80 },
  contentWithNav: { paddingBottom: 96 },
  header: { marginBottom: spacing.lg },
  desktopPageHeader: { minHeight: 54, justifyContent: "center", marginBottom: 16 },
  desktopPageHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  desktopPageSubtitle: { color: colors.inkMuted, fontSize: 12 },
  desktopBackButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", marginBottom: 5, paddingVertical: 2 },
  backButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: spacing.xs, marginBottom: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.7 },
  backIcon: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  backLabel: { color: colors.inkBody, fontSize: 13, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  headerSubtitle: { fontSize: 11, color: colors.inkMuted },
  body: { gap: spacing.md },
  desktopBody: { gap: 16 },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "stretch", justifyContent: "space-around", minHeight: 76, paddingHorizontal: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderDivider },
  navItem: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: radius.field, paddingHorizontal: spacing.sm },
  navItemActive: { backgroundColor: colors.surfaceSelected },
  navLabel: { fontSize: 10, color: colors.inkMuted },
  navLabelActive: { color: colors.accent, fontWeight: "700" },
});