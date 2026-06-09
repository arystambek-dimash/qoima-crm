import { cn, initials } from "@/lib/utils";

// Soft, friendly Notion-style avatar — picks a stable warm color from name
const PALETTE = [
  { bg: "var(--color-tag-brown-bg)", fg: "var(--color-tag-brown-fg)" },
  { bg: "var(--color-tag-orange-bg)", fg: "var(--color-tag-orange-fg)" },
  { bg: "var(--color-tag-yellow-bg)", fg: "var(--color-tag-yellow-fg)" },
  { bg: "var(--color-tag-green-bg)", fg: "var(--color-tag-green-fg)" },
  { bg: "var(--color-tag-blue-bg)", fg: "var(--color-tag-blue-fg)" },
  { bg: "var(--color-tag-purple-bg)", fg: "var(--color-tag-purple-fg)" },
  { bg: "var(--color-tag-pink-bg)", fg: "var(--color-tag-pink-fg)" },
];

function pickFor(name: string | null | undefined) {
  if (!name) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({
  name,
  className,
  size = 32,
}: {
  name?: string | null;
  className?: string;
  size?: number;
}) {
  const text = initials(name);
  const colors = pickFor(name);
  const fontSize = Math.round(size * 0.38);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: colors.bg,
        color: colors.fg,
        fontSize,
      }}
      className={cn(
        "flex items-center justify-center rounded-full font-medium select-none",
        className
      )}
    >
      {text}
    </div>
  );
}
