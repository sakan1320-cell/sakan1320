import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface TimelineEvent {
  id: string;
  event_type: string;
  event_data: any;
  created_at: string;
  profiles?: { full_name: string | null, email: string | null } | null;
}

export const SystemTimeline = ({ entityType, entityId }: { entityType: string, entityId: string }) => {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("system_events")
      .select(`
        id, event_type, event_data, created_at, actor_id
      `)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      const userIds = Array.from(new Set(data.map(e => e.actor_id).filter(Boolean)));
      let profiles: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profData } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds as string[]);
        (profData || []).forEach(p => { profiles[p.id] = p; });
      }

      const enhanced = data.map(e => ({
        ...e,
        profiles: e.actor_id ? profiles[e.actor_id] : null
      }));
      setEvents(enhanced as TimelineEvent[]);
    }
  };

  useEffect(() => {
    if (entityId) load();
  }, [entityId, entityType]);

  const getEventDescription = (event: TimelineEvent) => {
    const actor = event.profiles?.full_name || event.profiles?.email || t("common.system", "النظام");
    switch (event.event_type) {
      case 'created': return t("events.created", { actor, defaultValue: `${actor} قام بإنشاء السجل` });
      case 'updated': return t("events.updated", { actor, defaultValue: `${actor} قام بتحديث السجل` });
      case 'deleted': return t("events.deleted", { actor, defaultValue: `${actor} قام بحذف السجل` });
      case 'status_change': return t("events.status_change", { actor, status: event.event_data?.status, defaultValue: `${actor} قام بتغيير الحالة إلى ${event.event_data?.status || ''}` });
      case 'notification_sent': return t("events.notification", { channel: event.event_data?.channel, defaultValue: `تم إرسال رسالة عبر ${event.event_data?.channel || ''}` });
      default: return event.event_type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {t("events.timeline", "الخط الزمني")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">{t("events.empty", "لا توجد نشاطات مسجلة")}</p>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 rtl:before:right-2 ltr:before:left-2 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent">
            {events.map((e) => (
              <div key={e.id} className="relative flex items-start gap-4">
                <div className="flex items-center justify-center w-5 h-5 rounded-full border border-primary bg-background shrink-0 mt-1 shadow z-10" />
                <div className="flex-1 bg-muted/30 p-3 rounded border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground font-medium" dir="ltr">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: i18n.language === 'ar' ? ar : enUS })}
                    </span>
                  </div>
                  <p className="text-sm">{getEventDescription(e)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
