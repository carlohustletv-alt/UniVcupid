import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export type AuthedContext = {
  userId: string;
  admin: ReturnType<typeof createClient>;
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function withUser(req: Request): Promise<AuthedContext | Response> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!url || !anonKey || !serviceKey) return json({ error: "Supabase function secrets are not configured" }, 500);
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing bearer token" }, 401);

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return json({ error: "Invalid or expired token" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  return { userId: data.user.id, admin };
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === "GET") return {};
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}
