import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function requireAdminContext() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      error: NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      ),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (
    !requesterProfile ||
    !requesterProfile.is_active ||
    !["super_admin", "admin"].includes(requesterProfile.role)
  ) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (
    !serviceKey ||
    !supabaseUrl ||
    serviceKey.includes("your-service-role-key")
  ) {
    return {
      error: NextResponse.json(
        { error: "SERVICE_ROLE_MISSING" },
        { status: 400 }
      ),
    };
  }

  const adminClient = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { user, requesterProfile, adminClient };
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdminContext();
    if ("error" in ctx) return ctx.error;
    const { requesterProfile, adminClient } = ctx;

    const body = await request.json();
    const { email, password, full_name, role, phone, preferred_language } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Only super_admin can create another super_admin
    const targetRole =
      role === "super_admin" && requesterProfile.role !== "super_admin"
        ? "admin"
        : role === "student"
          ? "student"
          : role || "staff";

    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email: String(email).trim(),
        password: String(password),
        email_confirm: true,
        user_metadata: {
          full_name: String(full_name).trim(),
          preferred_language: ["th", "vi", "en", "zh", "lo"].includes(
            preferred_language
          )
            ? preferred_language
            : "th",
        },
      });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Failed to create user" },
        { status: 400 }
      );
    }

    await adminClient
      .from("profiles")
      .update({
        role: targetRole,
        full_name: String(full_name).trim(),
        phone: phone ? String(phone) : "",
        preferred_language: ["th", "vi", "en", "zh", "lo"].includes(
          preferred_language
        )
          ? preferred_language
          : "th",
      })
      .eq("id", created.user.id);

    return NextResponse.json({ id: created.user.id, ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireAdminContext();
    if ("error" in ctx) return ctx.error;
    const { user, requesterProfile, adminClient } = ctx;

    const body = await request.json();
    const userId = String(body?.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    if (userId === user.id) {
      return NextResponse.json(
        { error: "Cannot delete current account" },
        { status: 400 }
      );
    }

    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (
      targetProfile?.role === "super_admin" &&
      requesterProfile.role !== "super_admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
