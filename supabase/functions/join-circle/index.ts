import { corsHeaders, json, readBody, withUser } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const ctx = await withUser(req);
  if (ctx instanceof Response) return ctx;

  const body = await readBody(req);
  const circleId = String(body.circle_id ?? "");
  const leave = Boolean(body.leave ?? false);
  if (!circleId) return json({ error: "circle_id is required" }, 422);

  const result = leave
    ? await ctx.admin.from("circle_members").delete().eq("circle_id", circleId).eq("user_id", ctx.userId)
    : await ctx.admin.from("circle_members").upsert({ circle_id: circleId, user_id: ctx.userId }, { onConflict: "circle_id,user_id" });

  if (result.error) return json({ error: result.error.message }, 400);
  return json({ ok: true, joined: !leave });
});
