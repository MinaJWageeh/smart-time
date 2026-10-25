import React, { useRef, useState, useEffect } from "react";
import { 
  X, 
  PenTool, 
  Eraser, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Download, 
  Check,
  Highlighter
} from "lucide-react";
import { findInkBounds } from "../services/inlineImages";

interface InkDrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertDrawing: (dataUrl: string) => void;
  darkMode?: boolean;
}

const PALETTE = [
  { name: "Default", color: "#1a1a1a", darkColor: "#f3f3f3" },
  { name: "Notion Purple", color: "#5645d4", darkColor: "#7b66ff" },
  { name: "Blue", color: "#0075de", darkColor: "#3894f0" },
  { name: "Green", color: "#1aae39", darkColor: "#2ecc71" },
  { name: "Red", color: "#e03131", darkColor: "#ff5252" },
  { name: "Orange", color: "#dd5b00", darkColor: "#ff7b25" },
  { name: "Yellow Highlighter", color: "#f5d75e", darkColor: "#f5d75e" },
];

const MAX_HISTORY_STEPS = 8;
const STROKE_SIZES = [
  { label: "Fine", size: 2 },
  { label: "Medium", size: 5 },
  { label: "Bold", size: 10 },
  { label: "Marker", size: 20 },
];

export const InkDrawingModal: React.FC<InkDrawingModalProps> = ({
  isOpen,
  onClose,
  onInsertDrawing,
  darkMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser">("pen");
  const [selectedColor, setSelectedColor] = useState(darkMode ? "#f3f3f3" : "#1a1a1a");
  const [strokeSize, setStrokeSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [insertError, setInsertError] = useState("");

  // Undo / Redo history
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Update default ink color when dark mode changes
  useEffect(() => {
    if (tool !== "eraser") {
      setSelectedColor(darkMode ? "#f3f3f3" : "#1a1a1a");
    }
  }, [darkMode]);

  // Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y, Esc)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        onClose();
      } else if (isCmdOrCtrl && (e.key === "z" || e.key === "Z")) {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
      } else if (isCmdOrCtrl && (e.key === "y" || e.key === "Y")) {
        handleRedo();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, historyIndex, history]);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen) return;
    setInsertError("");

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Save initial snapshot
        const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initial]);
        setHistoryIndex(0);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, darkMode]);

  if (!isOpen) return null;

  const saveHistorySnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const updated = [...history.slice(0, historyIndex + 1), imgData].slice(-MAX_HISTORY_STEPS);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setInsertError("");
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = strokeSize * 3;
    } else if (tool === "highlighter") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = `${selectedColor}55`; // ~33% opacity
      ctx.lineWidth = strokeSize * 3.5;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = strokeSize;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
    saveHistorySnapshot();
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveHistorySnapshot();
  };

  const drawingImage = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bounds = findInkBounds(pixels.data, canvas.width, canvas.height, [0, 0, 0], Math.round(24 * Math.min(window.devicePixelRatio || 1, 1.5)));
    if (!bounds) { setInsertError("Draw something before inserting or downloading your sketch."); return null; }
    const cropped = document.createElement("canvas");
    cropped.width = bounds.width; cropped.height = bounds.height;
    cropped.getContext("2d")?.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    return cropped.toDataURL("image/png");
  };
  const handleInsert = () => {
    const image = drawingImage();
    if (!image) return;
    onInsertDrawing(image);
    onClose();
  };

  const handleDownload = () => {
    const dataUrl = drawingImage();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `smart-time-drawing-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className={`w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${
        darkMode ? "bg-[#181818] border-[#2e2e2e] text-[#ebebeb]" : "bg-white border-[#e9e8e4] text-[#37352f]"
      }`}>
        {insertError && <p role="alert" className="px-5 py-3 text-sm bg-amber-100 text-amber-900">{insertError}</p>}
        {/* Header toolbar */}
        <div className={`px-5 py-3 border-b flex items-center justify-between shrink-0 ${
          darkMode ? "border-[#2e2e2e] bg-[#202020]" : "border-[#e9e8e4] bg-[#fafaf9]"
        }`}>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-[#5645d4] text-white">
                <PenTool className="w-4 h-4" />
              </span>
              <span className="font-semibold text-sm">Ink & Freehand Drawing Board</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-colors border ${
                darkMode ? "border-[#383838] hover:bg-[#2c2c2c]" : "border-[#e5e3df] hover:bg-[#f1f0eb]"
              }`}
              title="Download as PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PNG</span>
            </button>
            <button
              onClick={handleInsert}
              className="px-4 py-1.5 bg-[#5645d4] hover:bg-[#4534b3] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Insert into Note</span>
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                darkMode ? "hover:bg-[#2c2c2c] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#787671]"
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Secondary Tools Bar */}
        <div className={`px-5 py-2.5 border-b flex items-center justify-between text-xs flex-wrap gap-2 ${
          darkMode ? "border-[#2e2e2e] bg-[#1a1a1a]" : "border-[#e9e8e4] bg-white"
        }`}>
          {/* Tool switchers */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setTool("pen")}
              className={`px-2.5 py-1.5 rounded-md flex items-center space-x-1 font-medium transition-colors ${
                tool === "pen"
                  ? "bg-[#5645d4] text-white"
                  : darkMode ? "hover:bg-[#262626] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#787671]"
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Pen</span>
            </button>

            <button
              onClick={() => setTool("highlighter")}
              className={`px-2.5 py-1.5 rounded-md flex items-center space-x-1 font-medium transition-colors ${
                tool === "highlighter"
                  ? "bg-[#f5d75e] text-[#1a1a1a]"
                  : darkMode ? "hover:bg-[#262626] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#787671]"
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>Highlighter</span>
            </button>

            <button
              onClick={() => setTool("eraser")}
              className={`px-2.5 py-1.5 rounded-md flex items-center space-x-1 font-medium transition-colors ${
                tool === "eraser"
                  ? "bg-rose-500 text-white"
                  : darkMode ? "hover:bg-[#262626] text-[#a4a097]" : "hover:bg-[#f1f0eb] text-[#787671]"
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Eraser</span>
            </button>
          </div>

          {/* Stroke size selector */}
          <div className="flex items-center space-x-1 border-x px-3 border-[#e5e3df] dark:border-[#2e2e2e]">
            <span className="text-[11px] text-[#787671] mr-1">Size:</span>
            {STROKE_SIZES.map((s) => (
              <button
                key={s.size}
                onClick={() => setStrokeSize(s.size)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  strokeSize === s.size
                    ? "bg-[#e9e8e4] dark:bg-[#333333] text-[#1a1a1a] dark:text-white"
                    : "text-[#787671] hover:bg-[#f1f0eb] dark:hover:bg-[#262626]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Color palette */}
          <div className="flex items-center space-x-1.5">
            {PALETTE.map((p) => {
              const color = darkMode ? p.darkColor : p.color;
              const isSelected = selectedColor === color && tool !== "eraser";
              return (
                <button
                  key={p.name}
                  onClick={() => {
                    setSelectedColor(color);
                    if (tool === "eraser") setTool("pen");
                  }}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    isSelected ? "ring-2 ring-offset-2 ring-[#5645d4] scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  title={p.name}
                />
              );
            })}
          </div>

          {/* Undo / Redo / Clear */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className={`p-1.5 rounded transition-colors ${
                historyIndex > 0
                  ? "hover:bg-[#f1f0eb] dark:hover:bg-[#262626] text-[#37352f] dark:text-[#ebebeb]"
                  : "text-[#bbb8b1] dark:text-[#555555] cursor-not-allowed"
              }`}
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className={`p-1.5 rounded transition-colors ${
                historyIndex < history.length - 1
                  ? "hover:bg-[#f1f0eb] dark:hover:bg-[#262626] text-[#37352f] dark:text-[#ebebeb]"
                  : "text-[#bbb8b1] dark:text-[#555555] cursor-not-allowed"
              }`}
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-colors ml-1"
              title="Clear Canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawing canvas area */}
        <div className="flex-1 relative overflow-hidden bg-dot-pattern flex items-center justify-center p-2">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full h-full rounded-xl cursor-crosshair touch-none shadow-inner"
          />
        </div>
      </div>
    </div>
  );
};
