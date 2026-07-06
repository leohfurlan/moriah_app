import { useEffect, useState } from "react";

import { api } from "@/services/api";
import { clearTokens, saveTokens } from "@/services/storage";
import { LoginResponse, MeResponse } from "@/types/api";

export function useAuth() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    try {
      const profile = await api.get<MeResponse>("/me/");
      setMe(profile);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const tokens = await api.post<LoginResponse>("/auth/login/", { email, password });
    await saveTokens(tokens.access, tokens.refresh);
    await loadProfile();
  }

  async function logout() {
    await clearTokens();
    setMe(null);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  return {
    me,
    loading,
    login,
    logout,
    refreshProfile: loadProfile,
  };
}
