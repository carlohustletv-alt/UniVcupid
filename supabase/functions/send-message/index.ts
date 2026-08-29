import { corsHeaders, json, readBody, withUser } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const ctx = await withUser(req);
  if (ctx instanceof Response) return ctx;

  const body = await readBody(req);
  const conversationId = String(body.conversation_id ?? "");
  const message = String(body.body ?? "").trim();
  if (!conversationId || !message) return json({ error: "conversation_id and body are required" }, 422);
  if (message.length > 2000) return json({ error: "Message is too long" }, 422);

  const { data: member } = await ctx.admin
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!member) return json({ error: "Not a conversation member" }, 403);

  const { data, error } = await ctx.admin
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: ctx.userId, body: message })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ message: data }, 201);
});
