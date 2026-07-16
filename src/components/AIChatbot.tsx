import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Bot, User, Package, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (overrideMessage?: string) => {
    const messageToSend = (overrideMessage ?? input).trim();
    if (!messageToSend || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [...messages, { role: "user", content: messageToSend }],
        },
      });

      if (response.error) throw response.error;

      const assistantMessage = response.data?.message || "I apologize, I couldn't process that request.";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
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
      {/* Chat Button */}
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
                         inset-4 md:inset-auto md:bottom-24 md:right-4 md:w-96 md:h-[500px] md:max-h-[calc(100vh-120px)]"
            >
              {/* Header - Sticky */}
              <div className="sticky top-0 bg-primary text-primary-foreground p-4 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">AI Assistant</h3>
                    <p className="text-xs text-primary-foreground/70">Here to help you</p>
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

              {/* Messages - Scrollable area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 scroll-smooth
                           [&::-webkit-scrollbar]:w-2 
                           [&::-webkit-scrollbar-track]:bg-muted 
                           [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 
                           [&::-webkit-scrollbar-thumb]:rounded-full 
                           hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"
              >
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Hi! I'm your AI assistant. How can I help you today?
                    </p>
                    <div className="space-y-2">
                      {quickActions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            handleSend(action.message);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors w-full"
                        >
                          <action.icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`flex items-start gap-2 max-w-[80%] ${
                            message.role === "user" ? "flex-row-reverse" : ""
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary"
                            }`}
                          >
                            {message.role === "user" ? (
                              <User className="w-4 h-4" />
                            ) : (
                              <Bot className="w-4 h-4" />
                            )}
                          </div>
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-secondary px-4 py-2 rounded-2xl">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Input - Sticky footer */}
              <div className="sticky bottom-0 p-4 border-t border-border bg-background shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t("aiChatPlaceholder")}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
