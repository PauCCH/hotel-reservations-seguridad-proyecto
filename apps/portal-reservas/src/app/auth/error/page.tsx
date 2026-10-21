import type { Metadata } from "next";
import { getServerTranslations } from "@/locales/server";
import { AuthErrorContent } from "./AuthErrorContent";
import type { AuthErrorPageProps } from "./page.interface";
import { resolveAuthErrorKey } from "./resolveAuthError";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslations();

  return {
    title: t.AUTH.ERRORS.AUTH_ERROR_TITLE,
  };
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  // AUTH-POC-4 / O-04 (P3.2): resolve on the server so only the allowlisted key is
  // serialized to the client component, never the raw query values.
  const errorKey = resolveAuthErrorKey(await searchParams);
  return <AuthErrorContent errorKey={errorKey} />;
}
