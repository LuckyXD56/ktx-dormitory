import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import crypto from "crypto";

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

function generateReadablePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `Ktx@${suffix}`;
}

function makeRoomEmail(
  buildingCode: string,
  buildingName: string,
  roomNumber: string
): string {
  const bDigit =
    buildingCode.match(/\d+/)?.[0] ?? buildingName.match(/\d+/)?.[0] ?? "1";
  const rDigits =
    roomNumber
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .replace(/^nha|^phong/, "") || roomNumber.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `t${bDigit}.${rDigits}@ktx.local`;
}

export async function POST() {
  try {
    const ctx = await requireAdminContext();
    if ("error" in ctx) return ctx.error;
    const { adminClient } = ctx;

    const [{ data: rooms, error: rErr }, { data: existingProfiles }] =
      await Promise.all([
        adminClient
          .from("rooms")
          .select("id, room_number, floor, building:buildings(id, code, name)")
          .order("room_number", { ascending: true }),
        adminClient
          .from("profiles")
          .select("id, room_id, email")
          .eq("role", "student"),
      ]);

    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 400 });
    }

    const assignedRoomIds = new Set(
      (existingProfiles ?? [])
        .map((p: { room_id: string | null }) => p.room_id)
        .filter(Boolean)
    );
    const usedEmails = new Set(
      (existingProfiles ?? []).map((p: { email: string }) =>
        p.email.toLowerCase()
      )
    );

    const createdAccounts: {
      room_id: string;
      building: string;
      room_number: string;
      email: string;
      password: string;
    }[] = [];

    for (const r of (rooms ?? []) as unknown as {
      id: string;
      room_number: string;
      building:
        | { id: string; code: string; name: string }
        | { id: string; code: string; name: string }[]
        | null;
    }[]) {
      if (assignedRoomIds.has(r.id)) continue;
      const bld = Array.isArray(r.building) ? r.building[0] : r.building;
      const bCode = bld?.code ?? "1";
      const bName = bld?.name ?? "KTX";

      let email = makeRoomEmail(bCode, bName, r.room_number);
      if (usedEmails.has(email.toLowerCase())) {
        email = `${email.replace("@ktx.local", "")}.${r.id.slice(0, 4)}@ktx.local`;
      }
      usedEmails.add(email.toLowerCase());

      const password = generateReadablePassword();
      const displayName = `${bName} · ${r.room_number}`;

      const { data: created, error: cErr } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: displayName,
            role: "student",
            room_id: r.id,
            preferred_language: "lo",
          },
        });

      if (cErr || !created.user) continue;

      await adminClient
        .from("profiles")
        .update({
          role: "student",
          room_id: r.id,
          full_name: displayName,
          preferred_language: "lo",
        })
        .eq("id", created.user.id);

      createdAccounts.push({
        room_id: r.id,
        building: bName,
        room_number: r.room_number,
        email,
        password,
      });
    }

    return NextResponse.json({
      created: createdAccounts,
      count: createdAccounts.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireAdminContext();
    if ("error" in ctx) return ctx.error;
    const { adminClient } = ctx;

    const body = await request.json();
    const userId = String(body?.userId ?? "").trim();
    const password = String(body?.password ?? "").trim();

    if (!userId || password.length < 6) {
      return NextResponse.json(
        { error: "Valid userId and password (>= 6 chars) required" },
        { status: 400 }
      );
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
