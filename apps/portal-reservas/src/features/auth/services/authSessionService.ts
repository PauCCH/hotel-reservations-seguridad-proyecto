import type { User } from "@supabase/supabase-js";
import { AUTH_LOG_MESSAGES as LOG } from "@/features/auth/constants/log-messages";
import { getSessionUserAction, signOutAction } from "./sessionActions";

// Session cookies are HttpOnly (P3.3): the browser client can't see them, so these
// helpers delegate to Server Actions instead of `createSupabaseClient().auth`.

export const getSession = async (): Promise<User | null> => {
  try {
    return await getSessionUserAction();
  } catch (error) {
    console.error(LOG.SESSION_FETCH_ERROR, error);
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await signOutAction();
  } catch (error) {
    console.error(LOG.SESSION_FETCH_ERROR, error); // Using same log for now or could add a specific one
    throw error;
  }
};
