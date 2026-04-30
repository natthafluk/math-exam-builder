import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const decodeUserId = (token: string) => {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    const sub = typeof json.sub === "string" ? json.sub : null;
    const exp = typeof json.exp === "number" ? json.exp : 0;
    const role = typeof json.role === "string" ? json.role : null;
    if (!sub || role !== "authenticated" || exp * 1000 < Date.now()) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sub) ? sub : null;
  } catch {
    return null;
  }
};

const DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";

const errorMessage = (error: unknown) => {
  if (!error) return "unknown error";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    const value = error as { message?: unknown; code?: unknown; details?: unknown };
    return [value.code, value.message, value.details].filter(Boolean).join(" — ") || JSON.stringify(error);
  } catch {
    return String(error);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!DB_URL) {
    return new Response(JSON.stringify({ error: "Missing backend database configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const userId = token ? decodeUserId(token) : null;

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres(DB_URL, { max: 1, idle_timeout: 5, connect_timeout: 8 });

    const rows = await sql`
      SELECT id, full_name, email, role, avatar_initials, avatar_color,
             approval_status, is_super_admin, requested_role
      FROM public.profiles
      WHERE id = ${userId}
      LIMIT 1
    `;

    const profile = rows.length > 0 ? rows[0] : null;

    return new Response(JSON.stringify({ profile }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (sql) {
      try { await sql.end({ timeout: 3 }); } catch { /* noop */ }
    }
  }
});
