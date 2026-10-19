import React, { useRef, useState } from "react";
import { 
  Sparkles, 
  CheckSquare, 
  Heading1, 
  Heading2, 
  List, 
  Quote, 
  Code, 
  Clock,
  PenTool,
  Columns,
  Eye,
  Edit3,
  Bot,
  Check
} from "lucide-react";
import { Page } from "../types";
import { InkDrawingModal } from "./InkDrawingModal";
import { InlineNoteEditor, type InlineNoteEditorHandle } from "./InlineNoteEditor";
import { insertInlineImage, splitInlineImages } from "../services/inlineImages";

interface PageEditorProps {
  page: Page | null;
  onUpdatePage: (updated: Page) => void;
  onStartTaskFromPage: (title: string) => void;
  onAskAIAboutPage: (prompt: string, context: string) => void;
  onToggleCopilot?: () => void;
  isCopilotOpen?: boolean;
  darkMode?: boolean;
}

const EMOJI_OPTIONS = ["📝", "🎯", "💡", "⚡", "🚀", "📅", "🔥", "🧠", "✨", "📌"];

export const PageEditor: React.FC<PageEditorProps> = ({
  page,
  onUpdatePage,
  onStartTaskFromPage,
  onAskAIAboutPage,
  onToggleCopilot,
  isCopilotOpen = false,
  darkMode = false,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isInkModalOpen, setIsInkModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">("edit");
  const editor = useRef<InlineNoteEditorHandle>(null);

  if (!page) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center ${
        darkMode ? "bg-[#181818] text-[#777777]" : "bg-white text-[#a4a097]"
      }`}>
        <p className="text-sm">Select or create a page from the sidebar to begin.</p>
      </div>
    );
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdatePage({
      ...page,
      title: e.target.value,
      updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const handleContentChange = (content: string) => {
    onUpdatePage({
      ...page,
      content,
      updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const insertText = (prefix: string, suffix: string = "") => {
    editor.current?.insertText(prefix, suffix);
  };

  const handleInsertDrawing = (dataUrl: string) => {
    if (editor.current) editor.current.insertImage(dataUrl);
    else handleContentChange(insertInlineImage(page.content, page.content.length, dataUrl).content);
    // The drawing is visible directly in the writing surface; no source pane is needed.
    setViewMode("edit");
  };

  const handleAIAction = (actionType: "summarize" | "tasks" | "improve") => {
    let prompt = "";
    if (actionType === "summarize") {
      prompt = "Summarize the key points and decisions in this document concisely.";
    } else if (actionType === "tasks") {
      prompt = "Extract an actionable to-do checklist from this document with estimated times for each task.";
    } else {
      prompt = "Refine the writing style of this note to be clearer, structured, and punchy.";
    }
    onAskAIAboutPage(prompt, page.content);
  };

  // Toggle checklist item in markdown text directly
  const toggleMarkdownCheckbox = (lineIndex: number) => {
    const lines = page.content.split("\n");
    if (lines[lineIndex] !== undefined) {
      const line = lines[lineIndex];
      if (line.includes("- [ ]")) {
        lines[lineIndex] = line.replace("- [ ]", "- [x]");
      } else if (line.includes("- [x]") || line.includes("- [X]")) {
        lines[lineIndex] = line.replace(/- \[[xX]\]/, "- [ ]");
      }
      onUpdatePage({
        ...page,
        content: lines.join("\n"),
        updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }
  };

  // Render interactive markdown preview
  const renderInteractiveMarkdown = () => {
    const rows = splitInlineImages(page.content).flatMap<{ line: string; sourceLine: number; image: { src: string; alt: string } | null }>(block => {
      if (block.kind === "image") return [{ line: "", sourceLine: 0, image: block }];
      const firstLine = page.content.slice(0, block.start).split("\n").length - 1;
      return block.text.split("\n").map((line, offset) => ({ line, sourceLine: firstLine + offset, image: null }));
    });
    return (
      <div className="space-y-2 text-sm leading-relaxed">
        {rows.map(({ line, sourceLine, image }, index) => {
          if (image) return <figure key={index} className="inline-sketch"><img src={image.src} alt={image.alt} /><figcaption>Sketch</figcaption></figure>;
          // Check for checklist items
          const isUnchecked = line.trim().startsWith("- [ ]");
          const isChecked = line.trim().startsWith("- [x]") || line.trim().startsWith("- [X]");

          if (isUnchecked || isChecked) {
            const taskText = line.replace(/^[ \t]*- \[[ xX]\][ \t]*/, "");
            return (
              <div 
                key={index} 
                className="flex items-center space-x-2 py-0.5 group cursor-pointer"
                onClick={() => toggleMarkdownCheckbox(sourceLine)}
              >
                <button
                  type="button"
                  className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                    isChecked 
                      ? "bg-[#5645d4] text-white" 
                      : darkMode 
                      ? "border border-[#555555] hover:border-[#7b66ff]" 
                      : "border border-[#bbb8b1] hover:border-[#5645d4]"
                  }`}
                >
                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
                <span className={`${
                  isChecked 
                    ? "line-through text-[#8f8d88] dark:text-[#777777]" 
                    : darkMode ? "text-[#ebebeb]" : "text-[#1a1a1a]"
                }`}>
                  {taskText}
                </span>
              </div>
            );
          }

          // Check for image/sketch
          const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
          if (imgMatch) {
            const [, alt, src] = imgMatch;
            return (
              <div key={index} className="my-4">
                <img
                  src={src}
                  alt={alt || "Drawing"}
                  className="max-w-full rounded-xl border border-black/10 dark:border-white/10 shadow-sm"
                />
                {alt && <div className="text-[11px] text-[#787671] mt-1 italic">{alt}</div>}
              </div>
            );
          }

          // Headings
          if (line.startsWith("# ")) {
            return (
              <h1 key={index} className="text-2xl font-bold tracking-tight mt-5 mb-2 text-[#1a1a1a] dark:text-white">
                {line.replace("# ", "")}
              </h1>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h2 key={index} className="text-lg font-semibold tracking-tight mt-4 mb-1.5 text-[#1a1a1a] dark:text-white">
                {line.replace("## ", "")}
              </h2>
            );
          }
          if (line.startsWith("### ")) {
            return (
              <h3 key={index} className="text-base font-semibold tracking-tight mt-3 mb-1 text-[#1a1a1a] dark:text-white">
                {line.replace("### ", "")}
              </h3>
            );
          }

          // Quotes
          if (line.startsWith("> ")) {
            return (
              <blockquote key={index} className="pl-3 border-l-2 border-[#5645d4] italic text-[#555555] dark:text-[#a0a0a0] my-2">
                {line.replace("> ", "")}
              </blockquote>
            );
          }

          // Bullet items
          if (line.trim().startsWith("- ")) {
            return (
              <div key={index} className="flex items-start space-x-2 pl-2">
                <span className="text-[#5645d4] select-none">•</span>
                <span>{line.replace(/^[ \t]*- /, "")}</span>
              </div>
            );
          }

          // Empty line
          if (!line.trim()) {
            return <div key={index} className="h-2" />;
          }

          // Standard paragraph
          return <p key={index} className="my-1">{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className={`flex-1 flex flex-col min-h-0 h-full overflow-hidden ${
      darkMode ? "bg-[#181818] text-[#ebebeb]" : "bg-white text-[#37352f]"
    }`}>
      {/* Top Bar / Toolbar */}
      <div className={`h-12 border-b px-5 flex items-center justify-between shrink-0 ${
        darkMode ? "border-[#2e2e2e] bg-[#202020]" : "border-[#e9e8e4] bg-white"
      }`}>
        <div className="flex items-center space-x-1 text-xs">
          {/* Markdown Quick formatting buttons */}
          <button
            onClick={() => insertText("# ")}
            className={`p-1.5 rounded transition-colors ${
              darkMode ? "hover:bg-[#2c2c2c] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#37352f]"
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertText("## ")}
            className={`p-1.5 rounded transition-colors ${
              darkMode ? "hover:bg-[#2c2c2c] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#37352f]"
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertText("- [ ] ")}
            className={`p-1.5 rounded transition-colors ${
              darkMode ? "hover:bg-[#2c2c2c] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#37352f]"
            }`}
            title="Interactive To-Do Checklist Item"
          >
            <CheckSquare className="w-4 h-4 text-[#5645d4]" />
          </button>
          <button
            onClick={() => insertText("- ")}
            className={`p-1.5 rounded transition-colors ${
              darkMode ? "hover:bg-[#2c2c2c] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#37352f]"
            }`}
            title="Bullet list"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertText("> ")}
            className={`p-1.5 rounded transition-colors ${
              darkMode ? "hover:bg-[#2c2c2c] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#37352f]"
            }`}
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertText("```\n", "\n```")}
            className={`p-1.5 rounded transition-colors ${
              darkMode ? "hover:bg-[#2c2c2c] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#37352f]"
            }`}
            title="Code block"
          >
            <Code className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-[#e9e8e4] dark:bg-[#333333] mx-1.5" />

          {/* Ink / Handwriting Drawing button */}
          <button
            onClick={() => setIsInkModalOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs bg-[#fef7d6] dark:bg-[#3c3417] text-[#793400] dark:text-[#f5d75e] rounded-md font-semibold hover:opacity-90 transition-opacity"
            title="Open Ink & Freehand Sketching Board"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Draw / Ink</span>
          </button>

          <div className="h-4 w-px bg-[#e9e8e4] dark:bg-[#333333] mx-1.5" />

          {/* AI Quick actions */}
          <button
            onClick={() => handleAIAction("summarize")}
            className="flex items-center space-x-1 px-2 py-1 text-xs bg-[#e6e0f5] dark:bg-[#2d2645] text-[#5645d4] dark:text-[#7b66ff] rounded hover:opacity-90 transition-opacity font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Summarize</span>
          </button>
          <button
            onClick={() => handleAIAction("tasks")}
            className="flex items-center space-x-1 px-2 py-1 text-xs bg-[#d9f3e1] dark:bg-[#173822] text-emerald-800 dark:text-emerald-400 rounded hover:opacity-90 transition-opacity font-medium"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>AI Extract Tasks</span>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-2 text-xs">
          {/* View mode segmented switcher */}
          <div className={`flex items-center rounded-lg p-0.5 border ${
            darkMode ? "border-[#333333] bg-[#1a1a1a]" : "border-[#e5e3df] bg-[#f7f6f3]"
          }`}>
            <button
              onClick={() => setViewMode("edit")}
              className={`p-1 rounded flex items-center space-x-1 ${
                viewMode === "edit"
                  ? "bg-white dark:bg-[#2a2a2a] text-[#1a1a1a] dark:text-white shadow-xs font-medium"
                  : "text-[#787671]"
              }`}
              title="Edit mode"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Edit</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`p-1 rounded flex items-center space-x-1 ${
                viewMode === "split"
                  ? "bg-white dark:bg-[#2a2a2a] text-[#1a1a1a] dark:text-white shadow-xs font-medium"
                  : "text-[#787671]"
              }`}
              title="Split View (Editor + Interactive Checklist & Drawings)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Split</span>
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`p-1 rounded flex items-center space-x-1 ${
                viewMode === "preview"
                  ? "bg-white dark:bg-[#2a2a2a] text-[#1a1a1a] dark:text-white shadow-xs font-medium"
                  : "text-[#787671]"
              }`}
              title="Interactive Preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Preview</span>
            </button>
          </div>

          {/* Side-by-Side Copilot Toggle */}
          {onToggleCopilot && (
            <button
              onClick={onToggleCopilot}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                isCopilotOpen
                  ? "bg-[#5645d4] text-white border-[#5645d4]"
                  : darkMode
                  ? "bg-[#252525] border-[#383838] text-[#ebebeb] hover:bg-[#2e2e2e]"
                  : "bg-[#f1f0eb] border-[#e5e3df] text-[#37352f] hover:bg-[#e9e8e4]"
              }`}
              title="Toggle Side-by-Side AI Copilot"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isCopilotOpen ? "Close Copilot" : "Side Copilot"}</span>
            </button>
          )}

          {/* Start focus timer for this note */}
          <button
            onClick={() => onStartTaskFromPage(page.title || "Untitled Task")}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#ffe8d4] dark:bg-[#3b281d] text-[#dd5b00] dark:text-[#ff9248] rounded hover:opacity-90 transition-opacity font-medium"
            title="Track focus time on this page"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Focus Timer</span>
          </button>
        </div>
      </div>

      {/* Editor Main Content Area */}
      <div className="flex-1 overflow-y-auto px-10 py-8 max-w-5xl mx-auto w-full">
        {/* Icon & Title Header */}
        <div className="relative mb-6">
          <div className="relative inline-block mb-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`text-4xl p-1.5 rounded-lg transition-colors ${
                darkMode ? "hover:bg-[#252525]" : "hover:bg-[#f7f6f3]"
              }`}
              title="Change icon"
            >
              {page.icon}
            </button>
            {showEmojiPicker && (
              <div className={`absolute top-12 left-0 border rounded-lg shadow-xl p-2 flex space-x-1 z-20 ${
                darkMode ? "bg-[#222222] border-[#333333]" : "bg-white border-[#e9e8e4]"
              }`}>
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      onUpdatePage({ ...page, icon: e });
                      setShowEmojiPicker(false);
                    }}
                    className={`text-xl p-1 rounded ${
                      darkMode ? "hover:bg-[#333333]" : "hover:bg-[#f1f0eb]"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            value={page.title}
            onChange={handleTitleChange}
            placeholder="Untitled Note"
            className={`w-full text-3xl font-bold tracking-tight border-none outline-none bg-transparent ${
              darkMode ? "text-white placeholder-[#666666]" : "text-[#1a1a1a] placeholder-[#a4a097]"
            }`}
          />
        </div>

        {/* View Mode Content */}
        {viewMode === "edit" && (
          <InlineNoteEditor
            key={page.id}
            ref={editor}
            value={page.content}
            onChange={handleContentChange}
          />
        )}

        {viewMode === "split" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[calc(100vh-270px)]">
            <InlineNoteEditor
              key={page.id}
              ref={editor}
              value={page.content}
              onChange={handleContentChange}
            />
            <div className={`w-full h-full overflow-y-auto p-4 rounded-xl border ${
              darkMode ? "bg-[#1f1f1f] border-[#2e2e2e]" : "bg-white border-[#e9e8e4]"
            }`}>
              <div className="text-[11px] font-semibold text-[#787671] mb-2 uppercase tracking-wider flex items-center justify-between">
                <span>Interactive Preview & Checklists</span>
                <span className="text-[10px] text-[#5645d4]">Click items to check off</span>
              </div>
              {renderInteractiveMarkdown()}
            </div>
          </div>
        )}

        {viewMode === "preview" && (
          <div className={`p-6 rounded-2xl border min-h-[calc(100vh-270px)] ${
            darkMode ? "bg-[#1c1c1c] border-[#2e2e2e]" : "bg-white border-[#e9e8e4]"
          }`}>
            <div className="text-[11px] font-semibold text-[#787671] mb-3 uppercase tracking-wider flex items-center justify-between">
              <span>Interactive Document View</span>
              <span className="text-[10px] text-[#5645d4]">Checkboxes are interactive</span>
            </div>
            {renderInteractiveMarkdown()}
          </div>
        )}
      </div>

      {/* Ink Drawing Modal */}
      <InkDrawingModal
        isOpen={isInkModalOpen}
        onClose={() => setIsInkModalOpen(false)}
        onInsertDrawing={handleInsertDrawing}
        darkMode={darkMode}
      />
    </div>
  );
};
