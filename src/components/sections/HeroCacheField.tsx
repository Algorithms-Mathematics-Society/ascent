"use client";

import { useEffect, useRef } from "react";

type Exclusion = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type CacheCell = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  index: number;
  length: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function seeded(index: number) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function readChannels(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
    .replace(/\s+/g, ", ");

  return value || fallback;
}

function rgba(channels: string, alpha: number) {
  return "rgba(" + channels + ", " + clamp(alpha, 0, 1) + ")";
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

function overlaps(
  left: number,
  top: number,
  right: number,
  bottom: number,
  exclusions: Exclusion[],
) {
  return exclusions.some(
    (rect) =>
      right > rect.left &&
      left < rect.right &&
      bottom > rect.top &&
      top < rect.bottom,
  );
}

function createCells(
  width: number,
  height: number,
  exclusions: Exclusion[],
) {
  const cells: CacheCell[] = [];
  const rowSpacing = 122;
  const rowCount = Math.ceil(height / rowSpacing) + 1;

  for (let row = 0; row < rowCount; row += 1) {
    const y =
      42 +
      row * rowSpacing +
      (seeded(row * 41 + 5) - 0.5) * 28;

    if (y > height - 30) continue;

    for (let side = 0; side < 2; side += 1) {
      const clusterSeed = seeded(row * 89 + side * 31 + 11);

      // Alternating gaps keep the field from becoming a repeated wallpaper.
      if ((row + side) % 4 === 1 || clusterSeed < 0.2) continue;

      const length = 3 + Math.floor(seeded(row * 23 + side * 67) * 3);
      const cellWidth = 21 + seeded(row * 47 + side * 17) * 9;
      const cellHeight = 10 + seeded(row * 73 + side * 29) * 4;
      const gap = 8 + seeded(row * 19 + side * 53) * 3;
      const clusterWidth = length * cellWidth + (length - 1) * gap;

      const looseStart =
        side === 0
          ? width * (0.015 + clusterSeed * 0.1)
          : width * (0.8 + clusterSeed * 0.11);
      const startX = clamp(
        looseStart,
        18,
        Math.max(18, width - clusterWidth - 18),
      );

      for (let index = 0; index < length; index += 1) {
        const cellX = startX + index * (cellWidth + gap);
        const cellY =
          y + (seeded(row * 137 + side * 43 + index) - 0.5) * 3;
        const padding = 18;

        if (
          overlaps(
            cellX - padding,
            cellY - padding,
            cellX + cellWidth + padding,
            cellY + cellHeight + padding,
            exclusions,
          )
        ) {
          continue;
        }

        cells.push({
          key: row + ":" + side + ":" + index,
          x: cellX,
          y: cellY,
          width: cellWidth,
          height: cellHeight,
          row,
          index,
          length,
        });
      }
    }
  }

  return cells;
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
    let cells: CacheCell[] = [];
    let frame = 0;
    let visible = true;
    let disposed = false;
    let lastFrame = performance.now();

    const pointer = {
      x: -9999,
      y: -9999,
      targetX: -9999,
      targetY: -9999,
      strength: 0,
      targetStrength: 0,
    };

    const updateGeometry = () => {
      const sectionRect = section.getBoundingClientRect();
      const exclusions = Array.from(
        section.querySelectorAll<HTMLElement>(
          "h1, p, a, button, dl, [role='timer']",
        ),
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        const padding = 16;

        return {
          left: rect.left - sectionRect.left - padding,
          right: rect.right - sectionRect.left + padding,
          top: rect.top - sectionRect.top - padding,
          bottom: rect.bottom - sectionRect.top + padding,
        };
      });

      cells = createCells(width, height, exclusions);
    };

    const fillCell = (
      cell: CacheCell,
      fill: string,
      stroke: string,
    ) => {
      roundedRect(
        context,
        cell.x,
        cell.y,
        cell.width,
        cell.height,
        3,
      );
      context.fillStyle = fill;
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = stroke;
      context.stroke();
    };

    const draw = (time: number, staticFrame = false) => {
      context.clearRect(0, 0, width, height);
      if (!width || !height) return;

      const idleStep = staticFrame ? 1 : Math.floor(time / 760);
      let nearest: CacheCell | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const cell of cells) {
        const activeIndex =
          (idleStep + cell.row) % Math.max(1, cell.length);
        const idleDistance =
          (activeIndex - cell.index + cell.length) % cell.length;
        const idleAlpha =
          idleDistance === 0
            ? 0.042
            : idleDistance === 1
              ? 0.026
              : 0.012;

        const distance = Math.hypot(
          cell.x + cell.width / 2 - pointer.x,
          cell.y + cell.height / 2 - pointer.y,
        );
        const interactiveAlpha =
          distance < 64
            ? 0.085
            : distance < 122
              ? 0.045
              : distance < 178
                ? 0.018
                : 0;

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = cell;
        }

        fillCell(
          cell,
          rgba(
            glacier,
            idleAlpha + interactiveAlpha * pointer.strength,
          ),
          rgba(border, 0.06),
        );
      }

      if (
        nearest &&
        nearestDistance < 112 &&
        pointer.strength > 0.04
      ) {
        const activeCell = nearest as CacheCell;
        context.fillStyle = rgba(gold, 0.42 * pointer.strength);
        context.fillRect(
          activeCell.x + 4,
          activeCell.y + 2,
          Math.max(3, activeCell.width - 8),
          2,
        );
      }
    };

    const resize = () => {
      width = Math.max(1, section.clientWidth);
      height = Math.max(1, section.clientHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      updateGeometry();
      draw(
        performance.now(),
        reducedMotion.matches || coarsePointer.matches,
      );
    };

    const animate = (time: number) => {
      frame = 0;
      const delta = Math.min(48, Math.max(0, time - lastFrame));
      lastFrame = time;
      const ease = 1 - Math.pow(0.84, delta / 16.67);

      pointer.x += (pointer.targetX - pointer.x) * ease;
      pointer.y += (pointer.targetY - pointer.y) * ease;
      pointer.strength +=
        (pointer.targetStrength - pointer.strength) * ease;

      draw(time);

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
          reducedMotion.matches || coarsePointer.matches,
        );
        return;
      }

      lastFrame = performance.now();
      frame = window.requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotion.matches || coarsePointer.matches) return;

      const rect = section.getBoundingClientRect();
      pointer.targetX = event.clientX - rect.left;
      pointer.targetY = event.clientY - rect.top;

      if (pointer.x < -9000) {
        pointer.x = pointer.targetX;
        pointer.y = pointer.targetY;
      }

      pointer.targetStrength = 1;
    };

    const handlePointerLeave = () => {
      pointer.targetStrength = 0;
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
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;

      if (visible) {
        start();
      } else if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    });

    resizeObserver.observe(section);
    intersectionObserver.observe(section);
    section.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    section.addEventListener("pointerleave", handlePointerLeave);
    reducedMotion.addEventListener("change", handlePreferenceChange);
    coarsePointer.addEventListener("change", handlePreferenceChange);

    document.fonts.ready.then(() => {
      if (!disposed) resize();
    });
    resize();
    start();

    return () => {
      disposed = true;
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
      className="pointer-events-none absolute inset-0 z-0 hidden lg:block"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

