import { forbidden } from "next/navigation";
import { AuditLogTableView } from "@/features/audit-log/components/AuditLogTableView/AuditLogTableView";
import { getAuditLogs } from "@/features/audit-log/services/getAuditLogs";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/shared/auth/errors";

export default async function AuditLogPage() {
  try {
    const initialData = await getAuditLogs();

    return <AuditLogTableView initialData={initialData} />;
  } catch (e) {
    if (e instanceof AuthenticationRequiredError || e instanceof PermissionDeniedError) {
      forbidden();
    }

    throw e;
  }
}
