import { corsHeaders, json, withUser } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const ctx = await withUser(req);
  if (ctx instanceof Response) return ctx;

  const vibe = new URL(req.url).searchParams.get("vibe") ?? "All";
  const { data, error } = await ctx.admin.rpc("get_vibe_feed", {
    viewer_id: ctx.userId,
    selected_vibe: vibe,
    result_limit: 30,
  });

  if (error) return json({ error: error.message }, 400);
  return json({ posts: data ?? [] });
});
