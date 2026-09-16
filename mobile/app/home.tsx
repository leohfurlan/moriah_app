import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { HomeScreen } from "@/screens/HomeScreen";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const router = useRouter();
  const { me, loading, logout } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!me) {
    router.replace("/");
    return null;
  }

  return (
    <HomeScreen
      me={me}
      canAccessManagement={me.can_access_management}
      onNavigate={(route) => router.push(`/${route}` as never)}
      onLogout={async () => {
        await logout();
        router.replace("/");
      }}
    />
  );
}
