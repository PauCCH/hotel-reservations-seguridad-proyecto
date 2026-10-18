/**
 * @file route.ts — POST /api/checkout — opens a payment-gateway session.
 *
 * Thin handler: parses the reservation payload and delegates to the checkout
 * feature's server gateway service, which creates the Stripe Checkout Session
 * (or a mock URL when no key is set) and returns the URL to redirect to.
 */

import { ENV } from "@/config/env";
import type { CheckoutSessionPayload } from "@/features/checkout";
import { CHECKOUT_API_ERROR, CHECKOUT_HTTP_STATUS, openGatewaySession } from "@/features/checkout";

export async function POST(request: Request) {
  // A3.3 / OP-POC-4 (anti-CSRF): only accept same-origin requests. A browser
  // sends `Origin` on cross-site and same-origin fetches alike; a cross-site
  // page (or forged form post) carries a foreign/absent Origin, so reject it.
  const origin = request.headers.get("origin");
  if (origin !== ENV.APP_URL) {
    return Response.json(
      { error: CHECKOUT_API_ERROR.FORBIDDEN_ORIGIN },
      { status: CHECKOUT_HTTP_STATUS.FORBIDDEN },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as CheckoutSessionPayload;
  const result = await openGatewaySession(payload);
  return Response.json(result.body, { status: result.status });
}
