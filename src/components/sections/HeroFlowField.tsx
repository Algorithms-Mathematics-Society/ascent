"use client";

import { useEffect, useRef } from "react";
import { useHeroFlow, type FlowPhase } from "./HeroFlowContext";

/**
 * Raw-WebGL flow field behind the hero — a field of data/latency streaks that
 * flow slow + turbulent + warm by default, then rip fast + laminar + cool when
 * the visitor runs the on-device benchmark. The "before→after" of optimization
 * as motion. Subordinate to the content (low contrast, thinned behind the text
 * column), and brutally cheap: one full-screen fragment shader, 1 draw call per
 * frame, no per-particle CPU work — because on this site the effect's own
 * performance is the demo.
 *
 * Guardrails: DPR capped; RAF paused when offscreen (IntersectionObserver) or
 * tab hidden; resolution steps down if frames run slow; never inits on
 * reduced-motion / no-WebGL / coarse-pointer (mobile) — those keep the CSS
 * HeroBackdrop only. Zero dependencies.
 */

/* ---- Tuning (adjust by eye in dev) ---------------------------------- */
const DPR_CAP = 1.5; // retina fill-rate guard
const EASE_TAU = 360; // ms — speed/heat ramp smoothness
const SLOW_MS = 24; // frame time above which we consider stepping down
const MIN_RENDER_SCALE = 0.6;
const U_DENSITY = 62.0; // streak count (y-frequency)
const U_CONTRAST = 3.0; // filament sharpness
const U_INTENSITY = 0.5; // peak streak alpha (kept subtle for subordination)

// phase → [targetSpeed, targetHeat]
function targets(phase: FlowPhase): [number, number] {
  switch (phase) {
    case "naive":
      return [0.12, 0.9]; // slow code running: turbulent + warm
    case "rewrite":
      return [0.3, 0.5];
    case "opt":
      return [0.85, 0.15]; // rips: fast + cool + laminar
    case "done":
      return [0.7, 0.05]; // lively cool rest
    default:
      return [0.12, 0.15]; // idle: quiet warm drift
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
  vec2 p = vec2(uv.x * aspect, uv.y);

  float t = uTime * mix(0.06, 0.55, uSpeed);

  // vertical warp: turbulent when hot, laminar when fast; stronger on slow-left
  float warpAmp = mix(0.006, 0.07, uHeat);
  float warp = (fbm(vec2(p.x * 2.5 - t, uv.y * 2.5 + uTime * 0.03)) - 0.5) * warpAmp;
  float yy = uv.y + warp * (0.6 + (1.0 - uv.x));

  // streaks: long in x, thin in y, flowing right
  float s = fbm(vec2(p.x * 1.5 - t * 1.6, yy * uDensity));
  float fil = pow(smoothstep(0.42, 0.78, s), uContrast);

  // subordination: thin behind the left text column, densest upper-right
  float leftFade = smoothstep(0.02, 0.5, uv.x);
  float topBias = mix(0.55, 1.0, uv.y);
  float mask = leftFade * topBias;

  // color: cool electric (fast/right) vs warm magenta (hot/slow/left)
  vec3 blue = vec3(0.376, 0.647, 0.980);
  vec3 cyan = vec3(0.133, 0.827, 0.933);
  vec3 hot  = vec3(1.0, 0.239, 0.443);
  vec3 cool = mix(blue, cyan, clamp(uv.x, 0.0, 1.0));
  float warmth = clamp(uHeat * (1.0 - uv.x) + (1.0 - uSpeed) * 0.15, 0.0, 1.0);
  vec3 col = mix(cool, hot, warmth * 0.55);

  float intensity = fil * mask * mix(0.12, uIntensity, uSpeed);
  gl_FragColor = vec4(col, clamp(intensity, 0.0, 1.0));
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

    // Capability gate — phones / reduced-motion keep the CSS backdrop only.
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

    // Full-screen triangle.
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

    let curSpeed = 0.12;
    let curHeat = 0.15;
    let emaDt = 16;
    let slow = 0;
    let raf = 0;
    let last = performance.now();
    let running = false;

    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      // adaptive resolution
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

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 0.001);
      gl.uniform1f(uSpeed, curSpeed);
      gl.uniform1f(uHeat, curHeat);
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

    // Pause when the hero scrolls out of view.
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
