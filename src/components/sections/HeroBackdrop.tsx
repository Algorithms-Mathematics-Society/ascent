// src/components/sections/HeroBackdrop.tsx
/**
 * Ambient hero backdrop: a faint memory / cache-line grid — C++'s manual-memory
 * model rendered as cells. Contiguous lit runs read as cache lines loaded
 * sequentially (the row-major "cache hit"); scattered lit cells read as strided
 * misses — the same story the benchmark card tells. A pointer arrow crosses the
 * grid (indirection) and one faint address grounds it as memory. Blue family,
 * low contrast, edge-masked so it floats. Subordinate by design (the real
 * motion is the flow field + benchmark), and the static fallback when WebGL is
 * off.
 */

const COLS = 14;
const ROWS = 9;
const CELL = 20;
const GAP = 5;
const STEP = CELL + GAP;
const TOP = 18; // leave room for the address label
const GRID_W = COLS * STEP - GAP;

// Lit cells: contiguous runs = cache lines (hits); scattered singles = misses.
const cellLit = (r: number, c: number): "hit" | "miss" | null => {
  if (r === 2 && c >= 1 && c <= 9) return "hit";
  if (r === 5 && c >= 4 && c <= 11) return "hit";
  if ((r === 7 && c === 2) || (r === 7 && c === 6) || (r === 7 && c === 11))
    return "miss";
  return null;
};

const center = (c: number, r: number) => ({
  x: c * STEP + CELL / 2,
  y: TOP + r * STEP + CELL / 2,
});

export default function HeroBackdrop() {
  const a = center(11, 0); // pointer source
  const b = center(4, 5); // → into the second cache line
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Electric glow */}
      <div
        className="absolute right-[-8%] top-[10%] h-[42rem] w-[42rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--ascent-accent) / 0.16), transparent)",
        }}
      />
      {/* Cool depth glow anchoring the lower half */}
      <div
        className="absolute bottom-[-18%] left-[8%] h-[34rem] w-[40rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--ascent-accent) / 0.07), transparent)",
        }}
      />
      {/* Memory / cache-line grid */}
      <div
        className="absolute right-[3%] top-[15%] w-[30rem] max-w-[46%]"
        style={{
          maskImage:
            "radial-gradient(120% 120% at 70% 35%, black 40%, transparent 88%)",
          WebkitMaskImage:
            "radial-gradient(120% 120% at 70% 35%, black 40%, transparent 88%)",
        }}
      >
        <svg
          viewBox={`0 0 ${GRID_W} ${TOP + ROWS * STEP}`}
          fill="none"
          className="h-full w-full"
        >
          <defs>
            <marker
              id="ptr"
              markerWidth="6"
              markerHeight="6"
              refX="4"
              refY="3"
              orient="auto"
            >
              <path
                d="M0 0 L5 3 L0 6 z"
                fill="rgb(var(--ascent-accent))"
                fillOpacity={0.4}
              />
            </marker>
          </defs>

          {/* faint address label — grounds it as memory */}
          <text
            x={0}
            y={11}
            fontFamily="var(--font-jetbrains), monospace"
            fontSize={9}
            fill="rgb(var(--ascent-accent))"
            fillOpacity={0.22}
            letterSpacing="1"
          >
            0x7ffe1a3c
          </text>

          {/* cells */}
          {Array.from({ length: ROWS }).map((_, r) =>
            Array.from({ length: COLS }).map((__, c) => {
              const lit = cellLit(r, c);
              return (
                <rect
                  key={`${r}-${c}`}
                  x={c * STEP}
                  y={TOP + r * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  stroke="rgb(var(--ascent-accent))"
                  strokeOpacity={0.1}
                  strokeWidth={1}
                  fill={
                    lit === "hit"
                      ? "rgb(var(--ascent-cyan))"
                      : lit === "miss"
                        ? "rgb(var(--ascent-accent))"
                        : "none"
                  }
                  fillOpacity={lit === "hit" ? 0.16 : lit === "miss" ? 0.12 : 0}
                />
              );
            }),
          )}

          {/* pointer (indirection) */}
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="rgb(var(--ascent-accent))"
            strokeOpacity={0.3}
            strokeWidth={1}
            markerEnd="url(#ptr)"
          />
        </svg>
      </div>
    </div>
  );
}
