import { corsHeaders, json, readBody, withUser } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const ctx = await withUser(req);
  if (ctx instanceof Response) return ctx;

  const body = await readBody(req);
  const displayName = String(body.display_name ?? "New Cupid").trim().slice(0, 40) || "New Cupid";
  const age = Math.max(18, Math.min(80, Number(body.age ?? 18)));
  const university = String(body.university ?? "CLSU").trim().slice(0, 80) || "CLSU";
  const course = String(body.course ?? "Student").trim().slice(0, 80) || "Student";

  const { data: profile, error } = await ctx.admin
    .from("profiles")
    .upsert({ id: ctx.userId, display_name: displayName, age, university, course }, { onConflict: "id" })
    .select("id, display_name, age, university, course")
    .single();
  if (error) return json({ error: error.message }, 400);

  const { error: privacyError } = await ctx.admin
    .from("privacy_settings")
    .upsert({ user_id: ctx.userId }, { onConflict: "user_id" });
  if (privacyError) return json({ error: privacyError.message }, 400);

  return json({ profile });
});
