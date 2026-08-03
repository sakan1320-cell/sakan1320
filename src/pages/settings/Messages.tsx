import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageSquare, Search, Users, PlusCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Thread {
  id: string;
  subject: string | null;
  thread_type: "direct" | "project" | "broadcast";
  created_at: string;
  updated_at: string;
  last_message?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_name?: string;
}

const Messages = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === "ar";

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadThreads();
  }, [user]);

  useEffect(() => {
    if (activeThread) {
      loadMessages(activeThread.id);
      
      // Mark as read
      if (user) {
        supabase.from("message_thread_members")
          .update({ last_read_at: new Date().toISOString() } as any)
          .eq("thread_id", activeThread.id)
          .eq("user_id", user.id)
          .then(() => {
            setThreads(prev => prev.map(t => t.id === activeThread.id ? { ...t, unread_count: 0 } : t));
          });
      }

      // Realtime subscription
      const sub = supabase.channel(`messages:${activeThread.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${activeThread.id}` }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(sub);
      };
    }
  }, [activeThread, user]);

  const loadThreads = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get threads user is member of
      const { data, error } = await supabase
        .from("message_thread_members")
        .select(`
          thread_id,
          last_read_at,
          message_threads (
            id, subject, thread_type, updated_at, created_at,
            messages ( id, body, created_at )
          )
        `)
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false });

      if (error) throw error;

      const formatted: Thread[] = (data || []).map((m: any) => {
        const tObj = m.message_threads;
        // Sort messages by date to get the latest
        const sortedMsgs = (tObj.messages || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const lastMsg = sortedMsgs[0];
        
        return {
          id: tObj.id,
          subject: tObj.subject || (tObj.thread_type === "direct" ? "رسالة مباشرة" : "محادثة"),
          thread_type: tObj.thread_type,
          updated_at: tObj.updated_at,
          created_at: tObj.created_at,
          last_message: lastMsg?.body,
        };
      }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      setThreads(formatted);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`*, profiles:sender_id(full_name, display_name_ar)`)
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []).map((m: any) => ({
        ...m,
        sender_name: m.profiles?.display_name_ar || m.profiles?.full_name || "Unknown",
      })));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeThread || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        thread_id: activeThread.id,
        sender_id: user.id,
        body: newMessage.trim(),
      } as any);
      
      if (error) throw error;
      
      // Update thread timestamp
      await supabase.from("message_threads")
        .update({ updated_at: new Date().toISOString() } as any)
        .eq("id", activeThread.id);

      setNewMessage("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter(t => 
    !search || t.subject?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Sidebar */}
      <div className={cn("w-full flex-col border-e sm:w-80", activeThread ? "hidden sm:flex" : "flex")}>
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">{t("messages.title", "الرسائل")}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder={t("common.search", "بحث...")} 
              className="ps-9 bg-muted/50" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-muted-foreground p-4 text-center">
              <MessageSquare className="mb-2 h-8 w-8 opacity-20" />
              <p className="text-sm">{t("messages.empty", "لا توجد رسائل")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-2">
              {filteredThreads.map(thread => (
                <button
                  key={thread.id}
                  onClick={() => setActiveThread(thread)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg p-3 text-start transition-colors hover:bg-accent",
                    activeThread?.id === thread.id && "bg-accent"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium truncate">{thread.subject}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true, locale: isRtl ? ar : undefined })}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground line-clamp-1 w-full">
                    {thread.last_message || t("messages.noMessages", "لا توجد رسائل بعد")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className={cn("flex-1 flex-col bg-background/50", !activeThread ? "hidden sm:flex" : "flex")}>
        {activeThread ? (
          <>
            {/* Header */}
            <div className="flex h-14 items-center gap-3 border-b bg-card px-4 shadow-sm">
              <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setActiveThread(null)}>
                <span className="text-xl leading-none">&lsaquo;</span>
              </Button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                {activeThread.thread_type === "direct" ? <MessageSquare className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
              </div>
              <div>
                <h3 className="font-semibold leading-tight">{activeThread.subject}</h3>
                <p className="text-xs text-muted-foreground">
                  {activeThread.thread_type === "project" ? t("messages.projectThread", "محادثة مشروع") : t("messages.directMessage", "رسالة مباشرة")}
                </p>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="flex flex-col gap-4">
                {messages.map((msg, idx) => {
                  const isMe = msg.sender_id === user?.id;
                  const showHeader = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id;
                  return (
                    <div key={msg.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                      <div className={cn("flex max-w-[75%] flex-col gap-1", isMe ? "items-end" : "items-start")}>
                        {showHeader && !isMe && (
                          <span className="text-xs font-medium text-muted-foreground px-1">{msg.sender_name}</span>
                        )}
                        <div className={cn(
                          "rounded-2xl px-4 py-2 text-sm",
                          isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"
                        )}>
                          {msg.body}
                        </div>
                        <span className="text-[10px] text-muted-foreground px-1">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: isRtl ? ar : undefined })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t bg-card p-4">
              <form 
                onSubmit={e => { e.preventDefault(); sendMessage(); }}
                className="flex items-end gap-2"
              >
                <Textarea 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={t("messages.placeholder", "اكتب رسالتك...")}
                  className="min-h-[60px] resize-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim() || sending} className="h-[60px] shrink-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <MessageSquare className="h-8 w-8" />
            </div>
            <p className="text-lg font-medium text-foreground">{t("messages.welcome", "رسائلك")}</p>
            <p className="text-sm">{t("messages.selectToStart", "اختر محادثة للبدء أو قم بإنشاء رسالة جديدة")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Simple textarea wrapper for messages
const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={cn(
      "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      props.className
    )}
  />
);

export default Messages;
