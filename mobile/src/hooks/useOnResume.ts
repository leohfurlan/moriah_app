import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

export function useOnResume(callback: () => void) {
  const current = useRef(callback);
  current.current = callback;
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const resume = () => { if (document.visibilityState === "visible") current.current(); };
      document.addEventListener("visibilitychange", resume);
      return () => document.removeEventListener("visibilitychange", resume);
    }
    const listener = AppState.addEventListener("change", state => { if (state === "active") current.current(); });
    return () => listener.remove();
  }, []);
}
