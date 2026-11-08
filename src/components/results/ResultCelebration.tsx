"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** A finite burst; no library, React animation loop, sound, or ongoing work. */
export default function ResultCelebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const canvas = canvasRef.current;
    if (motion.matches || document.hidden || !canvas) { setFinished(true); return; }
    const context = canvas.getContext("2d");
    if (!context) { setFinished(true); return; }

    const width = window.innerWidth, height = window.innerHeight;
    // Bound the backing buffer to about 12 MB even on large high-DPI screens.
    const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3_000_000 / (width * height)));
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);
    const colors = ["#e7c671", "#f4e3b6", "#72b6cc", "#ffffff", "#b59043"];
    const count = width < 600 ? 80 : 120;
    const particles = Array.from({ length: count }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      const spread = (i * 0.61803398875) % 1;
      return {
        x: side === -1 ? width * .05 : width * .95, y: height * .72,
        vx: -side * (180 + spread * Math.min(width * .65, 700)),
        vy: -(440 + ((i * 41) % 330)), rotation: i * .7,
        spin: (i % 2 ? 1 : -1) * (3 + spread * 8), size: 4 + i % 5,
        color: colors[i % colors.length], ribbon: i % 4 === 0,
      };
    });
    let frame = 0, start = 0, last = 0, stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", motionChanged);
      window.removeEventListener("resize", stop);
      context.clearRect(0, 0, width, height);
      setFinished(true);
    };
    const visibility = () => { if (document.hidden) stop(); };
    const motionChanged = () => { if (motion.matches) stop(); };
    function draw(now: number) {
      if (stopped) return;
      if (!start) { start = now; last = now; }
      const elapsed = now - start;
      if (elapsed > 2600) { stop(); return; }
      const dt = Math.min((now - last) / 1000, .032);
      last = now;
      context!.clearRect(0, 0, width, height);
      context!.globalAlpha = Math.min(1, (2600 - elapsed) / 650);
      for (const particle of particles) {
        particle.vy += 780 * dt;
        particle.vx *= Math.exp(-.7 * dt);
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.rotation += particle.spin * dt;
        context!.save();
        context!.translate(particle.x, particle.y);
        context!.rotate(particle.rotation);
        context!.fillStyle = particle.color;
        context!.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.ribbon ? particle.size * 2.5 : particle.size * .65);
        context!.restore();
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", motionChanged);
    window.addEventListener("resize", stop, { once: true });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", motionChanged);
      window.removeEventListener("resize", stop);
    };
  }, []);

  if (finished || typeof document === "undefined") return null;
  return createPortal(<canvas ref={canvasRef} data-result-celebration aria-hidden="true"
    style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 60 }} />, document.body);
}
