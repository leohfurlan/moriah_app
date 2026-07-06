import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_KEY = "moriah_access_token";
const REFRESH_KEY = "moriah_refresh_token";

export async function saveTokens(access: string, refresh: string) {
  await AsyncStorage.multiSet([
    [ACCESS_KEY, access],
    [REFRESH_KEY, refresh],
  ]);
}

export async function getAccessToken() {
  return AsyncStorage.getItem(ACCESS_KEY);
}

export async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_KEY);
}

export async function saveAccessToken(access: string) {
  await AsyncStorage.setItem(ACCESS_KEY, access);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}
