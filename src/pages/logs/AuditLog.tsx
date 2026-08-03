import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollText, AlertTriangle } from "lucide-react";
import SystemErrors from "./SystemErrors";

interface AuditRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  metadata: unknown;
}

const AuditLog = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      setRows((data ?? []) as AuditRow[]);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p) => { map[p.id] = p.full_name || p.email || p.id; });
      setUsers(map);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="audit" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/60 rounded-xl mb-4">
          <TabsTrigger value="audit" className="rounded-lg py-2.5 gap-1.5"><ScrollText className="h-4 w-4" />سجل العمليات</TabsTrigger>
          <TabsTrigger value="errors" className="rounded-lg py-2.5 gap-1.5"><AlertTriangle className="h-4 w-4" />سجل الأخطاء</TabsTrigger>
        </TabsList>
        
        <TabsContent value="audit">
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">{t("audit.empty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("audit.when")}</TableHead>
                      <TableHead>{t("audit.user")}</TableHead>
                      <TableHead>{t("audit.action")}</TableHead>
                      <TableHead>{t("audit.entity")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                        <TableCell>{r.user_id ? users[r.user_id] ?? r.user_id.slice(0, 8) : "—"}</TableCell>
                        <TableCell><span className="font-mono text-xs">{r.action}</span></TableCell>
                        <TableCell>{r.entity_type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <SystemErrors />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AuditLog;
