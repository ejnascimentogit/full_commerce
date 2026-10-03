// Prepara a logo antes do envio: corta as margens vazias (transparentes ou de cor solida), deixa uma pequena
// margem de respiro e limita o tamanho. O fundo da propria imagem e MANTIDO (nada vira transparente). Logo com
// fundo transparente e desenho escuro ganha fundo branco (senao some no cabecalho azul); desenho claro continua
// transparente. Se qualquer passo falhar, envia o arquivo original, entao nunca impede o upload.
const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;
const WORK_MAX = 1600; // lado maior usado so na analise (evita travar com imagem gigante)
const TOLERANCE = 40;
const PAD_RATIO = 0.06;
const DARK_LIMIT = 190; // luminosidade media (0-255) abaixo da qual o desenho conta como escuro

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
    const d = ctx.getImageData(0, 0, w, h).data;
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

    const pad = Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * PAD_RATIO);
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const cw = Math.min(w - 1, maxX + pad) - sx + 1;
    const ch = Math.min(h - 1, maxY + pad) - sy + 1;

    let flatten = false;
    if (transparentBg) {
      let sum = 0;
      let count = 0;
      for (let y = sy; y < sy + ch; y++) {
        for (let x = sx; x < sx + cw; x++) {
          const i = px(x, y);
          if (d[i + 3] > 128) {
            sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            count++;
          }
        }
      }
      flatten = count > 0 && sum / count < DARK_LIMIT;
    }

    const ratio = Math.min(1, MAX_WIDTH / cw, MAX_HEIGHT / ch);
    const ow = Math.max(1, Math.round(cw * ratio));
    const oh = Math.max(1, Math.round(ch * ratio));
    const out = document.createElement("canvas");
    out.width = ow;
    out.height = oh;
    const octx = out.getContext("2d");
    if (!octx) return file;
    if (flatten) {
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, ow, oh);
    }
    octx.imageSmoothingQuality = "high";
    octx.drawImage(canvas, sx, sy, cw, ch, 0, 0, ow, oh);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
    if (!blob) return file;
    return new File([blob], "logo.png", { type: "image/png" });
  } catch {
    return file;
  }
}
