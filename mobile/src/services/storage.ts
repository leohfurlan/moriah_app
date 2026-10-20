import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_KEY = "moriah_access_token";
const REFRESH_KEY = "moriah_refresh_token";

let accessToken: string | null = null;
let purge: Promise<void> | null = null;

async function purgeLegacy() {
  // Old credentials are discarded, never migrated into a new live session.
  if (!purge) purge = AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
  await purge;
}

export async function saveTokens(access: string, refresh?: string) {
  await purgeLegacy();
  if (Platform.OS !== "web" && refresh) {
    await SecureStore.setItemAsync(REFRESH_KEY, refresh, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  accessToken = access;
}

export async function getAccessToken() {
  await purgeLegacy();
  return accessToken;
}

export async function getRefreshToken() {
  await purgeLegacy();
  return Platform.OS === "web" ? null : SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveAccessToken(access: string) {
  accessToken = access;
}

export async function clearTokens() {
  accessToken = null;
  await purgeLegacy();
  if (Platform.OS !== "web") await SecureStore.deleteItemAsync(REFRESH_KEY);
}

// Non-secret intent prevents an offline logout from silently signing back in.
export async function setPendingLogout(pending: boolean) {
  if (pending) await AsyncStorage.setItem("moriah_pending_logout", "1");
  else await AsyncStorage.removeItem("moriah_pending_logout");
}
export async function hasPendingLogout() {
  return (await AsyncStorage.getItem("moriah_pending_logout")) === "1";
}
