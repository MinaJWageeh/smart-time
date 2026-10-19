import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Task } from "../types";
import { localDateKey } from "../services/localDate";

interface CalendarViewProps {
  tasks: Task[];
  onAddTaskForDate: (title: string, date: string, category: string) => void;
  darkMode?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  tasks, 
  onAddTaskForDate,
  darkMode = false,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(
    localDateKey()
  );
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventCategory, setNewEventCategory] = useState("work");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    onAddTaskForDate(newEventTitle.trim(), selectedDateStr, newEventCategory);
    setNewEventTitle("");
  };

  // Calendar matrix days
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const selectedDateTasks = tasks.filter((t) => t.date === selectedDateStr);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "work":
        return darkMode 
          ? "bg-[#193147] text-[#4facfe] border-[#1f4b73]"
          : "bg-[#dcecfa] text-[#0075de] border-[#b8daf8]";
      case "study":
        return darkMode
          ? "bg-[#2d2645] text-[#b69df8] border-[#44386b]"
          : "bg-[#e6e0f5] text-[#7b3ff2] border-[#d6b6f6]";
      case "meeting":
        return darkMode
          ? "bg-[#3b281d] text-[#ff9248] border-[#5e3b25]"
          : "bg-[#ffe8d4] text-[#dd5b00] border-[#ffd0a8]";
      default:
        return darkMode
          ? "bg-[#173822] text-[#55e084] border-[#225734]"
          : "bg-[#d9f3e1] text-[#1aae39] border-[#b5e7c3]";
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-screen overflow-hidden p-8 transition-colors ${
      darkMode ? "bg-[#181818] text-[#ebebeb]" : "bg-white text-[#37352f]"
    }`}>
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <div className={`flex items-center justify-between pb-6 border-b shrink-0 ${
          darkMode ? "border-[#2e2e2e]" : "border-[#e9e8e4]"
        }`}>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
              <span>📅 Calendar & Schedule</span>
            </h1>
            <p className="text-xs text-[#787671] dark:text-[#9c9a95] mt-1">
              Plan deadlines, meetings, and focus sessions on your interactive calendar.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentDate(new Date())}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                darkMode ? "bg-[#252525] hover:bg-[#303030] text-[#ebebeb]" : "bg-[#f1f0eb] hover:bg-[#e9e8e4] text-[#37352f]"
              }`}
            >
              Today
            </button>
            <div className="flex items-center space-x-1">
              <button
                onClick={handlePrevMonth}
                className={`p-1.5 rounded transition-colors ${
                  darkMode ? "hover:bg-[#252525] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#5d5b54]"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold w-32 text-center">
                {monthNames[month]} {year}
              </span>
              <button
                onClick={handleNextMonth}
                className={`p-1.5 rounded transition-colors ${
                  darkMode ? "hover:bg-[#252525] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#5d5b54]"
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar & Agenda Split Layout */}
        <div className="flex-1 grid grid-cols-3 gap-6 pt-6 overflow-hidden">
          {/* Calendar Grid (2 cols) */}
          <div className={`col-span-2 flex flex-col border rounded-xl overflow-hidden ${
            darkMode ? "border-[#2e2e2e] bg-[#1a1a1a]" : "border-[#e9e8e4] bg-[#fafaf9]"
          }`}>
            {/* Weekday headers */}
            <div className={`grid grid-cols-7 border-b text-[11px] font-semibold py-2 text-center ${
              darkMode ? "border-[#2e2e2e] bg-[#222222] text-[#9c9a95]" : "border-[#e9e8e4] bg-[#f7f6f3] text-[#787671]"
            }`}>
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Days Grid */}
            <div className={`grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y ${
              darkMode 
                ? "bg-[#181818] divide-[#262626]" 
                : "bg-white divide-[#f1f0eb]"
            }`}>
              {days.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className={`${darkMode ? "bg-[#151515]" : "bg-[#fafaf9]/40"} p-2`} />;
                }

                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = dateStr === selectedDateStr;
                const isToday =
                  new Date().toISOString().split("T")[0] === dateStr;
                const dayTasks = tasks.filter((t) => t.date === dateStr);

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`p-1.5 cursor-pointer flex flex-col justify-between transition-colors min-h-[70px] ${
                      isSelected
                        ? darkMode ? "bg-[#2d2645]/40 ring-1 ring-[#7b66ff]" : "bg-[#e6e0f5]/40 ring-1 ring-[#5645d4]"
                        : darkMode ? "hover:bg-[#202020]" : "hover:bg-[#f7f6f3]"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                          isToday
                            ? "bg-[#5645d4] text-white"
                            : isSelected
                            ? "text-[#5645d4] dark:text-[#7b66ff] font-bold"
                            : ""
                        }`}
                      >
                        {day}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-semibold text-[#787671] dark:text-[#9c9a95]">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5 mt-1 overflow-hidden">
                      {dayTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className={`text-[9px] px-1 py-0.5 rounded truncate font-medium border ${getCategoryColor(
                            t.category
                          )}`}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-[8px] text-[#a4a097] font-medium pl-1">
                          +{dayTasks.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agenda & Day Details Panel (1 col) */}
          <div className={`border rounded-xl p-5 flex flex-col overflow-y-auto ${
            darkMode ? "border-[#2e2e2e] bg-[#1f1f1f]" : "border-[#e9e8e4] bg-white"
          }`}>
            <div className={`border-b pb-3 mb-4 ${
              darkMode ? "border-[#2e2e2e]" : "border-[#e9e8e4]"
            }`}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#787671] dark:text-[#9c9a95]">
                Agenda for
              </span>
              <h2 className="text-base font-bold mt-0.5">
                {new Date(selectedDateStr + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </h2>
            </div>

            {/* Quick Add Form for this day */}
            <form onSubmit={handleCreateEvent} className="mb-4 space-y-2">
              <input
                type="text"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="New event or deadline..."
                className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none transition-colors ${
                  darkMode
                    ? "bg-[#171717] border-[#333333] text-white placeholder-[#666666] focus:border-[#7b66ff]"
                    : "bg-white border-[#e5e3df] text-[#1a1a1a] placeholder-[#a4a097] focus:border-[#5645d4]"
                }`}
              />
              <div className="flex space-x-2">
                <select
                  value={newEventCategory}
                  onChange={(e) => setNewEventCategory(e.target.value)}
                  className={`flex-1 px-2 py-1 text-xs rounded-lg border outline-none ${
                    darkMode
                      ? "bg-[#171717] border-[#333333] text-[#ebebeb]"
                      : "bg-white border-[#e5e3df] text-[#5d5b54]"
                  }`}
                >
                  <option value="work">Work</option>
                  <option value="study">Study</option>
                  <option value="meeting">Meeting</option>
                  <option value="personal">Personal</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#5645d4] hover:bg-[#4534b3] text-white text-xs font-semibold rounded-lg flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </form>

            {/* Events on selected day */}
            <div className="space-y-2 flex-1">
              {selectedDateTasks.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#a4a097]">
                  No items scheduled for this day.
                </div>
              ) : (
                selectedDateTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                      darkMode ? "bg-[#181818] border-[#2e2e2e]" : "bg-[#fafaf9] border-[#e9e8e4]"
                    }`}
                  >
                    <div>
                      <div className="font-medium flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5645d4]" />
                        <span>{task.title}</span>
                      </div>
                      <div className="text-[10px] text-[#787671] dark:text-[#9c9a95] mt-1 flex items-center space-x-2">
                        <span className="capitalize">{task.category}</span>
                        <span>•</span>
                        <span>{task.targetMinutes} mins</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
