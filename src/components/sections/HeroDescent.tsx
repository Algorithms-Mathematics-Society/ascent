"use client";

import { useEffect, useRef } from "react";
import { useHeroFlow } from "./HeroFlowContext";

/**
 * "Descent" — a live 3D optimization landscape behind the hero. A height-field
 * loss surface (global bowl + Gaussian peaks); a marker performs real gradient
 * descent down it into the minimum, trailing a fading path — the optimizer
 * converging, which is what the contest is. Warm at the peaks (high cost / slow)
 * → cool electric-blue in the valley (converged / fast). Camera orbits slowly
 * with cursor parallax, so it's a surface you perturb. When the visitor runs the
 * benchmark, the descent accelerates and the palette cools.
 *
 * Three.js is justified here because this is genuine 3D (camera, projection,
 * geometry). Kept disciplined: lazy-loaded (separate async chunk, no first-paint
 * cost), one low-poly mesh + one marker + a trail, DPR capped, RAF paused
 * offscreen / tab-hidden, disposed on unmount. Never loads on reduced-motion /
 * coarse-pointer (mobile) / no-WebGL — those keep the CSS HeroBackdrop.
 */

const DPR_CAP = 1.5;
const SEG = 80; // grid resolution (≈13k tris — cheap)
const DOMAIN = 2.8; // surface extends [-D, D] in x/z (bigger, fills more)
const MOUSE_TAU = 240;

// Loss landscape: a bowl (global minimum at origin) + a few Gaussian peaks.
const PEAKS: [number, number, number, number][] = [
  [-1.2, -0.8, 1.0, 0.6],
  [1.0, -1.4, 0.85, 0.5],
  [1.6, 1.0, 1.25, 0.72],
  [-1.6, 1.2, 0.95, 0.58],
  [0.2, 1.8, 0.7, 0.5],
];
function height(x: number, z: number): number {
  let h = 0.12 * (x * x + z * z);
  for (const [px, pz, amp, sig] of PEAKS) {
    const dx = x - px,
      dz = z - pz;
    h += amp * Math.exp(-(dx * dx + dz * dz) / (2 * sig * sig));
  }
  return h;
}
function grad(x: number, z: number): [number, number] {
  let gx = 0.24 * x,
    gz = 0.24 * z;
  for (const [px, pz, amp, sig] of PEAKS) {
    const dx = x - px,
      dz = z - pz;
    const g = amp * Math.exp(-(dx * dx + dz * dz) / (2 * sig * sig));
    gx += (g * -dx) / (sig * sig);
    gz += (g * -dz) / (sig * sig);
  }
  return [gx, gz];
}

const VERT = `
  varying float vH;
  varying float vDepth;
  void main(){
    vH = position.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;                 // view-space distance for depth fog
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = `
  precision highp float;
  varying float vH;
  varying float vDepth;
  uniform float uTime;
  uniform float uHeat;   // 1 = warm (unoptimised), 0 = cool (converged)
  void main(){
    float h = clamp(vH / 2.6, 0.0, 1.0);     // 0 valley → 1 peak
    // Blue family, desaturated + dark. NO hot magenta here — that colour is
    // reserved for performance reveals; ambient terrain stays quiet.
    vec3 deep    = vec3(0.09, 0.15, 0.26);   // dark steel-blue valley base
    vec3 blue    = vec3(0.28, 0.42, 0.66);   // muted electric blue
    vec3 warmDim = vec3(0.32, 0.27, 0.30);   // faint warm-grey (far / slow)
    vec3 valley = mix(deep, blue, 0.55);
    vec3 peak   = mix(blue, warmDim, uHeat); // faintly warm when slow, cool when converged
    vec3 base = mix(valley, peak, h);
    // subtle topographic contour lines
    float line = abs(fract(vH * 6.0 - uTime * 0.05) - 0.5);
    float glow = 1.0 - smoothstep(0.0, 0.06, line);
    vec3 col = base + glow * 0.3 * base;
    // depth fog: distant terrain dissolves into the dark
    float fog = smoothstep(9.0, 2.5, vDepth);
    // low, atmospheric intensity — felt at the edges, never competing with copy
    float alpha = (mix(0.07, 0.2, h) + glow * 0.1) * fog;
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function HeroDescent() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { phaseRef } = useHeroFlow();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    if (reduce || coarse) return;

    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        return; // fallback: CSS HeroBackdrop
      }
      if (cancelled || !canvasRef.current) return;

      try {
        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 100);

        // Build the height-field grid as an explicit BufferGeometry.
        const n = SEG + 1;
        const pos = new Float32Array(n * n * 3);
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const x = (i / SEG) * 2 * DOMAIN - DOMAIN;
            const z = (j / SEG) * 2 * DOMAIN - DOMAIN;
            const o = (j * n + i) * 3;
            pos[o] = x;
            pos[o + 1] = height(x, z);
            pos[o + 2] = z;
          }
        }
        const idx: number[] = [];
        for (let j = 0; j < SEG; j++) {
          for (let i = 0; i < SEG; i++) {
            const a = j * n + i,
              b = a + 1,
              c = a + n,
              d = c + 1;
            idx.push(a, c, b, b, c, d);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setIndex(idx);

        const uniforms = {
          uTime: { value: 0 },
          uHeat: { value: 1 },
        };
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms,
          transparent: true,
          depthWrite: false,
        });
        const surface = new THREE.Mesh(geo, mat);
        scene.add(surface);

        // Descent marker + fading trail.
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0xcfeaff }),
        );
        scene.add(marker);
        const TRAIL = 60;
        const trailPos = new Float32Array(TRAIL * 3);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute(
          "position",
          new THREE.BufferAttribute(trailPos, 3),
        );
        const trail = new THREE.Line(
          trailGeo,
          new THREE.LineBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.5,
          }),
        );
        scene.add(trail);

        let mx = -1.6,
          mz = 1.2; // start on a peak
        const resetMarker = () => {
          const a = Math.random() * Math.PI * 2;
          mx = Math.cos(a) * 1.9;
          mz = Math.sin(a) * 1.9;
          for (let k = 0; k < TRAIL; k++) {
            trailPos[k * 3] = mx;
            trailPos[k * 3 + 1] = height(mx, mz) + 0.05;
            trailPos[k * 3 + 2] = mz;
          }
        };
        resetMarker();

        const resize = () => {
          const w = canvas.clientWidth || 1;
          const h = canvas.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        resize();
        window.addEventListener("resize", resize, { passive: true });

        let tMx = 0,
          tMy = 0,
          cMx = 0,
          cMy = 0;
        const onPointer = (e: PointerEvent) => {
          tMx = (e.clientX / window.innerWidth) * 2 - 1;
          tMy = -((e.clientY / window.innerHeight) * 2 - 1);
        };
        window.addEventListener("pointermove", onPointer, { passive: true });

        const heatFor = (phase: string) =>
          phase === "opt" || phase === "done" ? 0 : phase === "rewrite" ? 0.5 : 1;
        const stepFor = (phase: string) =>
          phase === "opt" || phase === "done" ? 3.2 : phase === "naive" ? 1.6 : 1;

        let raf = 0,
          last = performance.now(),
          running = false,
          angle = 0;

        const frame = (now: number) => {
          const dt = Math.min(64, now - last) / 1000;
          last = now;
          const phase = phaseRef.current;

          // gradient descent step(s) on the real surface
          const steps = Math.max(1, Math.round(stepFor(phase)));
          for (let s = 0; s < steps; s++) {
            const [gx, gz] = grad(mx, mz);
            mx -= gx * 0.06;
            mz -= gz * 0.06;
            if (gx * gx + gz * gz < 1e-4 || mx * mx + mz * mz < 0.02)
              resetMarker();
          }
          const my = height(mx, mz) + 0.05;
          marker.position.set(mx, my, mz);
          // shift trail
          trailPos.copyWithin(3, 0, TRAIL * 3 - 3);
          trailPos[0] = mx;
          trailPos[1] = my;
          trailPos[2] = mz;
          trailGeo.attributes.position.needsUpdate = true;

          // camera orbit + cursor parallax — low, oblique angle reads as 3D
          angle += dt * 0.06;
          const km = 1 - Math.exp((-dt * 1000) / MOUSE_TAU);
          cMx += (tMx - cMx) * km;
          cMy += (tMy - cMy) * km;
          const az = angle + cMx * 0.45;
          const radius = 4.4;
          camera.position.set(
            Math.sin(az) * radius + 1.0, // biased right — terrain in negative space
            2.7 + cMy * 0.9, // higher: ridgelines sit lower in frame, off the headline
            Math.cos(az) * radius,
          );
          camera.lookAt(0.4, 0.45, 0);

          // ease heat toward phase target
          uniforms.uTime.value = now * 0.001;
          uniforms.uHeat.value +=
            (heatFor(phase) - uniforms.uHeat.value) * (1 - Math.exp(-dt / 0.4));

          renderer.render(scene, camera);
          raf = requestAnimationFrame(frame);
        };
        const start = () => {
          if (!running && !document.hidden) {
            running = true;
            last = performance.now();
            raf = requestAnimationFrame(frame);
          }
        };
        const stop = () => {
          running = false;
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
        };

        const io = new IntersectionObserver(
          ([e]) => (e.isIntersecting ? start() : stop()),
          { threshold: 0 },
        );
        io.observe(canvas);
        const onVis = () => (document.hidden ? stop() : start());
        document.addEventListener("visibilitychange", onVis);
        start();

        cleanup = () => {
          stop();
          io.disconnect();
          document.removeEventListener("visibilitychange", onVis);
          window.removeEventListener("resize", resize);
          window.removeEventListener("pointermove", onPointer);
          geo.dispose();
          mat.dispose();
          trailGeo.dispose();
          (trail.material as { dispose(): void }).dispose();
          marker.geometry.dispose();
          (marker.material as { dispose(): void }).dispose();
          renderer.dispose();
        };
      } catch {
        cleanup();
        cleanup = () => {};
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [phaseRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      style={{
        // Radial vignette: the landscape dissolves into the dark on every edge
        // (floats, not boxed) and stays off the left text column.
        maskImage:
          "radial-gradient(115% 130% at 66% 42%, black 32%, rgba(0,0,0,0.55) 62%, transparent 88%)",
        WebkitMaskImage:
          "radial-gradient(115% 130% at 66% 42%, black 32%, rgba(0,0,0,0.55) 62%, transparent 88%)",
      }}
    />
  );
}
