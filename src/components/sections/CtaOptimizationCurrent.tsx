"use client";

import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
};

type TrackSample = Point & {
  tangentX: number;
  tangentY: number;
};

type Track = {
  points: Point[];
  cumulative: number[];
  totalLength: number;
  simdPhase: number;
};

type ParticleGroup = {
  phase: number;
  speed: number;
};

type Particle = {
  group: number;
  member: number;
  drift: number;
  waveSpeed: number;
  size: number;
  kind: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
};

type WakeParticle = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
  size: number;
  kind: number;
};

type TracePoint = {
  x: number;
  y: number;
  life: number;
};

type Exclusion = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const PARTICLES_DESKTOP = 44;
const PARTICLES_TABLET = 32;
const PARTICLES_MOBILE = 24;
const POINTER_RADIUS = 204;
const MAX_WAKE_PARTICLES = 42;
const MAX_TRACE_POINTS = 16;
const WAKE_DISTANCE = 8;

function seeded(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function appendLine(points: Point[], end: Point) {
  const start = points[points.length - 1];
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.max(2, Math.ceil(distance / 7));

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    points.push({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    });
  }
}

function cubicPoint(
  start: Point,
  controlA: Point,
  controlB: Point,
  end: Point,
  progress: number,
): Point {
  const inverse = 1 - progress;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * progress * controlA.x +
      3 * inverse * progress ** 2 * controlB.x +
      progress ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * progress * controlA.y +
      3 * inverse * progress ** 2 * controlB.y +
      progress ** 3 * end.y,
  };
}

function createTrack(width: number, height: number): Track {
  const compact = width < 768;
  const left = width * (compact ? 0.1 : 0.08);
  const right = width * (compact ? 0.9 : 0.94);
  const bottom = height * (compact ? 0.88 : 0.82);
  const top = height * (compact ? 0.58 : 0.16);
  const horizontalStep = (right - left) / 4;
  const verticalStep = (bottom - top) / 4;

  const stepPoints: Point[] = [{ x: left, y: bottom }];
  for (let index = 1; index <= 4; index += 1) {
    stepPoints.push({
      x: left + horizontalStep * index,
      y: bottom - verticalStep * (index - 1),
    });
    stepPoints.push({
      x: left + horizontalStep * index,
      y: bottom - verticalStep * index,
    });
  }
  stepPoints.push({ x: right + horizontalStep * 0.22, y: top });

  const points: Point[] = [stepPoints[0]];
  const checkpointIndices = [0];
  for (const point of stepPoints.slice(1)) {
    appendLine(points, point);
    checkpointIndices.push(points.length - 1);
  }

  const stepEndIndex = points.length - 1;
  const curveStart = points[stepEndIndex];
  const curveEnd = points[0];
  const controlA = {
    x: width * (compact ? 0.96 : 0.88),
    y: height * (compact ? 0.68 : 0.06),
  };
  const controlB = {
    x: width * (compact ? 0.08 : 0.12),
    y: height * (compact ? 0.98 : 0.96),
  };

  for (let index = 1; index <= 100; index += 1) {
    points.push(
      cubicPoint(curveStart, controlA, controlB, curveEnd, index / 100),
    );
  }

  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] +
        Math.hypot(
          points[index].x - points[index - 1].x,
          points[index].y - points[index - 1].y,
        ),
    );
  }

  const totalLength = cumulative[cumulative.length - 1];
  const simdCheckpoint = checkpointIndices[5];
  const simdPhase = cumulative[simdCheckpoint] / totalLength;

  return {
    points,
    cumulative,
    totalLength,
    simdPhase,
  };
}

function sampleTrack(track: Track, phase: number): TrackSample {
  const normalizedPhase = ((phase % 1) + 1) % 1;
  const distance = normalizedPhase * track.totalLength;
  let low = 1;
  let high = track.cumulative.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (track.cumulative[middle] < distance) low = middle + 1;
    else high = middle;
  }

  const index = low;
  const previousIndex = Math.max(0, index - 1);
  const segmentLength =
    track.cumulative[index] - track.cumulative[previousIndex] || 1;
  const progress =
    (distance - track.cumulative[previousIndex]) / segmentLength;
  const previous = track.points[previousIndex];
  const current = track.points[index];
  const tangentStart = track.points[Math.max(0, index - 2)];
  const tangentEnd =
    track.points[Math.min(track.points.length - 1, index + 2)];
  const tangentLength =
    Math.hypot(
      tangentEnd.x - tangentStart.x,
      tangentEnd.y - tangentStart.y,
    ) || 1;

  return {
    x: previous.x + (current.x - previous.x) * progress,
    y: previous.y + (current.y - previous.y) * progress,
    tangentX: (tangentEnd.x - tangentStart.x) / tangentLength,
    tangentY: (tangentEnd.y - tangentStart.y) / tangentLength,
  };
}

function cyclicDistance(first: number, second: number): number {
  const distance = Math.abs(first - second);
  return Math.min(distance, 1 - distance);
}

function smoothPulse(distance: number, radius: number): number {
  if (distance >= radius) return 0;
  const progress = 1 - distance / radius;
  return progress * progress * (3 - 2 * progress);
}

function avoidExclusions(point: Point, exclusions: Exclusion[]): Point {
  let x = point.x;
  let y = point.y;

  for (const rect of exclusions) {
    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      continue;
    }

    const distances = [
      { edge: "left", value: x - rect.left },
      { edge: "right", value: rect.right - x },
      { edge: "top", value: y - rect.top },
      { edge: "bottom", value: rect.bottom - y },
    ].sort((first, second) => first.value - second.value);

    switch (distances[0].edge) {
      case "left":
        x = rect.left;
        break;
      case "right":
        x = rect.right;
        break;
      case "top":
        y = rect.top;
        break;
      default:
        y = rect.bottom;
    }
  }

  return { x, y };
}

export default function CtaOptimizationCurrent() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const section = root?.parentElement;
    const context = canvas?.getContext("2d");

    if (!root || !canvas || !section || !context) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const iceChannels =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--ascent-ice")
        .trim()
        .replace(/\s+/g, ", ") || "237, 241, 242";
    const ice = (alpha: number) => `rgba(${iceChannels}, ${alpha})`;

    let width = 0;
    let height = 0;
    let track: Track | null = null;
    let groups: ParticleGroup[] = [];
    let particles: Particle[] = [];
    let wakeParticles: WakeParticle[] = [];
    let exclusions: Exclusion[] = [];
    let frame = 0;
    let tracePoints: TracePoint[] = [];
    let lastTime = performance.now();
    let isVisible = true;

    const pointer = {
      x: -9999,
      y: -9999,
      previousX: -9999,
      previousY: -9999,
      velocityX: 0,
      velocityY: 0,
      targetStrength: 0,
      strength: 0,
      lastEmissionX: -9999,
      lastEmissionY: -9999,
    };

    const updateExclusions = () => {
      const sectionRect = section.getBoundingClientRect();
      exclusions = Array.from(
        section.querySelectorAll<HTMLElement>("[data-cta-obstacle]"),
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        const padding = width < 768 ? 10 : 18;
        return {
          left: rect.left - sectionRect.left - padding,
          right: rect.right - sectionRect.left + padding,
          top: rect.top - sectionRect.top - padding,
          bottom: rect.bottom - sectionRect.top + padding,
        };
      });
    };

    const initializeParticles = () => {
      if (!track) return;

      const particleCount =
        width < 640
          ? PARTICLES_MOBILE
          : width < 1024
            ? PARTICLES_TABLET
            : PARTICLES_DESKTOP;
      const groupCount = particleCount / 4;

      groups = Array.from({ length: groupCount }, (_, index) => ({
        phase: (index / groupCount + seeded(index + 9) * 0.025) % 1,
        speed: 0.000047 + seeded(index + 41) * 0.000014,
      }));

      particles = Array.from({ length: particleCount }, (_, index) => {
        const group = Math.floor(index / 4);
        const member = index % 4;
        const sample = sampleTrack(
          track as Track,
          groups[group].phase + (member - 1.5) * 0.007,
        );

        return {
          group,
          member,
          drift: seeded(index + 101) * Math.PI * 2,
          waveSpeed: 0.72 + seeded(index + 211) * 0.62,
          size: 1.4 + seeded(index + 307) * 1.8,
          kind: index % 6,
          x: sample.x,
          y: sample.y,
          velocityX: 0,
          velocityY: 0,
        };
      });
    };

    const updateParticles = (
      time: number,
      delta: number,
      shouldAdvance: boolean,
    ) => {
      if (!track) return;
      const frameScale = Math.min(2, delta / 16.667 || 1);

      if (shouldAdvance) {
        for (const group of groups) {
          group.phase = (group.phase + group.speed * delta) % 1;
        }
        pointer.strength +=
          (pointer.targetStrength - pointer.strength) *
          Math.min(1, 0.11 * frameScale);
        pointer.velocityX *= Math.pow(0.82, frameScale);
        pointer.velocityY *= Math.pow(0.82, frameScale);
      }

      for (const particle of particles) {
        const group = groups[particle.group];
        const alignment = smoothPulse(
          cyclicDistance(group.phase, track.simdPhase),
          0.055,
        );
        const phase =
          group.phase + (particle.member - 1.5) * 0.007 * (1 - alignment);
        const sample = sampleTrack(track, phase);
        const normalX = -sample.tangentY;
        const normalY = sample.tangentX;
        const wandering =
          Math.sin(time * 0.00062 * particle.waveSpeed + particle.drift) * 7;
        const simdLane = (particle.member - 1.5) * 5.5;
        const offset = wandering * (1 - alignment) + simdLane * alignment;
        const target = avoidExclusions(
          {
            x: sample.x + normalX * offset,
            y: sample.y + normalY * offset,
          },
          exclusions,
        );

        if (!shouldAdvance) {
          particle.x = target.x;
          particle.y = target.y;
          particle.velocityX = 0;
          particle.velocityY = 0;
          continue;
        }

        particle.velocityX +=
          (target.x - particle.x) * 0.026 * frameScale;
        particle.velocityY +=
          (target.y - particle.y) * 0.026 * frameScale;

        const pointerX = particle.x - pointer.x;
        const pointerY = particle.y - pointer.y;
        const pointerDistance = Math.hypot(pointerX, pointerY);
        if (pointerDistance < POINTER_RADIUS && pointerDistance > 0.1) {
          const proximity =
            (1 - pointerDistance / POINTER_RADIUS) * pointer.strength;
          const force = proximity * proximity;
          const directionX = pointerX / pointerDistance;
          const directionY = pointerY / pointerDistance;
          const pointerSpeed = Math.min(
            1.8,
            Math.hypot(pointer.velocityX, pointer.velocityY) / 18,
          );

          particle.velocityX +=
            (directionX * 1.05 -
              directionY * (0.34 + pointerSpeed * 0.2)) *
            force *
            frameScale;
          particle.velocityY +=
            (directionY * 1.05 +
              directionX * (0.34 + pointerSpeed * 0.2)) *
            force *
            frameScale;
        }

        const damping = Math.pow(0.86, frameScale);
        particle.velocityX *= damping;
        particle.velocityY *= damping;
        particle.x += particle.velocityX * frameScale;
        particle.y += particle.velocityY * frameScale;
      }
    };

    const drawConnections = () => {
      const connectionDistance = width < 640 ? 58 : 86;

      context.save();
      context.lineWidth = 0.75;
      for (let first = 0; first < particles.length; first += 1) {
        for (let second = first + 1; second < particles.length; second += 1) {
          const deltaX = particles[first].x - particles[second].x;
          const deltaY = particles[first].y - particles[second].y;
          const distance = Math.hypot(deltaX, deltaY);
          if (distance >= connectionDistance) continue;

          const proximity = 1 - distance / connectionDistance;
          context.beginPath();
          context.moveTo(particles[first].x, particles[first].y);
          context.lineTo(particles[second].x, particles[second].y);
          context.strokeStyle = ice(0.025 + proximity * 0.09);
          context.stroke();
        }
      }
      context.restore();
    };

    const updateWakeParticles = (delta: number, shouldAdvance: boolean) => {
      if (!shouldAdvance) {
        wakeParticles = [];
        tracePoints = [];
        return;
      }

      const frameScale = Math.max(0.35, Math.min(2.1, delta / 16.67));
      const damping = Math.pow(0.9, frameScale);

      wakeParticles = wakeParticles.filter((particle) => {
        particle.life -= delta / 940;
        particle.velocityX *= damping;
        particle.velocityY = particle.velocityY * damping - 0.012 * frameScale;
        particle.x += particle.velocityX * frameScale;
        particle.y += particle.velocityY * frameScale;
        return particle.life > 0;
      });
      tracePoints = tracePoints.filter((point) => {
        point.life -= delta / 720;
        return point.life > 0;
      });
    };


    const drawTracePath = () => {
      if (tracePoints.length < 2) return;

      context.save();
      context.lineCap = "square";
      for (let index = 1; index < tracePoints.length; index += 1) {
        const previous = tracePoints[index - 1];
        const current = tracePoints[index];
        const alpha =
          Math.min(previous.life, current.life) * pointer.strength * 0.4;
        context.beginPath();
        context.moveTo(previous.x, previous.y);
        context.lineTo(current.x, current.y);
        context.lineWidth = index % 3 === 0 ? 1 : 0.65;
        context.strokeStyle = ice(alpha);
        context.stroke();
      }
      context.restore();
    };

    const drawPointerProbe = (time: number) => {
      if (pointer.strength < 0.01) return;

      const nearby = particles
        .map((particle) => ({
          particle,
          distance: Math.hypot(particle.x - pointer.x, particle.y - pointer.y),
        }))
        .filter(({ distance }) => distance < POINTER_RADIUS)
        .sort((first, second) => first.distance - second.distance)
        .slice(0, 10);

      context.save();
      for (const { particle, distance } of nearby) {
        const proximity = 1 - distance / POINTER_RADIUS;
        context.beginPath();
        context.moveTo(pointer.x, pointer.y);
        context.lineTo(particle.x, particle.y);
        context.lineWidth = 0.55 + proximity * 0.55;
        context.strokeStyle = ice(
          (0.045 + proximity * 0.2) * pointer.strength,
        );
        context.stroke();
      }

      const alpha = pointer.strength;
      const radius = 12 + Math.sin(time * 0.006) * 1.25;
      const corner = 4.5;
      context.beginPath();
      context.moveTo(pointer.x - radius, pointer.y - radius + corner);
      context.lineTo(pointer.x - radius, pointer.y - radius);
      context.lineTo(pointer.x - radius + corner, pointer.y - radius);
      context.moveTo(pointer.x + radius - corner, pointer.y - radius);
      context.lineTo(pointer.x + radius, pointer.y - radius);
      context.lineTo(pointer.x + radius, pointer.y - radius + corner);
      context.moveTo(pointer.x + radius, pointer.y + radius - corner);
      context.lineTo(pointer.x + radius, pointer.y + radius);
      context.lineTo(pointer.x + radius - corner, pointer.y + radius);
      context.moveTo(pointer.x - radius + corner, pointer.y + radius);
      context.lineTo(pointer.x - radius, pointer.y + radius);
      context.lineTo(pointer.x - radius, pointer.y + radius - corner);
      context.lineWidth = 0.9;
      context.strokeStyle = ice(0.66 * alpha);
      context.stroke();
      context.fillStyle = ice(0.7 * alpha);
      context.fillRect(pointer.x - 1.5, pointer.y - 1.5, 3, 3);


      const outerRadius = radius + 7;
      context.beginPath();
      context.moveTo(pointer.x - outerRadius, pointer.y - 2);
      context.lineTo(pointer.x - outerRadius, pointer.y + 2);
      context.moveTo(pointer.x + outerRadius, pointer.y - 2);
      context.lineTo(pointer.x + outerRadius, pointer.y + 2);
      context.moveTo(pointer.x - 2, pointer.y - outerRadius);
      context.lineTo(pointer.x + 2, pointer.y - outerRadius);
      context.moveTo(pointer.x - 2, pointer.y + outerRadius);
      context.lineTo(pointer.x + 2, pointer.y + outerRadius);
      context.lineWidth = 0.65;
      context.strokeStyle = ice(0.34 * alpha);
      context.stroke();
      if (width >= 640) {
        context.font = "8px var(--font-jetbrains-mono), monospace";
        context.letterSpacing = "0.08em";
        context.fillStyle = ice(0.7 * alpha);
        context.fillText(
          `TRACE / ${nearby.length.toString().padStart(2, "0")}`,
          pointer.x + 20,
          pointer.y - 14,
        );
        context.beginPath();
        context.moveTo(pointer.x + 20, pointer.y - 10);
        context.lineTo(pointer.x + 58, pointer.y - 10);
        context.lineWidth = 0.65;
        context.strokeStyle = ice(0.4 * alpha);
        context.stroke();
      }
      context.restore();
    };
    const drawWakeParticles = () => {
      context.save();
      for (const particle of wakeParticles) {
        const alpha = Math.max(0, particle.life) * 0.56;
        context.fillStyle = ice(alpha);
        context.strokeStyle = ice(alpha);
        context.lineWidth = 0.8;

        if (particle.kind === 0) {
          context.beginPath();
          context.moveTo(particle.x - particle.size, particle.y);
          context.lineTo(particle.x + particle.size, particle.y);
          context.moveTo(particle.x, particle.y - particle.size);
          context.lineTo(particle.x, particle.y + particle.size);
          context.stroke();
        } else if (particle.kind === 1) {
          context.fillRect(
            particle.x - particle.size,
            particle.y - 0.55,
            particle.size * 2,
            1.1,
          );
        } else {
          context.fillRect(
            particle.x - particle.size / 2,
            particle.y - particle.size / 2,
            particle.size,
            particle.size,
          );
        }
      }
      context.restore();
    };

    const drawParticles = () => {
      context.save();
      for (const particle of particles) {
        const distanceToPointer = Math.hypot(
          particle.x - pointer.x,
          particle.y - pointer.y,
        );
        const pointerInfluence =
          distanceToPointer < POINTER_RADIUS
            ? (1 - distanceToPointer / POINTER_RADIUS) * pointer.strength
            : 0;
        const alpha = 0.32 + pointerInfluence * 0.34;
        const size = particle.size + pointerInfluence * 1.4;
        context.fillStyle = ice(alpha);
        context.strokeStyle = ice(alpha * 0.82);

        if (particle.kind === 0 || particle.kind === 3) {
          context.fillRect(
            particle.x - size * 1.4,
            particle.y - size * 0.45,
            size * 2.8,
            Math.max(1, size * 0.9),
          );
        } else if (particle.kind === 5 && pointerInfluence > 0.3) {
          context.beginPath();
          context.moveTo(particle.x - size, particle.y);
          context.lineTo(particle.x + size, particle.y);
          context.moveTo(particle.x, particle.y - size);
          context.lineTo(particle.x, particle.y + size);
          context.stroke();
        } else {
          context.fillRect(
            particle.x - size / 2,
            particle.y - size / 2,
            size,
            size,
          );
        }
      }
      context.restore();
    };

    const draw = (time: number, delta: number, shouldAdvance: boolean) => {
      if (!track || !width || !height) return;
      context.clearRect(0, 0, width, height);
      updateParticles(time, delta, shouldAdvance);
      updateWakeParticles(delta, shouldAdvance);
      drawConnections();
      drawTracePath();
      drawWakeParticles();
      drawParticles();
      drawPointerProbe(time);
    };

    const animate = (time: number) => {
      const delta = Math.min(34, time - lastTime);
      lastTime = time;
      draw(time, delta, true);
      frame = window.requestAnimationFrame(animate);
    };

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const start = () => {
      stop();
      if (reduceMotion.matches) {
        draw(performance.now(), 0, false);
        return;
      }
      if (!isVisible || document.hidden) return;
      lastTime = performance.now();
      frame = window.requestAnimationFrame(animate);
    };

    const resize = () => {
      width = root.clientWidth;
      height = root.clientHeight;
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        width < 640 ? 1.25 : 1.75,
      );
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      track = createTrack(width, height);
      updateExclusions();
      initializeParticles();
      wakeParticles = [];
      draw(performance.now(), 0, false);
      start();
    };

      tracePoints = [];
    const handlePointerMove = (event: PointerEvent) => {
      if (
        reduceMotion.matches ||
        coarsePointer.matches ||
        (event.pointerType !== "mouse" && event.pointerType !== "pen")
      ) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const nextX = event.clientX - rect.left;
      const nextY = event.clientY - rect.top;
      if (pointer.previousX > -1000) {
        pointer.velocityX = nextX - pointer.previousX;
        pointer.velocityY = nextY - pointer.previousY;
      }

      const emissionDistance = Math.hypot(
        nextX - pointer.lastEmissionX,
        nextY - pointer.lastEmissionY,
      );
      if (pointer.lastEmissionX < -1000 || emissionDistance >= WAKE_DISTANCE) {
        const speed = Math.hypot(pointer.velocityX, pointer.velocityY) || 1;
        const lateralX = -pointer.velocityY / speed;
        const lateralY = pointer.velocityX / speed;
        const wakeIndex = wakeParticles.length;

        for (const side of [-1, 1]) {
          wakeParticles.push({
            x: nextX + lateralX * side * 3.2,
            y: nextY + lateralY * side * 3.2,
            velocityX: -pointer.velocityX * 0.055 + lateralX * side * 0.18,
            velocityY: -pointer.velocityY * 0.055 + lateralY * side * 0.18,
            life: 1,
            size: 1.5 + seeded(wakeIndex + side + 811) * 1.25,
            kind: (wakeIndex + (side > 0 ? 1 : 0)) % 3,
          });
        }
        wakeParticles = wakeParticles.slice(-MAX_WAKE_PARTICLES);
        pointer.lastEmissionX = nextX;
        pointer.lastEmissionY = nextY;
      }

        tracePoints.push({ x: nextX, y: nextY, life: 1 });
        tracePoints = tracePoints.slice(-MAX_TRACE_POINTS);
      pointer.x = nextX;
      pointer.y = nextY;
      pointer.previousX = nextX;
      pointer.previousY = nextY;
      pointer.targetStrength = 1;
    };

    const handlePointerLeave = () => {
      pointer.targetStrength = 0;
      pointer.previousX = -9999;
      pointer.previousY = -9999;
      pointer.lastEmissionX = -9999;
      pointer.lastEmissionY = -9999;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    const handleMotionPreferenceChange = () => {
      if (reduceMotion.matches) {
        pointer.targetStrength = 0;
        pointer.strength = 0;
        wakeParticles = [];
      }
      start();
    };

        tracePoints = [];
    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) start();
        else stop();
      },
      { rootMargin: "120px" },
    );

    resizeObserver.observe(root);
    intersectionObserver.observe(root);
    section.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    section.addEventListener("pointerleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reduceMotion.addEventListener("change", handleMotionPreferenceChange);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      section.removeEventListener("pointermove", handlePointerMove);
      section.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reduceMotion.removeEventListener("change", handleMotionPreferenceChange);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        role="presentation"
      />
    </div>
  );
}
