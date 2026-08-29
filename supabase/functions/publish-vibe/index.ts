import { corsHeaders, json, readBody, withUser } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const ctx = await withUser(req);
  if (ctx instanceof Response) return ctx;

  const body = await readBody(req);
  const activity = String(body.activity ?? "").trim();
  const caption = String(body.caption ?? "").trim();
  const mediaUrl = String(body.media_url ?? "").trim() || null;
  const campus = String(body.campus ?? "").trim() || null;
  const openToCompany = Boolean(body.open_to_company ?? false);

  if (activity.length < 2) return json({ error: "Activity is required" }, 422);
  if (caption.length > 280) return json({ error: "Caption must be 280 characters or less" }, 422);

  const { data, error } = await ctx.admin
    .from("vibes")
    .insert({ user_id: ctx.userId, activity, caption, media_url: mediaUrl, campus, open_to_company: openToCompany })
    .select("id, activity, caption, media_url, open_to_company, campus, created_at")
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ post: data }, 201);
});
