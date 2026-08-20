import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/list-users
 *
 * Returns all Supabase auth users so the client can merge them
 * with profile rows (showing orphaned accounts too).
 * Uses SUPABASE_SERVICE_ROLE_KEY server-side only.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return res.status(500).json({ error: "Server not configured." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return res.status(400).json({ error: error.message });

  // Only return safe fields, never return sensitive info
  const users = (data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.name || u.email,
    phone: u.user_metadata?.phone || "",
    created_at: u.created_at,
  }));

  return res.status(200).json({ users });
}
