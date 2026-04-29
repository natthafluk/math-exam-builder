import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DemoRole = "admin" | "teacher" | "student";

type DemoAccount = {
  email: string;
  password: string;
  full_name: string;
  role: DemoRole;
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "admin@example.com", password: "123456", full_name: "ผู้ดูแลระบบ", role: "admin" },
  { email: "teacher@example.com", password: "123456", full_name: "ครูสมหญิง", role: "teacher" },
  { email: "student@example.com", password: "123456", full_name: "นักเรียนสมชาย", role: "student" },
];

const avatarColorFor = (role: DemoRole) => {
  if (role === "admin") return "bg-destructive";
  if (role === "teacher") return "bg-primary";
  return "bg-accent";
};

const findUserByEmail = async (admin: ReturnType<typeof createClient>, email: string) => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) break;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    return new Response(JSON.stringify({ error: "Missing backend seed configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results = [];

  for (const account of DEMO_ACCOUNTS) {
    try {
      const existing = await findUserByEmail(admin, account.email);
      const metadata = { full_name: account.full_name, role: account.role };

      let recreated = false;
      let userResult;

      if (existing) {
        const loginCheck = await publicClient.auth.signInWithPassword({
          email: account.email,
          password: account.password,
        });
        await publicClient.auth.signOut();

        if (loginCheck.error) {
          const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
          if (deleteError) throw deleteError;
          recreated = true;
          userResult = await admin.auth.admin.createUser({
            email: account.email,
            password: account.password,
            email_confirm: true,
            user_metadata: metadata,
          });
        } else {
          userResult = await admin.auth.admin.updateUserById(existing.id, {
            email_confirm: true,
            user_metadata: metadata,
          });
        }
      } else {
        userResult = await admin.auth.admin.createUser({
            email: account.email,
            password: account.password,
            email_confirm: true,
            user_metadata: metadata,
          });
      }

      if (userResult.error || !userResult.data.user) {
        throw userResult.error ?? new Error("ไม่พบข้อมูลผู้ใช้หลังสร้างบัญชี");
      }

      const user = userResult.data.user;
      const { error: profileError } = await admin.from("profiles").upsert({
        id: user.id,
        email: account.email,
        full_name: account.full_name,
        role: account.role,
        avatar_initials: account.full_name.slice(0, 1).toUpperCase(),
        avatar_color: avatarColorFor(account.role),
        updated_at: new Date().toISOString(),
      });

      if (profileError) throw profileError;

      results.push({
        email: account.email,
        role: account.role,
        status: existing && !recreated ? "already_exists" : "created",
        message: existing && !recreated
          ? "มีอยู่แล้ว — ตรวจสอบโปรไฟล์และรหัสผ่านให้พร้อมใช้งานแล้ว"
          : recreated
            ? "สร้างใหม่แทนบัญชีเดิมที่เข้าสู่ระบบไม่ได้ และยืนยันอีเมลพร้อมใช้งานแล้ว"
            : "สร้างใหม่และยืนยันอีเมลพร้อมใช้งานแล้ว",
      });
    } catch (error) {
      results.push({
        email: account.email,
        role: account.role,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const hasFailure = results.some((result) => result.status === "failed");

  return new Response(JSON.stringify({ results }), {
    status: hasFailure ? 207 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
