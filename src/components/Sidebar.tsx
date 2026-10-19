import React from "react";
import { 
  FileText, 
  Clock, 
  Calendar, 
  Bot, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  ChevronRight,
  FolderKanban,
  Sun,
  Moon,
  Check
} from "lucide-react";
import { Page, TabType, Task } from "../types";

interface SidebarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  pages: Page[];
  activePageId: string;
  setActivePageId: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
  activeTask: Task | null;
  timerRunning: boolean;
  onToggleTimer: () => void;
  timerSeconds: number;
  tasks?: Task[];
  onToggleTaskComplete?: (taskId: string) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  pages,
  activePageId,
  setActivePageId,
  onAddPage,
  onDeletePage,
  activeTask,
  timerRunning,
  onToggleTimer,
  timerSeconds,
  tasks = [],
  onToggleTaskComplete,
  darkMode = false,
  onToggleDarkMode,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const completedTasksCount = tasks.filter((t) => t.completed).length;

  return (
    <aside className={`w-64 border-r flex flex-col h-screen select-none text-sm shrink-0 transition-colors ${
      darkMode ? "bg-[#1d1d1d] border-[#2e2e2e] text-[#ebebeb]" : "bg-[#f7f6f3] border-[#e9e8e4] text-[#37352f]"
    }`}>
      {/* Workspace Header with Dark Mode Toggle */}
      <div className={`p-3 border-b flex items-center justify-between ${
        darkMode ? "border-[#2e2e2e]" : "border-[#e9e8e4]"
      }`}>
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-[#5645d4] flex items-center justify-center text-white font-bold text-xs shadow-sm">
            ST
          </div>
          <div className="font-semibold text-xs tracking-tight">
            Smart Time <span className="text-[10px] bg-[#e6e0f5] dark:bg-[#2d2645] text-[#5645d4] dark:text-[#7b66ff] px-1.5 py-0.5 rounded font-mono font-medium">Rust</span>
          </div>
        </div>

        {/* Prominent Dark Mode Toggle Button */}
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            className={`p-1.5 rounded-md flex items-center space-x-1 text-xs transition-colors ${
              darkMode 
                ? "bg-[#2a2a2a] text-amber-400 hover:bg-[#363636] border border-[#383838]" 
                : "bg-[#e9e8e4] text-[#37352f] hover:bg-[#dedcd7] border border-[#d3d1cb]"
            }`}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Main Nav Items */}
      <div className="px-2 py-2 space-y-0.5">
        <button onClick={() => setCurrentTab("workspace")} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-colors ${currentTab === "workspace" ? "bg-[#e6e0f5] text-[#5645d4] dark:bg-[#2d2645] dark:text-[#b69df8] font-semibold" : "hover:bg-black/5 dark:hover:bg-white/5"}`}><FolderKanban className="w-4 h-4" />Clients & Projects</button>
        <button
          onClick={() => setCurrentTab("editor")}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium ${
            currentTab === "editor"
              ? darkMode ? "bg-[#292929] text-white shadow-xs" : "bg-[#e9e8e4] text-[#1a1a1a] shadow-xs"
              : darkMode ? "hover:bg-[#252525] text-[#a4a097]" : "hover:bg-[#edece8] text-[#5d5b54]"
          }`}
        >
          <FileText className="w-4 h-4 text-[#5645d4]" />
          <span>Pages & Workspace</span>
        </button>

        <button
          onClick={() => setCurrentTab("timer")}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium ${
            currentTab === "timer"
              ? darkMode ? "bg-[#292929] text-white shadow-xs" : "bg-[#e9e8e4] text-[#1a1a1a] shadow-xs"
              : darkMode ? "hover:bg-[#252525] text-[#a4a097]" : "hover:bg-[#edece8] text-[#5d5b54]"
          }`}
        >
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Smart Timer & Log</span>
          </div>
          {timerRunning && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setCurrentTab("calendar")}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium ${
            currentTab === "calendar"
              ? darkMode ? "bg-[#292929] text-white shadow-xs" : "bg-[#e9e8e4] text-[#1a1a1a] shadow-xs"
              : darkMode ? "hover:bg-[#252525] text-[#a4a097]" : "hover:bg-[#edece8] text-[#5d5b54]"
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Calendar & Schedule</span>
        </button>

        <button
          onClick={() => setCurrentTab("ai-hub")}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium ${
            currentTab === "ai-hub"
              ? "bg-[#e6e0f5] dark:bg-[#2d2645] text-[#5645d4] dark:text-[#7b66ff] shadow-xs"
              : darkMode ? "hover:bg-[#252525] text-[#a4a097]" : "hover:bg-[#edece8] text-[#5d5b54]"
          }`}
        >
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-[#5645d4] dark:text-[#7b66ff]" />
            <span>AI Hub & Local RAG</span>
          </div>
          <span className="text-[9px] bg-[#dcecfa] dark:bg-[#193147] text-[#0075de] dark:text-[#4facfe] px-1 py-0.5 rounded font-mono">
            Ollama/Jan
          </span>
        </button>
      </div>

      {/* Pages Section */}
      <div className={`flex-1 overflow-y-auto px-2 py-2 border-t ${
        darkMode ? "border-[#2e2e2e]" : "border-[#e9e8e4]"
      }`}>
        <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#787671] dark:text-[#9c9a95] uppercase tracking-wider">
          <div className="flex items-center space-x-1">
            <FolderKanban className="w-3 h-3" />
            <span>Workspace Pages</span>
          </div>
          <button
            onClick={onAddPage}
            title="Create new page"
            className={`p-1 rounded transition-colors ${
              darkMode ? "hover:bg-[#2c2c2c] text-[#ebebeb]" : "hover:bg-[#e9e8e4] text-[#37352f]"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-1 space-y-0.5">
          {pages.map((page) => (
            <div
              key={page.id}
              onClick={() => {
                setActivePageId(page.id);
                setCurrentTab("editor");
              }}
              className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                activePageId === page.id && currentTab === "editor"
                  ? darkMode ? "bg-[#292929] font-medium text-white" : "bg-[#e9e8e4] font-medium text-[#1a1a1a]"
                  : darkMode ? "hover:bg-[#252525] text-[#a4a097]" : "hover:bg-[#edece8] text-[#5d5b54]"
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="text-sm shrink-0">{page.icon}</span>
                <span className="truncate">{page.title || "Untitled"}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePage(page.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded transition-opacity"
                title="Delete page"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Quick Tasks & Checkboxes Section inside Sidebar */}
        {tasks.length > 0 && onToggleTaskComplete && (
          <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#787671] dark:text-[#9c9a95] uppercase tracking-wider">
              <span>Today's Checklist</span>
              <span className="text-[10px] font-mono text-[#5645d4] dark:text-[#7b66ff]">
                {completedTasksCount}/{tasks.length}
              </span>
            </div>

            <div className="mt-1 space-y-1">
              {tasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  onClick={() => onToggleTaskComplete(task.id)}
                  className={`flex items-center space-x-2 px-2 py-1 rounded cursor-pointer transition-colors text-xs ${
                    darkMode ? "hover:bg-[#252525]" : "hover:bg-[#edece8]"
                  }`}
                  title="Click checkbox to mark done/undone"
                >
                  <button
                    type="button"
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition-colors ${
                      task.completed
                        ? "bg-[#5645d4] text-white"
                        : darkMode ? "border border-[#555555]" : "border border-[#bbb8b1]"
                    }`}
                  >
                    {task.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </button>
                  <span className={`truncate ${
                    task.completed
                      ? "line-through text-[#8f8d88] dark:text-[#666666]"
                      : darkMode ? "text-[#ebebeb]" : "text-[#1a1a1a]"
                  }`}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active Timer Pill in Footer */}
      {activeTask && (
        <div className={`p-3 border-t ${
          darkMode ? "border-[#2e2e2e] bg-[#171717]" : "border-[#e9e8e4] bg-[#f1f0eb]"
        }`}>
          <div className="text-[10px] text-[#787671] dark:text-[#9c9a95] flex items-center justify-between font-medium mb-1">
            <span className="truncate max-w-[120px]">⏱️ {activeTask.title}</span>
            <span className="font-mono text-xs font-semibold">
              {formatTime(timerSeconds)}
            </span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <button
              onClick={onToggleTimer}
              className={`flex-1 py-1 px-2 rounded text-xs font-medium flex items-center justify-center space-x-1 transition-colors ${
                timerRunning
                  ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200"
                  : "bg-[#5645d4] text-white hover:bg-[#4534b3]"
              }`}
            >
              {timerRunning ? (
                <>
                  <Pause className="w-3 h-3" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Resume</span>
                </>
              )}
            </button>
            <button
              onClick={() => setCurrentTab("timer")}
              className={`p-1 rounded ${
                darkMode ? "hover:bg-[#2c2c2c] text-[#a4a097]" : "hover:bg-[#e9e8e4] text-[#5d5b54]"
              }`}
              title="Open Timer Details"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
