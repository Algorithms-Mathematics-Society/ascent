// src/components/sections/HeroBackdrop.tsx
/**
 * Ambient hero backdrop: soft electric glows only — quiet depth behind the
 * content, no figurative motif (the flow field carries the motion). Also the
 * static fallback when WebGL is off. Restraint over decoration.
 */
export default function HeroBackdrop() {
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
            "radial-gradient(closest-side, rgb(var(--ascent-accent) / 0.14), transparent)",
        }}
      />
      {/* Cool depth glow anchoring the lower half */}
      <div
        className="absolute bottom-[-18%] left-[8%] h-[34rem] w-[40rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--ascent-accent) / 0.06), transparent)",
        }}
      />
    </div>
  );
}
