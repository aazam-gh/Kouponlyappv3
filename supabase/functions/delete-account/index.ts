import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.1";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: { code: "unauthorized", message: "Authentication required." } }, { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const collect = async (bucket: string, prefix: string): Promise<string[]> => {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    const paths: string[] = [];
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.metadata) paths.push(path);
      else paths.push(...await collect(bucket, path));
    }
    return paths;
  };

  try {
    for (const bucket of ["avatars", "campaign-media"]) {
      const paths = await collect(bucket, user.id);
      if (paths.length) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) throw error;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage cleanup failed.";
    return Response.json({ error: { code: "storage_cleanup_failed", message } }, { status: 500 });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: { code: "delete_failed", message: error.message } }, { status: 400 });
  return Response.json({ data: { deleted: true } });
});
