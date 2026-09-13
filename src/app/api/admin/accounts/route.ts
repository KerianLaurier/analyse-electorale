import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  serviceRoleConfigured,
} from "@/lib/supabase/admin";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";

export async function POST(request: Request) {
  // Une requête JSON impose un preflight inter-origines ; vérifier également
  // l'origine quand le navigateur la fournit (y compris les sous-domaines).
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return NextResponse.json({ error: "Format JSON requis." }, { status: 415 });
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  if (profileError || !profile?.is_super_admin)
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  if (!serviceRoleConfigured())
    return NextResponse.json(
      { error: "Création indisponible." },
      { status: 503 },
    );
  let input: unknown;
  try {
    input = await readBoundedJson(request, 8192);
  } catch (error) {
    return NextResponse.json(
      { error: "Requête invalide." },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const body = input as Record<string, unknown>;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    typeof body.password !== "string" ||
    body.password.length < 12 ||
    body.password.length > 128 ||
    !["trial", "active", "inactive"].includes(String(body.status)) ||
    !["candidat", "equipe", "parti"].includes(String(body.tier)) ||
    typeof body.isSuperAdmin !== "boolean"
  ) {
    return NextResponse.json(
      {
        error:
          "Paramètres invalides ; mot de passe de 12 à 128 caractères requis.",
      },
      { status: 400 },
    );
  }
  if (
    [body.fullName, body.organisation].some(
      (value) =>
        value != null && (typeof value !== "string" || value.length > 200),
    ) ||
    (body.trialEndsAt != null &&
      (typeof body.trialEndsAt !== "string" ||
        !Number.isFinite(Date.parse(body.trialEndsAt))))
  )
    return NextResponse.json({ error: "Profil invalide." }, { status: 400 });
  const admin = createServiceClient();
  // API officielle : Supabase gère aussi identities, le hachage et ses invariants internes.
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName ?? null,
        organisation: body.organisation ?? null,
      },
    });
  if (createError || !created.user)
    return NextResponse.json(
      {
        error:
          "Création refusée ; vérifiez si cette adresse possède déjà un compte.",
      },
      { status: 409 },
    );
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      subscription_status: body.status,
      subscription_tier: body.tier,
      trial_ends_at: body.trialEndsAt ?? null,
      is_super_admin: body.isSuperAdmin,
    })
    .eq("id", created.user.id)
    .select("id")
    .single();
  if (updateError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(
      created.user.id,
    );
    return NextResponse.json(
      {
        error: cleanupError
          ? "Compte créé mais configuration incomplète : vérifiez-le dans Supabase avant de réessayer."
          : "Configuration échouée ; création annulée. Réessayez.",
      },
      { status: 502 },
    );
  }
  return NextResponse.json({ id: created.user.id }, { status: 201 });
}
