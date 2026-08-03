import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FolderKanban, ChevronRight, Upload, Download } from "lucide-react";
import { ProjectFormDialog } from "@/components/ProjectFormDialog";
import { ProjectImportDialog } from "@/components/ProjectImportDialog";
import { logAudit } from "@/lib/audit";

interface Project {
  id: string;
  name_ar: string;
  name_en: string | null;
  status: "planned" | "in_progress" | "completed" | "stalled";
  has_branches: boolean;
  budget: number | null;
  category: string | null;
  manager_id: string | null;
}

const statusVariant: Record<Project["status"], "default" | "secondary" | "destructive" | "outline"> = {
  planned: "outline",
  in_progress: "default",
  completed: "secondary",
  stalled: "destructive",
};

const PROJECT_CATEGORIES = ["education", "training", "volunteer", "social", "health", "other"];

const Projects = () => {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { user } = useAuth();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*, manager_id").order("created_at", { ascending: false });
    const allProjects = (data ?? []) as Project[];

    if (isAdmin || !user) {
      setItems(allProjects);
    } else {
      // Fetch user's project memberships
      const { data: memberships } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id);
      
      const myProjectIds = (memberships || []).map(m => m.project_id);
      
      // Filter out public projects unless the user is explicitly involved
      setItems(allProjects.filter(p => myProjectIds.includes(p.id) || p.manager_id === user.id));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user, isAdmin]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.name_ar.toLowerCase().includes(q) && !(p.name_en?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [items, search, categoryFilter, statusFilter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-background/50 p-4 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent pb-1">
          {t("projects.title")}
        </h1>
        {isAdmin && (
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="rounded-xl font-bold bg-white dark:bg-card">
              <Upload className="h-4 w-4" />{t("projects.import")}
            </Button>
            <Button onClick={() => setOpen(true)} className="rounded-xl font-bold shadow-sm">
              <Plus className="h-4 w-4" />{t("projects.new")}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3 bg-card p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
        <Input className="rounded-2xl h-12 bg-muted/50 border-transparent focus-visible:bg-background transition-colors" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="rounded-2xl h-12 bg-muted/50 border-transparent focus:bg-background transition-colors"><SelectValue placeholder={t("projects.category")} /></SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {PROJECT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{t(`projects.categories.${c}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="rounded-2xl h-12 bg-muted/50 border-transparent focus:bg-background transition-colors"><SelectValue placeholder={t("projects.status")} /></SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {(["planned","in_progress","completed","stalled"] as const).map((s) => (
              <SelectItem key={s} value={s}>{t(`projects.statuses.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center bg-muted/20 rounded-3xl border border-dashed">
          <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">{t("projects.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="group block h-full">
              <div className="h-full bg-gradient-to-br from-card to-muted/20 rounded-3xl p-6 border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-16 bg-primary/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
                <div className="flex items-start justify-between gap-2 mb-4 relative z-10">
                  <div className="bg-white dark:bg-card shadow-sm border border-border/50 h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FolderKanban className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant={statusVariant[p.status]} className="px-3 py-1 text-xs font-bold shadow-sm">{t(`projects.statuses.${p.status}`)}</Badge>
                </div>
                <h3 className="text-lg font-black line-clamp-2 mb-4 relative z-10 text-foreground/90 group-hover:text-primary transition-colors">
                  {i18n.language === "ar" ? p.name_ar : (p.name_en || p.name_ar)}
                </h3>
                <div className="flex-1"></div>
                <div className="flex flex-col gap-3 relative z-10 mt-2 border-t pt-4 border-border/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.category && <Badge variant="secondary" className="bg-muted text-muted-foreground">{t(`projects.categories.${p.category}`, { defaultValue: p.category })}</Badge>}
                    {p.has_branches && <Badge variant="outline" className="bg-background">فروع متعددة</Badge>}
                  </div>
                  {p.budget != null && Number(p.budget) > 0 && (
                    <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl">
                      <span className="text-xs text-emerald-800/70 dark:text-emerald-400 font-bold">{t("projects.budget")}</span>
                      <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{Number(p.budget).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={async (id) => { await logAudit("create", "project", id); load(); }}
      />
      <ProjectImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onDone={load}
      />
    </div>
  );
};

export default Projects;
