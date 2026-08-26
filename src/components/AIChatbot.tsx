import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Bot, User, Package, HelpCircle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

interface Message {
  role: "user" | "assistant" | "admin";
  content: string;
  senderName?: string;
}

export const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isEscalated, setIsEscalated] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true);
    window.addEventListener("open-ai-chat", handleOpenChat);
    return () => window.removeEventListener("open-ai-chat", handleOpenChat);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Subscribe to Realtime messages when a session is active
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`chat_messages_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const newMsg = payload.new;
          if (newMsg.sender_type === "admin") {
            setMessages((prev) => [
              ...prev,
              { role: "admin", content: newMsg.message, senderName: newMsg.sender_name || "Support Agent" },
            ]);
            setIsEscalated(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;

    try {
      const { data, error } = await (supabase.from as any)("chat_sessions")
        .insert({
          user_id: user?.id || null,
          customer_name: user?.user_metadata?.full_name || user?.email || "Guest Customer",
          customer_email: user?.email || null,
          status: "ai_active",
        })
        .select()
        .single();

      if (!error && data) {
        setSessionId(data.id);
        return data.id;
      }
    } catch (e) {
      console.error("Session creation error:", e);
    }
    const tempId = `temp-${Date.now()}`;
    setSessionId(tempId);
    return tempId;
  };

  const handleSend = async (overrideMessage?: string) => {
    const messageToSend = (overrideMessage ?? input).trim();
    if (!messageToSend || isLoading) return;

    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: messageToSend }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const currentSessionId = await ensureSession();

      // Log user message in DB
      if (currentSessionId && !currentSessionId.startsWith("temp-")) {
        await (supabase.from as any)("chat_messages").insert({
          session_id: currentSessionId,
          sender_type: "user",
          message: messageToSend,
        });
      }

      // If escalated to live human admin, wait for admin response
      if (isEscalated) {
        setIsLoading(false);
        return;
      }

      // Call AI Edge Function
      const response = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: newMessages.map((m) => ({
            role: m.role === "admin" ? "assistant" : m.role,
            content: m.content,
          })),
        },
      });

      if (response.error) throw response.error;

      const assistantMessage = response.data?.message || "I apologize, I couldn't process that request.";
      const shouldEscalate = response.data?.escalate === true;

      setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);

      if (currentSessionId && !currentSessionId.startsWith("temp-")) {
        await (supabase.from as any)("chat_messages").insert({
          session_id: currentSessionId,
          sender_type: "assistant",
          message: assistantMessage,
        });

        if (shouldEscalate) {
          setIsEscalated(true);
          await (supabase.from as any)("chat_sessions")
            .update({ status: "escalated", updated_at: new Date().toISOString() })
            .eq("id", currentSessionId);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm sorry, I encountered an error. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { icon: Package, label: "Track my order", message: "I want to track my order" },
    { icon: HelpCircle, label: "Product help", message: "I need help finding a product" },
  ];

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: isOpen ? 0 : 1 }}
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              className="fixed z-50 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden
                         inset-4 md:inset-auto md:bottom-24 md:right-4 md:w-96 md:h-[520px] md:max-h-[calc(100vh-120px)]"
            >
              {/* Header */}
              <div className="sticky top-0 bg-primary text-primary-foreground p-4 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    {isEscalated ? <UserCheck className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">
                      {isEscalated ? "Live Customer Support" : "AI Support Assistant"}
                    </h3>
                    <p className="text-xs text-primary-foreground/70">
                      {isEscalated ? "Connected to Support Specialist 💬" : "24/7 Instant Answers"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-primary-foreground hover:bg-primary-foreground/20 h-10 w-10"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              {/* Messages Area */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
              >
                {messages.length === 0 ? (
                  <div className="text-center py-6">
                    <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium mb-1">Welcome to Live Support!</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      I'm your 24/7 AI assistant. Ask me anything about products, orders, or store policies.
                    </p>
                    <div className="space-y-2">
                      {quickActions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => handleSend(action.message)}
                          className="w-full p-2.5 rounded-lg border border-border hover:bg-accent text-left text-xs flex items-center gap-2 transition-colors"
                        >
                          <action.icon className="w-4 h-4 text-primary shrink-0" />
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2.5 ${
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : message.role === "admin"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {message.role === "user" ? (
                          <User className="w-4 h-4" />
                        ) : message.role === "admin" ? (
                          <UserCheck className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-xs space-y-1 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : message.role === "admin"
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-foreground rounded-tl-none"
                            : "bg-muted text-foreground rounded-tl-none"
                        }`}
                      >
                        {message.role === "admin" && (
                          <p className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400">
                            {message.senderName || "Support Specialist"}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Processing response...</span>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-3 border-t border-border bg-background flex items-center gap-2 shrink-0">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={isEscalated ? "Type your message to Support..." : "Type your question..."}
                  className="flex-1 text-xs h-9"
                  disabled={isLoading}
                />
                <Button
                  size="icon"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="h-9 w-9 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
