import { useState } from "react";
import { 
  Bot, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Coins, 
  Timer, 
  Settings2,
  Database
} from "lucide-react";
import { AIProviderConfig, ChatMessage, Page, ProviderStatus } from "../types";

interface AIHubProps {
  config: AIProviderConfig;
  onUpdateConfig: (cfg: AIProviderConfig) => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isGenerating: boolean;
  providerStatus: ProviderStatus | null;
  onCheckStatus: () => Promise<void>;
  pages?: Page[];
  darkMode?: boolean;
}

export const AIHub: React.FC<AIHubProps> = ({
  config,
  onUpdateConfig,
  messages,
  onSendMessage,
  isGenerating,
  providerStatus,
  onCheckStatus,
  darkMode = false,
}) => {
  const [inputText, setInputText] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    const text = inputText;
    setInputText("");
    await onSendMessage(text);
  };

  const getProviderDefaultPort = (provider: string) => {
    switch (provider) {
      case "ollama": return "http://localhost:11434";
      case "lmstudio": return "http://localhost:1234";
      case "jan": return "http://localhost:1337";
      default: return "";
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-screen overflow-hidden transition-colors ${
      darkMode ? "bg-[#181818] text-[#ebebeb]" : "bg-white text-[#37352f]"
    }`}>
      {/* Top Bar with Provider Quick Switcher & Token Summary */}
      <div className={`h-14 border-b px-6 flex items-center justify-between shrink-0 ${
        darkMode ? "border-[#2e2e2e] bg-[#202020]" : "border-[#e9e8e4] bg-[#fafaf9]"
      }`}>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#5645d4] flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold flex items-center space-x-2">
                <span>AI Workspace Hub</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#e6e0f5] dark:bg-[#2d2645] text-[#5645d4] dark:text-[#7b66ff] uppercase">
                  {config.provider}
                </span>
              </div>
              <div className="text-[10px] text-[#787671] dark:text-[#9c9a95]">
                Model: <span className="font-mono text-[#37352f] dark:text-[#ebebeb]">{config.model || "default"}</span>
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-[#e9e8e4] dark:bg-[#333333] mx-2" />

          {/* RAG status badge */}
          <button
            onClick={() => onUpdateConfig({ ...config, enableRAG: !config.enableRAG })}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
              config.enableRAG
                ? "bg-[#d9f3e1] dark:bg-[#173822] text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                : "bg-[#f1f0eb] dark:bg-[#252525] text-[#787671] dark:text-[#9c9a95] border-[#e5e3df] dark:border-[#333333]"
            }`}
            title="Toggle searching your local notes (RAG) before answering"
          >
            <Database className="w-3 h-3" />
            <span>Local RAG: {config.enableRAG ? "Active" : "Off"}</span>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-2">
          {providerStatus && (
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] border ${
              darkMode ? "bg-[#252525] border-[#333333]" : "bg-white border-[#e9e8e4]"
            }`}>
              {providerStatus.online ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Server Online</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-rose-600 font-medium">Server Offline</span>
                </>
              )}
            </div>
          )}

          <button
            onClick={onCheckStatus}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              darkMode ? "bg-[#252525] hover:bg-[#333333] text-[#ebebeb]" : "bg-[#f1f0eb] hover:bg-[#e9e8e4] text-[#37352f]"
            }`}
          >
            Test Connection
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-1.5 rounded-md transition-colors ${
              showConfig 
                ? darkMode ? "bg-[#333333] text-white" : "bg-[#e9e8e4] text-[#1a1a1a]" 
                : darkMode ? "hover:bg-[#252525] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#787671]"
            }`}
            title="Configure AI Providers"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Slide-down Provider Configuration Drawer */}
      {showConfig && (
        <div className={`border-b p-4 text-xs transition-all ${
          darkMode ? "bg-[#1c1c1c] border-[#2e2e2e]" : "bg-[#f7f6f3] border-[#e9e8e4]"
        }`}>
          <div className="max-w-4xl mx-auto grid grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold text-[#787671] dark:text-[#9c9a95] mb-1">Provider</label>
              <select
                value={config.provider}
                onChange={(e) => {
                  const prov = e.target.value as any;
                  onUpdateConfig({
                    ...config,
                    provider: prov,
                    endpoint: getProviderDefaultPort(prov),
                  });
                }}
                className={`w-full p-2 rounded-md border outline-none ${
                  darkMode ? "bg-[#252525] border-[#383838] text-white" : "bg-white border-[#e5e3df] text-[#1a1a1a]"
                }`}
              >
                <optgroup label="Local (100% Free & Private)">
                  <option value="ollama">Ollama (localhost:11434)</option>
                  <option value="lmstudio">LM Studio (localhost:1234)</option>
                  <option value="jan">Jan (localhost:1337)</option>
                </optgroup>
                <optgroup label="Cloud (API Key Required)">
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#787671] dark:text-[#9c9a95] mb-1">Endpoint URL</label>
              <input
                type="text"
                value={config.endpoint}
                onChange={(e) => onUpdateConfig({ ...config, endpoint: e.target.value })}
                placeholder="http://localhost:11434"
                className={`w-full p-2 rounded-md border outline-none ${
                  darkMode ? "bg-[#252525] border-[#383838] text-white" : "bg-white border-[#e5e3df] text-[#1a1a1a]"
                }`}
              />
            </div>

            <div>
              <label className="block font-semibold text-[#787671] dark:text-[#9c9a95] mb-1">
                Model Name {providerStatus?.models && providerStatus.models.length > 0 && `(${providerStatus.models.length} found)`}
              </label>
              {providerStatus?.models && providerStatus.models.length > 0 ? (
                <select
                  value={config.model}
                  onChange={(e) => onUpdateConfig({ ...config, model: e.target.value })}
                  className={`w-full p-2 rounded-md border outline-none text-xs font-mono font-medium ${
                    darkMode ? "bg-[#252525] border-[#383838] text-white" : "bg-white border-[#e5e3df] text-[#1a1a1a]"
                  }`}
                >
                  {providerStatus.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => onUpdateConfig({ ...config, model: e.target.value })}
                  placeholder="e.g. llama3.2:latest, deepseek-r1:1.5b"
                  className={`w-full p-2 rounded-md border outline-none ${
                    darkMode ? "bg-[#252525] border-[#383838] text-white" : "bg-white border-[#e5e3df] text-[#1a1a1a]"
                  }`}
                />
              )}
            </div>

            <div>
              <label className="block font-semibold text-[#787671] dark:text-[#9c9a95] mb-1">API Key (Cloud only)</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => onUpdateConfig({ ...config, apiKey: e.target.value })}
                placeholder="sk-..."
                className={`w-full p-2 rounded-md border outline-none ${
                  darkMode ? "bg-[#252525] border-[#383838] text-white" : "bg-white border-[#e5e3df] text-[#1a1a1a]"
                }`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl mx-auto w-full select-text">
        {messages.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 bg-[#e6e0f5] dark:bg-[#2d2645] text-[#5645d4] dark:text-[#7b66ff] rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">
              Smart Time Local AI Assistant
            </h3>
            <p className="text-xs text-[#787671] dark:text-[#9c9a95] max-w-md mx-auto">
              Ask anything, brainstorm new ideas, or query your workspace notes using local RAG!
              Zero cloud lock-in and zero subscription costs.
            </p>

            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => onSendMessage("What tasks or notes do I have currently in my workspace?")}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${
                  darkMode 
                    ? "bg-[#252525] border-[#333333] hover:bg-[#303030] text-[#ebebeb]" 
                    : "bg-[#f7f6f3] border-[#e5e3df] hover:bg-[#edece8] text-[#37352f]"
                }`}
              >
                🔍 Search my notes
              </button>
              <button
                onClick={() => onSendMessage("Help me organize my day and plan focus sessions.")}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${
                  darkMode 
                    ? "bg-[#252525] border-[#333333] hover:bg-[#303030] text-[#ebebeb]" 
                    : "bg-[#f7f6f3] border-[#e5e3df] hover:bg-[#edece8] text-[#37352f]"
                }`}
              >
                ⏱️ Plan my focus day
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#5645d4] text-white"
                    : darkMode
                    ? "bg-[#202020] text-[#ebebeb] border border-[#2e2e2e]"
                    : "bg-[#f7f6f3] text-[#1a1a1a] border border-[#e9e8e4]"
                }`}
              >
                {/* RAG Source references */}
                {msg.ragSources && msg.ragSources.length > 0 && (
                  <div className={`mb-2 p-2 rounded-lg border text-[11px] ${
                    darkMode ? "bg-[#181818] border-[#333333]" : "bg-white border-[#e5e3df] text-[#5d5b54]"
                  }`}>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 mb-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Retrieved Knowledge from your notes:</span>
                    </div>
                    {msg.ragSources.map((s, idx) => (
                      <div key={idx} className="truncate">
                        • <span className="font-medium text-[#1a1a1a] dark:text-white">{s.title}</span>: {s.snippet}
                      </div>
                    ))}
                  </div>
                )}

                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Token Usage Metrics Badge */}
                {msg.tokens && (
                  <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center space-x-3 text-[10px] text-[#787671] dark:text-[#9c9a95] font-mono">
                    <span className="flex items-center space-x-1">
                      <Coins className="w-3 h-3 text-amber-500" />
                      <span>{msg.tokens.total} tokens</span>
                    </span>
                    {msg.latencyMs && (
                      <span className="flex items-center space-x-0.5">
                        <Timer className="w-3 h-3 text-blue-500" />
                        <span>{msg.latencyMs}ms</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isGenerating && (
          <div className={`flex items-center space-x-2 text-xs p-3 rounded-xl max-w-xs animate-pulse ${
            darkMode ? "bg-[#252525] text-[#9c9a95]" : "bg-[#f7f6f3] text-[#787671]"
          }`}>
            <Bot className="w-4 h-4 text-[#5645d4] animate-spin" />
            <span>Thinking with {config.provider}...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className={`p-4 border-t shrink-0 ${
        darkMode ? "border-[#2e2e2e] bg-[#202020]" : "border-[#e9e8e4] bg-white"
      }`}>
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask your Local AI or search workspace knowledge..."
            className={`flex-1 px-4 py-2.5 text-xs rounded-xl border outline-none transition-colors ${
              darkMode
                ? "bg-[#181818] border-[#333333] text-white placeholder-[#666666] focus:border-[#7b66ff]"
                : "bg-[#fafaf9] border-[#e5e3df] text-[#1a1a1a] placeholder-[#a4a097] focus:border-[#5645d4]"
            }`}
          />
          <button
            type="submit"
            disabled={isGenerating || !inputText.trim()}
            className="px-5 py-2.5 bg-[#5645d4] hover:bg-[#4534b3] disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-all shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
