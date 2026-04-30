import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  avatar_initials: string | null;
  avatar_color: string | null;
  approval_status: string | null;
  is_super_admin: boolean | null;
  requested_role: string | null;
};

const pool = new Pool(Deno.env.get("SUPABASE_DB_URL") ?? "", 1, true);

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!Deno.env.get("SUPABASE_DB_URL")) {
    return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = decodeUserId(token);

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const connection = await pool.connect();
  try {
    const result = await connection.queryObject<ProfileRow>(
      `select id, full_name, email, role, avatar_initials, avatar_color, approval_status, is_super_admin, requested_role
       from public.profiles
       where id = $1
       limit 1`,
      [userId],
    );

    return new Response(JSON.stringify({ profile: result.rows[0] ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    connection.release();
  }
});