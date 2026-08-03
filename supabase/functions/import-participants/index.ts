// Bulk import participants from a JSON array (parsed client-side from Excel).
// Each row may include project/branch by name. Returns per-row result.
// Supports: creating new participants, updating existing ones (by national_id),
// and linking participants to multiple projects via participant_projects table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Row {
  full_name?: string;
  national_id?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  notes?: string;
  project_name?: string;
  branch_name?: string;
  group_name?: string;
  project_id?: string;
  branch_id?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_national_id?: string;
  guardian_relation?: string;
  create_account?: boolean | string;
  username?: string;
  password?: string;
  custom_fields?: Record<string, unknown>;
  email?: string;
}

interface Payload {
  rows: Row[];
  default_project_id?: string;
  default_branch_id?: string | null;
  default_group_id?: string | null;
  create_accounts?: boolean;
}

interface ImportResult {
  row: number;
  status: "created" | "updated" | "failed" | "skipped";
  error?: string;
  participant_id?: string;
  account?: { user_id: string; username: string } | null;
}

const norm = (s?: string) => (s ?? "").toString().trim();
const normalizeUsername = (s?: string) => norm(s).replace(/[^A-Za-z0-9]/g, "");
const normGender = (g?: string): "male" | "female" | null => {
  const v = norm(g).toLowerCase();
  if (["male", "m", "ذكر", "ولد"].includes(v)) return "male";
  if (["female", "f", "أنثى", "انثى", "بنت"].includes(v)) return "female";
  return null;
};
const normRelation = (r?: string): string | null => {
  const v = norm(r).toLowerCase();
  if (["father", "أب", "اب", "والد"].includes(v)) return "father";
  if (["mother", "أم", "ام", "والدة"].includes(v)) return "mother";
  if (["guardian", "وصي", "ولي"].includes(v)) return "guardian";
  if (v) return "other";
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Permission check
    const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (callerRoles ?? []).map(r => r.role);
    const isAuthorized = roles.some(r => ["system_admin", "executive", "assistant", "project_manager", "branch_manager"].includes(r));
    
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Forbidden: Insufficient permissions" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = (await req.json()) as Payload;
    if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
      return new Response(JSON.stringify({ error: "rows required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Preload projects & branches & groups
    const { data: projects } = await admin.from("projects").select("id, name_ar, name_en");
    const { data: branches } = await admin.from("project_branches").select("id, name_ar, project_id");
    const { data: groups } = await admin.from("project_groups").select("id, name_ar, branch_id");

    const findProject = (name?: string) => {
      const n = norm(name);
      if (!n) return null;
      return projects?.find((p) => p.name_ar === n || p.name_en === n) ?? null;
    };
    const findBranch = (name: string | undefined, projectId: string) => {
      const n = norm(name);
      if (!n) return null;
      return branches?.find((b) => b.project_id === projectId && b.name_ar === n) ?? null;
    };
    const findGroup = (name: string | undefined, branchId: string) => {
      const n = norm(name);
      if (!n) return null;
      return groups?.find((g) => g.branch_id === branchId && g.name_ar === n) ?? null;
    };

    const results: ImportResult[] = [];

    for (let i = 0; i < payload.rows.length; i++) {
      const r = payload.rows[i];
      const rowNum = i + 2; 
      try {
        const fullName = norm(r.full_name);
        const nationalId = norm(r.national_id);
        const phone = norm(r.phone);

        if (!fullName || !nationalId || !phone) {
          results.push({ row: rowNum, status: "failed", error: "Missing required fields (name, national_id, phone)" });
          continue;
        }

        let projectId = r.project_id || payload.default_project_id;
        if (!projectId && r.project_name) projectId = findProject(r.project_name)?.id;

        let branchId = r.branch_id ?? payload.default_branch_id ?? null;
        if (!branchId && r.branch_name && projectId) branchId = findBranch(r.branch_name, projectId)?.id ?? null;
        if (!projectId) branchId = null;

        let groupId = payload.default_group_id ?? null;
        if (!groupId && r.group_name && branchId) groupId = findGroup(r.group_name, branchId)?.id ?? null;
        if (!branchId) groupId = null;

        // Check if participant already exists by national_id
        const { data: existing } = await admin.from("participants").select("id").eq("national_id", nationalId).maybeSingle();
        
        let participantId: string;
        let isUpdate = false;

        if (existing) {
          // UPDATE existing participant (preserve joined_at / created_at)
          isUpdate = true;
          participantId = existing.id;

          const updatePayload: Record<string, unknown> = {
            full_name: fullName,
            phone,
            date_of_birth: norm(r.date_of_birth) || null,
            gender: normGender(r.gender),
            project_id: projectId || null,
            branch_id: branchId,
            group_id: groupId,
            notes: norm(r.notes) || null,
            guardian_name: norm(r.guardian_name) || null,
            guardian_phone: norm(r.guardian_phone) || null,
            guardian_email: norm(r.guardian_email) || null,
            guardian_national_id: norm(r.guardian_national_id) || null,
            guardian_relation: normRelation(r.guardian_relation),
            updated_at: new Date().toISOString(),
          };

          // Merge custom_fields if provided
          if (r.custom_fields && typeof r.custom_fields === 'object' && Object.keys(r.custom_fields).length > 0) {
            const { data: existingFull } = await admin.from("participants").select("custom_fields").eq("id", participantId).maybeSingle();
            const existingCF = (existingFull?.custom_fields as Record<string, unknown>) || {};
            updatePayload.custom_fields = { ...existingCF, ...r.custom_fields };
          }

          const { error: updErr } = await admin.from("participants").update(updatePayload).eq("id", participantId);
          if (updErr) throw updErr;

        } else {
          // CREATE new participant
          const { data: inserted, error: insErr } = await admin.from("participants").insert([{
            full_name: fullName,
            national_id: nationalId,
            phone,
            date_of_birth: norm(r.date_of_birth) || null,
            gender: normGender(r.gender),
            project_id: projectId || null,
            branch_id: branchId,
            group_id: groupId,
            status: projectId ? "active" : "inactive",
            notes: norm(r.notes) || null,
            guardian_name: norm(r.guardian_name) || null,
            guardian_phone: norm(r.guardian_phone) || null,
            guardian_email: norm(r.guardian_email) || null,
            guardian_national_id: norm(r.guardian_national_id) || null,
            guardian_relation: normRelation(r.guardian_relation),
            custom_fields: r.custom_fields || null,
            created_by: caller.id,
          }]).select("id").single();

          if (insErr || !inserted) throw insErr || new Error("Insert failed");
          participantId = inserted.id;
        }

        // Link participant to project via participant_projects (if project exists)
        if (projectId) {
          const { data: existingLink } = await admin
            .from("participant_projects")
            .select("id")
            .eq("participant_id", participantId)
            .eq("project_id", projectId)
            .maybeSingle();
          
          if (!existingLink) {
            await admin.from("participant_projects").insert({
              participant_id: participantId,
              project_id: projectId,
            });
          }
        }

        let account = null;
        if (!isUpdate) {
        const wantAccount = payload.create_accounts === true || r.create_account === true || norm(String(r.create_account)).toLowerCase() === "yes"
          || norm(String(r.create_account)) === "نعم";
        
        if (wantAccount && nationalId.length >= 6) {
          const username = normalizeUsername(r.username) || normalizeUsername(nationalId);
          const password = norm(r.password) || nationalId;
          if (!/^[A-Za-z0-9]+$/.test(username)) {
            results.push({ row: rowNum, status: "failed", error: "Username must contain English letters and numbers only." });
            continue;
          }
          const { data: taken } = await admin.from("profiles").select("id").eq("normalized_username", username.toLowerCase()).maybeSingle();
          if (taken) {
            results.push({ row: rowNum, status: "failed", error: `Username already exists. Suggested: ${username}${Math.floor(100 + Math.random() * 900)}` });
            continue;
          }
          const email = `${username.toLowerCase()}@participant.local`;
          const userMetadata = { full_name: fullName, phone, participant_id: inserted.id, username, national_id: nationalId };
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: userMetadata,
          });

          let userId = created?.user?.id ?? null;
          if (createErr && /already/i.test(createErr.message)) {
            const { data: found } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
            if (found) {
              userId = found.id;
              await admin.auth.admin.updateUserById(userId, { password: nationalId, user_metadata: userMetadata });
            }
          }

          if (userId) {
            await admin.auth.admin.updateUserById(userId, { user_metadata: userMetadata });

            const { error: deleteRolesErr } = await admin.from("user_roles").delete().eq("user_id", userId);
            if (deleteRolesErr) throw deleteRolesErr;
            const { error: roleErr } = await admin.from("user_roles").insert([{ user_id: userId, role: "participant" }]);
            if (roleErr) throw roleErr;
            const { error: participantLinkErr } = await admin.from("participants").update({ auth_user_id: userId, username }).eq("id", inserted.id);
            if (participantLinkErr) throw participantLinkErr;

            const profilePayload = {
              id: userId,
              is_password_setup_required: true,
              username,
              normalized_username: username.toLowerCase(),
              national_id: nationalId,
              email,
              phone,
              full_name: fullName,
            };
            const { error: profileErr } = await admin.from("profiles").upsert(profilePayload, { onConflict: "id" });
            if (profileErr) {
              const { error: fallbackProfileErr } = await admin.from("profiles").upsert({
                id: userId,
                username,
                normalized_username: username.toLowerCase(),
                national_id: nationalId,
                full_name: fullName,
              }, { onConflict: "id" });
              if (fallbackProfileErr) throw profileErr;
            }
            account = { user_id: userId, username };
          }
        }
        } // end if (!isUpdate)

        results.push({ 
          row: rowNum, 
          status: isUpdate ? "updated" : "created", 
          participant_id: participantId, 
          account 
        });
      } catch (e) {
        results.push({ row: rowNum, status: "failed", error: (e as Error).message });
      }
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
    };

    await admin.from("audit_log").insert({
      user_id: caller.id,
      action: "import_participants",
      entity_type: "participant",
      metadata: summary,
    });

    return new Response(JSON.stringify({ summary, results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("import-participants error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

