"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useUserStore } from "@/store/userStore";
import { AUTH_LOG_MESSAGES as LOG } from "../constants/log-messages";
import { getSession } from "../services/authSessionService";

export function useAuthSession() {
  const { user, isLoading, setUser, setIsLoading } = useUserStore();
  const pathname = usePathname();

  // The session lives in HttpOnly cookies (P3.3), so there is no browser-side
  // onAuthStateChange. Login/logout always navigate, so re-reading the verified
  // user from the server on every route change keeps the header in sync.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the refetch trigger
  useEffect(() => {
    let cancelled = false;

    const fetchSession = async () => {
      try {
        setIsLoading(true);
        const currentUser = await getSession();
        if (!cancelled) setUser(currentUser);
      } catch (error) {
        console.error(LOG.SESSION_FETCH_ERROR, error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchSession();

    return () => {
      cancelled = true;
    };
  }, [pathname, setUser, setIsLoading]);

  return { user, isLoading };
}
