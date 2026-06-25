// src/components/sections/HeroBackdrop.tsx
/**
 * Ambient hero backdrop: a logarithmic spiral converging to a point — an
 * optimization path spiralling into the minimum — over faint topographic rings,
 * with a soft convergence glow. Edge-masked so it floats (no corner clipping)
 * and slowly rotating so it feels alive. Subordinate by design; the real motion
 * is the flow field + the benchmark. Also the static fallback when WebGL is off.
 */

// Build a logarithmic spiral path (r = a·e^{bθ}) centered in the 600×600 box.
function spiralPath(): string {
  const cx = 300;
  const cy = 300;
  const a = 2.4;
  const b = 0.205;
  const turns = 3.6;
  const steps = 320;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * turns * 2 * Math.PI;
    const r = a * Math.exp(b * th);
    const x = cx + r * Math.cos(th);
    const y = cy + r * Math.sin(th);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
}

export default function HeroBackdrop() {
  const d = spiralPath();
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
      {/* Optimization spiral — converges to the minimum */}
      <div
        className="absolute right-[1%] top-[12%] h-[40rem] w-[40rem]"
        style={{
          maskImage:
            "radial-gradient(circle at center, black 34%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(circle at center, black 34%, transparent 78%)",
        }}
      >
        {/* convergence glow at the center (the minimum) */}
        <div
          className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(closest-side, rgb(var(--ascent-accent) / 0.2), transparent)",
          }}
        />
        <svg
          viewBox="0 0 600 600"
          fill="none"
          className="ascent-spin h-full w-full"
          style={{ transformOrigin: "center" }}
        >
          {/* faint topographic rings (rotation-invariant) */}
          {[70, 130, 195, 255].map((r, i) => (
            <circle
              key={r}
              cx={300}
              cy={300}
              r={r}
              stroke="rgb(var(--ascent-accent))"
              strokeOpacity={Math.max(0.03, 0.15 - i * 0.03)}
              strokeWidth={1}
            />
          ))}
          {/* converging spiral */}
          <path
            d={d}
            stroke="rgb(var(--ascent-accent))"
            strokeOpacity={0.42}
            strokeWidth={1.1}
          />
          {/* the minimum */}
          <circle cx={300} cy={300} r={3} fill="rgb(var(--ascent-cyan))" />
        </svg>
      </div>
    </div>
  );
}
