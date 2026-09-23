export const ROUTES = Object.freeze({
  ADMIN: Object.freeze({
    DASHBOARD: "/admin/dashboard",
    RESERVATIONS: "/admin/reservations",
    NEW: "/admin/reservations/new",
    ADMINS: "/admin/admins",
    AUDIT_LOG: "/admin/audit-log",
    ACTIVATE: "/admin/activate",
    CMS: "/admin/cms",
    INVITATIONS: "/admin/invitations",
    ROOMS: "/admin/rooms",
    METRICS_DASHBOARD: "/admin/metrics-dashboard",
    GALLERY: (roomId: string) => `/admin/rooms/gallery?roomId=${roomId}`,
  } as const),
  AUTH: Object.freeze({
    LOGIN: "/auth/login",
    ACTIVATE: "/auth/activate",
  }),
} as const);
