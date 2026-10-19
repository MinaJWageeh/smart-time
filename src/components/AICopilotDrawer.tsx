import React, { useState, useRef, useEffect } from "react";
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  CheckSquare, 
  Lightbulb, 
  Database,
  FileText
} from "lucide-react";
import { ChatMessage, Page, ProviderStatus } from "../types";

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePage: Page | null;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isGenerating: boolean;
  providerStatus: ProviderStatus | null;
  currentModel: string;
  darkMode?: boolean;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  activePage,
  messages,
  onSendMessage,
  isGenerating,
  providerStatus,
  currentModel,
  darkMode = false,
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    const text = inputText;
    setInputText("");
    await onSendMessage(text);
  };

  const handleQuickAction = (action: "summarize" | "tasks" | "explain") => {
    if (!activePage) return;
    let prompt = "";
    if (action === "summarize") {
      prompt = `Summarize this note ("${activePage.title}") in 3 concise bullet points with key takeaways.`;
    } else if (action === "tasks") {
      prompt = `Extract a practical actionable checklist of tasks from this note ("${activePage.title}") with estimated time intervals.`;
    } else {
      prompt = `Explain the core concepts and ideas described in this note ("${activePage.title}") simply and clearly.`;
    }
    onSendMessage(prompt);
  };

  return (
    <aside className={`w-96 flex flex-col h-full border-l shrink-0 transition-all select-none ${
      darkMode ? "bg-[#1c1c1c] border-[#2e2e2e] text-[#ebebeb]" : "bg-[#fafaf9] border-[#e9e8e4] text-[#37352f]"
    }`}>
      {/* Header */}
      <div className={`p-3 border-b flex items-center justify-between shrink-0 ${
        darkMode ? "border-[#2e2e2e] bg-[#222222]" : "border-[#e9e8e4] bg-white"
      }`}>
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-[#5645d4] flex items-center justify-center text-white">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-semibold text-xs flex items-center space-x-1.5">
              <span>AI Copilot Sidecar</span>
              {providerStatus && (
                <span className={`w-1.5 h-1.5 rounded-full ${providerStatus.online ? "bg-emerald-500" : "bg-rose-500"}`} title={providerStatus.message} />
              )}
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#e6e0f5] dark:bg-[#2d2645] text-[#5645d4] dark:text-[#7b66ff] font-medium">
                {currentModel || "Ollama"}
              </span>
            </div>
            {activePage && (
              <div className="text-[10px] text-[#787671] dark:text-[#9c9a95] flex items-center space-x-1 truncate max-w-[190px]">
                <FileText className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">Reading: {activePage.title}</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className={`p-1 rounded-md transition-colors ${
            darkMode ? "hover:bg-[#333333] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#787671]"
          }`}
          title="Close Copilot Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick context action chips for current page */}
      {activePage && (
        <div className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto text-[11px] ${
          darkMode ? "border-[#2e2e2e] bg-[#1a1a1a]" : "border-[#e9e8e4] bg-[#f7f6f3]"
        }`}>
          <button
            onClick={() => handleQuickAction("summarize")}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#e6e0f5] dark:bg-[#2d2645] text-[#5645d4] dark:text-[#7b66ff] font-medium hover:opacity-85 shrink-0 transition-opacity"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>Summarize</span>
          </button>
          <button
            onClick={() => handleQuickAction("tasks")}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#d9f3e1] dark:bg-[#173822] text-emerald-700 dark:text-emerald-400 font-medium hover:opacity-85 shrink-0 transition-opacity"
          >
            <CheckSquare className="w-2.5 h-2.5" />
            <span>Tasks</span>
          </button>
          <button
            onClick={() => handleQuickAction("explain")}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#ffe8d4] dark:bg-[#3b281d] text-[#dd5b00] dark:text-[#ff9248] font-medium hover:opacity-85 shrink-0 transition-opacity"
          >
            <Lightbulb className="w-2.5 h-2.5" />
            <span>Explain</span>
          </button>
        </div>
      )}

      {/* Messages stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs select-text">
        {messages.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <div className="w-9 h-9 rounded-full bg-[#e6e0f5] dark:bg-[#2d2645] text-[#5645d4] dark:text-[#7b66ff] flex items-center justify-center mx-auto">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="font-medium text-xs">Chat alongside your note</p>
            <p className="text-[11px] text-[#787671] dark:text-[#9c9a95]">
              Ask questions about this document or chat with your local Ollama models in real time without leaving the page.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#5645d4] text-white"
                    : darkMode
                    ? "bg-[#252525] border border-[#333333] text-[#ebebeb]"
                    : "bg-white border border-[#e9e8e4] text-[#1a1a1a]"
                }`}
              >
                {/* RAG references */}
                {msg.ragSources && msg.ragSources.length > 0 && (
                  <div className="mb-1.5 pb-1.5 border-b border-black/10 dark:border-white/10 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                    <Database className="w-2.5 h-2.5" />
                    <span>{msg.ragSources.length === 1 ? `Referenced note: "${msg.ragSources[0].title}"` : `Referenced ${msg.ragSources.length} workspace notes`}</span>
                  </div>
                )}

                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Metrics footer */}
                {msg.tokens && (
                  <div className="mt-1 pt-1 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[9px] text-[#787671] dark:text-[#9c9a95]">
                    <span>{msg.tokens.total} tokens</span>
                    {msg.latencyMs && <span>{msg.latencyMs}ms</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isGenerating && (
          <div className="flex items-center space-x-2 text-xs text-[#787671] dark:text-[#9c9a95] p-2">
            <span className="w-2 h-2 rounded-full bg-[#5645d4] animate-ping" />
            <span>AI is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className={`p-3 border-t shrink-0 ${
        darkMode ? "border-[#2e2e2e] bg-[#202020]" : "border-[#e9e8e4] bg-white"
      }`}>
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about this note..."
            disabled={isGenerating}
            className={`w-full pr-8 pl-3 py-2 text-xs rounded-lg border outline-none transition-colors ${
              darkMode
                ? "bg-[#181818] border-[#333333] text-white placeholder-[#777777] focus:border-[#7b66ff]"
                : "bg-[#fafaf9] border-[#e5e3df] text-[#1a1a1a] placeholder-[#a4a097] focus:border-[#5645d4]"
            }`}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isGenerating}
            className="absolute right-1.5 p-1 rounded-md text-[#5645d4] hover:bg-[#e6e0f5] dark:hover:bg-[#2d2645] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
};
