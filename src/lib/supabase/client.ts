"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Une instance partagée ; le verrou du SDK coordonne aussi plusieurs onglets. */
function build() {
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}

let client: ReturnType<typeof build> | undefined;

export function createClient() {
  return (client ??= build());
}
