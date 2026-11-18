import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Sparkles, Loader2, Bot, User, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const SUGGESTED_PROMPTS = [
  "What is my total revenue from all sales?",
  "How many products are low on stock?",
  "Show me all pending online orders",
  "What are my total expenses?",
  "Which vendors have the highest rating?",
  "How many goods receipts are pending QC?",
];

export default function AssistantPanel({ open, onOpenChange }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open) loadConversations();
  }, [open]);

  useEffect(() => {
    if (activeConv?.id) {
      const unsubscribe = base44.agents.subscribeToConversation(activeConv.id, (data) => {
        setMessages(data.messages || []);
        const hasPending = data.messages?.some(m =>
          m.role === 'assistant' && !m.content &&
          m.tool_calls?.some(tc => tc.status === 'pending' || tc.status === 'running' || tc.status === 'in_progress')
        );
        setLoading(hasPending ?? false);
      });
      return () => unsubscribe();
    }
  }, [activeConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const convs = await base44.agents.listConversations({ agent_name: "erp_assistant" });
      setConversations(convs || []);
      if (convs?.length > 0 && !activeConv) {
        setActiveConv(convs[0]);
        setMessages(convs[0].messages || []);
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
    }
  };

  const handleNewChat = async () => {
    try {
      setCreating(true);
      const conv = await base44.agents.createConversation({
        agent_name: "erp_assistant",
        metadata: { name: `Chat ${new Date().toLocaleString()}`, description: "ERP Assistant" }
      });
      setConversations(prev => [conv, ...prev]);
      setActiveConv(conv);
      setMessages([]);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (text) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;

    let conv = activeConv;
    if (!conv) {
      try {
        setCreating(true);
        conv = await base44.agents.createConversation({
          agent_name: "erp_assistant",
          metadata: { name: `Chat ${new Date().toLocaleString()}`, description: "ERP Assistant" }
        });
        setConversations(prev => [conv, ...prev]);
        setActiveConv(conv);
      } catch (err) {
        console.error(err);
        return;
      } finally {
        setCreating(false);
      }
    }

    try {
      await base44.agents.addMessage(conv, { role: "user", content: msg });
      setMessages(prev => [...prev, { role: "user", content: msg }]);
      setLoading(true);
    } catch (err) {
      console.error(err);
    }
    setInput("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base">AI Assistant</SheetTitle>
              <SheetDescription className="text-xs">Ask about your business data</SheetDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleNewChat} disabled={creating}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New
          </Button>
        </SheetHeader>

        {/* Conversation tabs */}
        {conversations.length > 1 && (
          <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto">
            {conversations.slice(0, 6).map(c => (
              <button
                key={c.id}
                onClick={() => { setActiveConv(c); setMessages(c.messages || []); }}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs whitespace-nowrap transition-colors",
                  activeConv?.id === c.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <MessageSquare className="h-3 w-3" /> Chat
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">Ask me anything</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4 text-center">
                Revenue, inventory, sales, expenses & more
              </p>
              <div className="space-y-2 w-full">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    className="flex items-start gap-2 rounded-lg border p-2.5 text-left text-xs hover:border-primary hover:bg-accent/50 transition-colors w-full"
                  >
                    <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => <MessageBubble key={i} message={msg} />)
          )}
          {loading && messages.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-4 w-4" />
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about revenue, inventory, sales..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={() => handleSend()} disabled={loading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full shrink-0",
        isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
      )}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {message.content ? (
          isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )
        ) : message.tool_calls?.length > 0 ? (
          <div className="space-y-1">
            {message.tool_calls.map((tc, i) => <ToolCallDisplay key={i} toolCall={tc} />)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status;
  const isRunning = status === "pending" || status === "running" || status === "in_progress";
  const isError = status === "failed" || status === "error";

  let args = toolCall.arguments_string;
  try { if (typeof args === "string") args = JSON.parse(args); } catch {}

  const entityName = args?.entity_name || args?.filter || "";
  const label = entityName ? `Searching ${entityName}` : toolCall.name || "Tool call";

  return (
    <div className="text-xs">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
        {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : isError ? "⚠" : "✓"}
        <span className={isError ? "text-red-500" : ""}>{label}</span>
      </button>
      {expanded && args && (
        <pre className="mt-1 pl-3 border-l-2 border-muted text-[10px] text-muted-foreground overflow-x-auto">{JSON.stringify(args, null, 2)}</pre>
      )}
    </div>
  );
}