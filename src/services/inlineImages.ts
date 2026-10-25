export type NoteSegment =
  | { kind: "text"; start: number; end: number; text: string }
  | { kind: "image"; start: number; end: number; alt: string; src: string };

// Keep the existing Markdown representation so saved notes and backups remain compatible.
export function splitInlineImages(content: string): NoteSegment[] {
  const fences: [number, number][] = [];
  let offset = 0;
  let open: { marker: string; length: number; start: number } | undefined;
  for (const line of content.split("\n")) {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (!open) open = { marker: fence[1][0], length: fence[1].length, start: offset };
      else if (fence[1][0] === open.marker && fence[1].length >= open.length && !fence[2].trim()) {
        fences.push([open.start, offset + line.length]); open = undefined;
      }
    }
    offset += line.length + 1;
  }
  if (open) fences.push([open.start, content.length]);
  const blocks: NoteSegment[] = [];
  const images = /!\[([^\]\n]*)\]\((data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+)\)/gi;
  let cursor = 0;
  for (const match of content.matchAll(images)) {
    const start = match.index;
    if (fences.some(([a,b]) => start >= a && start < b)) continue;
    blocks.push({ kind: "text", start: cursor, end: start, text: content.slice(cursor, start) });
    cursor = start + match[0].length;
    blocks.push({ kind: "image", start, end: cursor, alt: match[1] || "Ink Sketch", src: match[2].replace(/\s/g, "") });
  }
  blocks.push({ kind: "text", start: cursor, end: content.length, text: content.slice(cursor) });
  return blocks;
}

export function insertInlineImage(content: string, position: number, src: string) {
  const at = Math.max(0, Math.min(position, content.length));
  const image = `\n\n![Ink Sketch](${src})\n\n`;
  return { content: content.slice(0, at) + image + content.slice(at), caret: at + image.length };
}

export function searchableNoteText(content: string): string {
  return content.replace(/!\[[^\]\n]*\]\(data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+\)/gi, " ");
}

export function findInkBounds(pixels: Uint8ClampedArray, width: number, height: number, background: readonly number[], padding: number) {
  let left = width, top = height, right = -1, bottom = -1;
  const hasBg = Boolean(background && background.length >= 3);
  const bg0 = hasBg ? background[0] : 0;
  const bg1 = hasBg ? background[1] : 0;
  const bg2 = hasBg ? background[2] : 0;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = rowOffset + (x << 2);
      if (pixels[i + 3] > 16) {
        if (
          hasBg &&
          Math.abs(pixels[i] - bg0) <= 16 &&
          Math.abs(pixels[i + 1] - bg1) <= 16 &&
          Math.abs(pixels[i + 2] - bg2) <= 16
        ) {
          continue;
        }
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (right < 0) return null;
  const x = Math.max(0, left - padding);
  const y = Math.max(0, top - padding);
  return {
    x,
    y,
    width: Math.min(width, right + padding + 1) - x,
    height: Math.min(height, bottom + padding + 1) - y,
  };
}
