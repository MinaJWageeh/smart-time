import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { PageEditor } from "./components/PageEditor";
import { TimerView } from "./components/TimerView";
import { CalendarView } from "./components/CalendarView";
import { AIHub } from "./components/AIHub";
import { AICopilotDrawer } from "./components/AICopilotDrawer";
import { WorkspaceView } from "./components/WorkspaceView";
import { NoteMetadata } from "./components/NoteMetadata";
import { useWorkspace } from "./hooks/useWorkspace";
import { localDateKey } from "./services/localDate";
import { AIProviderConfig, ChatMessage, Page, ProviderStatus, TabType, Task } from "./types";
import { 
  checkAIProviderStatus, 
  searchWorkspaceNotes, 
  sendAIChatRequest 
} from "./services/aiService";
import { searchableNoteText } from "./services/inlineImages";

const INITIAL_PAGES: Page[] = [
  {
    id: "p1",
    title: "⚡ Welcome to Smart Time",
    icon: "⚡",
    category: "work",
    updatedAt: "Just now",
    content: `# Welcome to Smart Time

Smart Time is your fast, lightweight, Notion alternative written in Rust with:
- **Zero Cloud Lock-in**: 100% Local-first architecture.
- **Local AI & RAG**: Connect directly to Ollama, LM Studio, or Jan on your PC.
- **Smart Time Tracking**: Stay focused with countdown timers and itemized task duration logging.
- **Interactive Calendar**: Schedule your week and organize deadlines.

### Quick Start
1. Type and format your notes just like Notion.
2. Click **Start Timer for this** in the top bar to track your work.
3. Switch to **AI Hub & Local RAG** to chat with your local models.
`,
  },
  {
    id: "p2",
    title: "🚀 Rebuilding Heavy Apps in Rust",
    icon: "🚀",
    category: "ideas",
    updatedAt: "10:30 AM",
    content: `# Project Roadmap: Rebuilding Heavy Apps in Rust

Goal: Take bloated, Electron-based desktop utilities and recreate blazing-fast, lightweight alternatives in Rust!

### Key Advantages:
- Memory footprint: ~30MB instead of 600MB+ in Electron.
- Microsecond startup time.
- Single lightweight executable.

### Target Features:
- [x] Local AI integration with Ollama and LM Studio
- [x] Local RAG search across workspace notes
- [x] Task stopwatch and Pomodoro countdowns
- [x] Printable daily summary ("إطبع يومي")
`,
  },
];

const INITIAL_TASKS: Task[] = [
  {
    id: "t1",
    title: "Implement Rust Backend AI Engine",
    date: localDateKey(),
    durationSeconds: 1500, // 25 mins
    targetMinutes: 30,
    completed: true,
    priority: "high",
    category: "work",
  },
  {
    id: "t2",
    title: "Configure Ollama & Local RAG",
    date: localDateKey(),
    durationSeconds: 900, // 15 mins
    targetMinutes: 25,
    completed: false,
    priority: "medium",
    category: "deepwork",
  },
];

const CHAT_HISTORY_LIMIT = 12;
const CHAT_MESSAGE_LIMIT = 6_000;
const NOTE_CONTEXT_LIMIT = 12_000;
function limitPromptText(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n[Earlier content shortened to keep the AI request responsive.]`;
}

export function App() {
  const [currentTab, setCurrentTab] = useState<TabType>("workspace");
  const storage = useWorkspace(INITIAL_PAGES, INITIAL_TASKS);
  const { workspace, setPages, setTasks } = storage;
  const pages = (workspace?.pages ?? []).filter(p => !p.deletedAt);
  const tasks = workspace?.tasks ?? [];
  const [activePageId, setActivePageId] = useState<string>("p1");
  const [activeTaskId, setActiveTaskId] = useState<string | null>("t2");

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // AI Configuration state
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>(() => {
    let saved: Partial<AIProviderConfig> = {};
    try { saved = JSON.parse(localStorage.getItem("st_aiconfig") || "{}"); } catch { /* Invalid optional settings do not block workspace recovery. */ }
    const config: AIProviderConfig = {
          provider: "ollama",
          endpoint: "http://localhost:11434",
          apiKey: "",
          model: "llama3.2",
          enableRAG: false,
        };
    return { ...config, ...saved, enableRAG: saved.enableRAG ?? config.enableRAG };
  });

  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);

  // Dark Mode state & persistence
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("st_dark_mode");
    return saved === "true";
  });

  // Side-by-side AI Copilot drawer state
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("st_dark_mode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("st_aiconfig", JSON.stringify({ ...aiConfig, apiKey: "" }));
  }, [aiConfig]);

  // Timer interval effect
  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);

        // Also increment duration on active task
        if (activeTaskId) {
          setTasks((prevTasks) =>
            prevTasks.map((t) =>
              t.id === activeTaskId
                ? { ...t, durationSeconds: t.durationSeconds + 1 }
                : t
            )
          );
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, activeTaskId]);

  const activePage = pages.find((p) => p.id === activePageId) || pages[0] || null;
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  // Add Page
  const handleAddPage = () => {
    const newPage: Page = {
      id: `p_${Date.now()}`,
      title: "Untitled Page",
      icon: "📄",
      category: "work",
      updatedAt: "Just now",
      content: "",
    };
    setPages(prev => [newPage, ...prev]);
    setActivePageId(newPage.id);
    setCurrentTab("editor");
  };

  const handleDeletePage = (id: string) => {
    const filtered = pages.filter((p) => p.id !== id);
    setPages(prev => prev.map(p => p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p));
    if (activePageId === id && filtered.length > 0) {
      setActivePageId(filtered[0].id);
    }
  };

  const handleUpdatePage = (updated: Page) => {
    storage.update(w => ({ ...w, pages: w.pages.map(p => p.id === updated.id ? updated : p), attachments: w.attachments.map(f => f.pageId === updated.id ? { ...f, projectId: updated.projectId ?? null } : f) }));
  };

  // Timer actions
  const handleToggleTimer = () => {
    setTimerRunning(!timerRunning);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setTimerSeconds(0);
  };

  const handleSelectActiveTask = (task: Task) => {
    setActiveTaskId(task.id);
    setTimerSeconds(0);
    setTimerRunning(true);
  };

  const handleAddTask = (title: string, targetMinutes: number) => {
    const newTask: Task = {
      id: `t_${Date.now()}`,
      title,
      date: localDateKey(),
      durationSeconds: 0,
      targetMinutes,
      completed: false,
      priority: "medium",
      category: "work",
    };
    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
    setTimerSeconds(0);
  };

  const handleToggleTaskComplete = (taskId: string) => {
    setTasks(
      tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleSetPresetMinutes = (mins: number) => {
    setTimerSeconds(0);
    if (activeTask) {
      setTasks(
        tasks.map((t) => (t.id === activeTask.id ? { ...t, targetMinutes: mins } : t))
      );
    }
  };

  const handleAddTaskForDate = (title: string, date: string, category: string) => {
    const newTask: Task = {
      id: `t_${Date.now()}`,
      title,
      date,
      durationSeconds: 0,
      targetMinutes: 30,
      completed: false,
      priority: "medium",
      category,
    };
    setTasks([...tasks, newTask]);
  };

  const handleStartTaskFromPage = (title: string) => {
    handleAddTask(`Focus: ${title}`, 25);
    setCurrentTab("timer");
    setTimerRunning(true);
  };

  // Auto-check AI Provider status on mount and when provider or tab changes
  useEffect(() => {
    handleCheckAIStatus();
  }, [aiConfig.provider, currentTab]);

  // AI & RAG Communication (Tauri Native IPC with Browser Fallback)
  const handleCheckAIStatus = async () => {
    try {
      const status = await checkAIProviderStatus(aiConfig.provider, aiConfig.endpoint);
      setProviderStatus(status);
      if (status.models && status.models.length > 0) {
        // If current model is not in detected models, default to first available
        if (!aiConfig.model || !status.models.includes(aiConfig.model)) {
          // If llama3.2 exists, prefer it, otherwise first
          const preferred = status.models.find((m) => m.toLowerCase().includes("llama3.2")) || status.models[0];
          setAiConfig((prev) => ({ ...prev, model: preferred }));
        }
      }
    } catch (err: any) {
      setProviderStatus({
        provider: aiConfig.provider,
        online: false,
        models: [],
        message: String(err?.message || err),
      });
    }
  };

  const handleSendMessage = async (text: string, explicitContext?: string) => {
    if (isAiGenerating) return;
    const userMsg: ChatMessage = {
      id: `m_${Date.now()}`,
      role: "user",
      content: text,
    };
    setAiMessages((prev) => [...prev, userMsg]);
    setIsAiGenerating(true);

    try {
      let ragContext = explicitContext
        ? `Current note "${activePage?.title ?? ""}":\n${limitPromptText(searchableNoteText(explicitContext), NOTE_CONTEXT_LIMIT)}`
        : "";
      let retrievedSources: Array<{ title: string; snippet: string }> = [];

      // If RAG enabled, search workspace notes (via Rust or browser client-side scoring)
      if (aiConfig.enableRAG && pages.length > 0) {
        try {
          const results = await searchWorkspaceNotes(
            text,
            pages,
            3,
            aiConfig.provider === "ollama" ? aiConfig.endpoint : null
          );
          if (results && results.length > 0) {
            const relatedNotes = results;
            retrievedSources = relatedNotes.map((r) => ({
              title: r.title,
              snippet: r.snippet,
            }));
            const relatedContext = relatedNotes
              .map((r) => `Document: "${r.title}"\nContent: ${r.snippet}`)
              .join("\n\n");
            ragContext = [ragContext, relatedContext ? `Related workspace notes:\n${relatedContext}` : ""]
              .filter(Boolean).join("\n\n");
          }
        } catch (e) {
          console.warn("RAG search error:", e);
        }
      }

      // Format messages history
      const formattedMessages = [
        ...aiMessages.slice(-CHAT_HISTORY_LIMIT).map((m) => ({ role: m.role, content: limitPromptText(m.content, CHAT_MESSAGE_LIMIT) })),
        { role: "user", content: text },
      ];

      const resp = await sendAIChatRequest({
        provider: aiConfig.provider,
        endpoint: aiConfig.endpoint || null,
        api_key: aiConfig.apiKey || null,
        model: aiConfig.model || "llama3.2",
        messages: formattedMessages,
        context: ragContext || null,
      });

      const assistantMsg: ChatMessage = {
        id: `m_${Date.now() + 1}`,
        role: "assistant",
        content: resp.message,
        tokens: {
          prompt: resp.prompt_tokens,
          completion: resp.completion_tokens,
          total: resp.total_tokens,
        },
        latencyMs: resp.latency_ms,
        costUsd: resp.estimated_cost_usd,
        model: resp.model,
        ragSources: retrievedSources,
      };

      setAiMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `m_${Date.now() + 1}`,
        role: "assistant",
        content: `⚠️ Error from ${aiConfig.provider}: ${String(err?.message || err)}\n\nPlease ensure your local server (${aiConfig.provider}) is running or check your settings.`,
      };
      setAiMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAskAIAboutPage = (prompt: string, context: string) => {
    setIsCopilotOpen(true);
    void handleSendMessage(prompt, context);
  };

  if (!workspace) return <div className="workspace-view" style={{ minHeight: "100vh", padding: 48 }}><h1>Smart Time</h1><p role={storage.error ? "alert" : "status"}>{storage.error || "Opening your workspace…"}</p>{storage.error && <><p>Your existing data has been kept. Fix the storage problem and reload.</p><button className="ws-button" onClick={() => window.location.reload()}>Retry loading</button></>}</div>;

  return (
    <div className={`flex h-screen w-screen overflow-hidden select-none transition-colors ${
      darkMode ? "dark bg-[#181818] text-[#ebebeb]" : "bg-white text-[#37352f]"
    }`}>
      {/* Notion-styled Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pages={pages}
        activePageId={activePageId}
        setActivePageId={setActivePageId}
        onAddPage={handleAddPage}
        onDeletePage={handleDeletePage}
        activeTask={activeTask}
        timerRunning={timerRunning}
        onToggleTimer={handleToggleTimer}
        timerSeconds={timerSeconds}
        tasks={tasks.filter(t => t.date === localDateKey())}
        onToggleTaskComplete={handleToggleTaskComplete}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {storage.error && <div className="workspace-alert" role="alert"><span>{storage.error} · Changes have not been saved.</span><button className="ws-button" onClick={() => void storage.flush().catch(() => {})}>Retry save</button></div>}
        {currentTab === "workspace" && <WorkspaceView workspace={workspace} update={storage.update} flush={storage.flush} restore={storage.restore} onOpenPage={id => { setActivePageId(id); setCurrentTab("editor"); }} status={storage.status} mode={storage.mode} />}
        {currentTab === "editor" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {activePage && <NoteMetadata page={activePage} workspace={workspace} onUpdate={handleUpdatePage} update={storage.update} flush={storage.flush} status={storage.status} />}
            <div className="flex-1 flex min-h-0 overflow-hidden">
            <PageEditor
              page={activePage}
              onUpdatePage={handleUpdatePage}
              onStartTaskFromPage={handleStartTaskFromPage}
              onAskAIAboutPage={handleAskAIAboutPage}
              isCopilotOpen={isCopilotOpen}
              onToggleCopilot={() => setIsCopilotOpen(!isCopilotOpen)}
              darkMode={darkMode}
            />
            <AICopilotDrawer
              isOpen={isCopilotOpen}
              onClose={() => setIsCopilotOpen(false)}
              activePage={activePage}
              messages={aiMessages}
              onSendMessage={text => handleSendMessage(text, activePage?.content)}
              isGenerating={isAiGenerating}
              providerStatus={providerStatus}
              currentModel={aiConfig.model}
              darkMode={darkMode}
            />
            </div>
          </div>
        )}

        {currentTab === "timer" && (
          <TimerView
            tasks={tasks}
            activeTask={activeTask}
            timerRunning={timerRunning}
            timerSeconds={timerSeconds}
            onToggleTimer={handleToggleTimer}
            onResetTimer={handleResetTimer}
            onSelectActiveTask={handleSelectActiveTask}
            onAddTask={handleAddTask}
            onToggleTaskComplete={handleToggleTaskComplete}
            onSetPresetMinutes={handleSetPresetMinutes}
            darkMode={darkMode}
          />
        )}

        {currentTab === "calendar" && (
          <CalendarView
            tasks={tasks}
            onAddTaskForDate={handleAddTaskForDate}
            darkMode={darkMode}
          />
        )}

        {currentTab === "ai-hub" && (
          <AIHub
            config={aiConfig}
            onUpdateConfig={setAiConfig}
            messages={aiMessages}
            onSendMessage={handleSendMessage}
            isGenerating={isAiGenerating}
            providerStatus={providerStatus}
            onCheckStatus={handleCheckAIStatus}
            pages={pages}
            darkMode={darkMode}
          />
        )}
      </main>
    </div>
  );
}

export default App;

