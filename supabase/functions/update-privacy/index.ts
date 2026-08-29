import { corsHeaders, json, readBody, withUser } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const ctx = await withUser(req);
  if (ctx instanceof Response) return ctx;

  const body = await readBody(req);
  const settings = {
    user_id: ctx.userId,
    show_university: Boolean(body.show_university ?? true),
    show_course: Boolean(body.show_course ?? true),
    show_age: Boolean(body.show_age ?? true),
    show_online_status: Boolean(body.show_online_status ?? true),
    allow_dms: Boolean(body.allow_dms ?? true),
    show_activities: Boolean(body.show_activities ?? true),
    appear_in_cupid: Boolean(body.appear_in_cupid ?? true),
    appear_in_vibe: Boolean(body.appear_in_vibe ?? true),
  };

  const { error } = await ctx.admin.from("privacy_settings").upsert(settings, { onConflict: "user_id" });
  if (error) return json({ error: error.message }, 400);
  return json({ settings });
});
