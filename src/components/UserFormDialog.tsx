import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PhoneInputWithCountry } from "@/components/PhoneInputWithCountry";

const ALL_ROLES: AppRole[] = [
  "board", "executive", "assistant", "project_manager",
  "branch_manager", "employee", "contractor", "participant", "guardian",
];

export interface UserFormInitial {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: UserFormInitial | null; // if provided -> edit mode
  onSaved: () => void;
}

export const UserFormDialog = ({ open, onOpenChange, initial, onSaved }: Props) => {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("employee");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(initial?.full_name ?? "");
      setEmail(initial?.email ?? "");
      setPhone(initial?.phone ?? "");
      setPassword("");
      setRole("employee");
    }
  }, [open, initial]);

  const submit = async () => {
    setLoading(true);
    try {
      if (isEdit) {
        const { error } = await supabase.functions.invoke("admin-create-user", {
          body: {
            action: "update_profile",
            user_id: initial!.id,
            full_name: fullName,
            phone,
            email,
          },
        });
        if (error) throw error;
        if (password) {
          const { error: pErr } = await supabase.functions.invoke("admin-create-user", {
            body: { action: "change_password", user_id: initial!.id, password },
          });
          if (pErr) throw pErr;
          toast.success(t("users.passwordChanged"));
        }
        toast.success(t("users.userUpdated"));
      } else {
        if (!email || !password) { toast.error(t("auth.errors.generic")); return; }
        if (password.length < 6) { toast.error(t("auth.errors.weak_password")); return; }
        const { error } = await supabase.functions.invoke("admin-create-user", {
          body: {
            action: "create",
            email, password, full_name: fullName, phone, role,
          },
        });
        if (error) throw error;
        toast.success(t("users.userCreated"));
      }
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("users.editUser") : t("users.createUser")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t("auth.fullName")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.phone")}</Label>
            <PhoneInputWithCountry value={phone} onChange={setPhone} />
          </div>
          <div className="space-y-2">
            <Label>{isEdit ? t("users.changePassword") : t("common.password")}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? t("users.leaveBlankPassword") : ""} />
            <p className="text-xs text-muted-foreground">{t("auth.passwordRules")}</p>
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label>{t("users.initialRole")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
