import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const state = vi.hoisted(() => ({
  appUrl: undefined as string | undefined,
  user: { id: "audit-user" } as { id: string } | null,
  status: "inactive",
  teamAccess: false,
  teamError: null as Error | null,
}));
vi.mock("@/lib/env", () => ({
  env: {
    get APP_URL() {
      return state.appUrl;
    },
  },
}));
vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(async () => {
    const response = NextResponse.next();
    response.cookies.set("audit-refreshed-session", "new-token", {
      httpOnly: true,
    });
    return {
      response,
      user: state.user,
      supabase: {
        rpc: async () => ({ data: state.teamAccess, error: state.teamError }),
        auth: {
          getClaims: async () => ({
            data: {
              claims: {
                app_metadata: {
                  subscription_status: state.status,
                  trial_ends_at: "2020-01-01",
                },
              },
            },
          }),
        },
      },
    };
  }),
}));
import { proxy } from "@/proxy";
import { updateSession } from "@/lib/supabase/proxy";

beforeEach(() => {
  state.appUrl = undefined;
  state.user = { id: "audit-user" };
  state.status = "inactive";
  state.teamAccess = false;
  state.teamError = null;
  vi.clearAllMocks();
});

describe("accès aux paiements et routage", () => {
  it.each(["/api/stripe/checkout", "/api/stripe/portal"])(
    "laisse un compte expiré atteindre %s",
    async (path) => {
      const res = await proxy(
        new NextRequest(`https://app.example.test${path}`, { method: "POST" }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("garde l'application protégée et conserve les cookies rafraîchis", async () => {
    const res = await proxy(
      new NextRequest("https://app.example.test/explorer"),
    );
    expect(res.headers.get("location")).toBe(
      "https://app.example.test/auth/abonnement",
    );
    expect(res.cookies.get("audit-refreshed-session")?.value).toBe("new-token");
  });

  it("retourne un 401 JSON aux appels API anonymes", async () => {
    state.user = null;
    const res = await proxy(
      new NextRequest("https://app.example.test/api/stripe/checkout", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("sert la liste d'attente sur le domaine vitrine, sans redirection CORS", async () => {
    state.appUrl = "https://app.example.test";
    const res = await proxy(
      new NextRequest("https://example.test/api/waitlist", {
        method: "POST",
        headers: { host: "example.test" },
      }),
    );
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("le webhook signé ne dépend pas de Supabase Auth", async () => {
    const res = await proxy(
      new NextRequest("https://app.example.test/api/stripe/webhook", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(200);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("conserve le périmètre d'analyse après connexion", async () => {
    state.user = null;
    const res = await proxy(
      new NextRequest("https://app.example.test/analyser?t=commune&c=75056"),
    );
    const destination = new URL(res.headers.get("location")!);
    expect(destination.searchParams.get("next")).toBe(
      "/analyser?t=commune&c=75056",
    );
    expect(destination.searchParams.has("t")).toBe(false);
  });
});

it("autorise un compte expiré couvert par une équipe et ferme en cas d’erreur", async () => {
  state.teamAccess = true;
  expect(
    (await proxy(new NextRequest("https://app.example.test/explorer"))).status,
  ).toBe(200);
  state.teamError = new Error("timeout");
  expect(
    (
      await proxy(new NextRequest("https://app.example.test/explorer"))
    ).headers.get("location"),
  ).toContain("/auth/abonnement");
});
it("un compte expiré peut rejoindre son équipe sans payer", async () => {
  expect(
    (await proxy(new NextRequest("https://app.example.test/auth/team"))).status,
  ).toBe(200);
});
