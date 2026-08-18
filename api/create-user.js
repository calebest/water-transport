import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/create-user
 * Body: { email, password, name, phone, role }
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (server-side only, never exposed to client).
 */
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return res
      .status(500)
      .json({ error: "Server is not configured. Contact the administrator." });
  }

  const { email, password, name, phone, role } = req.body ?? {};

  if (!email || !password || !role) {
    return res.status(400).json({ error: "email, password and role are required." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create auth user (email pre-confirmed, no confirmation email sent)
  const { data, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone },
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const userId = data?.user?.id;

  // 2. Upsert profile row
  if (userId) {
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      name,
      phone: phone || "",
      role,
    });

    if (profileError) {
      // Auth user was created but profile failed — return partial error
      return res
        .status(207)
        .json({ warning: "User created but profile insert failed: " + profileError.message, userId });
    }
  }

  return res.status(200).json({ success: true, userId });
}
