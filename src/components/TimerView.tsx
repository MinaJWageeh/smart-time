import { useState } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Printer, 
  Clock, 
  Award,
  Flame,
  Check
} from "lucide-react";
import { Task } from "../types";
import { localDateKey } from "../services/localDate";

interface TimerViewProps {
  tasks: Task[];
  activeTask: Task | null;
  timerRunning: boolean;
  timerSeconds: number;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onSelectActiveTask: (task: Task) => void;
  onAddTask: (title: string, targetMinutes: number) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onSetPresetMinutes: (mins: number) => void;
  darkMode?: boolean;
}

export const TimerView: React.FC<TimerViewProps> = ({
  tasks,
  activeTask,
  timerRunning,
  timerSeconds,
  onToggleTimer,
  onResetTimer,
  onSelectActiveTask,
  onAddTask,
  onToggleTaskComplete,
  onSetPresetMinutes,
  darkMode = false,
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskMinutes, setNewTaskMinutes] = useState(25);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const today = localDateKey();
  const todayTasks = tasks.filter(t => t.date === today);
  const totalSecondsToday = todayTasks.reduce((acc, t) => acc + t.durationSeconds, 0);
  const completedCount = todayTasks.filter((t) => t.completed).length;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(newTaskTitle.trim(), newTaskMinutes);
    setNewTaskTitle("");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`flex-1 flex flex-col h-screen overflow-y-auto p-8 transition-colors ${
      darkMode ? "bg-[#181818] text-[#ebebeb]" : "bg-white text-[#37352f]"
    }`}>
      {/* Header */}
      <div className="max-w-4xl mx-auto w-full">
        <div className={`flex items-center justify-between pb-6 border-b ${
          darkMode ? "border-[#2e2e2e]" : "border-[#e9e8e4]"
        }`}>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
              <span>⏱️ Smart Time & Productivity</span>
            </h1>
            <p className="text-xs text-[#787671] dark:text-[#9c9a95] mt-1">
              Track focused execution on your tasks, avoid burnout, and print your daily accomplishments.
            </p>
          </div>

          <button
            onClick={() => setShowPrintModal(true)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-colors text-xs font-medium border ${
              darkMode
                ? "bg-[#252525] border-[#383838] text-[#ebebeb] hover:bg-[#2e2e2e]"
                : "bg-[#f1f0eb] border-[#e5e3df] text-[#37352f] hover:bg-[#e9e8e4]"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>إطبع يومي / Print Daily Log</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 my-6">
          <div className={`p-4 rounded-xl border ${
            darkMode ? "bg-[#202020] border-[#2e2e2e]" : "bg-[#f7f6f3] border-[#e9e8e4]"
          }`}>
            <div className="text-xs text-[#787671] dark:text-[#9c9a95] font-medium flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Total Focused Today</span>
            </div>
            <div className="text-2xl font-bold mt-1 font-mono">
              {formatTime(totalSecondsToday)}
            </div>
          </div>

          <div className={`p-4 rounded-xl border ${
            darkMode ? "bg-[#202020] border-[#2e2e2e]" : "bg-[#f7f6f3] border-[#e9e8e4]"
          }`}>
            <div className="text-xs text-[#787671] dark:text-[#9c9a95] font-medium flex items-center space-x-1">
              <Award className="w-3.5 h-3.5 text-emerald-500" />
              <span>Completed Tasks</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {completedCount} <span className="text-xs font-normal text-[#a4a097]">/ {todayTasks.length}</span>
            </div>
          </div>

          <div className={`p-4 rounded-xl border ${
            darkMode ? "bg-[#202020] border-[#2e2e2e]" : "bg-[#f7f6f3] border-[#e9e8e4]"
          }`}>
            <div className="text-xs text-[#787671] dark:text-[#9c9a95] font-medium flex items-center space-x-1">
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>Focus Efficiency</span>
            </div>
            <div className="text-2xl font-bold text-[#5645d4] dark:text-[#7b66ff] mt-1">
              {todayTasks.length > 0 ? Math.round((completedCount / todayTasks.length) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Main Focus Timer Hero Card */}
        <div className={`p-8 rounded-2xl border shadow-xs text-center mb-8 relative overflow-hidden ${
          darkMode ? "bg-[#1f1f1f] border-[#2e2e2e]" : "bg-[#fdfdfc] border-[#e5e3df]"
        }`}>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#787671] dark:text-[#9c9a95] mb-2">
            {activeTask ? (
              <span className="text-[#5645d4] dark:text-[#7b66ff] font-medium">Currently Focusing On: {activeTask.title}</span>
            ) : (
              <span>Select or start a task below</span>
            )}
          </div>

          {/* Big Digital Clock Display */}
          <div className="text-6xl font-bold font-mono tracking-tight my-4">
            {formatTime(timerSeconds)}
          </div>

          {/* Presets */}
          <div className="flex justify-center space-x-2 my-4">
            {[15, 25, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => onSetPresetMinutes(mins)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                  darkMode
                    ? "bg-[#2a2a2a] hover:bg-[#333333] text-[#ebebeb]"
                    : "bg-[#f1f0eb] hover:bg-[#e9e8e4] text-[#5d5b54]"
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center space-x-3 mt-6">
            <button
              onClick={onToggleTimer}
              className={`px-6 py-2.5 rounded-full font-semibold text-sm flex items-center space-x-2 transition-all shadow-sm ${
                timerRunning
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-[#5645d4] hover:bg-[#4534b3] text-white"
              }`}
            >
              {timerRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause Timer</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Start Focus</span>
                </>
              )}
            </button>

            <button
              onClick={onResetTimer}
              className={`p-2.5 rounded-full transition-colors ${
                darkMode ? "bg-[#2a2a2a] hover:bg-[#333333] text-[#ebebeb]" : "bg-[#f1f0eb] hover:bg-[#e9e8e4] text-[#5d5b54]"
              }`}
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {activeTask && (
            <div className="mt-4 text-xs text-[#787671] dark:text-[#9c9a95]">
              إجمالي الوقت المنقضي: <span className="font-mono font-medium">{formatTime(activeTask.durationSeconds)}</span>
            </div>
          )}
        </div>

        {/* Task Management & Daily Checklist */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#787671] dark:text-[#9c9a95]">
              Tasks & Checklist for Today
            </h2>
            <span className="text-xs text-[#a4a097]">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
          </div>

          {/* Quick Task Input Form */}
          <form onSubmit={handleCreateTask} className="flex space-x-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What do you want to accomplish next? (e.g., Rewrite module in Rust)"
              className={`flex-1 px-3 py-2 text-xs rounded-lg border outline-none transition-colors ${
                darkMode
                  ? "bg-[#202020] border-[#333333] text-white placeholder-[#666666] focus:border-[#7b66ff]"
                  : "bg-white border-[#e5e3df] text-[#1a1a1a] placeholder-[#a4a097] focus:border-[#5645d4]"
              }`}
            />
            <select
              value={newTaskMinutes}
              onChange={(e) => setNewTaskMinutes(Number(e.target.value))}
              className={`px-2 py-2 text-xs rounded-lg border outline-none ${
                darkMode
                  ? "bg-[#202020] border-[#333333] text-[#ebebeb]"
                  : "bg-white border-[#e5e3df] text-[#5d5b54]"
              }`}
            >
              <option value={15}>15 mins</option>
              <option value={25}>25 mins (Pomodoro)</option>
              <option value={30}>30 mins</option>
              <option value={60}>1 hour</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-[#5645d4] hover:bg-[#4534b3] text-white text-xs font-semibold rounded-lg flex items-center space-x-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </form>

          {/* Tasks List with Interactive Checkboxes */}
          <div className="space-y-1.5 mt-2">
            {tasks.map((task) => {
              const isActive = activeTask?.id === task.id;
              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isActive
                      ? darkMode
                        ? "bg-[#25231c] border-amber-600/50 shadow-xs"
                        : "bg-[#fdfbf7] border-amber-300 shadow-xs"
                      : darkMode
                      ? "bg-[#1f1f1f] border-[#2e2e2e] hover:border-[#3e3e3e]"
                      : "bg-[#fafaf9] border-[#e9e8e4] hover:border-[#d3d1cb]"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Interactive Checkbox */}
                    <button
                      type="button"
                      onClick={() => onToggleTaskComplete(task.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        task.completed
                          ? "bg-emerald-600 text-white shadow-xs"
                          : darkMode
                          ? "border border-[#555555] hover:border-emerald-500 bg-[#252525]"
                          : "border border-[#bbb8b1] hover:border-emerald-600 bg-white"
                      }`}
                      title={task.completed ? "Mark incomplete" : "Mark completed"}
                    >
                      {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <span
                      className={`text-xs font-medium cursor-pointer ${
                        task.completed 
                          ? "line-through text-[#8f8d88] dark:text-[#666666]" 
                          : ""
                      }`}
                      onClick={() => onToggleTaskComplete(task.id)}
                    >
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] font-mono text-[#787671] dark:text-[#9c9a95]">
                      {formatTime(task.durationSeconds)} / {task.targetMinutes}m
                    </span>

                    {!isActive ? (
                      <button
                        onClick={() => onSelectActiveTask(task)}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                          darkMode
                            ? "bg-[#2a2a2a] hover:bg-[#333333] text-[#ebebeb]"
                            : "bg-[#f1f0eb] hover:bg-[#e9e8e4] text-[#37352f]"
                        }`}
                      >
                        Start Focus
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Printable Daily Summary Modal ("إطبع يومي") */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-2xl w-full p-8 shadow-2xl border relative max-h-[90vh] overflow-y-auto ${
            darkMode ? "bg-[#1f1f1f] border-[#2e2e2e] text-[#ebebeb]" : "bg-white border-[#e5e3df] text-[#1a1a1a]"
          }`}>
            <div className={`flex justify-between items-center pb-4 border-b ${
              darkMode ? "border-[#2e2e2e]" : "border-[#e9e8e4]"
            }`}>
              <div>
                <h2 className="text-xl font-bold">Smart Time — Daily Accomplishment Report</h2>
                <p className="text-xs text-[#787671] dark:text-[#9c9a95]">Date: {new Date().toLocaleDateString(undefined, { dateStyle: "full" })}</p>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-sm font-semibold hover:opacity-75"
              >
                ✕ Close
              </button>
            </div>

            <div className="py-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-3 rounded-lg ${darkMode ? "bg-[#272727]" : "bg-[#f7f6f3]"}`}>
                  <div className="text-xs text-[#787671] dark:text-[#9c9a95]">Total Focused Hours</div>
                  <div className="text-xl font-bold font-mono mt-0.5">{formatTime(totalSecondsToday)}</div>
                </div>
                <div className={`p-3 rounded-lg ${darkMode ? "bg-[#272727]" : "bg-[#f7f6f3]"}`}>
                  <div className="text-xs text-[#787671] dark:text-[#9c9a95]">Tasks Completed</div>
                  <div className="text-xl font-bold mt-0.5">{completedCount} / {todayTasks.length}</div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#787671] dark:text-[#9c9a95] mb-2">Itemized Task Breakdown</h3>
                <div className={`border rounded-lg divide-y ${
                  darkMode ? "border-[#333333] divide-[#333333]" : "border-[#e9e8e4] divide-[#e9e8e4]"
                }`}>
                  {todayTasks.map((task) => (
                    <div key={task.id} className="p-3 flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2">
                        <span>{task.completed ? "✅" : "⏳"}</span>
                        <span className={task.completed ? "font-medium" : "text-[#787671]"}>{task.title}</span>
                      </div>
                      <span className="font-mono text-[#787671]">{formatTime(task.durationSeconds)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`flex justify-end space-x-3 pt-4 border-t ${
              darkMode ? "border-[#2e2e2e]" : "border-[#e9e8e4]"
            }`}>
              <button
                onClick={() => setShowPrintModal(false)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                  darkMode ? "hover:bg-[#2c2c2c]" : "hover:bg-[#f1f0eb]"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                className="px-5 py-2 text-xs font-semibold bg-[#5645d4] hover:bg-[#4534b3] text-white rounded-lg flex items-center space-x-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
