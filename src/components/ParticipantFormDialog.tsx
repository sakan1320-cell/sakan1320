import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { InfoPopover } from "@/components/ui/info-popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { PhoneInputWithCountry } from "@/components/PhoneInputWithCountry";
import { useAuth } from "@/contexts/AuthContext";
import { HijriGregorianDateInput } from "./HijriGregorianDateInput";

type DeliveryChannel = "none" | "whatsapp" | "sms" | "notification";

export interface ParticipantRow {
  id?: string;
  full_name: string;
  date_of_birth: string | null;
  gender: "male" | "female" | null;
  national_id: string;
  phone: string;
  project_id: string | null;
  branch_id: string | null;
  status: "active" | "inactive" | "archived";
  notes: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_national_id: string | null;
  guardian_relation: "father" | "mother" | "guardian" | "other" | null;
  guardian_notes: string | null;
  auth_user_id?: string | null;
  is_staff?: boolean;
  staff_user_id?: string | null;
  points?: number;
  username?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  custom_fields?: Record<string, any> | null;
}

interface Project { id: string; name_ar: string; name_en: string | null; project_mode?: "external" | "internal" | "mixed"; }
interface Branch { id: string; name_ar: string; project_id: string; }
interface StaffUser { id: string; full_name: string | null; email: string | null; }
interface DynamicField {
  id: string;
  name_ar: string;
  field_type: string;
  is_required: boolean;
  min_length: number | null;
  max_length: number | null;
  regex_pattern: string | null;
  options_array: string[] | null;
  order_index: number;
  system_key: string | null;
  is_active: boolean;
  tab_section: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ParticipantRow | null;
  defaultProjectId?: string | null;
  onSaved: () => void;
  previewMode?: boolean;
}

const empty: ParticipantRow = {
  full_name: "",
  date_of_birth: null,
  gender: null,
  national_id: "",
  phone: "",
  project_id: null,
  branch_id: null,
  status: "inactive",
  notes: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_email: "",
  guardian_national_id: "",
  guardian_relation: "guardian",
  guardian_notes: "",
  auth_user_id: null,
  is_staff: false,
  staff_user_id: null,
  points: 0,
  username: "",
  avatar_url: null,
  email: "",
};

const normalizeUsername = (value: string) => value.trim().replace(/[^A-Za-z0-9]/g, "");
const usernamePattern = /^[A-Za-z0-9]+$/;

const inferStatus = (projectId: string | null | undefined, current?: string | null) => {
  if (current === "archived") return "archived";
  return projectId ? "active" : "inactive";
};

export const ParticipantFormDialog = ({ open, onOpenChange, initial, defaultProjectId, onSaved, previewMode }: Props) => {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState<ParticipantRow>(empty);
  const [projects, setProjects] = useState<Project[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  
  const { hasAnyRole } = useAuth();
  const canEditProjects = hasAnyRole(["system_admin", "executive", "assistant", "project_manager", "branch_manager"]);
  const [createAccount, setCreateAccount] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sendCredentials, setSendCredentials] = useState(false);
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>("whatsapp");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!open) return;
    const next = initial ? { ...empty, ...initial } : { ...empty, project_id: defaultProjectId ?? null };
    next.status = inferStatus(next.project_id, next.status) as ParticipantRow["status"];
    setForm(next);
    const suggested = normalizeUsername(next.username || next.national_id || "");
    setUsername(suggested);
    setPassword(next.national_id || "");
    setCreateAccount(!next.auth_user_id);
    setSendCredentials(false);
    setDeliveryChannel("whatsapp");
    setUsernameHint(null);
    setCustomFieldsData(next.custom_fields || {});
    setSelectedProjectIds(next.project_id ? [next.project_id] : []);

    (async () => {
      if (next.national_id || next.auth_user_id) {
        let q = supabase.from("participants").select("project_id").eq("status", "active");
        if (next.auth_user_id) q = q.eq("auth_user_id", next.auth_user_id);
        else q = q.eq("national_id", next.national_id);
        const { data } = await q;
        if (data) setSelectedProjectIds(Array.from(new Set([...(next.project_id ? [next.project_id] : []), ...data.map(d => d.project_id).filter(Boolean)])) as string[]);
      }

      const [pj, br, gr, st, df] = await Promise.all([
        supabase.from("projects").select("id, name_ar, name_en, project_mode").order("name_ar"),
        supabase.from("project_branches").select("id, name_ar, project_id").order("name_ar"),
        supabase.from("project_groups").select("id, name_ar, project_id").order("name_ar"),
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase.from("registration_form_fields").select("*").order("order_index"),
      ]);
      setProjects((pj.data ?? []) as Project[]);
      setBranches(br.data ?? []);
      setGroups(gr.data ?? []);
      setStaffUsers(st.data ?? []);
      setDynamicFields((df.data ?? []) as DynamicField[]);
    })();
  }, [open, initial, defaultProjectId]);

  useEffect(() => {
    if (!open || initial?.id) return;
    const suggested = normalizeUsername(form.national_id || "");
    setUsername((current) => current ? normalizeUsername(current) : suggested);
    setPassword((current) => current || form.national_id || "");
  }, [form.national_id, open, initial?.id]);

  useEffect(() => {
    if (!open || !createAccount || !username) {
      setUsernameHint(null);
      return;
    }
    const normalized = normalizeUsername(username);
    if (normalized !== username || !usernamePattern.test(normalized)) {
      setUsernameHint(t("participants.usernameEnglishOnly", "اسم المستخدم يقبل حروفًا إنجليزية وأرقامًا فقط."));
      return;
    }

    let cancelled = false;
    setCheckingUsername(true);
    const timer = window.setTimeout(async () => {
      const [profiles, participants] = await Promise.all([
        supabase.from("profiles").select("id").eq("normalized_username", normalized.toLowerCase()).maybeSingle(),
        supabase.from("participants").select("id").eq("username", normalized).maybeSingle(),
      ]);
      if (cancelled) return;
      const profileTaken = !!profiles.data && profiles.data.id !== form.auth_user_id;
      const participantTaken = !!participants.data && participants.data.id !== form.id;
      if (profileTaken || participantTaken) {
        const suggestion = `${normalized}${Math.floor(100 + Math.random() * 900)}`;
        setUsernameHint(t("participants.usernameTakenSuggestion", "اسم المستخدم مستخدم مسبقًا. اقترحنا بديلًا: {{suggestion}}", { suggestion }));
        setUsername(suggestion);
      } else {
        setUsernameHint(null);
      }
      setCheckingUsername(false);
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, createAccount, open, form.auth_user_id, form.id, t]);

  const selectedProject = projects.find((p) => p.id === form.project_id);
  const isInternalProject = selectedProject?.project_mode === "internal" || selectedProject?.project_mode === "mixed";
  const filteredBranches = useMemo(() => branches.filter((b) => b.project_id === form.project_id), [branches, form.project_id]);
  const filteredGroups = useMemo(() => groups.filter((g) => g.project_id === form.project_id), [groups, form.project_id]);
  const derivedStatus = inferStatus(form.project_id, form.status);

  /** Translate raw Supabase / Postgres error into Arabic */
  const translateDbError = (msg: string): string => {
    if (!msg) return t("participants.errors.unknown", "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
    const m = msg.toLowerCase();
    // Unique constraint violations
    if (m.includes("national_id_unique") || m.includes("national_id_key") || m.includes("duplicate key") && m.includes("national_id"))
      return t("participants.errors.nationalIdTaken", "رقم الهوية مستخدم مسبقًا لمشارك آخر.");
    if (m.includes("username_unique") || m.includes("username_key") || m.includes("duplicate key") && m.includes("username"))
      return t("participants.errors.usernameTaken", "اسم المستخدم مستخدم مسبقًا.");
    if (m.includes("email_unique") || m.includes("email_key") || m.includes("duplicate key") && m.includes("email"))
      return t("participants.errors.emailTaken", "البريد الإلكتروني مستخدم مسبقًا.");
    // Column / schema errors
    if (m.includes("column") && m.includes("does not exist"))
      return t("participants.errors.schemaError", "خطأ في بنية البيانات. يرجى التواصل مع الدعم الفني.");
    if (m.includes("not-null") || m.includes("violates not-null") || m.includes("null value"))
      return t("participants.errors.missingRequired", "يوجد حقل مطلوب لم يتم تعبئته.");
    // RLS / Permission errors
    if (m.includes("row-level security") || m.includes("rls") || m.includes("policy") || m.includes("new row violates"))
      return t("participants.errors.noPermission", "ليس لديك صلاحية لإجراء هذا التغيير.");
    if (m.includes("permission denied") || m.includes("forbidden") || m.includes("insufficient"))
      return t("participants.errors.noPermission", "ليس لديك صلاحية لإجراء هذا التغيير.");
    // Foreign key errors
    if (m.includes("foreign key") || m.includes("violates foreign key") || m.includes("not present in table"))
      return t("participants.errors.invalidReference", "أحد الحقول يشير إلى بيانات غير موجودة (مشروع أو فرع محذوف).");
    // Network / timeout
    if (m.includes("fetch") || m.includes("network") || m.includes("timeout") || m.includes("failed to fetch"))
      return t("participants.errors.networkError", "خطأ في الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.");
    // Generic
    return t("participants.errors.unknown", "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
  };

  const submit = async () => {
    if (previewMode) {
      toast.info("أنت في وضع المعاينة، لا يمكن حفظ البيانات.");
      return;
    }

    const cleanUsername = normalizeUsername(username || form.national_id || "");
    const cleanPassword = password || form.national_id;

    if (!form.full_name.trim() || !form.phone.trim() || !form.national_id.trim()) {
      toast.error(t("participants.errors.requiredFields", "يجب تعبئة الاسم الكامل ورقم الهوية ورقم الهاتف."));
      return;
    }
    if (createAccount && (!cleanUsername || !usernamePattern.test(cleanUsername))) {
      toast.error(t("participants.usernameEnglishOnly", "اسم المستخدم يقبل حروفًا إنجليزية وأرقامًا فقط."));
      return;
    }
    if (createAccount && cleanPassword.length < 6) {
      toast.error(t("auth.errors.weak_password", "كلمة المرور يجب أن تتكون من 6 أحرف على الأقل."));
      return;
    }

    // Validate email format if provided (email is used for account creation only, not stored in participants table)
    if (form.email && form.email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(form.email.trim())) {
        toast.error(t("participants.invalidEmail", "صيغة البريد الإلكتروني غير صحيحة."));
        return;
      }
    }

    
    // Dynamic Validation
    let hasDynamicError = false;
    for (const field of dynamicFields) {
      if (field.system_key || field.is_active === false) continue;
      const val = customFieldsData[field.id];
      if (field.is_required && (!val || (typeof val === 'string' && !val.trim()))) {
        toast.error(`حقل ${field.name_ar} مطلوب`);
        hasDynamicError = true;
        break;
      }
      if (val && typeof val === 'string') {
        if (field.min_length && val.length < field.min_length) {
          toast.error(`حقل ${field.name_ar} يجب أن لا يقل عن ${field.min_length} حرف`);
          hasDynamicError = true;
          break;
        }
        if (field.max_length && val.length > field.max_length) {
          toast.error(`حقل ${field.name_ar} يجب أن لا يزيد عن ${field.max_length} حرف`);
          hasDynamicError = true;
          break;
        }
        if (field.regex_pattern) {
          try {
            const regex = new RegExp(field.regex_pattern);
            if (!regex.test(val)) {
              toast.error(`حقل ${field.name_ar} بصيغة غير صحيحة`);
              hasDynamicError = true;
              break;
            }
          } catch (e) {
            console.error("Invalid regex in DB", e);
          }
        }
      }
    }
    if (hasDynamicError) return;

    setSaving(true);

    // NOTE: The 'email' column does NOT exist on the participants DB table.
    // Email is only used when creating an auth account (via edge function).
    const payload: Record<string, unknown> = {
      full_name: form.full_name.trim(),
      date_of_birth: form.date_of_birth || null,
      gender: form.gender,
      national_id: form.national_id.trim(),
      phone: form.phone.trim(),
      project_id: form.project_id || null,
      branch_id: form.project_id ? (form.branch_id || null) : null,
      status: derivedStatus,
      notes: form.notes || null,
      guardian_name: form.guardian_name?.trim() || null,
      guardian_phone: form.guardian_phone?.trim() || null,
      guardian_email: form.guardian_email?.trim() || null,
      guardian_national_id: form.guardian_national_id?.trim() || null,
      guardian_relation: form.guardian_relation,
      guardian_notes: form.guardian_notes || null,
      is_staff: !!form.is_staff,
      staff_user_id: form.staff_user_id || null,
      username: createAccount ? cleanUsername : form.username || null,
      custom_fields: customFieldsData,
    };

    let participantId = initial?.id;
    let error;

    try {
      if (initial?.id) {
        // Sync the base profile fields across ALL rows for this user
        let q = supabase.from("participants").update(payload as any);
        if (form.auth_user_id) q = q.eq("auth_user_id", form.auth_user_id);
        else if (form.national_id) q = q.eq("national_id", form.national_id);
        else q = q.eq("id", initial.id); // fallback
        
        ({ error } = await q);
        if (!error) await logAudit("update", "participant", initial.id);
        
        if (!error && selectedProjectIds.length > 0) {
          // Identify missing project records and insert them
          let currQ = supabase.from("participants").select("project_id, id");
          if (form.auth_user_id) currQ = currQ.eq("auth_user_id", form.auth_user_id);
          else currQ = currQ.eq("national_id", form.national_id);
          const { data: currRows } = await currQ;
          
          if (currRows) {
            const existingIds = new Set(currRows.map(r => r.project_id).filter(Boolean));
            const toAdd = selectedProjectIds.filter(pid => !existingIds.has(pid));
            const toArchive = Array.from(existingIds).filter(pid => pid && !selectedProjectIds.includes(pid));
            
            // Insert missing
            if (toAdd.length > 0) {
               const { data: { user } } = await supabase.auth.getUser();
               const insertPayloads = toAdd.map(pid => ({ ...payload, project_id: pid, created_by: user?.id, status: "active" as const }));
               await supabase.from("participants").insert(insertPayloads as any);
            }
            // Archive removed
            if (toArchive.length > 0) {
               const idsToArchive = currRows.filter(r => r.project_id && toArchive.includes(r.project_id)).map(r => r.id);
               if (idsToArchive.length > 0) {
                 await supabase.from("participants").update({ status: "archived" }).in("id", idsToArchive);
               }
            }
          }
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        // Insert a row for EACH selected project
        const targetProjects = selectedProjectIds.length > 0 ? selectedProjectIds : [null];
        const insertPayloads = targetProjects.map(pid => ({ ...payload, project_id: pid, created_by: user?.id }));
        
        const { data, error: e } = await supabase.from("participants").insert(insertPayloads as any).select();
        error = e;
        if (!error && data && data.length > 0) {
          participantId = (data[0] as any).id;
          await logAudit("create", "participant", participantId!);
        }
      }
    } catch (err: any) {
      error = err;
    }

    if (error) {
      setSaving(false);
      const localizedMsg = translateDbError(error.message);
      toast.error(localizedMsg);

      try {
        await supabase.from("system_errors").insert({
          error_type: "database_save_failure",
          message: error.message,
          details: JSON.stringify({ payload, db_error: error }),
          severity: "error"
        });
      } catch (_) { /* ignore logging errors */ }
      return;
    }

    if (createAccount && participantId && !form.auth_user_id) {
      const { data, error: fnErr } = await supabase.functions.invoke("create-participant-account", {
        body: {
          participant_id: participantId,
          national_id: form.national_id.trim(),
          username: cleanUsername,
          password: cleanPassword,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email?.trim() || undefined,
          send_credentials: sendCredentials,
          delivery_channel: sendCredentials ? deliveryChannel : "none",
        },
      });
      if (fnErr || (data as { error?: string })?.error) {
        const rawErr = (data as { error?: string })?.error || fnErr?.message || "";
        // Translate edge function errors to Arabic
        let errMsg: string;
        if (rawErr.includes("Unauthorized")) {
          errMsg = t("participants.errors.unauthorized", "غير مصرح لك بإنشاء حسابات. يرجى تسجيل الدخول مرة أخرى.");
        } else if (rawErr.includes("Forbidden") || rawErr.includes("Insufficient permissions")) {
          errMsg = t("participants.errors.noPermission", "ليس لديك صلاحية لإنشاء حسابات دخول.");
        } else if (rawErr.includes("national_id") && rawErr.includes("short")) {
          errMsg = t("participants.errors.nationalIdShort", "رقم الهوية قصير جدًا (يجب 6 أحرف على الأقل).");
        } else if (rawErr.includes("Username must contain") || rawErr.includes("English letters")) {
          errMsg = t("participants.usernameEnglishOnly", "اسم المستخدم يقبل حروفًا إنجليزية وأرقامًا فقط.");
        } else if (rawErr.includes("Password must be") || rawErr.includes("at least 6")) {
          errMsg = t("auth.errors.weak_password", "كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.");
        } else if (rawErr.includes("Username already exists")) {
          const suggestion = (data as { suggestion?: string })?.suggestion;
          if (suggestion) {
            setUsername(suggestion);
            setUsernameHint(t("participants.usernameTakenSuggestion", "اسم المستخدم مستخدم مسبقًا. اقترحنا بديلًا: {{suggestion}}", { suggestion }));
          }
          errMsg = suggestion
            ? t("participants.errors.usernameTakenWithSuggestion", "اسم المستخدم مستخدم مسبقًا. اقترحنا بديلًا: {{suggestion}}", { suggestion })
            : t("participants.errors.usernameTaken", "اسم المستخدم مستخدم مسبقًا. جرّب اسمًا مختلفًا.");
        } else if (rawErr.includes("البريد الإلكتروني")) {
          errMsg = rawErr; // Already Arabic
        } else if (rawErr.includes("already exists") || rawErr.includes("already registered")) {
          errMsg = t("participants.errors.accountExists", "يوجد حساب مسجل بهذه البيانات مسبقًا.");
        } else if (rawErr.includes("fetch") || rawErr.includes("network") || rawErr.includes("Failed to fetch")) {
          errMsg = t("participants.errors.networkError", "خطأ في الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.");
        } else {
          errMsg = t("participants.errors.accountCreationFailed", "فشل إنشاء حساب الدخول. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.");
        }
        toast.error(errMsg);

        try {
          await supabase.from("system_errors").insert({
            error_type: "create_participant_account_failure",
            message: rawErr,
            details: JSON.stringify({
              participant_id: participantId,
              username: cleanUsername,
              error: fnErr || data
            }),
            severity: "error"
          });
        } catch (_) { /* ignore logging errors */ }

        setSaving(false);
        return;
      } else {
        toast.success(t("participants.accountCreated", "تم إنشاء حساب الدخول: {{username}}", { username: cleanUsername }));
      }
    }

    setSaving(false);
    toast.success(t("common.success"));
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{initial?.id ? t("participants.edit") : t("participants.new")}</DialogTitle>
        </DialogHeader>

        <div className="w-full mt-2">
          {(() => {
            const renderField = (f: DynamicField) => {
              const isReq = f.is_required ? <span className="text-destructive">*</span> : null;
              const label = <Label>{f.name_ar} {isReq}</Label>;

              switch (f.system_key) {
                case 'full_name':
                  return <div key={f.id} className="col-span-full space-y-1.5">{label}<Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>;
                case 'national_id':
                  return <div key={f.id} className="space-y-1.5">{label}<Input dir="ltr" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></div>;
                case 'phone':
                  return (
                    <div key={f.id} className="space-y-1.5">
                      {label}
                      <PhoneInputWithCountry
                        value={form.phone}
                        onChange={(val) => setForm({ ...form, phone: val })}
                      />
                    </div>
                  );
                case 'date_of_birth':
                  return (
                    <div key={f.id} className="space-y-1.5">
                      {label}
                      <HijriGregorianDateInput
                        value={form.date_of_birth || ""}
                        onChange={(val) => setForm({ ...form, date_of_birth: val })}
                      />
                    </div>
                  );
                case 'gender':
                  return (
                    <div key={f.id} className="space-y-1.5">{label}
                      <Select value={form.gender ?? ""} onValueChange={(v) => setForm({ ...form, gender: v as "male" | "female" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t("participants.genders.male")}</SelectItem>
                          <SelectItem value="female">{t("participants.genders.female")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                case 'email':
                  return <div key={f.id} className="col-span-full space-y-1.5">{label}<Input type="email" dir="ltr" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>;
                case 'project_id':
                  return null; // Moved to projects tab
                case 'create_account':
                  return (
                      <div key={f.id} className="col-span-full rounded-md border p-3 space-y-3">
                        <div className="flex items-start gap-2">
                          <Checkbox id="create-acc" checked={createAccount} disabled={!!form.auth_user_id} onCheckedChange={(v) => setCreateAccount(!!v)} />
                          <div className="flex items-center gap-2">
                            <Label htmlFor="create-acc" className="cursor-pointer">{form.auth_user_id ? t("participants.accountExists", "يوجد حساب دخول مرتبط") : f.name_ar}</Label>
                            <InfoPopover text={t("participants.accountCredentialsInline", "إذا تركت الحقول فارغة سيتم استخدام رقم الهوية مؤقتًا وطلب تغيير كلمة المرور عند أول دخول.")} />
                          </div>
                        </div>
                        {form.auth_user_id && form.username && (
                          <div className="mt-3 p-3 bg-muted/20 border rounded-md">
                            <Label className="mb-2 block text-muted-foreground">اسم المستخدم</Label>
                            <div className="font-mono bg-background p-2 border rounded text-sm text-center tracking-wider font-bold">
                              {form.username}
                            </div>
                          </div>
                        )}
                        {createAccount && !form.auth_user_id && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Label>{t("auth.username", "اسم المستخدم")}</Label>
                                  <InfoPopover text={checkingUsername ? t("common.loading", "جار التحقق...") : (usernameHint || t("participants.usernameDefaultHint", "الافتراضي: رقم الهوية، ويمكن تعديله قبل الحفظ."))} />
                                </div>
                                <Input dir="ltr" value={username} onChange={(e) => setUsername(normalizeUsername(e.target.value))} placeholder={form.national_id || "1234567890"} />
                              </div>
                              <div>
                                <Label className="mb-1.5 block">{t("common.password", "كلمة المرور")}</Label>
                                <Input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={form.national_id || "1234567890"} />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-3">
                              <div className="flex items-center gap-2">
                                <Checkbox id="send-credentials" checked={sendCredentials} onCheckedChange={(v) => setSendCredentials(!!v)} />
                                <Label htmlFor="send-credentials" className="cursor-pointer">{t("participants.sendCredentials", "إرسال بيانات الدخول")}</Label>
                              </div>
                              {sendCredentials && (
                                <Select value={deliveryChannel} onValueChange={(v) => setDeliveryChannel(v as DeliveryChannel)}>
                                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    <SelectItem value="sms">SMS</SelectItem>
                                    <SelectItem value="notification">{t("nav.notifications", "رسالة")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                  );
                case 'notes':
                  return <div key={f.id} className="col-span-full space-y-1.5">{label}<Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>;
                
                case 'guardian_name':
                  return <div key={f.id} className="col-span-full space-y-1.5">{label}<Input value={form.guardian_name ?? ""} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></div>;
                case 'guardian_phone':
                  return (
                    <div key={f.id} className="space-y-1.5">
                      {label}
                      <PhoneInputWithCountry
                        value={form.guardian_phone ?? ""}
                        onChange={(val) => setForm({ ...form, guardian_phone: val })}
                      />
                    </div>
                  );
                case 'guardian_relation':
                  return (
                    <div key={f.id} className="space-y-1.5">{label}
                      <Select value={form.guardian_relation ?? "guardian"} onValueChange={(v) => setForm({ ...form, guardian_relation: v as ParticipantRow["guardian_relation"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="father">{t("guardians.relations.father")}</SelectItem>
                          <SelectItem value="mother">{t("guardians.relations.mother")}</SelectItem>
                          <SelectItem value="guardian">{t("guardians.relations.guardian")}</SelectItem>
                          <SelectItem value="other">{t("guardians.relations.other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                case 'guardian_email':
                  return <div key={f.id} className="space-y-1.5">{label}<Input type="email" value={form.guardian_email ?? ""} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })} /></div>;
                case 'guardian_national_id':
                  return <div key={f.id} className="space-y-1.5">{label}<Input value={form.guardian_national_id ?? ""} onChange={(e) => setForm({ ...form, guardian_national_id: e.target.value })} /></div>;
                case 'guardian_notes':
                  return <div key={f.id} className="col-span-full space-y-1.5">{label}<Textarea rows={3} value={form.guardian_notes ?? ""} onChange={(e) => setForm({ ...form, guardian_notes: e.target.value })} /></div>;
                
                default:
                  return (
                    <div key={f.id} className="space-y-1.5">
                      {label}
                      {f.field_type === 'select' ? (
                        <Select value={customFieldsData[f.id] ?? ""} onValueChange={v => setCustomFieldsData(prev => ({...prev, [f.id]: v}))}>
                          <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                          <SelectContent>
                            {f.options_array?.map((opt, i) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input 
                          type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'}
                          value={customFieldsData[f.id] ?? ""} 
                          onChange={e => setCustomFieldsData(prev => ({...prev, [f.id]: e.target.value}))} 
                        />
                      )}
                    </div>
                  );
              }
            };

            const profileSection = (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-0">
                {dynamicFields.filter(f => f.tab_section === 'info' && f.is_active !== false).map(renderField)}
                
                {isInternalProject && (
                  <div className="col-span-full rounded-md border p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Checkbox id="is-staff" checked={!!form.is_staff} onCheckedChange={(v) => setForm({ ...form, is_staff: !!v })} />
                      <Label htmlFor="is-staff" className="cursor-pointer">{t("participants.isStaff", "موظف ضمن برنامج تطوير داخلي")}</Label>
                    </div>
                    {form.is_staff && (
                      <div>
                        <Label>{t("participants.staffUser", "حساب الموظف")}</Label>
                        <Select value={form.staff_user_id ?? "_none"} onValueChange={(v) => setForm({ ...form, staff_user_id: v === "_none" ? null : v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">{t("common.none")}</SelectItem>
                            {staffUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );

            const guardianSection = (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-0">
                {dynamicFields.filter(f => f.tab_section === 'guardian' && f.is_active !== false).map(renderField)}
              </div>
            );

            const projectsSection = (
              <div className="rounded-md border p-4 space-y-4 bg-muted/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-base">المشاريع</Label>
                    <InfoPopover text={t("participants.optionalProjectHint", "يمكن حفظ المشارك وإضافته لعدة مشاريع في نفس الوقت.")} />
                  </div>
                  <Badge variant={selectedProjectIds.length > 0 ? "default" : "outline"}>
                    {selectedProjectIds.length > 0 ? t("participants.statuses.active", "نشط") : t("participants.noProjectStatus", "غير نشط بالمشاريع")}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 max-h-64 overflow-y-auto p-3 border rounded-md bg-background">
                  {projects.map((p) => {
                    const isSelected = selectedProjectIds.includes(p.id);
                    return (
                      <div key={p.id} className={`flex items-center space-x-2 space-x-reverse border p-2 rounded-md transition-colors ${isSelected ? 'bg-primary/5 border-primary/20' : 'bg-transparent'} ${!canEditProjects ? 'opacity-70' : ''}`}>
                        <Checkbox 
                          id={`proj-tab-${p.id}`} 
                          checked={isSelected}
                          disabled={!canEditProjects}
                          onCheckedChange={(checked) => {
                            if (!canEditProjects) return;
                            if (checked) {
                              setSelectedProjectIds(prev => [...prev, p.id]);
                              setForm({ ...form, project_id: p.id, status: "active" }); // set primary
                            } else {
                              const next = selectedProjectIds.filter(id => id !== p.id);
                              setSelectedProjectIds(next);
                              if (form.project_id === p.id) setForm({ ...form, project_id: next[0] || null });
                            }
                          }}
                        />
                        <Label htmlFor={`proj-tab-${p.id}`} className={`w-full ${canEditProjects ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                          {i18n.language === "ar" ? p.name_ar : (p.name_en || p.name_ar)}
                        </Label>
                      </div>
                    );
                  })}
                  {projects.length === 0 && (
                    <p className="text-muted-foreground text-sm p-2">لا توجد مشاريع متاحة</p>
                  )}
                </div>

                {selectedProjectIds.length === 1 && filteredBranches.length > 0 && (
                  <Select disabled={!canEditProjects} value={form.branch_id ?? "_none"} onValueChange={(v) => setForm({ ...form, branch_id: v === "_none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع (اختياري)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t("common.none")}</SelectItem>
                      {filteredBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                {selectedProjectIds.length === 1 && filteredGroups.length > 0 && (
                  <Select disabled={!canEditProjects} value={form.group_id ?? "_none"} onValueChange={(v) => setForm({ ...form, group_id: v === "_none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المجموعة (اختياري)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t("common.none")}</SelectItem>
                      {filteredGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );

            if (initial?.id) {
              return (
                <Tabs defaultValue="info" className="flex flex-col md:flex-row gap-4 w-full h-full">
                  <TabsList className="flex flex-row md:flex-col justify-start bg-muted/30 p-2 rounded-xl h-auto md:min-w-[180px] md:h-full shrink-0 gap-2 overflow-x-auto">
                    <TabsTrigger className="w-full justify-start rounded-lg text-start px-4 py-2" value="info">الملف الشخصي</TabsTrigger>
                    <TabsTrigger className="w-full justify-start rounded-lg text-start px-4 py-2" value="guardian">بيانات ولي الأمر</TabsTrigger>
                    <TabsTrigger className="w-full justify-start rounded-lg text-start px-4 py-2" value="projects">المشاريع</TabsTrigger>
                    <TabsTrigger className="w-full justify-start rounded-lg text-start px-4 py-2" value="certificates">الشهادات</TabsTrigger>
                  </TabsList>
                  
                  <div className="flex-1 overflow-y-auto px-2 max-h-[70vh]">
                    <TabsContent value="info" className="mt-0">{profileSection}</TabsContent>
                    <TabsContent value="guardian" className="mt-0">{guardianSection}</TabsContent>
                    <TabsContent value="projects" className="mt-0 space-y-4">
                      <h3 className="font-bold text-lg mb-4">المشاريع المرتبط بها المشارك</h3>
                      {!canEditProjects && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md text-sm mb-4">
                          لا تملك صلاحية تعديل المشاريع المرتبطة بهذا المشارك. تقتصر الصلاحية على المسؤولين.
                        </div>
                      )}
                      {projectsSection}
                    </TabsContent>
                    <TabsContent value="certificates" className="mt-0 space-y-4">
                      <h3 className="font-bold text-lg mb-4">الشهادات</h3>
                      <div className="rounded-lg border p-8 bg-muted/5 flex flex-col items-center justify-center gap-3 text-center">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                        </div>
                        <div>
                          <p className="font-medium">الشهادات</p>
                          <p className="text-muted-foreground text-sm">قريباً</p>
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              );
            } else {
              // Simple continuous form for New Participant
              return (
                <div className="flex-1 overflow-y-auto px-2 max-h-[75vh] space-y-8 py-4 w-full">
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg border-b pb-2 text-primary">الملف الشخصي</h3>
                    {profileSection}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg border-b pb-2 text-primary">بيانات ولي الأمر</h3>
                    {guardianSection}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg border-b pb-2 text-primary">المشاريع المرتبط بها المشارك</h3>
                    {!canEditProjects && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md text-sm mb-4">
                        لا تملك صلاحية تعديل المشاريع المرتبطة بهذا المشارك. تقتصر الصلاحية على المسؤولين.
                      </div>
                    )}
                    {projectsSection}
                  </div>
                </div>
              );
            }
          })()}
        </div>

        <DialogFooter className="mt-6 flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={saving || checkingUsername || previewMode} className={previewMode ? "bg-amber-600 hover:bg-amber-700" : ""}>
            {saving && <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />}
            {previewMode ? "وضع المعاينة (لا يمكن الحفظ)" : (initial ? t("common.save") : t("common.add"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
