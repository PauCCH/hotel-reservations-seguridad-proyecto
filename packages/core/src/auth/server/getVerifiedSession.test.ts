import type { SupabaseServerClient } from "@hotel/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVerifiedSession } from "./getVerifiedSession";

const mockGetUser = vi.fn();
const mockGetSession = vi.fn();

const supabase = {
  auth: { getUser: mockGetUser, getSession: mockGetSession },
} as unknown as SupabaseServerClient;

const verifiedUser = { id: "user-verified", email: "ada@example.com" };

describe("getVerifiedSession (AUTH-POC-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns nulls when Supabase Auth rejects the token, even if a cookie session exists", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "invalid JWT" },
    });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "forged", user: { id: "attacker" } } },
      error: null,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getVerifiedSession(supabase);

    expect(result).toEqual({ session: null, user: null });
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("returns nulls without logging when there is no session at all", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await getVerifiedSession(supabase)).toEqual({ session: null, user: null });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("uses the verified user instead of the user decoded from the cookie", async () => {
    mockGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token", user: { id: "from-cookie" } } },
      error: null,
    });

    const result = await getVerifiedSession(supabase);

    expect(result.user).toBe(verifiedUser);
    expect(result.session?.user).toBe(verifiedUser);
    expect(result.session?.access_token).toBe("token");
  });
});
