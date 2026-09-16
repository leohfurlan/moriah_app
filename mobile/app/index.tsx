import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { LoginScreen } from "@/screens/LoginScreen";
import { useAuth } from "@/hooks/useAuth";

export default function IndexPage() {
  const router = useRouter();
  const { me, loading, login } = useAuth();

  useEffect(() => {
    if (me) {
      router.replace("/home");
    }
  }, [me, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <LoginScreen onLogin={login} />;
}
