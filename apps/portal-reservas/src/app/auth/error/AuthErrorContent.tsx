"use client";

import { Button } from "@heroui/react";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { useI18n } from "@/locales";
import type { AuthErrorContentProps } from "./page.interface";
import { AUTH_ERROR_STYLES } from "./page.styles";

export function AuthErrorContent({ errorKey }: AuthErrorContentProps) {
  const { t } = useI18n();

  return (
    <div className={AUTH_ERROR_STYLES.root}>
      <div className={AUTH_ERROR_STYLES.card}>
        <h1 className={AUTH_ERROR_STYLES.title}>{t.AUTH.ERRORS.AUTH_ERROR_TITLE}</h1>
        <p className={AUTH_ERROR_STYLES.description}>{t.AUTH.ERRORS[errorKey]}</p>

        <div className={AUTH_ERROR_STYLES.codeWrapper}>
          <p className={AUTH_ERROR_STYLES.codeText}>
            <strong>{t.AUTH.ERRORS.AUTH_ERROR_CODE}</strong> {errorKey.toLowerCase()}
          </p>
        </div>

        <Button
          render={(props: any) => <Link {...props} href={ROUTES.AUTH.LOGIN} />}
          variant={AUTH_ERROR_STYLES.buttonVariant}
          className={AUTH_ERROR_STYLES.button}
        >
          {t.AUTH.ERRORS.BACK_TO_LOGIN}
        </Button>
      </div>
    </div>
  );
}
