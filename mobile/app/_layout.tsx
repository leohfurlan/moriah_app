import { useEffect } from "react";
import { Stack } from "expo-router";
import { usePathname, useRouter } from "expo-router";

import { useAuth } from "@/hooks/useAuth";

const MEMBER_PATHS = ["/profile", "/statement", "/contribution", "/schedules", "/agenda"];

function isMemberPath(pathname: string): boolean {
  return MEMBER_PATHS.includes(pathname) || pathname.startsWith("/schedule/") || pathname.startsWith("/song/");
}

export default function Layout() {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useAuth();
  const blocked = Boolean(me && !me.member_id && isMemberPath(pathname) && !me.can_access_management);

  useEffect(() => {
    if (blocked) router.replace("/home");
  }, [blocked, router]);

  if (loading && isMemberPath(pathname)) return null;
  if (blocked) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}
