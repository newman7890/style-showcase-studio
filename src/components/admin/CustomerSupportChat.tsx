import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageCircle, Send, UserCheck, Bot, User, CheckCircle2, Clock, AlertCircle, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface ChatSession {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string | null;
  status: "ai_active" | "escalated" | "closed";
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: "user" | "assistant" | "admin";
  sender_name: string | null;
  message: string;
  created_at: string;
}

export const CustomerSupportChat = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyInput, setReplyInput] = useState("");
  const [filter, setFilter] = useState<"escalated" | "ai_active" | "all">("escalated");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // 1. Fetch Sessions
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("chat_sessions")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);

      if (data && data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].id);
      }
    } catch (err: any) {
      console.error("Error fetching chat sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Messages for selected session
  const fetchMessages = async (sid: string) => {
    try {
      const { data, error } = await (supabase.from as any)("chat_messages")
        .select("*")
        .eq("session_id", sid)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err: any) {
      console.error("Error fetching chat messages:", err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchMessages(selectedSessionId);
    }
  }, [selectedSessionId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Subscribe to Realtime Chat Messages & Sessions
  useEffect(() => {
    const sessionChannel = supabase
      .channel("admin_chat_sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_sessions" },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;

    const messageChannel = supabase
      .channel(`admin_chat_messages_${selectedSessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `session_id=eq.${selectedSessionId}` },
        (payload: any) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [selectedSessionId]);

  const handleSendAdminReply = async () => {
    if (!selectedSessionId || !replyInput.trim() || sending) return;

    const msg = replyInput.trim();
    setReplyInput("");
    setSending(true);

    try {
      const adminName = user?.user_metadata?.full_name || "Admin Support";

      const { error } = await (supabase.from as any)("chat_messages").insert({
        session_id: selectedSessionId,
        sender_type: "admin",
        sender_name: adminName,
        message: msg,
      });

      if (error) throw error;

      // Update session status to escalated if not already
      await (supabase.from as any)("chat_sessions")
        .update({ status: "escalated", updated_at: new Date().toISOString() })
        .eq("id", selectedSessionId);

      toast.success("Reply sent to customer!");
      fetchMessages(selectedSessionId);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleCloseSession = async (sid: string) => {
    try {
      const { error } = await (supabase.from as any)("chat_sessions")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", sid);

      if (error) throw error;
      toast.success("Chat session marked as resolved!");
      fetchSessions();
    } catch (err: any) {
      toast.error(err.message || "Failed to close session");
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (filter === "escalated") return s.status === "escalated";
    if (filter === "ai_active") return s.status === "ai_active";
    return true;
  });

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const escalatedCount = sessions.filter((s) => s.status === "escalated").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Live Customer Support Chat
          </h2>
          <p className="text-muted-foreground text-sm">
            AI Assistant resolves customer inquiries 24/7. Take over escalated sessions to chat with customers in real time.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSessions} disabled={loading} className="w-fit">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh Chats
        </Button>
      </div>

      {/* Filter Tabs */}
      <Tabs defaultValue="escalated" onValueChange={(v: any) => setFilter(v)}>
        <TabsList>
          <TabsTrigger value="escalated" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>Escalated Live Chats</span>
            {escalatedCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {escalatedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ai_active" className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-500" />
            <span>AI Active Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <span>All Conversations</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Main Grid: Sessions List + Chat Transcript */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
        {/* Sessions List Column */}
        <Card className="border-border/50 flex flex-col overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">Active Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto space-y-2">
            {filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                No chat conversations found.
              </div>
            ) : (
              filteredSessions.map((s) => {
                const isSelected = s.id === selectedSessionId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-xs space-y-1 ${
                      isSelected
                        ? "bg-accent border-primary/40 shadow-sm"
                        : "border-border/40 hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm truncate">{s.customer_name}</span>
                      {s.status === "escalated" ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                          Escalated 💬
                        </Badge>
                      ) : s.status === "closed" ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                          Closed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 text-blue-500">
                          AI Active
                        </Badge>
                      )}
                    </div>
                    {s.customer_email && (
                      <p className="text-muted-foreground text-[11px] truncate">{s.customer_email}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(s.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Chat Transcript & Real-Time Input */}
        <Card className="md:col-span-2 border-border/50 flex flex-col overflow-hidden">
          {selectedSession ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-card/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {selectedSession.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{selectedSession.customer_name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedSession.customer_email || "Guest User"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSession.status !== "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCloseSession(selectedSession.id)}
                      className="text-xs h-8 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages Body */}
              <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-card/20">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    Loading conversation transcript...
                  </div>
                ) : (
                  messages.map((m) => {
                    const isUser = m.sender_type === "user";
                    const isAdmin = m.sender_type === "admin";

                    return (
                      <div
                        key={m.id}
                        className={`flex items-start gap-2.5 ${isUser ? "flex-row" : "flex-row-reverse"}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                            isUser
                              ? "bg-primary text-primary-foreground"
                              : isAdmin
                              ? "bg-emerald-600 text-white"
                              : "bg-blue-600 text-white"
                          }`}
                        >
                          {isUser ? <User className="w-4 h-4" /> : isAdmin ? <UserCheck className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div
                          className={`max-w-[75%] p-3 rounded-2xl text-xs space-y-1 ${
                            isUser
                              ? "bg-secondary text-foreground rounded-tl-none"
                              : isAdmin
                              ? "bg-emerald-600 text-white rounded-tr-none"
                              : "bg-blue-500/10 border border-blue-500/30 text-foreground rounded-tr-none"
                          }`}
                        >
                          <div className="flex justify-between items-center gap-2 mb-1">
                            <span className="font-bold text-[10px] opacity-80">
                              {isUser ? selectedSession.customer_name : isAdmin ? m.sender_name || "Admin Support" : "AI Assistant"}
                            </span>
                            <span className="text-[9px] opacity-60">
                              {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Input Box */}
              <div className="p-3 border-t border-border/50 bg-background flex items-center gap-2">
                <Input
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAdminReply();
                    }
                  }}
                  placeholder={`Reply live to ${selectedSession.customer_name}...`}
                  className="flex-1 text-xs h-9"
                  disabled={sending}
                />
                <Button
                  size="sm"
                  onClick={handleSendAdminReply}
                  disabled={!replyInput.trim() || sending}
                  className="h-9 px-4"
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  Send
                </Button>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
              <MessageCircle className="w-12 h-12 mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium">No conversation selected</p>
              <p className="text-xs">Select a customer chat session from the list on the left to view the transcript and reply live.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
