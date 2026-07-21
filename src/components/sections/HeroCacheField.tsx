"use client";

import { useEffect, useRef } from "react";

type GridMetrics = {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  gapX: number;
  gapY: number;
  left: number;
  top: number;
};

type TrailCell = {
  column: number;
  row: number;
  life: number;
};

type MissCell = TrailCell & {
  createdAt: number;
};

const TRAIL_LENGTH = 14;
const GROUP_SIZE = 4;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function readChannels(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
    .replace(/\s+/g, ", ");

  return value || fallback;
}

function rgba(channels: string, alpha: number) {
  return `rgba(${channels}, ${clamp(alpha, 0, 1)})`;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function createMetrics(width: number, height: number): GridMetrics {
  const columns = width < 420 ? 10 : 12;
  const rows = clamp(Math.floor((height - 48) / 35), 7, 12);
  const gapX = width < 420 ? 6 : 8;
  const gapY = 12;
  const left = 12;
  const cellWidth = (width - left * 2 - gapX * (columns - 1)) / columns;
  const availableHeight = height - 48 - gapY * (rows - 1);
  const cellHeight = clamp(availableHeight / rows, 13, 21);
  const gridHeight = cellHeight * rows + gapY * (rows - 1);

  return {
    columns,
    rows,
    cellWidth,
    cellHeight,
    gapX,
    gapY,
    left,
    top: Math.max(24, (height - gridHeight) / 2),
  };
}

function cellPosition(
  metrics: GridMetrics,
  column: number,
  row: number,
) {
  return {
    x: metrics.left + column * (metrics.cellWidth + metrics.gapX),
    y: metrics.top + row * (metrics.cellHeight + metrics.gapY),
  };
}

export default function HeroCacheField() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const section = root?.closest("section");
    const context = canvas?.getContext("2d");

    if (!root || !canvas || !section || !context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const glacier = readChannels("--ascent-glacier", "20, 40, 58");
    const gold = readChannels("--ascent-gold", "169, 130, 47");
    const border = readChannels("--ascent-border-strong", "166, 183, 190");

    let width = 0;
    let height = 0;
    let metrics = createMetrics(1, 1);
    let frame = 0;
    let visible = true;
    let lastFrame = performance.now();
    let lastPointerTime = performance.now();
    let lastPointerX = -9999;
    let lastPointerY = -9999;
    let lastSample = "";
    let lastMissAt = 0;
    let trail: TrailCell[] = [];
    let miss: MissCell | null = null;

    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      strength: 0,
      targetStrength: 0,
      velocity: 0,
    };

    const fillCell = (
      column: number,
      row: number,
      fill: string,
      stroke?: string,
    ) => {
      const position = cellPosition(metrics, column, row);
      roundedRect(
        context,
        position.x,
        position.y,
        metrics.cellWidth,
        metrics.cellHeight,
        3,
      );
      context.fillStyle = fill;
      context.fill();

      if (stroke) {
        context.strokeStyle = stroke;
        context.lineWidth = 1;
        context.stroke();
      }
    };

    const draw = (time: number, delta: number, staticFrame = false) => {
      context.clearRect(0, 0, width, height);
      if (!width || !height) return;

      metrics = createMetrics(width, height);

      for (let row = 0; row < metrics.rows; row += 1) {
        for (let column = 0; column < metrics.columns; column += 1) {
          const group = Math.floor(column / GROUP_SIZE);
          const baseAlpha = group % 2 === 0 ? 0.035 : 0.052;
          fillCell(
            column,
            row,
            rgba(glacier, baseAlpha),
            rgba(border, 0.2),
          );
        }
      }

      for (
        let boundary = GROUP_SIZE;
        boundary < metrics.columns;
        boundary += GROUP_SIZE
      ) {
        const previous = cellPosition(metrics, boundary - 1, 0);
        const x = previous.x + metrics.cellWidth + metrics.gapX / 2;
        context.fillStyle = rgba(glacier, 0.1);
        context.fillRect(
          Math.round(x),
          metrics.top - 8,
          1,
          metrics.rows * (metrics.cellHeight + metrics.gapY) -
            metrics.gapY +
            16,
        );
      }

      const idleStep = staticFrame ? 5 : Math.floor(time / 430);
      const idleRow = staticFrame
        ? Math.floor(metrics.rows * 0.42)
        : Math.floor(time / 5400) % metrics.rows;
      const idleHead = idleStep % (metrics.columns + 4);

      for (let offset = 0; offset < GROUP_SIZE; offset += 1) {
        const column = idleHead - offset;
        if (column < 0 || column >= metrics.columns) continue;

        fillCell(
          column,
          idleRow,
          rgba(glacier, 0.07 + (GROUP_SIZE - offset) * 0.035),
          rgba(glacier, 0.11),
        );
      }

      if (pointer.strength > 0.015) {
        const column = clamp(
          Math.round(
            (pointer.x - metrics.left) /
              (metrics.cellWidth + metrics.gapX),
          ),
          0,
          metrics.columns - 1,
        );
        const row = clamp(
          Math.round(
            (pointer.y - metrics.top) /
              (metrics.cellHeight + metrics.gapY),
          ),
          0,
          metrics.rows - 1,
        );

        const sampleKey = `${column}:${row}`;
        if (sampleKey !== lastSample) {
          lastSample = sampleKey;
          trail.unshift({ column, row, life: 1 });
          trail = trail.slice(0, TRAIL_LENGTH);
        }

        for (let sampleRow = 0; sampleRow < metrics.rows; sampleRow += 1) {
          for (
            let sampleColumn = 0;
            sampleColumn < metrics.columns;
            sampleColumn += 1
          ) {
            const distance =
              Math.abs(sampleColumn - column) + Math.abs(sampleRow - row);
            if (distance > 2) continue;

            const levels = [0.24, 0.13, 0.055];
            fillCell(
              sampleColumn,
              sampleRow,
              rgba(glacier, levels[distance] * pointer.strength),
              distance === 0
                ? rgba(glacier, 0.42 * pointer.strength)
                : undefined,
            );
          }
        }

        const samplePosition = cellPosition(metrics, column, 0);
        const sampleX =
          samplePosition.x + metrics.cellWidth / 2;

        context.fillStyle = rgba(glacier, 0.16 * pointer.strength);
        context.fillRect(
          Math.round(sampleX),
          metrics.top - 12,
          1,
          metrics.rows * (metrics.cellHeight + metrics.gapY) -
            metrics.gapY +
            24,
        );

        const activePosition = cellPosition(metrics, column, row);
        context.fillStyle = rgba(gold, 0.92 * pointer.strength);
        context.fillRect(
          activePosition.x + 3,
          activePosition.y + 2,
          Math.max(4, metrics.cellWidth - 6),
          2,
        );
      }

      for (const sample of trail) {
        fillCell(
          sample.column,
          sample.row,
          rgba(glacier, sample.life * 0.09 * pointer.strength),
        );
        sample.life = Math.max(0, sample.life - delta / 1250);
      }
      trail = trail.filter((sample) => sample.life > 0.015);

      if (miss) {
        const age = time - miss.createdAt;
        miss.life = Math.max(0, 1 - age / 760);

        if (miss.life > 0) {
          fillCell(
            miss.column,
            miss.row,
            rgba(gold, 0.13 * miss.life),
            rgba(gold, 0.68 * miss.life),
          );
          const position = cellPosition(metrics, miss.column, miss.row);
          context.fillStyle = rgba(gold, 0.86 * miss.life);
          context.fillRect(
            position.x + metrics.cellWidth - 5,
            position.y + 3,
            3,
            3,
          );
        } else {
          miss = null;
        }
      }
    };

    const resize = () => {
      const bounds = root.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      pointer.x = width * 0.56;
      pointer.y = height * 0.46;
      pointer.targetX = pointer.x;
      pointer.targetY = pointer.y;
      draw(performance.now(), 0, reducedMotion.matches || coarsePointer.matches);
    };

    const animate = (time: number) => {
      frame = 0;
      const delta = Math.min(48, Math.max(0, time - lastFrame));
      lastFrame = time;

      pointer.x += (pointer.targetX - pointer.x) * 0.115;
      pointer.y += (pointer.targetY - pointer.y) * 0.115;
      pointer.strength +=
        (pointer.targetStrength - pointer.strength) * 0.085;
      pointer.velocity *= 0.9;

      draw(time, delta);

      if (visible && !reducedMotion.matches && !coarsePointer.matches) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    const start = () => {
      if (
        frame ||
        !visible ||
        reducedMotion.matches ||
        coarsePointer.matches
      ) {
        draw(
          performance.now(),
          0,
          reducedMotion.matches || coarsePointer.matches,
        );
        return;
      }

      lastFrame = performance.now();
      frame = window.requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      const bounds = root.getBoundingClientRect();
      const now = performance.now();
      const delta = Math.max(16, now - lastPointerTime);
      const hasPreviousPointer = lastPointerX > -9000;
      const movement = hasPreviousPointer
        ? Math.hypot(
            event.clientX - lastPointerX,
            event.clientY - lastPointerY,
          )
        : 0;

      pointer.targetX = clamp(event.clientX - bounds.left, 0, width);
      pointer.targetY = clamp(event.clientY - bounds.top, 0, height);
      pointer.targetStrength = 1;
      pointer.velocity = movement / delta;

      if (
        pointer.velocity > 0.72 &&
        now - lastMissAt > 420 &&
        metrics.columns > 0
      ) {
        const sourceColumn = clamp(
          Math.round(
            (pointer.targetX - metrics.left) /
              (metrics.cellWidth + metrics.gapX),
          ),
          0,
          metrics.columns - 1,
        );
        const sourceRow = clamp(
          Math.round(
            (pointer.targetY - metrics.top) /
              (metrics.cellHeight + metrics.gapY),
          ),
          0,
          metrics.rows - 1,
        );

        miss = {
          column: clamp(
            sourceColumn + (sourceColumn > metrics.columns / 2 ? -3 : 3),
            0,
            metrics.columns - 1,
          ),
          row: clamp(
            sourceRow + (sourceRow % 2 === 0 ? 2 : -2),
            0,
            metrics.rows - 1,
          ),
          createdAt: now,
          life: 1,
        };
        lastMissAt = now;
      }

      lastPointerTime = now;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    };

    const handlePointerLeave = () => {
      pointer.targetStrength = 0;
      lastPointerX = -9999;
      lastPointerY = -9999;
      lastSample = "";
    };

    const handlePreferenceChange = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      pointer.targetStrength = 0;
      start();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          start();
        } else if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { threshold: 0.02 },
    );
    intersectionObserver.observe(root);

    section.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    section.addEventListener("pointerleave", handlePointerLeave);
    reducedMotion.addEventListener("change", handlePreferenceChange);
    coarsePointer.addEventListener("change", handlePreferenceChange);

    resize();
    start();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      section.removeEventListener("pointermove", handlePointerMove);
      section.removeEventListener("pointerleave", handlePointerLeave);
      reducedMotion.removeEventListener("change", handlePreferenceChange);
      coarsePointer.removeEventListener("change", handlePreferenceChange);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute bottom-24 right-[max(2rem,calc((100vw-80rem)/2))] top-24 hidden w-[min(28vw,28rem)] xl:block"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
