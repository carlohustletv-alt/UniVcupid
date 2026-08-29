import { corsHeaders, json, withUser } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const ctx = await withUser(req);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.admin.rpc("get_cupid_candidates", { viewer_id: ctx.userId, result_limit: 20 });
  if (error) return json({ error: error.message }, 400);
  return json({ profiles: data ?? [] });
});
