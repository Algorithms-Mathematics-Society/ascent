// src/components/sections/HeroBackdrop.tsx
/**
 * Ambient, decorative hero backdrop: a faint summit-topography contour (the
 * "ascent" / optimization-landscape motif) plus a soft electric glow and a
 * low hot ember. Purely presentational, no motion — the energy lives in the
 * focal speedup reveal, not the background.
 */
export default function HeroBackdrop() {
  const rings = Array.from({ length: 9 });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Electric glow behind the console */}
      <div
        className="absolute right-[-8%] top-[10%] h-[42rem] w-[42rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--ascent-accent) / 0.16), transparent)",
        }}
      />
      {/* Cool depth glow anchoring the lower half (keeps the void from reading flat) */}
      <div
        className="absolute bottom-[-18%] left-[8%] h-[34rem] w-[40rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--ascent-accent) / 0.07), transparent)",
        }}
      />
      {/* Summit topography — concentric contours around a peak */}
      <svg
        className="absolute right-0 top-0 h-full w-2/3 opacity-70"
        viewBox="0 0 600 600"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {rings.map((_, i) => (
          <ellipse
            key={i}
            cx={410}
            cy={205}
            rx={24 * (i + 1)}
            ry={15 * (i + 1)}
            transform="rotate(-18 410 205)"
            stroke="rgb(var(--ascent-accent))"
            strokeOpacity={Math.max(0.03, 0.26 - i * 0.027)}
            strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  );
}
