// Prepara a logo antes do envio: corta margens vazias ou de cor solida, tira o fundo de cor solida (so o que
// encosta nas bordas -- o desenho por dentro nao e tocado) e limita o tamanho. Se qualquer passo falhar, envia o
// arquivo original, entao nunca impede o upload.
const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;
const WORK_MAX = 1600; // lado maior usado so na analise (evita travar com imagem gigante)
const TOLERANCE = 40;

function distance(d: Uint8ClampedArray, i: number, bg: number[]): number {
  return Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
}

export async function prepareLogoFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, WORK_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const px = (x: number, y: number) => (y * w + x) * 4;

    // Fundo: transparente, ou uma cor solida quando os 4 cantos sao (quase) iguais. Fora disso nao corta por cor.
    const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
    const transparentBg = corners.every((i) => d[i + 3] < 16);
    const bg = [d[corners[0]], d[corners[0] + 1], d[corners[0] + 2]];
    const solidBg = !transparentBg && corners.every((i) => d[i + 3] > 240 && distance(d, i, bg) <= TOLERANCE);
    const isBackground = (i: number): boolean => {
      if (transparentBg) return d[i + 3] < 16;
      if (solidBg) return d[i + 3] > 240 && distance(d, i, bg) <= TOLERANCE;
      return false;
    };

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (isBackground(px(x, y))) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return file; // tudo parece fundo: nao mexe

    if (solidBg) {
      const seen = new Uint8Array(w * h);
      const stack: number[] = [];
      const push = (x: number, y: number) => {
        const k = y * w + x;
        if (!seen[k] && isBackground(k * 4)) {
          seen[k] = 1;
          stack.push(k);
        }
      };
      for (let x = 0; x < w; x++) {
        push(x, 0);
        push(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        push(0, y);
        push(w - 1, y);
      }
      while (stack.length > 0) {
        const k = stack.pop() as number;
        d[k * 4 + 3] = 0;
        const x = k % w;
        const y = (k - x) / w;
        if (x > 0) push(x - 1, y);
        if (x < w - 1) push(x + 1, y);
        if (y > 0) push(x, y - 1);
        if (y < h - 1) push(x, y + 1);
      }
      ctx.putImageData(img, 0, 0);
    }

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const ratio = Math.min(1, MAX_WIDTH / cw, MAX_HEIGHT / ch);
    const ow = Math.max(1, Math.round(cw * ratio));
    const oh = Math.max(1, Math.round(ch * ratio));
    const out = document.createElement("canvas");
    out.width = ow;
    out.height = oh;
    const octx = out.getContext("2d");
    if (!octx) return file;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, ow, oh);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
    if (!blob) return file;
    return new File([blob], "logo.png", { type: "image/png" });
  } catch {
    return file;
  }
}
