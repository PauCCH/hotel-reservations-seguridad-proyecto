import type { AuthErrorKey } from "./resolveAuthError";

export type AuthErrorSearchParams = { [key: string]: string | string[] | undefined };

export interface AuthErrorPageProps {
  searchParams: Promise<AuthErrorSearchParams>;
}

export interface AuthErrorContentProps {
  /** Allowlisted key resolved on the server; raw query values never reach the client. */
  errorKey: AuthErrorKey;
}
