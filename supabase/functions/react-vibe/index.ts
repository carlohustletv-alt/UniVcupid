import { corsHeaders, json, readBody, withUser } from "../_shared/client.ts";

const allowed = new Set(["❤️", "🔥", "😂", "👀", "✨", "🙌"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const ctx = await withUser(req);
  if (ctx instanceof Response) return ctx;

  const body = await readBody(req);
  const vibeId = String(body.vibe_id ?? "");
  const reaction = String(body.reaction ?? "");
  if (!vibeId || !allowed.has(reaction)) return json({ error: "Invalid reaction" }, 422);

  const { error } = await ctx.admin
    .from("vibe_reactions")
    .upsert({ vibe_id: vibeId, user_id: ctx.userId, reaction }, { onConflict: "vibe_id,user_id" });

  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
});
