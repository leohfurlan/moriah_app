import { PropsWithChildren, ReactNode, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import {
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { colors, radius, routeLabels, spacing } from "@/theme";
import { MVP_NOTIFICATIONS } from "@/notifications";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  HandCoins,
  House,
  LayoutDashboard,
  Menu,
  Search,
  Settings2,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react-native";

function parentOf(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "";
  const last = segments[segments.length - 1];
  if (last in routeLabels) return "";
  const parent = segments[segments.length - 2];
  return routeLabels[parent] || "";
}

type SidebarItem = {
  label: string;
  route: string;
  Icon: typeof House;
};

const sidebarGroups: Array<{ label: string; items: SidebarItem[] }> = [
  {
    label: "Home",
    items: [
      { label: "Início", route: "home", Icon: LayoutDashboard },
      { label: "Membros", route: "members", Icon: Users },
      { label: "Visitantes", route: "visitors", Icon: UserRound },
    ],
  },
  {
    label: "Agenda",
    items: [
      { label: "Agenda", route: "agenda", Icon: CalendarDays },
      { label: "Cultos e eventos", route: "events", Icon: House },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Visão geral", route: "finance", Icon: WalletCards },
      { label: "Contribuições", route: "statement", Icon: HandCoins },
      { label: "Gestão financeira", route: "finance-management", Icon: ClipboardList },
    ],
  },
  {
    label: "Ministérios",
    items: [
      { label: "Ministérios", route: "ministries", Icon: Users },
      { label: "Escalas", route: "schedules", Icon: CalendarDays },
    ],
  },
  {
    label: "Louvor",
    items: [
      { label: "Setlists", route: "setlists", Icon: ClipboardList },
      { label: "Repertório", route: "repertoire", Icon: BookOpen },
      { label: "Bandas", route: "bands", Icon: HandCoins },
    ],
  },
  { label: "Conteúdo", items: [{ label: "Palavras", route: "content", Icon: BookOpen }] },
  {
    label: "Ensino",
    items: [
      { label: "Escola Bíblica", route: "bible-school", Icon: BookOpen },
      { label: "Turmas", route: "classes", Icon: Users },
    ],
  },
];

const mobileNavItems = [
  { route: "home", label: "Início", Icon: House },
  { route: "agenda", label: "Agenda", Icon: CalendarDays },
  { route: "schedules", label: "Escalas", Icon: HandCoins },
  { route: "statement", label: "Contribuições", Icon: BookOpen },
  { route: "profile", label: "Perfil", Icon: UserRound },
];

function isActiveRoute(route: string, activeRoute: string) {
  if (route === "home") return activeRoute === "home";
  if (route === "agenda") return activeRoute === "agenda";
  if (route === "events") return activeRoute === "events";
  if (route === "finance") return activeRoute === "finance";
  if (route === "finance-management") return activeRoute === "finance-management";
  if (route === "schedules") return ["schedules", "schedule", "song", "schedule-create"].includes(activeRoute);
  if (route === "statement") return ["statement", "contribution"].includes(activeRoute);
  if (route === "profile") return activeRoute === "profile";
  if (["members", "visitors", "ministries", "setlists", "repertoire", "bands", "bible-school", "classes"].includes(route)) return activeRoute === route;
  return false;
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate: (route: string) => void }) {
  const activeRoute = pathname.split("/").filter(Boolean)[0] || "home";
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { me } = useAuth();
  const visibleGroups = sidebarGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !["finance", "finance-management"].includes(item.route) || Boolean(me?.capabilities.includes("manage_finance"))),
    }))
    .filter((group) => group.items.length);
  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>M</Text></View>
        <View>
          <Text style={styles.brandTitle}>Moriah</Text>
          <Text style={styles.brandSubtitle}>Igreja Moriah</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarGroups}>
        {visibleGroups.map((group) => (
          <View key={group.label} style={styles.sidebarGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: !collapsedGroups[group.label] }}
              onPress={() => setCollapsedGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}
              style={({ pressed }) => [styles.sidebarGroupHeader, pressed && styles.pressed]}
            >
              <Text style={styles.sidebarGroupLabel}>{group.label.toUpperCase()}</Text>
              {collapsedGroups[group.label] ? <ChevronRight size={14} color="#667085" /> : <ChevronDown size={14} color="#667085" />}
            </Pressable>
            {!collapsedGroups[group.label] && group.items.map((item, index) => {
              const active = isActiveRoute(item.route, activeRoute);
              return (
                <Pressable
                  key={group.label + item.label + index}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onNavigate(item.route)}
                  style={({ pressed }) => [
                    styles.sidebarItem,
                    active && styles.sidebarItemActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <item.Icon size={15} strokeWidth={1.8} color={active ? colors.onAccent : "#98A2B3"} />
                  <Text style={[styles.sidebarItemText, active && styles.sidebarItemTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.sidebarFooter}>
        <Settings2 size={15} color="#98A2B3" />
        <Text style={styles.sidebarFooterText}>Configurações</Text>
      </View>
    </View>
  );
}

function NotificationPopover({ onClose, onNavigate }: { onClose: () => void; onNavigate: (route: string) => void }) {
  return (
    <View style={styles.notificationPopover}>
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationTitle}>Notificações</Text>
        <Pressable onPress={onClose}><Text style={styles.markRead}>Marcar lidas</Text></Pressable>
      </View>
      {MVP_NOTIFICATIONS.slice(0, 3).map((notification, index) => (
        <Pressable
          key={notification.id}
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
      <Pressable onPress={() => { onClose(); onNavigate("notifications"); }}>
        <Text style={styles.viewAll}>Ver todas</Text>
      </Pressable>
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const activeRoute = pathname.split("/").filter(Boolean)[0] || "home";
  const onNavigate = (route: string) => router.replace(("/" + route) as never);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={appShell ? styles.desktopShell : styles.mobileShell}>
        {appShell ? <Sidebar pathname={pathname} onNavigate={onNavigate} /> : null}
        <View style={appShell ? styles.desktopMain : styles.mobileMain}>
          {appShell ? (
            <View style={styles.desktopTopbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Recolher menu"
                style={({ pressed }) => [styles.sidebarToggle, pressed && styles.pressed]}
              >
                <Menu size={18} color={colors.inkBody} />
              </Pressable>
              <View style={styles.topbarGreeting}>
                <Text style={styles.topbarChurch}>Igreja Moriah</Text>
                <Text accessibilityRole="header" style={styles.topbarTitle}>{title}</Text>
              </View>
              <View style={styles.topbarActions}>
                <View style={styles.globalSearch}>
                  <Search size={16} color={colors.inkMuted} />
                  <Text style={styles.globalSearchText}>Buscar no Moriah</Text>
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
                    <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>3</Text></View>
                  </Pressable>
                  {notificationsOpen ? <NotificationPopover onClose={() => setNotificationsOpen(false)} onNavigate={onNavigate} /> : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir perfil"
                  onPress={() => onNavigate("profile")}
                  style={({ pressed }) => [styles.profilePill, pressed && styles.pressed]}
                >
                  <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>AM</Text></View>

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
      {showBottomNav && !appShell ? <BottomNav pathname={pathname} onNavigate={onNavigate} /> : null}
    </SafeAreaView>
  );
}

function BottomNav({ pathname, onNavigate }: { pathname: string; onNavigate: (route: string) => void }) {
  const activeRoute = pathname.split("/").filter(Boolean)[0] || "home";
  return (
    <View style={styles.bottomNav}>
      {mobileNavItems.map((item) => {
        const active = isActiveRoute(item.route, activeRoute);
        return (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => onNavigate(item.route)}
            style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && styles.pressed]}
          >
            <item.Icon size={19} strokeWidth={1.8} color={active ? colors.accent : colors.inkMuted} />
            <Text numberOfLines={1} style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
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
  sidebarGroupHeader: { minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sidebarGroupLabel: { color: "#667085", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginBottom: 5 },
  sidebarItem: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 27, borderRadius: 6, paddingHorizontal: 10 },
  sidebarItemActive: { backgroundColor: "#27315A" },
  sidebarItemText: { color: "#D0D5DD", fontSize: 12, fontWeight: "500" },
  sidebarItemTextActive: { color: colors.onAccent, fontWeight: "700" },
  sidebarFooter: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#1D2939", paddingTop: 14 },
  sidebarFooterText: { color: "#98A2B3", fontSize: 12 },
  desktopTopbar: { height: 92, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, position: "relative", zIndex: 40, overflow: "visible" },
  sidebarToggle: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  topbarGreeting: { marginLeft: 18, flex: 1, gap: 3 },
  topbarChurch: { color: colors.inkMuted, fontSize: 12 },
  topbarTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.2 },
  topbarActions: { flexDirection: "row", alignItems: "center", gap: 10, position: "relative", zIndex: 41 },
  globalSearch: { width: 260, height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  globalSearchText: { color: colors.inkPlaceholder, fontSize: 12 },
  notificationAnchor: { position: "relative", zIndex: 42 },
  topbarIconButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  notificationBadge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.canvas },
  notificationBadgeText: { color: colors.onAccent, fontSize: 9, fontWeight: "800" },
  profilePill: { width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: colors.avatar, borderRadius: 6 },
  profileAvatar: { width: "100%", height: "100%", borderRadius: 6, backgroundColor: colors.avatar, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { color: colors.accent, fontSize: 9, fontWeight: "800" },
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
