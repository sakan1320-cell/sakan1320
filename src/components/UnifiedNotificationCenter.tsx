import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck, Trash2, X, MessageSquare, HelpCircle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface InAppNotification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  priority: string;
  read_at: string | null;
  action_url: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
}

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  info: "ℹ️", success: "✅", warning: "⚠️", error: "❌", action: "🔔",
};

const priorityColors: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-warning",
  urgent: "text-destructive font-semibold",
};

export const UnifiedNotificationCenter = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [open, setOpen] = useState(false);
  
  // Data States
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  
  // Counts
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);

  const loadAll = useCallback(async () => {
    if (!user) return;
    
    // Fetch notifications
    const { data: nData } = await supabase
      .from("in_app_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
      
    const items = (nData ?? []) as InAppNotification[];
    setNotifications(items);
    setNotifCount(items.filter((n) => !n.read_at).length);

    // Fetch messages
    const { data: mData } = await supabase
      .from("messages")
      .select("id, body, created_at, sender_id")
      .neq("sender_id", user.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(10);
      
    setMessages((mData ?? []) as MessageRow[]);
    const { count: mc } = await supabase.from("messages").select("id", { count: "exact", head: true }).neq("sender_id", user.id).eq("is_deleted", false);
    setMsgCount(mc ?? 0);

    // Fetch tickets
    const { data: tData } = await supabase
      .from("support_tickets")
      .select("id, subject, status, created_at")
      .eq("requester_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(10);
      
    setTickets((tData ?? []) as TicketRow[]);
    const { count: tc } = await supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("requester_id", user.id).eq("status", "open");
    setTicketCount(tc ?? 0);
    
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [user, loadAll]);

  const markRead = async (id: string) => {
    await supabase.from("in_app_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setNotifCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("in_app_notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setNotifCount(0);
  };

  const deleteNotif = async (id: string) => {
    await supabase.from("in_app_notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `${mins} د`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} س`;
    const days = Math.floor(hours / 24);
    return `${days} ي`;
  };

  const totalUnread = notifCount + msgCount + ticketCount;

  return (
    <div className="relative" dir="rtl">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 hover:bg-sidebar-accent transition-colors"
        onClick={() => setOpen(!open)}
        aria-label="التنبيهات المجمعة"
      >
        <Bell className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm animate-in zoom-in">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-xl border bg-card shadow-xl animate-in fade-in-0 slide-in-from-top-2 duration-200 overflow-hidden">
            <Tabs defaultValue="notifications" className="w-full">
              <div className="flex items-center justify-between border-b px-2 py-2 bg-muted/20">
                <TabsList className="h-9 w-full bg-transparent justify-start space-x-1 space-x-reverse p-0">
                  <TabsTrigger 
                    value="notifications" 
                    className="relative data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 text-xs"
                  >
                    الإشعارات
                    {notifCount > 0 && <span className="ms-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive/10 text-destructive text-[9px]">{notifCount}</span>}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="messages" 
                    className="relative data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 text-xs"
                  >
                    الرسائل
                    {msgCount > 0 && <span className="ms-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px]">{msgCount}</span>}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tickets" 
                    className="relative data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 text-xs"
                  >
                    التذاكر
                    {ticketCount > 0 && <span className="ms-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-warning/10 text-warning text-[9px]">{ticketCount}</span>}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="m-0 border-none outline-none">
                {notifCount > 0 && (
                  <div className="flex items-center justify-end px-4 py-1.5 border-b bg-muted/5">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary" onClick={markAllRead}>
                      <CheckCheck className="h-3 w-3 me-1" /> قراءة الكل
                    </Button>
                  </div>
                )}
                <ScrollArea className="h-[350px]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center text-sm text-muted-foreground">
                      <Bell className="h-8 w-8 opacity-20 mb-2" />
                      <p>لا توجد إشعارات</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer relative group",
                            !n.read_at && "bg-primary/5"
                          )}
                          onClick={() => {
                            if (!n.read_at) markRead(n.id);
                            if (n.action_url) window.location.href = n.action_url;
                          }}
                        >
                          <span className="shrink-0 text-lg mt-0.5">{typeIcons[n.type] || "🔔"}</span>
                          <div className="min-w-0 flex-1">
                            <div className={cn("text-sm leading-tight", priorityColors[n.priority] || "")}>
                              {n.title}
                            </div>
                            {n.body && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                              {!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 absolute top-2 end-2"
                            onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Messages Tab */}
              <TabsContent value="messages" className="m-0 border-none outline-none">
                <ScrollArea className="h-[350px] bg-background">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center text-sm text-muted-foreground">
                      <MessageSquare className="h-8 w-8 opacity-20 mb-2" />
                      <p>لا توجد رسائل</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className="flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setOpen(false);
                            navigate("/messages");
                          }}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <MessageSquare className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-1">{m.body}</p>
                            <span className="text-[10px] text-muted-foreground mt-1 block">{timeAgo(m.created_at)}</span>
                          </div>
                        </div>
                      ))}
                      <div className="p-2">
                        <Button variant="ghost" className="w-full text-xs text-primary" onClick={() => { setOpen(false); navigate("/messages"); }}>
                          عرض جميع الرسائل
                        </Button>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Tickets Tab */}
              <TabsContent value="tickets" className="m-0 border-none outline-none">
                <ScrollArea className="h-[350px] bg-background">
                  {tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center text-sm text-muted-foreground">
                      <HelpCircle className="h-8 w-8 opacity-20 mb-2" />
                      <p>لا توجد تذاكر مفتوحة</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {tickets.map((t) => (
                        <div
                          key={t.id}
                          className="flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setOpen(false);
                            navigate("/support");
                          }}
                        >
                          <div className="h-8 w-8 rounded-full bg-warning/10 text-warning flex items-center justify-center shrink-0">
                            <Activity className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-1">{t.subject}</p>
                            <span className="text-[10px] text-muted-foreground mt-1 block">{timeAgo(t.created_at)}</span>
                          </div>
                        </div>
                      ))}
                      <div className="p-2">
                        <Button variant="ghost" className="w-full text-xs text-primary" onClick={() => { setOpen(false); navigate("/support"); }}>
                          إدارة التذاكر
                        </Button>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </div>
  );
};
