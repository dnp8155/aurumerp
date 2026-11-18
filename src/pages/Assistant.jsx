import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Sparkles, Loader2, Bot, User, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageHeader from "@/components/erp/PageHeader";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const SUGGESTED_PROMPTS = [
  "What is my total revenue from all sales?",
  "How many products are low on stock?",
  "Show me all pending online orders",
  "What are my total expenses this month?",
  "Which vendors have the highest rating?",
  "How many goods receipts are pending QC?",
  "What is my net GST payable?",
  "Show me all shipments in transit",
];

export default function Assistant() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (activeConv) {
      const unsubscribe = base44.agents.subscribeToConversation(activeConv.id, (data) => {
        setMessages(data.messages || []);
        setLoading(data.messages?.some(m => m.role === 'assistant' && !m.content && m.tool_calls?.some(tc => tc.status === 'pending' || tc.status === 'running' || tc.status === 'in_progress')) ?? false);
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
        const conv = convs[0];
        setActiveConv(conv);
        setMessages(conv.messages || []);
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
        metadata: { name: `Chat ${new Date().toLocaleString()}`, description: "ERP Assistant conversation" }
      });
      setConversations(prev => [conv, ...prev]);
      setActiveConv(conv);
      setMessages([]);
    } catch (err) {
      console.error("Error creating conversation:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (text) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;

    if (!activeConv) {
      try {
        setCreating(true);
        const conv = await base44.agents.createConversation({
          agent_name: "erp_assistant",
          metadata: { name: `Chat ${new Date().toLocaleString()}`, description: "ERP Assistant conversation" }
        });
        setConversations(prev => [conv, ...prev]);
        setActiveConv(conv);
        await base44.agents.addMessage(conv, { role: "user", content: msg });
        setMessages(prev => [...prev, { role: "user", content: msg }]);
        setLoading(true);
      } catch (err) {
        console.error(err);
      } finally {
        setCreating(false);
      }
    } else {
      try {
        await base44.agents.addMessage(activeConv, { role: "user", content: msg });
        setMessages(prev => [...prev, { role: "user", content: msg }]);
        setLoading(true);
      } catch (err) {
        console.error(err);
      }
    }
    setInput("");
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader title="AI Assistant" description="Ask anything about your business — revenue, inventory, sales, expenses, and more" />

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Conversation list */}
        <div className="hidden md:flex w-56 shrink-0 flex-col rounded-xl border bg-card">
          <div className="p-3 border-b">
            <Button onClick={handleNewChat} disabled={creating} size="sm" className="w-full">
              <Plus className="mr-2 h-4 w-4" /> {creating ? "Creating..." : "New Chat"}
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
              ) : conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setActiveConv(c); setMessages(c.messages || []); }}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    activeConv?.id === c.id ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.metadata?.name || "Conversation"}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col rounded-xl border bg-card min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold">Ask me anything about your ERP</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-6 text-center max-w-md">
                    I can answer questions about revenue, inventory, sales, orders, expenses, vendors, and more
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                    {SUGGESTED_PROMPTS.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(prompt)}
                        className="flex items-start gap-2 rounded-lg border p-3 text-left text-sm hover:border-primary hover:bg-accent/50 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
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
          </ScrollArea>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about revenue, inventory, sales, expenses..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={loading}
                className="flex-1"
              />
              <Button onClick={() => handleSend()} disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
        isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {message.content ? (
          isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )
        ) : message.tool_calls?.length > 0 ? (
          <div className="space-y-1.5">
            {message.tool_calls.map((tc, i) => (
              <ToolCallDisplay key={i} toolCall={tc} />
            ))}
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

  let results = toolCall.results;
  try {
    if (typeof results === "string") results = JSON.parse(results);
  } catch {}

  let args = toolCall.arguments_string;
  try {
    if (typeof args === "string") args = JSON.parse(args);
  } catch {}

  const entityName = args?.entity_name || args?.filter || "";
  const label = toolCall.name === "search_entity" && entityName
    ? `Searching ${entityName}`
    : toolCall.name || "Tool call";

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
      >
        {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : isError ? "⚠" : "✓"}
        <span className={isError ? "text-red-500" : ""}>{label}</span>
      </button>
      {expanded && (
        <div className="mt-1 pl-4 border-l-2 border-muted space-y-1">
          {args && <pre className="text-[10px] text-muted-foreground overflow-x-auto">{JSON.stringify(args, null, 2)}</pre>}
          {results && <pre className="text-[10px] text-muted-foreground overflow-x-auto">{JSON.stringify(results, null, 2)?.slice(0, 500)}</pre>}
        </div>
      )}
    </div>
  );
}