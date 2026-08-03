import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { UserPlus, Search } from "lucide-react";

interface GroupParticipantsDialogProps {
  projectId: string;
  group: { id: string; name_ar: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface Participant {
  id: string;
  full_name: string;
  group_id: string | null;
}

export function GroupParticipantsDialog({ projectId, group, open, onOpenChange, onSaved }: GroupParticipantsDialogProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // We maintain a local set of selected participant IDs for this group
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && group) {
      loadParticipants();
    } else {
      setSearch("");
      setParticipants([]);
    }
  }, [open, group]);

  const loadParticipants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("id, full_name, group_id")
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("full_name");

      if (error) throw error;
      setParticipants(data || []);
      
      const currentIds = new Set((data || []).filter(p => p.group_id === group?.id).map(p => p.id));
      setSelectedIds(currentIds);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleSave = async () => {
    if (!group) return;
    setSaving(true);
    try {
      // Find who was added and who was removed
      const originalIds = new Set(participants.filter(p => p.group_id === group.id).map(p => p.id));
      const addedIds = Array.from(selectedIds).filter(id => !originalIds.has(id));
      const removedIds = Array.from(originalIds).filter(id => !selectedIds.has(id));

      if (addedIds.length > 0) {
        const { error } = await supabase
          .from("participants")
          .update({ group_id: group.id })
          .in("id", addedIds);
        if (error) throw error;
      }

      if (removedIds.length > 0) {
        const { error } = await supabase
          .from("participants")
          .update({ group_id: null })
          .in("id", removedIds);
        if (error) throw error;
      }

      if (addedIds.length > 0 || removedIds.length > 0) {
        toast.success(isRtl ? "تم تحديث أعضاء المجموعة بنجاح" : "Group members updated successfully");
        onSaved();
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = participants.filter(p => 
    !search || p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {isRtl ? `إدارة مشاركي: ${group?.name_ar}` : `Manage Participants: ${group?.name_ar}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          <div className="relative">
            <Search className={`absolute ${isRtl ? 'right-2' : 'left-2'} top-2.5 h-4 w-4 text-muted-foreground`} />
            <Input
              placeholder={isRtl ? "بحث عن مشارك..." : "Search participant..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={isRtl ? "pr-8" : "pl-8"}
            />
          </div>

          <div className="flex-1 overflow-y-auto border rounded-md p-2 space-y-1">
            {loading ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                {isRtl ? "جاري التحميل..." : "Loading..."}
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                {isRtl ? "لا يوجد مشاركين" : "No participants found"}
              </p>
            ) : (
              filtered.map(p => (
                <Label
                  key={p.id}
                  className={`flex items-center gap-3 p-2 hover:bg-secondary/50 rounded-md cursor-pointer transition-colors ${selectedIds.has(p.id) ? 'bg-primary/5 border-primary/20 border' : 'border border-transparent'}`}
                >
                  <Checkbox 
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={(checked) => toggleParticipant(p.id, checked as boolean)}
                  />
                  <div className="flex-1 flex flex-col">
                    <span className="font-medium text-sm">{p.full_name}</span>
                    {p.group_id && p.group_id !== group?.id && (
                      <span className="text-[10px] text-muted-foreground">
                        {isRtl ? "مرتبط بمجموعة أخرى (سيتم نقله)" : "In another group (will be moved)"}
                      </span>
                    )}
                  </div>
                </Label>
              ))
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            {isRtl ? `تم تحديد ${selectedIds.size} من أصل ${participants.length}` : `Selected ${selectedIds.size} of ${participants.length}`}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

