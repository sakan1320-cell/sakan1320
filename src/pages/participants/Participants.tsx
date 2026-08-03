import React, { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pencil, Plus, Trash2, FileSpreadsheet, Download, Upload, Eye,
  Archive, RotateCcw, List, LayoutGrid, Users, UserCheck, UserMinus,
  Award, Calendar, FileEdit, CheckCircle2, XCircle, Search, ShieldAlert,
  GraduationCap, ArrowUpDown, ArrowUp, ArrowDown, Filter
} from "lucide-react";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ParticipantFormDialog, ParticipantRow } from "@/components/ParticipantFormDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PhoneInputWithCountry, COUNTRY_CODES } from "@/components/PhoneInputWithCountry";
import { HijriGregorianDateInput } from "@/components/HijriGregorianDateInput";
import { toGregorian } from "hijri-converter";

// Import existing attendance and edit requests pages to embed them as tabs
import Attendance from "./Attendance";
import AttendanceReport from "./AttendanceReport";
import ProfileEditRequests from "./ProfileEditRequests";
import RegistrationStructureSettings from "./RegistrationStructureSettings";

interface Project { id: string; name_ar: string; name_en: string | null; }
interface Branch { id: string; name_ar: string; project_id: string; }
interface RegistrationRequest {
  id: string;
  project_id: string;
  full_name: string;
  phone: string | null;
  national_id: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  // Joined
  project_name?: string;
}

const ARABIC_COLUMNS_MAP: Record<string, string> = {
  "الاسم الكامل": "full_name",
  "رقم الهوية": "national_id",
  "رقم الجوال": "phone",
  "البريد الإلكتروني": "email",
  "تاريخ الميلاد": "date_of_birth",
  "الجنس": "gender",
  "المشروع": "project_name",
  "الفرع": "branch_name",
  "المجموعة": "group_name",
  "ملاحظات": "notes",
  "اسم ولي الأمر": "guardian_name",
  "جوال ولي الأمر": "guardian_phone",
  "بريد ولي الأمر": "guardian_email",
  "هوية ولي الأمر": "guardian_national_id",
  "صلة القرابة": "guardian_relation",
  "إنشاء حساب": "create_account",
};

const TEMPLATE_COLUMNS = Object.keys(ARABIC_COLUMNS_MAP);

const Participants = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  // State Variables
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const { confirm, ConfirmDialogNode } = useConfirm();
  const [projectFilter, setProjectFilter] = useState<string>("_all");
  const [statusFilter, setStatusFilter] = useState<string>("active_inactive"); // active_inactive, active, inactive, archived, all
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ParticipantRow | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'full_name', direction: 'asc' });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Card View and Stats State
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    archived: 0,
    totalPoints: 0
  });

  // Registrations state
  const [registrations, setRegistrations] = useState<RegistrationRequest[]>([]);
  const [regSearch, setRegSearch] = useState("");
  const [regProjectFilter, setRegProjectFilter] = useState("_all");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [submittingRegAction, setSubmittingRegAction] = useState(false);

  // Import Dialog State
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDefaultProject, setImportDefaultProject] = useState<string>("_none");
  const [importDefaultBranch, setImportDefaultBranch] = useState<string>("_none");
  const [importDefaultGroup, setImportDefaultGroup] = useState<string>("_none");
  const [importCreateAccounts, setImportCreateAccounts] = useState(false);
  const [importSortConfig, setImportSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [importPreviewProjectFilter, setImportPreviewProjectFilter] = useState<string>("_all");
  const [importPreviewErrorFilter, setImportPreviewErrorFilter] = useState<string>("_all");
  const [isImportPreviewFilterOpen, setIsImportPreviewFilterOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<null | { summary: { total: number; created: number; skipped: number; failed: number }; results: Array<{ row: number; status: string; error?: string }> }>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<any[] | null>(null);
  const [selectedParsedRows, setSelectedParsedRows] = useState<number[]>([]);

  const customFieldKeys = useMemo(() => {
    if (!parsedRows) return [];
    const keys = new Set<string>();
    parsedRows.forEach(row => {
      if (row.custom_fields && typeof row.custom_fields === 'object') {
        Object.keys(row.custom_fields).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [parsedRows]);

  // Load Data
  const load = async () => {
    let q = supabase.from("participants").select("*").order("created_at", { ascending: false });
    
    // Project filter
    if (projectFilter === "_none") q = q.is("project_id", null);
    else if (projectFilter !== "_all") q = q.eq("project_id", projectFilter);

    // Status filter
    if (statusFilter === "active_inactive") q = q.in("status", ["active", "inactive"]);
    else if (statusFilter !== "all") q = q.eq("status", statusFilter);

    const { data } = await q;
    const parts = (data ?? []) as unknown as ParticipantRow[];
    setRows(parts);

    // Calculate quick stats from full data query to be accurate
    const { data: allData } = await supabase.from("participants").select("status, points");
    if (allData) {
      const counts = {
        total: allData.length,
        active: allData.filter(p => p.status === "active").length,
        inactive: allData.filter(p => p.status === "inactive").length,
        archived: allData.filter(p => p.status === "archived").length,
        totalPoints: allData.reduce((sum, p) => sum + (p.points || 0), 0)
      };
      setStats(counts);
    }
  };

  const loadRegistrations = async () => {
    const { data, error } = await supabase
      .from("project_registrations")
      .select("*, projects(name_ar, name_en)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("حدث خطأ أثناء تحميل طلبات التسجيل. يرجى إعادة تحميل الصفحة.");
    } else {
      setRegistrations((data ?? []).map((r: any) => ({
        ...r,
        project_name: i18n.language === "ar" ? r.projects?.name_ar : (r.projects?.name_en || r.projects?.name_ar)
      })));
    }
  };

  useEffect(() => {
    // Load lookup data
    supabase.from("projects").select("id, name_ar, name_en").then(pj => {
      console.log("Participants PJ:", pj.data, pj.error);
      supabase.from("project_branches").select("id, name_ar, project_id").order("name_ar").then(br => {
        console.log("Participants BR:", br.data, br.error);
        supabase.from("project_groups").select("id, name_ar, branch_id").order("name_ar").then(gr => {
          console.log("Participants GR:", gr.data, gr.error);
          setProjects(pj.data ?? []);
          setBranches(br.data ?? []);
          setGroups(gr.data ?? []);
        });
      });
    });
    loadRegistrations();
  }, []);

  useEffect(() => {
    load();
  }, [projectFilter, statusFilter]);

  // Archive and Restore Functions
  const handleArchive = async (id: string) => {
    const { error } = await supabase.from("participants").update({ status: "archived" }).eq("id", id);
    if (error) return toast.error("حدث خطأ أثناء الأرشفة. يرجى المحاولة مرة أخرى.");
    await logAudit("archive", "participant", id);
    toast.success(t("participants.archived", "تم نقل المشارك للأرشيف بنجاح"));
    load();
  };

  const handleRestore = async (id: string) => {
    const { error } = await supabase.from("participants").update({ status: "active" }).eq("id", id);
    if (error) return toast.error("حدث خطأ أثناء استعادة المشارك. يرجى المحاولة مرة أخرى.");
    await logAudit("restore", "participant", id);
    toast.success(t("participants.restored", "تم استعادة المشارك بنشاط"));
    load();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm(t("participants.deleteConfirm")))) return;
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) return toast.error("حدث خطأ أثناء الحذف. يرجى المحاولة مرة أخرى.");
    await logAudit("delete", "participant", id);
    toast.success(t("common.success"));
    load();
  };

  const projectName = (id?: string | null) => {
    if (!id) return t("participants.noProject", "بدون مشروع");
    const p = projects.find((x) => x.id === id);
    return p ? (i18n.language === "ar" ? p.name_ar : (p.name_en || p.name_ar)) : "—";
  };

  const branchName = (id?: string | null) => {
    if (!id) return "—";
    const b = branches.find((x) => x.id === id);
    return b ? (i18n.language === "ar" ? b.name_ar : (b.name_en || b.name_ar)) : "—";
  };

  const groupName = (id?: string | null) => {
    if (!id) return "—";
    const g = groups.find((x) => x.id === id);
    return g ? (i18n.language === "ar" ? g.name_ar : (g.name_en || g.name_ar)) : "—";
  };

  // Filtration & Sorting
  let filtered = rows.filter((r) =>
    !search || r.full_name.toLowerCase().includes(search.toLowerCase()) || (r.phone ?? "").includes(search) || (r.national_id ?? "").includes(search) || (r.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  filtered.sort((a, b) => {
    let aVal: string | number | null = null;
    let bVal: string | number | null = null;

    if (sortConfig.key === 'full_name') { aVal = a.full_name; bVal = b.full_name; }
    else if (sortConfig.key === 'national_id') { aVal = a.national_id; bVal = b.national_id; }
    else if (sortConfig.key === 'project') { aVal = projectName(a.project_id); bVal = projectName(b.project_id); }
    else if (sortConfig.key === 'branch') { aVal = branchName(a.branch_id); bVal = branchName(b.branch_id); }
    else if (sortConfig.key === 'group') { aVal = groupName((a as any).group_id); bVal = groupName((b as any).group_id); }
    else if (sortConfig.key === 'points') { aVal = a.points || 0; bVal = b.points || 0; }
    else if (sortConfig.key === 'status') { aVal = a.status; bVal = b.status; }

    if (aVal === null) aVal = "";
    if (bVal === null) bVal = "";

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  const toggleSort = (key: string) => {
    if (sortConfig.key === key) {
      setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };
  
  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ms-1 h-3 w-3 inline-block opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ms-1 h-3 w-3 inline-block text-emerald-600" /> : <ArrowDown className="ms-1 h-3 w-3 inline-block text-emerald-600" />;
  };

  const ImportSortIcon = ({ columnKey }: { columnKey: string }) => {
    if (importSortConfig?.key !== columnKey) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return importSortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const filteredRegs = registrations.filter((r) => {
    const matchesSearch = !regSearch || r.full_name.toLowerCase().includes(regSearch.toLowerCase()) || (r.phone ?? "").includes(regSearch) || (r.national_id ?? "").includes(regSearch);
    const matchesProject = regProjectFilter === "_all" || r.project_id === regProjectFilter;
    return matchesSearch && matchesProject;
  });

  // Gamification Level Inferences
  const getLevelInfo = (points: number) => {
    if (points >= 500) return { name: "👑 قائد", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" };
    if (points >= 300) return { name: "🏆 خبير", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
    if (points >= 150) return { name: "🏅 متميز", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" };
    if (points >= 50) return { name: "⭐ نشط", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" };
    return { name: "🌱 مبتدئ", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
  };

  // Registration Actions
  const handleApproveRegistration = async (req: RegistrationRequest) => {
    setSubmittingRegAction(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create participant record
      const { data: part, error: pErr } = await supabase.from("participants").insert([{
        full_name: req.full_name,
        phone: req.phone || "",
        national_id: req.national_id || "",
        project_id: req.project_id,
        status: "active",
        notes: req.notes,
        created_by: user?.id,
      }]).select().single();

      if (pErr) throw pErr;

      // 2. Approve registration request
      const { error: rErr } = await supabase.from("project_registrations").update({
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", req.id);

      if (rErr) throw rErr;

      await logAudit("create", "participant", part.id, { approved_from_registration: req.id });
      toast.success(t("participants.registrationApproved", "تم قبول طلب التسجيل وتحويله لمشارك فعلي بنجاح."));
      loadRegistrations();
      load();
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("national_id")) {
        toast.error("رقم الهوية مستخدم مسبقًا لمشارك آخر.");
      } else if (msg.includes("permission") || msg.includes("policy") || msg.includes("row-level")) {
        toast.error("ليس لديك صلاحية لقبول طلبات التسجيل.");
      } else if (msg.includes("column") && msg.includes("does not exist")) {
        toast.error("خطأ في بنية البيانات. يرجى التواصل مع الدعم الفني.");
      } else {
        toast.error("حدث خطأ أثناء قبول طلب التسجيل. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setSubmittingRegAction(false);
    }
  };

  const handleRejectRegistration = async () => {
    if (!rejectReason.trim()) {
      toast.error(t("participants.rejectReasonRequired", "يجب إدخال سبب الرفض"));
      return;
    }
    setSubmittingRegAction(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("project_registrations").update({
        status: "rejected",
        rejection_reason: rejectReason,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", rejectRequestId);

      if (error) throw error;

      toast.success(t("common.success"));
      setRejectOpen(false);
      setRejectReason("");
      loadRegistrations();
    } catch (e: any) {
      toast.error("حدث خطأ أثناء رفض الطلب. يرجى المحاولة مرة أخرى.");
    } finally {
      setSubmittingRegAction(false);
    }
  };

  // Export and Import Logic
  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    
    const worksheet = workbook.addWorksheet('بيانات المشتركين', {
      views: [{ rightToLeft: true }]
    });
    
    // Setup columns
    worksheet.columns = TEMPLATE_COLUMNS.map(col => ({ header: col, key: col, width: 20 }));
    
    // Center all columns
    worksheet.columns.forEach(column => {
      column.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Setup header style
    worksheet.getRow(1).font = { bold: true };
    
    // Sample row
    worksheet.addRow({
      "الاسم الكامل": "محمد أحمد",
      "رقم الهوية": "1234567890",
      "رقم الجوال": "+966500000000",
      "البريد الإلكتروني": "mohammad@example.com",
      "تاريخ الميلاد": "2010-05-01 (أو هجري 1431-05-17)",
      "الجنس": "ذكر",
      "المشروع": projects[0] ? (i18n.language === "ar" ? projects[0].name_ar : (projects[0].name_en || projects[0].name_ar)) : "",
      "الفرع": "",
      "المجموعة": "",
      "ملاحظات": "",
      "اسم ولي الأمر": "أحمد علي",
      "جوال ولي الأمر": "+966500000001",
      "بريد ولي الأمر": "",
      "هوية ولي الأمر": "",
      "صلة القرابة": "أب",
      "إنشاء حساب": "نعم",
    });

    // Populate projects list in column Z
    if (projects.length > 0) {
      projects.forEach((p, idx) => {
        worksheet.getCell(`Z${idx + 2}`).value = p.name_ar;
      });
    } else {
      worksheet.getCell('Z2').value = 'لا يوجد مشاريع';
    }
    
    // Populate branches list in column AA
    if (branches.length > 0) {
      branches.forEach((b, idx) => {
        worksheet.getCell(`AA${idx + 2}`).value = b.name_ar;
      });
    } else {
      worksheet.getCell('AA2').value = 'لا يوجد فروع';
    }

    // Populate groups list in column AB
    if (groups.length > 0) {
      groups.forEach((g, idx) => {
        worksheet.getCell(`AB${idx + 2}`).value = g.name_ar;
      });
    } else {
      worksheet.getCell('AB2').value = 'لا يوجد مجموعات';
    }

    // Hide the list columns
    worksheet.getColumn('Z').hidden = true;
    worksheet.getColumn('AA').hidden = true;
    worksheet.getColumn('AB').hidden = true;

    // Add Data Validation for rows 2 to 500
    const projectRange = `$Z$2:$Z$${Math.max(2, projects.length + 1)}`;
    const branchRange = `$AA$2:$AA$${Math.max(2, branches.length + 1)}`;
    const groupRange = `$AB$2:$AB$${Math.max(2, groups.length + 1)}`;

    for (let i = 2; i <= 500; i++) {
      // الجنس (Column F)
      worksheet.getCell(`F${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"ذكر,أنثى"']
      };
      
      // المشروع (Column G)
      worksheet.getCell(`G${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [projectRange]
      };
      
      // الفرع (Column H)
      worksheet.getCell(`H${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [branchRange]
      };

      // المجموعة (Column I)
      worksheet.getCell(`I${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [groupRange]
      };
      
      // صلة القرابة (Column O)
      worksheet.getCell(`O${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"أب,أم,أخ,أخت,زوج,وصي,أخرى"']
      };
      
      // إنشاء حساب (Column P)
      worksheet.getCell(`P${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"نعم,لا"']
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'قالب_بيانات_المشتركين.xlsx');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImportFile(file);
    setParsedRows(null);
    setSelectedParsedRows([]);
    setImportResult(null);

    if (file) {
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const mappedJson = rawJson.map(row => {
          const mappedRow: Record<string, unknown> = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.trim();
            if (!cleanKey || cleanKey.startsWith("__EMPTY")) return;
            
            const engKey = ARABIC_COLUMNS_MAP[cleanKey] || cleanKey;
            
            if (engKey === "phone" && typeof row[key] !== "undefined") {
              let phoneStr = String(row[key]).trim().replace(/\s+/g, "");
              let cc = "966";
              
              if (phoneStr.startsWith("+")) {
                phoneStr = phoneStr.substring(1);
                if (phoneStr.startsWith("966")) { cc = "966"; phoneStr = phoneStr.substring(3); }
              } else if (phoneStr.startsWith("00")) {
                phoneStr = phoneStr.substring(2);
                if (phoneStr.startsWith("966")) { cc = "966"; phoneStr = phoneStr.substring(3); }
              } else if (phoneStr.startsWith("0") && phoneStr.length === 10) {
                cc = "966";
                phoneStr = phoneStr.substring(1);
              } else if (phoneStr.length === 12 && phoneStr.startsWith("966")) {
                cc = "966";
                phoneStr = phoneStr.substring(3);
              }
              
              mappedRow["phone_country_code"] = cc;
              mappedRow["phone"] = phoneStr;
            } else {
              const safeEngKey = engKey || cleanKey;
              const isStandard = Object.values(ARABIC_COLUMNS_MAP).includes(safeEngKey) || safeEngKey === "phone_country_code" || safeEngKey === "create_account" || Object.keys(ARABIC_COLUMNS_MAP).includes(cleanKey);
              if (isStandard) {
                let val = row[key];
                if (safeEngKey === "date_of_birth" && typeof val === "string") {
                  // Clean up string
                  let dStr = val.trim().replace(/هـ/g, "").trim();
                  // Check if it looks like a hijri date (year < 1500)
                  const parts = dStr.split(/[-/]/);
                  if (parts.length === 3) {
                    let [y, m, d] = parts.map(Number);
                    // handle DD/MM/YYYY vs YYYY/MM/DD
                    if (y > 31 && y < 1500) {
                      // It's a Hijri year
                      try {
                        const greg = toGregorian(y, m, d);
                        val = `${greg.gy}-${greg.gm.toString().padStart(2, "0")}-${greg.gd.toString().padStart(2, "0")}`;
                      } catch(e) {}
                    } else if (d > 31 && d < 1500) {
                      try {
                        const greg = toGregorian(d, m, y);
                        val = `${greg.gy}-${greg.gm.toString().padStart(2, "0")}-${greg.gd.toString().padStart(2, "0")}`;
                      } catch(e) {}
                    } else if (y >= 1500) {
                      // Gregorian, ensure format YYYY-MM-DD
                      val = `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
                    } else if (d >= 1500) {
                      val = `${d}-${m.toString().padStart(2, "0")}-${y.toString().padStart(2, "0")}`;
                    }
                  }
                }
                mappedRow[safeEngKey] = val;
              } else {
                if (!mappedRow["custom_fields"]) mappedRow["custom_fields"] = {};
                (mappedRow["custom_fields"] as any)[cleanKey] = row[key];
              }
            }
          });
          return mappedRow;
        });
        setParsedRows(mappedJson);
      } catch (err) {
        toast.error("حدث خطأ أثناء قراءة الملف");
      }
    }
  };

  const handleRemoveParsedRow = (index: number) => {
    if (!parsedRows) return;
    const updated = [...parsedRows];
    updated.splice(index, 1);
    setParsedRows(updated);
    setSelectedParsedRows(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const handleImportSort = (key: string) => {
    if (!parsedRows) return;
    let direction: 'asc' | 'desc' = 'asc';
    if (importSortConfig && importSortConfig.key === key && importSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setImportSortConfig({ key, direction });

    const sorted = [...parsedRows].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      if (key.startsWith("custom_fields.")) {
        const customKey = key.replace("custom_fields.", "");
        aVal = String((a.custom_fields as any)?.[customKey] || "");
        bVal = String((b.custom_fields as any)?.[customKey] || "");
      } else {
        aVal = String(a[key] || "");
        bVal = String(b[key] || "");
      }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setParsedRows(sorted);
  };

  const handleRemoveSelectedParsedRows = () => {
    if (!parsedRows || selectedParsedRows.length === 0) return;
    const updated = parsedRows.filter((_, i) => !selectedParsedRows.includes(i));
    setParsedRows(updated);
    setSelectedParsedRows([]);
  };

  const updateParsedRow = (index: number, key: string, value: any) => {
    if (!parsedRows) return;
    const updated = [...parsedRows];
    updated[index] = { ...updated[index], [key]: value };
    setParsedRows(updated);
  };

  const runImport = async () => {
    if (!importFile || !parsedRows) { toast.error(t("participants.import.pickFile")); return; }
    if (parsedRows.length === 0) { toast.error(t("participants.import.empty")); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-participants", {
        body: {
          rows: parsedRows.filter((_, i) => selectedParsedRows.includes(i)).map(r => {
            const copy = { ...r };
            if (copy.phone && typeof copy.phone === 'string') {
              const cc = String(copy.phone_country_code || '966').replace(/^\+/, '');
              const p = copy.phone.replace(/^\+/, '');
              copy.phone = `${cc}${p}`;
            }
            return copy;
          }),
          default_project_id: importDefaultProject === "_none" ? undefined : importDefaultProject,
          default_branch_id: importDefaultBranch === "_none" ? null : importDefaultBranch,
          default_group_id: importDefaultGroup === "_none" ? null : importDefaultGroup,
          create_accounts: importCreateAccounts,
        },
      });
      if (error) throw error;
      const res = data as typeof importResult;
      setImportResult(res);
      toast.success(t("participants.import.done", { ...(res?.summary ?? {}) }));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const exportData = () => {
    const dataToExport = filtered.map(r => {
      const anyR = r as any; // Cast to any to access fields that might be missing in ParticipantRow interface
      return {
        "الاسم الكامل": r.full_name || "",
        "رقم الهوية": r.national_id || "",
        "رقم الجوال": r.phone ? `+966${r.phone.replace(/^966/, '')}` : "",
        "البريد الإلكتروني": r.email || "",
        "تاريخ الميلاد": r.date_of_birth || "",
        "الجنس": r.gender === "male" ? "ذكر" : r.gender === "female" ? "أنثى" : "",
        "المشروع": projectName(r.project_id) === "—" ? "" : projectName(r.project_id),
        "الفرع": branchName(r.branch_id) === "—" ? "" : branchName(r.branch_id),
        "المجموعة": groupName(anyR.group_id) === "—" ? "" : groupName(anyR.group_id),
        "ملاحظات": r.notes || "",
        "اسم ولي الأمر": r.guardian_name || "",
        "جوال ولي الأمر": r.guardian_phone || "",
        "بريد ولي الأمر": r.guardian_email || "",
        "هوية ولي الأمر": r.guardian_national_id || "",
        "صلة القرابة": r.guardian_relation === "father" ? "أب" : r.guardian_relation === "mother" ? "أم" : r.guardian_relation === "brother" ? "أخ" : r.guardian_relation === "sister" ? "أخت" : r.guardian_relation === "husband" ? "زوج" : r.guardian_relation === "guardian" ? "وصي" : r.guardian_relation === "other" ? "أخرى" : "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المشاركون");
    XLSX.writeFile(wb, "بيانات_المشاركين.xlsx");
  };

  const importBranches = branches.filter((b) => b.project_id === importDefaultProject);
  const importGroups = groups.filter((g) => g.branch_id === importDefaultBranch);

  return (
    <div dir="rtl" className="space-y-8 animate-in fade-in duration-500 bg-background/50 p-4 md:p-8">
      {ConfirmDialogNode}


      {/* Grid Stats */}
      <div className="grid gap-6 grid-cols-2 md:grid-cols-5">
        {[
          { k: "total", v: stats.total, icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-100 dark:border-blue-800/30", desc: "إجمالي المسجلين" },
          { k: "active", v: stats.active, icon: UserCheck, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-100 dark:border-emerald-800/30", desc: "المشاركون النشطون" },
          { k: "inactive", v: stats.inactive, icon: UserMinus, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-100 dark:border-amber-800/30", desc: "غير نشطين" },
          { k: "archived", v: stats.archived, icon: Archive, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-900/20", border: "border-slate-200 dark:border-slate-800/50", desc: "الأرشيف" },
          { k: "points", v: stats.totalPoints, icon: Award, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-100 dark:border-purple-800/30", desc: "مجموع النقاط" },
        ].map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className={`p-5 rounded-3xl flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-sm border ${s.bg} ${s.border}`}>
              <div className="bg-white dark:bg-card/50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm mb-4">
                <Icon className={`h-6 w-6 ${s.color}`} />
              </div>
              <div>
                <p className={`text-sm font-bold mb-1 opacity-80 ${s.color}`}>{s.desc}</p>
                <p className={`text-3xl font-black ${s.color}`}>{s.v}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="list" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-5 p-1 bg-muted/60 rounded-xl">
          <TabsTrigger value="list" className="rounded-lg py-2.5 gap-1.5"><Users className="h-4 w-4" />{t("participants.tabs.list", "المشاركون")}</TabsTrigger>
          <TabsTrigger value="registrations" className="rounded-lg py-2.5 gap-1.5 relative">
            <Users className="h-4 w-4" />
            {t("participants.tabs.registrations", "طلبات التسجيل")}
            {registrations.filter(r => r.status === "pending").length > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                {registrations.filter(r => r.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-lg py-2.5 gap-1.5"><Calendar className="h-4 w-4" />{t("participants.tabs.attendance", "تحضير الحضور")}</TabsTrigger>
          <TabsTrigger value="edit_requests" className="rounded-lg py-2.5 gap-1.5"><FileEdit className="h-4 w-4" />{t("participants.tabs.edit_requests", "طلبات التعديل")}</TabsTrigger>
        </TabsList>

        {/* Tab 1: Participants List */}
        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2 mb-4 mt-2">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
              <div className="flex items-center gap-1 rtl:ml-2 ltr:mr-2">
                 <Button size="icon" variant="ghost" onClick={() => { setEditing(null); setOpen(true); }} title={t("participants.new", "إضافة مشارك")} className="rounded-full h-9 w-9 bg-primary/10 text-primary hover:bg-primary/20">
                   <Plus className="h-4 w-4" />
                 </Button>
                 <Button size="icon" variant="ghost" onClick={() => setImportOpen(true)} title="استيراد" className="rounded-full h-9 w-9 bg-muted/50 hover:bg-muted">
                   <Download className="h-4 w-4 text-muted-foreground" />
                 </Button>
                 <Button size="icon" variant="ghost" onClick={exportData} title="تصدير" className="rounded-full h-9 w-9 bg-muted/50 hover:bg-muted">
                   <Upload className="h-4 w-4 text-muted-foreground" />
                 </Button>
              </div>
              <div className="relative w-full sm:w-64 flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t("common.search", "بحث...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-3 pr-9 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background text-sm"
                />
              </div>
            </div>

            <div className="flex bg-muted/50 rounded-lg p-0.5 shrink-0">
              <button onClick={() => setViewMode("table")} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} title="عرض القائمة"><List className="w-4 h-4" /></button>
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} title="بطاقات العرض"><LayoutGrid className="w-4 h-4" /></button>
            </div>
          </div>

          <div className={`border border-border/50 rounded-2xl overflow-y-auto shadow-sm ${viewMode === 'table' ? 'bg-card' : 'border-none shadow-none'}`}>
            <div className="p-0">
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">{t("participants.empty", "لا يوجد مشاركون مطابخون لخيارات البحث.")}</p>
              ) : viewMode === "table" ? (
                  <Table>
                <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-md z-10">
                  <TableRow className="border-none">
                    <TableHead className="w-[50px] p-0 align-middle">
                      <div className="relative flex items-center justify-center w-full h-full">
                        <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                          <DropdownMenuTrigger asChild>
                            <div className="absolute inset-0 w-full h-full pointer-events-none" />
                          </DropdownMenuTrigger>
                          
                          <div 
                            className="flex items-center justify-center cursor-pointer p-3"
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsFilterOpen(true);
                            }}
                            onClick={() => {
                              // Optional: You could still show the info toast here
                              toast.info("انقر مرتين لفتح خيارات التصفية", { position: "top-center" });
                            }}
                          >
                            <Checkbox 
                              className="rounded-full h-5 w-5 border-muted-foreground/50"
                              checked={filtered.length > 0 && filtered.every(p => selectedRows.includes(p.id!))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedRows(prev => [...new Set([...prev, ...filtered.map(p => p.id!)])]);
                                } else {
                                  setSelectedRows(prev => prev.filter(id => !filtered.find(p => p.id === id)));
                                }
                              }}
                            />
                          </div>
                          
                          <DropdownMenuContent align="start" className="w-48 shadow-xl rounded-xl p-1">
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="rounded-lg">تصفية بالمشروع ({projectFilter === '_all' ? 'الكل' : projectFilter === '_none' ? 'بدون' : 'محدد'})</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="rounded-xl max-h-64 overflow-y-auto shadow-xl p-1">
                                <DropdownMenuItem className="rounded-lg" onClick={() => setProjectFilter("_all")}>كل المشاريع</DropdownMenuItem>
                                <DropdownMenuItem className="rounded-lg" onClick={() => setProjectFilter("_none")}>بدون مشروع</DropdownMenuItem>
                                {projects.map(p => (
                                  <DropdownMenuItem className="rounded-lg" key={p.id} onClick={() => setProjectFilter(p.id)}>
                                    {i18n.language === "ar" ? p.name_ar : (p.name_en || p.name_ar)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="rounded-lg">تصفية بالحالة ({statusFilter === 'active_inactive' ? 'النشط' : statusFilter === 'all' ? 'الكل' : 'محدد'})</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="rounded-xl shadow-xl p-1">
                                <DropdownMenuItem className="rounded-lg" onClick={() => setStatusFilter("active_inactive")}>النشط وغير النشط</DropdownMenuItem>
                                <DropdownMenuItem className="rounded-lg" onClick={() => setStatusFilter("active")}>نشط</DropdownMenuItem>
                                <DropdownMenuItem className="rounded-lg" onClick={() => setStatusFilter("inactive")}>غير نشط</DropdownMenuItem>
                                <DropdownMenuItem className="rounded-lg" onClick={() => setStatusFilter("archived")}>مؤرشف</DropdownMenuItem>
                                <DropdownMenuItem className="rounded-lg" onClick={() => setStatusFilter("all")}>الكل</DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('full_name')}>
                      <div className="flex items-center gap-1">
                        {t("participants.name", "الاسم")}
                        <SortIcon columnKey="full_name" />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('national_id')}>
                      <div className="flex items-center gap-1">
                        {t("participants.nationalId", "رقم الهوية")}
                        <SortIcon columnKey="national_id" />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('project')}>
                      <div className="flex items-center gap-1">
                        {t("participants.project", "المشروع")}
                        <SortIcon columnKey="project" />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('branch')}>
                      <div className="flex items-center gap-1">
                        الفرع
                        <SortIcon columnKey="branch" />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('group')}>
                      <div className="flex items-center gap-1">
                        المجموعة
                        <SortIcon columnKey="group" />
                      </div>
                    </TableHead>
                    <TableHead>{t("participants.phone", "الهاتف")}</TableHead>
                    <TableHead>{t("participants.email", "البريد الإلكتروني")}</TableHead>
                    <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('points')}>
                      <div className="flex items-center gap-1">
                        {t("participants.points", "النقاط")}
                        <SortIcon columnKey="points" />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('status')}>
                      <div className="flex items-center gap-1">
                        {t("participants.status", "الحالة")}
                        <SortIcon columnKey="status" />
                      </div>
                    </TableHead>
                    <TableHead className="text-end">{t("common.actions", "الإجراءات")}</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const level = getLevelInfo(p.points || 0);
                      return (
                        <TableRow key={p.id} className={selectedRows.includes(p.id!) ? "bg-muted/30" : ""}>
                          <TableCell className="w-[50px] p-0 align-middle">
                            <div className="flex items-center justify-center w-full h-full">
                              <Checkbox 
                                className="rounded-full h-5 w-5 border-muted-foreground/50"
                                checked={selectedRows.includes(p.id!)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedRows(prev => [...prev, p.id!]);
                                  } else {
                                    setSelectedRows(prev => prev.filter(id => id !== p.id));
                                  }
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{p.full_name}</TableCell>
                          <TableCell dir="ltr" className="font-mono text-xs">{p.national_id || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{projectName(p.project_id)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{branchName(p.branch_id)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{groupName((p as any).group_id)}</TableCell>
                          <TableCell dir="ltr">{p.phone || "—"}</TableCell>
                          <TableCell className="text-sm">{p.email || "—"}</TableCell>
                          <TableCell>
                            <span className="font-semibold">{p.points ?? 0}</span>
                            <Badge variant="outline" className={`ms-1.5 text-[10px] px-1.5 py-0 ${level.color}`}>{level.name}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.status === "active" ? "default" : p.status === "inactive" ? "secondary" : "outline"}>
                              {p.status === "active" ? "نشط" : p.status === "inactive" ? "غير نشط" : "مؤرشف"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" asChild title="عرض التفاصيل">
                                <Link to={`/participants/${p.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }} title="تعديل">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {p.status !== "archived" ? (
                                <Button size="icon" variant="ghost" onClick={() => handleArchive(p.id!)} title="نقل للأرشيف">
                                  <Archive className="h-4 w-4 text-warning" />
                                </Button>
                              ) : (
                                <Button size="icon" variant="ghost" onClick={() => handleRestore(p.id!)} title="استعادة النشاط">
                                  <RotateCcw className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id!)} title="حذف نهائي">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-4">
                  {filtered.map((p) => {
                    const level = getLevelInfo(p.points || 0);
                    return (
                      <Card key={p.id} className="border-none shadow-sm overflow-hidden bg-card hover:shadow-md transition-all">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                          <div>
                            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${level.color}`}>{level.name}</Badge>
                          </div>
                          <Badge variant={p.status === "active" ? "default" : p.status === "inactive" ? "secondary" : "outline"}>
                            {p.status === "active" ? "نشط" : p.status === "inactive" ? "غير نشط" : "مؤرشف"}
                          </Badge>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-3">
                          <div>
                            <h3 className="font-bold text-lg">{p.full_name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{projectName(p.project_id)}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-b py-2">
                            <div>
                              <span className="text-muted-foreground block">الهوية</span>
                              <span className="font-semibold font-mono">{p.national_id || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">الهاتف</span>
                              <span className="font-semibold">{p.phone || "—"}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1">
                              <Award className="h-4 w-4 text-warning" />
                              <span className="font-bold text-sm">{p.points || 0}</span>
                              <span className="text-muted-foreground text-xs">نقطة</span>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/participants/${p.id}`}>{t("participants.viewProfile", "ملف المشارك")}</Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Registration Requests */}
        <TabsContent value="registrations" className="mt-4 space-y-4">
          <Card className="border-none shadow-sm">
            <CardContent className="grid gap-3 p-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("common.search", "بحث بالاسم، الهوية، الهاتف...")} value={regSearch} onChange={(e) => setRegSearch(e.target.value)} className="pr-9" />
              </div>
              <Select value={regProjectFilter} onValueChange={setRegProjectFilter}>
                <SelectTrigger><SelectValue placeholder={t("participants.filterProject", "تصفية بالمشروع")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("common.all", "كل المشاريع")}</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{i18n.language === "ar" ? p.name_ar : (p.name_en || p.name_ar)}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              {filteredRegs.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">{t("participants.noRegistrationRequests", "لا توجد طلبات تسجيل مطابقة للبحث.")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("participants.fullName", "الاسم الكامل")}</TableHead>
                      <TableHead>{t("participants.phone", "الهاتف")}</TableHead>
                      <TableHead>{t("participants.nationalId", "رقم الهوية")}</TableHead>
                      <TableHead>{t("participants.email", "البريد")}</TableHead>
                      <TableHead>{t("participants.project", "المشروع")}</TableHead>
                      <TableHead>{t("participants.notes", "ملاحظات")}</TableHead>
                      <TableHead>{t("participants.status", "الحالة")}</TableHead>
                      <TableHead className="text-end">{t("common.actions", "الإجراءات")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell dir="ltr">{r.phone || "—"}</TableCell>
                        <TableCell dir="ltr" className="font-mono text-xs">{r.national_id || "—"}</TableCell>
                        <TableCell className="text-sm">{r.email || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.project_name || "—"}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={r.notes || ""}>{r.notes || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "pending" ? "outline" : r.status === "approved" ? "default" : "destructive"}>
                            {r.status === "pending" ? "معلق" : r.status === "approved" ? "مقبول" : "مرفوض"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          {r.status === "pending" ? (
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" variant="default" disabled={submittingRegAction} onClick={() => handleApproveRegistration(r)}>
                                <UserCheck className="h-3.5 w-3.5 me-1" />{t("common.approve", "قبول")}
                              </Button>
                              <Button size="sm" variant="destructive" disabled={submittingRegAction} onClick={() => { setRejectRequestId(r.id); setRejectReason(""); setRejectOpen(true); }}>
                                <XCircle className="h-3.5 w-3.5 me-1" />{t("common.reject", "رفض")}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">تمت المراجعة</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Attendance & Reports */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          <Tabs defaultValue="sheets" dir="rtl">
            <TabsList className="bg-muted p-1 rounded-lg">
              <TabsTrigger value="sheets" className="px-4 py-1.5 text-xs">تحضير الحضور اليومي</TabsTrigger>
              <TabsTrigger value="reports" className="px-4 py-1.5 text-xs">سجل الحضور والتقارير</TabsTrigger>
            </TabsList>
            <TabsContent value="sheets" className="mt-3">
              <Attendance />
            </TabsContent>
            <TabsContent value="reports" className="mt-3">
              <AttendanceReport />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Tab 5: Profile Edit Requests */}
        <TabsContent value="edit_requests" className="mt-4">
          <ProfileEditRequests />
        </TabsContent>

        <TabsContent value="structure" className="mt-4">
          <RegistrationStructureSettings />
        </TabsContent>
      </Tabs>

      {/* Forms & Dialogs */}
      <ParticipantFormDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={load} />

      {/* Excel Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) { setImportFile(null); setImportResult(null); setParsedRows(null); setSelectedParsedRows([]); } }}>
        <DialogContent className={parsedRows ? "max-w-[95vw] h-[95vh] flex flex-col" : "max-w-xl"}>
          <DialogHeader>
            <DialogTitle>{t("participants.import.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4 pr-2">
            {!parsedRows && (
              <div className="rounded-md border p-3 text-sm space-y-2">
                <p>{t("participants.import.intro")}</p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 me-2" />{t("participants.import.downloadTemplate")}
                </Button>
              </div>
            )}

            <div className={parsedRows ? "grid grid-cols-1 md:grid-cols-3 gap-4" : "space-y-4"}>
              <div>
                <Label>{isRtl ? "المشروع" : "Project"}</Label>
                <Select value={importDefaultProject} onValueChange={(v) => { setImportDefaultProject(v); setImportDefaultBranch("_none"); setImportDefaultGroup("_none"); }}>
                  <SelectTrigger><SelectValue placeholder={t("participants.project")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t("common.notSet")}</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{i18n.language === "ar" ? p.name_ar : (p.name_en || p.name_ar)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {importDefaultProject && importDefaultProject !== "_none" && importBranches.length > 0 && (
                <div className="grid grid-cols-2 gap-4 col-span-2">
                  <div>
                    <Label>{isRtl ? "الفرع" : "Branch"}</Label>
                    <Select value={importDefaultBranch} onValueChange={(v) => { setImportDefaultBranch(v); setImportDefaultGroup("_none"); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t("common.notSet")}</SelectItem>
                        {importBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {importDefaultBranch && importDefaultBranch !== "_none" && importGroups.length > 0 && (
                    <div>
                      <Label>{isRtl ? "المجموعة" : "Group"}</Label>
                      <Select value={importDefaultGroup} onValueChange={setImportDefaultGroup}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">{t("common.notSet")}</SelectItem>
                          {importGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="imp-acc" checked={importCreateAccounts} onCheckedChange={(v) => setImportCreateAccounts(!!v)} />
              <Label htmlFor="imp-acc" className="cursor-pointer">{t("participants.import.createAccounts")}</Label>
            </div>

            <div>
              <Label>{t("participants.import.file")}</Label>
              <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
              
              {!parsedRows && (
                <>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex-1 h-px bg-muted"></div>
                    <span className="text-xs text-muted-foreground">أو</span>
                    <div className="flex-1 h-px bg-muted"></div>
                  </div>
                  <Button variant="outline" className="w-full mt-4 border-dashed border-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground" onClick={() => {
                    setParsedRows([{ 
                      full_name: "", 
                      national_id: "", 
                      phone: "",
                      email: "",
                      gender: "",
                      date_of_birth: "",
                      project_name: "",
                      branch_name: "",
                      group_name: "",
                      guardian_name: "",
                      guardian_phone: ""
                    }]);
                    setImportResult(null);
                  }}>
                    <Plus className="w-4 h-4 me-2" /> إدخال البيانات يدوياً
                  </Button>
                </>
              )}
            </div>

            {parsedRows && !importResult && (
              <div className="mt-4 border rounded-xl overflow-hidden flex flex-col h-full min-h-[300px]">
                <div className="bg-muted p-2 flex justify-between items-center rounded-t-lg">
                  <div className="text-sm font-bold flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-primary" />
                    معاينة البيانات ({parsedRows.length} صف)
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedParsedRows.length > 0 && (
                      <Button variant="destructive" size="sm" onClick={handleRemoveSelectedParsedRows}>
                        <Trash2 className="w-4 h-4 me-2" /> حذف المحدد ({selectedParsedRows.length})
                      </Button>
                    )}
                  </div>
                </div>
                <div className="overflow-auto flex-1 bg-background relative">
                  <Table className="w-full">
                    <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-md z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-10 p-0">
                          <DropdownMenu open={isImportPreviewFilterOpen} onOpenChange={setIsImportPreviewFilterOpen}>
                            <DropdownMenuTrigger asChild>
                              <div 
                                className="flex items-center justify-center cursor-pointer p-3 h-full"
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setIsImportPreviewFilterOpen(true);
                                }}
                                onClick={() => {
                                  toast.info("انقر مرتين لفتح خيارات التصفية", { position: "top-center", id: "import-filter-hint" });
                                }}
                              >
                                <Checkbox
                                  className="rounded-full h-5 w-5 border-muted-foreground/50"
                                  checked={selectedParsedRows.length === parsedRows.length && parsedRows.length > 0}
                                  onCheckedChange={(checked) => {
                                    if (checked) setSelectedParsedRows(parsedRows.map((_, i) => i));
                                    else setSelectedParsedRows([]);
                                  }}
                                />
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 shadow-xl rounded-xl p-1">
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="rounded-lg">تصفية بالمشروع ({importPreviewProjectFilter === '_all' ? 'الكل' : importPreviewProjectFilter === '_none' ? 'بدون' : 'محدد'})</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="rounded-xl max-h-64 overflow-y-auto shadow-xl p-1">
                                  <DropdownMenuItem className="rounded-lg" onClick={() => setImportPreviewProjectFilter("_all")}>الكل</DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg" onClick={() => setImportPreviewProjectFilter("_none")}>بدون مشروع</DropdownMenuItem>
                                  {projects.map(p => (
                                    <DropdownMenuItem className="rounded-lg" key={p.id} onClick={() => setImportPreviewProjectFilter(p.name_ar)}>
                                      {p.name_ar}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>

                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="rounded-lg">تصفية بالأخطاء ({importPreviewErrorFilter === '_all' ? 'الكل' : importPreviewErrorFilter === 'valid' ? 'صحيحة' : 'خاطئة'})</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="rounded-xl shadow-xl p-1">
                                  <DropdownMenuItem className="rounded-lg" onClick={() => setImportPreviewErrorFilter("_all")}>الكل</DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg" onClick={() => setImportPreviewErrorFilter("valid")}>بيانات صحيحة</DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg text-red-600" onClick={() => setImportPreviewErrorFilter("invalid")}>يوجد أخطاء</DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("full_name")}>
                          <div className="flex items-center justify-center gap-1">الاسم <ImportSortIcon columnKey="full_name" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("national_id")}>
                          <div className="flex items-center justify-center gap-1">الهوية <ImportSortIcon columnKey="national_id" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("phone")}>
                          <div className="flex items-center justify-center gap-1">الجوال <ImportSortIcon columnKey="phone" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("email")}>
                          <div className="flex items-center justify-center gap-1 min-w-[150px]">البريد <ImportSortIcon columnKey="email" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("gender")}>
                          <div className="flex items-center justify-center gap-1 min-w-[80px]">الجنس <ImportSortIcon columnKey="gender" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("date_of_birth")}>
                          <div className="flex items-center justify-center gap-1 min-w-[100px]">الميلاد <ImportSortIcon columnKey="date_of_birth" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("project_name")}>
                          <div className="flex items-center justify-center gap-1">المشروع <ImportSortIcon columnKey="project_name" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("branch_name")}>
                          <div className="flex items-center justify-center gap-1">الفرع <ImportSortIcon columnKey="branch_name" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("group_name")}>
                          <div className="flex items-center justify-center gap-1">المجموعة <ImportSortIcon columnKey="group_name" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("guardian_name")}>
                          <div className="flex items-center justify-center gap-1 min-w-[120px]">ولي الأمر <ImportSortIcon columnKey="guardian_name" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort("guardian_phone")}>
                          <div className="flex items-center justify-center gap-1 min-w-[120px]">جوال ولي الأمر <ImportSortIcon columnKey="guardian_phone" /></div>
                        </TableHead>
                        {customFieldKeys.map(k => (
                          <TableHead key={k} className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => handleImportSort(`custom_fields.${k}`)}>
                            <div className="flex items-center justify-center gap-1 min-w-[120px] text-primary">{k} <ImportSortIcon columnKey={`custom_fields.${k}`} /></div>
                          </TableHead>
                        ))}
                        <TableHead className="w-16 text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((row, i) => {
                        const nameInvalid = !row.full_name || String(row.full_name).trim().length < 3;
                        const idInvalid = !row.national_id || !/^\d{10}$/.test(String(row.national_id).trim());
                        const phoneInvalid = !row.phone || String(row.phone).trim().length < 9;
                        const hasError = nameInvalid || idInvalid || phoneInvalid;

                        if (importPreviewProjectFilter !== "_all") {
                          if (importPreviewProjectFilter === "_none" && row.project_name) return null;
                          if (importPreviewProjectFilter !== "_none" && row.project_name !== importPreviewProjectFilter) return null;
                        }

                        if (importPreviewErrorFilter !== "_all") {
                          if (importPreviewErrorFilter === "valid" && hasError) return null;
                          if (importPreviewErrorFilter === "invalid" && !hasError) return null;
                        }
                        
                        return (
                          <TableRow key={i}>
                          <TableCell className="text-center align-middle p-0">
                            <div className="flex justify-center items-center w-full h-full">
                              <Checkbox
                                className="rounded-full h-5 w-5 border-muted-foreground/50"
                                checked={selectedParsedRows.includes(i)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedParsedRows(prev => [...prev, i]);
                                  else setSelectedParsedRows(prev => prev.filter(idx => idx !== i));
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input value={row.full_name || ""} onChange={(e) => updateParsedRow(i, "full_name", e.target.value)} className={`h-8 min-w-[150px] text-center ${nameInvalid ? 'text-xs border-red-500 bg-red-50 text-red-700 placeholder:text-red-300' : ''}`} placeholder={nameInvalid ? "الاسم مطلوب" : ""} />
                          </TableCell>
                          <TableCell>
                            <Input value={row.national_id || ""} onChange={(e) => updateParsedRow(i, "national_id", e.target.value)} className={`h-8 min-w-[120px] text-center ${idInvalid ? 'text-xs border-red-500 bg-red-50 text-red-700 placeholder:text-red-300' : ''}`} placeholder={idInvalid ? "10 أرقام" : ""} />
                          </TableCell>
                          <TableCell>
                            <PhoneInputWithCountry 
                              value={row.phone_country_code ? `+${row.phone_country_code}${row.phone || ""}` : (row.phone || "")}
                              onChange={(fullNumber) => {
                                let cc = "966";
                                let num = fullNumber;
                                if (fullNumber.startsWith("+")) {
                                  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
                                  const codeMatch = sortedCodes.find(c => fullNumber.startsWith(c.code));
                                  if (codeMatch) {
                                    cc = codeMatch.code.replace("+", "");
                                    num = fullNumber.replace(codeMatch.code, "");
                                  }
                                } else if (fullNumber) {
                                  num = fullNumber;
                                }
                                updateParsedRow(i, "phone_country_code", cc);
                                updateParsedRow(i, "phone", num);
                              }}
                              className={`min-w-[150px] [&>button]:h-8 [&>input]:h-8 [&>button]:px-2 [&>input]:text-xs [&>button]:text-xs ${phoneInvalid ? '[&>input]:border-red-500 [&>input]:bg-red-50 [&>input]:text-red-700 [&>button]:border-red-500 [&>button]:bg-red-50' : ''}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input value={row.email || ""} onChange={(e) => updateParsedRow(i, "email", e.target.value)} className="h-8 min-w-[150px] text-center text-xs" dir="ltr" />
                          </TableCell>
                          <TableCell>
                            <Select value={row.gender === "أنثى" ? "أنثى" : row.gender === "ذكر" ? "ذكر" : "_none"} onValueChange={(v) => updateParsedRow(i, "gender", v === "_none" ? "" : v)}>
                              <SelectTrigger className="h-8 min-w-[80px] text-center text-xs"><SelectValue placeholder="-" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">-</SelectItem>
                                <SelectItem value="ذكر">ذكر</SelectItem>
                                <SelectItem value="أنثى">أنثى</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <HijriGregorianDateInput 
                              value={row.date_of_birth || ""} 
                              onChange={(val) => updateParsedRow(i, "date_of_birth", val)} 
                              className="min-w-[150px] [&_input]:text-xs [&_button]:text-xs" 
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={row.project_name || "_none"} onValueChange={(v) => updateParsedRow(i, "project_name", v === "_none" ? "" : v)}>
                              <SelectTrigger className="h-8 min-w-[120px] text-center text-xs"><SelectValue placeholder="المشروع" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">{t("common.notSet")}</SelectItem>
                                {projects.map((p) => <SelectItem key={p.id} value={p.name_ar}>{p.name_ar}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={row.branch_name || "_none"} onValueChange={(v) => updateParsedRow(i, "branch_name", v === "_none" ? "" : v)}>
                              <SelectTrigger className="h-8 min-w-[120px] text-center text-xs"><SelectValue placeholder="الفرع" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">{t("common.notSet")}</SelectItem>
                                {branches.map((b) => <SelectItem key={b.id} value={b.name_ar}>{b.name_ar}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={row.group_name || "_none"} onValueChange={(v) => updateParsedRow(i, "group_name", v === "_none" ? "" : v)}>
                              <SelectTrigger className="h-8 min-w-[120px] text-center text-xs"><SelectValue placeholder="المجموعة" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">{t("common.notSet")}</SelectItem>
                                {groups
                                  .filter(g => {
                                    if (!row.branch_name) return true;
                                    const branch = branches.find(b => b.name_ar === row.branch_name);
                                    return !branch || g.branch_id === branch.id;
                                  })
                                  .map((g) => <SelectItem key={g.id} value={g.name_ar}>{g.name_ar}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input value={row.guardian_name || ""} onChange={(e) => updateParsedRow(i, "guardian_name", e.target.value)} className="h-8 min-w-[120px] text-center text-xs" />
                          </TableCell>
                          <TableCell>
                            <PhoneInputWithCountry 
                              value={row.guardian_phone || ""}
                              onChange={(val) => updateParsedRow(i, "guardian_phone", val)}
                              className="min-w-[150px] [&>button]:h-8 [&>input]:h-8 [&>button]:px-2 [&>input]:text-xs [&>button]:text-xs"
                            />
                          </TableCell>
                          {customFieldKeys.map(k => (
                            <TableCell key={k}>
                              <Input 
                                value={((row.custom_fields as any)?.[k]) || ""} 
                                onChange={(e) => {
                                  const newCustom = { ...(row.custom_fields as any || {}), [k]: e.target.value };
                                  updateParsedRow(i, "custom_fields", newCustom);
                                }} 
                                className="h-8 min-w-[120px] text-center text-xs border-primary/30 bg-primary/5 placeholder:text-primary/40" 
                                placeholder="إضافي..."
                              />
                            </TableCell>
                          ))}
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleRemoveParsedRow(i)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={100} className="p-0 border-t">
                          <Button 
                            variant="ghost" 
                            className="w-full h-10 rounded-none text-muted-foreground hover:bg-muted/30 hover:text-primary transition-colors flex items-center justify-start p-0"
                            onClick={() => {
                              setParsedRows(prev => [...(prev || []), { 
                                full_name: "", 
                                national_id: "", 
                                phone: "",
                                email: "",
                                gender: "",
                                date_of_birth: "",
                                project_name: "",
                                branch_name: "",
                                group_name: "",
                                guardian_name: "",
                                guardian_phone: ""
                              }]);
                            }}
                          >
                            <div className="flex justify-center items-center w-10 shrink-0">
                              <Plus className="w-5 h-5" />
                            </div>
                            <span className="font-normal text-sm pt-0.5">إضافة صف جديد</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importResult && (
              <div className="rounded-md border p-3 text-sm space-y-2 max-h-60 overflow-auto">
                <div className="font-medium">{t("participants.import.summary", { ...importResult.summary })}</div>
                {importResult.results.filter((r) => r.status === "failed" || r.status === "skipped").slice(0, 20).map((r, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    Row {r.row}: <span className={r.status === "failed" ? "text-destructive" : ""}>{r.status}</span> — {r.error}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setImportOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={runImport} disabled={importing || !parsedRows || parsedRows.length === 0}>
              <Upload className="h-4 w-4 me-2" />{importing ? t("common.loading") : t("participants.import.run")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Registration Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              رفض طلب التسجيل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>سبب الرفض</Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1"
                placeholder="مثال: عدم مطابقة الشروط المطلوبة للمشروع..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleRejectRegistration} disabled={submittingRegAction}>
              {submittingRegAction ? "جاري الرفض..." : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Participants;

