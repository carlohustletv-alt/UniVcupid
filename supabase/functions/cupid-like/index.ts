import { corsHeaders, json, readBody, withUser } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const ctx = await withUser(req);
  if (ctx instanceof Response) return ctx;

  const body = await readBody(req);
  const likedId = String(body.liked_id ?? "");
  if (!likedId || likedId === ctx.userId) return json({ error: "Invalid liked user" }, 422);

  const { error: likeError } = await ctx.admin.from("likes").upsert({ liker_id: ctx.userId, liked_id: likedId }, { onConflict: "liker_id,liked_id" });
  if (likeError) return json({ error: likeError.message }, 400);

  const { data: reciprocal, error: reciprocalError } = await ctx.admin
    .from("likes")
    .select("liker_id")
    .eq("liker_id", likedId)
    .eq("liked_id", ctx.userId)
    .maybeSingle();
  if (reciprocalError) return json({ error: reciprocalError.message }, 400);

  if (!reciprocal) return json({ matched: false });
  const userA = ctx.userId < likedId ? ctx.userId : likedId;
  const userB = ctx.userId < likedId ? likedId : ctx.userId;
  const { data: match, error: matchError } = await ctx.admin
    .from("matches")
    .upsert({ user_a: userA, user_b: userB }, { onConflict: "user_a,user_b" })
    .select("id, user_a, user_b, created_at")
    .single();
  if (matchError) return json({ error: matchError.message }, 400);
  return json({ matched: true, match });
});
