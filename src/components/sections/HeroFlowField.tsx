"use client";

import { useEffect, useRef } from "react";
import { useHeroFlow, type FlowPhase } from "./HeroFlowContext";

/**
 * Raw-WebGL hero field — one fragment shader carrying three coherent layers:
 *  - flow streaks (data/latency) that rip faster + cooler when the benchmark runs;
 *  - a loss-landscape contour with a marker descending/spiralling to the minimum
 *    (the algorithm converging — literally the contest), warm at the rim, cool
 *    at the center;
 *  - cursor parallax across the whole field, so it reads as a surface you're
 *    perturbing, not a background image.
 *
 * One full-screen triangle, 1 draw call/frame, GPU-driven. DPR capped; RAF
 * paused offscreen + tab-hidden; resolution steps down if slow; never inits on
 * reduced-motion / no-WebGL / coarse-pointer (mobile) — those keep the CSS
 * HeroBackdrop. Zero dependencies.
 */

/* ---- Tuning (adjust by eye in dev) ---------------------------------- */
const DPR_CAP = 1.5;
const EASE_TAU = 360; // ms — speed/heat ramp smoothness
const MOUSE_TAU = 220; // ms — cursor follow smoothness
const SLOW_MS = 24;
const MIN_RENDER_SCALE = 0.6;
const U_DENSITY = 62.0; // streak count (y-frequency)
const U_CONTRAST = 2.2; // filament sharpness (lower = fuller/brighter)
const U_INTENSITY = 0.62; // peak streak alpha when fast

function targets(phase: FlowPhase): [number, number] {
  switch (phase) {
    case "naive":
      return [0.12, 0.9];
    case "rewrite":
      return [0.3, 0.5];
    case "opt":
      return [0.85, 0.15];
    case "done":
      return [0.7, 0.05];
    default:
      return [0.2, 0.2]; // idle: gentle, visible drift
  }
}

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uSpeed;
uniform float uHeat;
uniform vec2 uMouse;
uniform float uDensity;
uniform float uContrast;
uniform float uIntensity;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.0; a *= 0.5; }
  return s;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 par = uMouse * 0.035;           // cursor parallax (subtle)
  vec2 uvp = uv + par;
  vec2 p = vec2(uvp.x * aspect, uvp.y);

  float t = uTime * mix(0.06, 0.55, uSpeed);

  vec3 blue = vec3(0.376, 0.647, 0.980);
  vec3 cyan = vec3(0.133, 0.827, 0.933);
  vec3 hot  = vec3(1.0, 0.239, 0.443);

  // subordination: thinner (not absent) behind the left text column, top-biased
  float leftFade = mix(0.28, 1.0, smoothstep(0.0, 0.45, uv.x));
  float mask = leftFade * mix(0.7, 1.0, uv.y);

  /* --- flow streaks --- */
  float warpAmp = mix(0.006, 0.07, uHeat);
  float warp = (fbm(vec2(p.x * 2.5 - t, uvp.y * 2.5 + uTime * 0.03)) - 0.5) * warpAmp;
  float yy = uvp.y + warp * (0.6 + (1.0 - uvp.x));
  float sN = fbm(vec2(p.x * 1.5 - t * 1.6, yy * uDensity));
  float fil = pow(smoothstep(0.40, 0.72, sN), uContrast);
  vec3 scool = mix(blue, cyan, clamp(uv.x, 0.0, 1.0));
  float warmth = clamp(uHeat * (1.0 - uv.x) + (1.0 - uSpeed) * 0.15, 0.0, 1.0);
  vec3 scol = mix(scool, hot, warmth * 0.55);
  float aStreak = fil * mask * mix(0.34, uIntensity, uSpeed);

  /* --- loss-landscape contour, converging inward --- */
  vec2 C = vec2(0.70, 0.56) + par * 1.4;       // upper-right; breathes lower/right
  float d = length((uv - C) * vec2(aspect, 1.0));
  float rings = abs(fract(d * 20.0 - uTime * 0.22) - 0.5) * 2.0;
  float contour = 1.0 - smoothstep(0.0, 0.16, rings);
  float cfade = smoothstep(1.15, 0.05, d) * mask;
  vec3 ccol = mix(cyan, mix(blue, hot, smoothstep(0.28, 0.72, d)), smoothstep(0.0, 0.5, d));
  float aContour = contour * cfade * 0.18;

  /* --- descent marker spiralling to the minimum --- */
  float prog = fract(uTime / 7.0);
  float ang = uTime * 0.7 + prog * 12.566;
  vec2 mp = C + vec2(cos(ang) / aspect, sin(ang)) * (1.0 - prog) * 0.30;
  float md = length((uv - mp) * vec2(aspect, 1.0));
  float marker = exp(-md * md * 1600.0) * (0.35 + 0.65 * (1.0 - prog)) * mask;
  vec3 mcol = vec3(0.7, 0.88, 1.0);

  /* --- combine (straight alpha, coverage-weighted) --- */
  float aMark = marker * 0.5;
  float a = clamp(aStreak + aContour + aMark, 0.0, 0.85);
  vec3 color = (scol * aStreak + ccol * aContour + mcol * aMark) / max(a, 0.0001);
  gl_FragColor = vec4(color, a);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function HeroFlowField() {
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

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uSpeed = gl.getUniformLocation(prog, "uSpeed");
    const uHeat = gl.getUniformLocation(prog, "uHeat");
    const uMouse = gl.getUniformLocation(prog, "uMouse");
    gl.uniform1f(gl.getUniformLocation(prog, "uDensity"), U_DENSITY);
    gl.uniform1f(gl.getUniformLocation(prog, "uContrast"), U_CONTRAST);
    gl.uniform1f(gl.getUniformLocation(prog, "uIntensity"), U_INTENSITY);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let renderScale = 1;
    const resize = () => {
      const cssW = canvas.clientWidth || 1;
      const cssH = canvas.clientHeight || 1;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const w = Math.max(1, Math.floor(cssW * dpr * renderScale));
      const h = Math.max(1, Math.floor(cssH * dpr * renderScale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    // Cursor parallax — store latest, lerp in the frame loop.
    let targetMx = 0;
    let targetMy = 0;
    let curMx = 0;
    let curMy = 0;
    const onPointer = (e: PointerEvent) => {
      targetMx = (e.clientX / window.innerWidth) * 2 - 1;
      targetMy = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let curSpeed = 0.2;
    let curHeat = 0.2;
    let emaDt = 16;
    let slow = 0;
    let raf = 0;
    let last = performance.now();
    let running = false;

    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      emaDt += (dt - emaDt) * 0.1;
      if (emaDt > SLOW_MS) {
        if (++slow > 45 && renderScale > MIN_RENDER_SCALE) {
          renderScale = MIN_RENDER_SCALE;
          resize();
          slow = 0;
        }
      } else if (slow > 0) slow--;

      const [ts, th] = targets(phaseRef.current);
      const k = 1 - Math.exp(-dt / EASE_TAU);
      curSpeed += (ts - curSpeed) * k;
      curHeat += (th - curHeat) * k;

      const km = 1 - Math.exp(-dt / MOUSE_TAU);
      curMx += (targetMx - curMx) * km;
      curMy += (targetMy - curMy) * km;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 0.001);
      gl.uniform1f(uSpeed, curSpeed);
      gl.uniform1f(uHeat, curHeat);
      gl.uniform2f(uMouse, curMx, curMy);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

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

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [phaseRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
    />
  );
}
