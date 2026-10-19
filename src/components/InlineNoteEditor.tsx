import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { Download, Trash2 } from "lucide-react";
import { insertInlineImage, splitInlineImages } from "../services/inlineImages";
import "./inline-note.css";

export interface InlineNoteEditorHandle {
  insertText: (prefix: string, suffix: string) => void;
  insertImage: (src: string) => void;
}
export const InlineNoteEditor = forwardRef<InlineNoteEditorHandle, { value: string; onChange: (value: string) => void }>(function InlineNoteEditor({ value, onChange }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const blocks = useMemo(() => splitInlineImages(value), [value]);
  const hasImages = blocks.some(b => b.kind === "image");
  useLayoutEffect(() => {
    const fields = root.current?.querySelectorAll<HTMLTextAreaElement>("textarea");
    fields?.forEach(field => { field.style.height = "0px"; field.style.height = `${Math.max(field.scrollHeight, hasImages ? 44 : 280)}px`; });
    const caret = pendingCaret.current;
    if (caret == null) return;
    for (const field of fields ?? []) {
      const start = Number(field.dataset.start), end = start + field.value.length;
      if (caret >= start && caret <= end) {
        field.focus(); field.setSelectionRange(caret - start, caret - start);
        selection.current = { start: caret, end: caret }; break;
      }
    }
    pendingCaret.current = null;
  }, [value, hasImages]);
  useImperativeHandle(ref, () => ({
    insertText(prefix, suffix) {
      const { start, end } = selection.current ?? { start: value.length, end: value.length };
      const replacement = `${prefix}${value.slice(start, end) || "text"}${suffix}`;
      pendingCaret.current = start + replacement.length - suffix.length;
      onChange(value.slice(0, start) + replacement + value.slice(end));
    },
    insertImage(src) {
      const result = insertInlineImage(value, selection.current?.start ?? value.length, src);
      pendingCaret.current = result.caret; onChange(result.content);
    },
  }), [value, onChange]);
  let textIndex = 0, imageIndex = 0;
  return <div ref={root} className={`inline-note-editor ${hasImages ? "has-images" : ""}`} aria-label="Note editor">
    {blocks.map((block, index) => {
      if (block.kind === "text") {
        const number = ++textIndex;
        return <textarea key={`text-${index}`} data-start={block.start} aria-label={number === 1 ? "Note text" : `Note text ${number}`} value={block.text} dir="auto"
          placeholder={hasImages ? (number === blocks.filter(b => b.kind === "text").length ? "Continue writing…" : "Write here…") : "Write your notes… Use Draw / Ink to add a sketch."}
          onSelect={e => { selection.current = { start: block.start + e.currentTarget.selectionStart, end: block.start + e.currentTarget.selectionEnd }; }}
          onChange={e => {
            selection.current = { start: block.start + e.currentTarget.selectionStart, end: block.start + e.currentTarget.selectionEnd };
            onChange(value.slice(0, block.start) + e.target.value + value.slice(block.end));
          }} />;
      }
      const number = ++imageIndex;
      return <figure key={`image-${index}`} className="inline-sketch">
        <img src={block.src} alt={block.alt} draggable={false} />
        <figcaption><span>Sketch</span><div className="inline-sketch-actions"><a href={block.src} download={`sketch-${number}.png`} aria-label={`Download sketch ${number}`} title="Download sketch"><Download size={15} /></a><button type="button" aria-label={`Remove sketch ${number}`} title="Remove sketch" onClick={() => { pendingCaret.current = block.start; onChange(value.slice(0, block.start) + value.slice(block.end)); }}><Trash2 size={15} /></button></div></figcaption>
      </figure>;
    })}
  </div>;
});
