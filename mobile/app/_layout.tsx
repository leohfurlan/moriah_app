import { useEffect } from "react";
import { Stack } from "expo-router";
import { usePathname, useRouter } from "expo-router";

import { useAuth } from "@/hooks/useAuth";

const MEMBER_PATHS = ["/profile", "/members", "/visitors", "/statement", "/contribution", "/schedules", "/ministries", "/setlists", "/repertoire", "/bands", "/bible-school", "/classes", "/agenda", "/events", "/notifications", "/finance", "/finance-management", "/content"];

function isMemberPath(pathname: string): boolean {
  return MEMBER_PATHS.includes(pathname) || pathname.startsWith("/schedule/") || pathname.startsWith("/song/") || pathname.startsWith("/notification/") || pathname === "/schedule-create";
}

export default function Layout() {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useAuth();
  const needsLogin = Boolean(!loading && !me && isMemberPath(pathname));
  const blocked = Boolean(me && !me.member_id && isMemberPath(pathname) && !me.can_access_management);

  useEffect(() => {
    if (needsLogin) router.replace("/");
    else if (blocked) router.replace("/home");
  }, [blocked, needsLogin, router]);

  if (loading && isMemberPath(pathname)) return null;
  if (needsLogin || blocked) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}
