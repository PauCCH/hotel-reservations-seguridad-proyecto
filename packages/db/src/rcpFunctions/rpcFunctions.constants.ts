import type { Database } from "../database.types";

export const RPC_FUNCTIONS: Record<string, keyof Database["public"]["Functions"]> = {
  GET_ADMINS: "get_admins",
  PROMOTE_INVITED_ADMIN: "promote_invited_admin",
};
