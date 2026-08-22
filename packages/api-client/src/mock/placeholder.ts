// Local, network-free product image placeholder — keeps mock mode fully offline.
const PALETTE = ["#2563EB", "#0EA5E9", "#16A34A", "#D97706", "#DB2777", "#7C3AED"];

export function placeholderPhoto(seed: string, label: string): string {
  const hash = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const color = PALETTE[hash % PALETTE.length];
  const initials = label
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <rect width="400" height="400" fill="${color}"/>
    <text x="50%" y="50%" font-family="sans-serif" font-size="120" fill="white" fill-opacity="0.9" text-anchor="middle" dominant-baseline="central">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
