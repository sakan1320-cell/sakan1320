import { useEffect, useState, useCallback, useRef } from "react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { UnifiedNotificationCenter } from "../UnifiedNotificationCenter";

interface NotifItem {
  id: string;
  body: string;
  category: string | null;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

// Removed useUnreadCounts and CountBadge as they are moved to UnifiedNotificationCenter

export const HeaderActions = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const isRtl = i18n.language === "ar";

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, body, category, is_read, action_url, created_at")
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifications((data as NotifItem[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (notifOpen) loadNotifications();
  }, [notifOpen, loadNotifications]);

  const markRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .eq("target_user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="flex items-center gap-1">
      {/* Unified Notifications, Messages, and Tickets */}
      <UnifiedNotificationCenter />
    </div>
  );
};
