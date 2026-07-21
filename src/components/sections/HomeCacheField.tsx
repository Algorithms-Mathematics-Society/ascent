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
  documentY: number;
  width: number;
  height: number;
  rowIndex: number;
  clusterIndex: number;
  cellIndex: number;
  clusterLength: number;
};

type TrailCell = {
  key: string;
  life: number;
};

type MissCell = {
  key: string;
  createdAt: number;
  life: number;
};

const ROW_SPACING = 88;
const MAX_TRAIL = 18;

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

function overlapsExclusion(
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

function createCells({
  width,
  scrollY,
  viewportHeight,
  mainTop,
  mainBottom,
  exclusions,
}: {
  width: number;
  scrollY: number;
  viewportHeight: number;
  mainTop: number;
  mainBottom: number;
  exclusions: Exclusion[];
}) {
  const cells: CacheCell[] = [];
  const firstRow = Math.floor((scrollY - mainTop - 120) / ROW_SPACING);
  const lastRow = Math.ceil(
    (scrollY + viewportHeight - mainTop + 120) / ROW_SPACING,
  );
  const clusterCount = width >= 1500 ? 3 : 2;

  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
    const rowSeed = seeded(rowIndex * 31 + 7);
    const baseDocumentY =
      mainTop +
      rowIndex * ROW_SPACING +
      (rowSeed - 0.5) * ROW_SPACING * 0.36;

    if (
      baseDocumentY < mainTop + 36 ||
      baseDocumentY > mainBottom - 36
    ) {
      continue;
    }

    for (
      let clusterIndex = 0;
      clusterIndex < clusterCount;
      clusterIndex += 1
    ) {
      const clusterSeed = seeded(
        rowIndex * 101 + clusterIndex * 43 + 19,
      );

      if (clusterIndex === 2 && clusterSeed < 0.58) continue;

      const clusterLength =
        3 + Math.floor(seeded(rowIndex * 17 + clusterIndex * 71) * 5);
      const cellWidth =
        20 + seeded(rowIndex * 53 + clusterIndex * 11) * 12;
      const cellHeight =
        11 + seeded(rowIndex * 79 + clusterIndex * 29) * 6;
      const gap = 7 + seeded(rowIndex * 23 + clusterIndex * 61) * 4;
      const clusterWidth =
        clusterLength * cellWidth + (clusterLength - 1) * gap;

      let startX: number;
      if (clusterIndex === 0) {
        startX = width * (0.015 + clusterSeed * 0.16);
      } else if (clusterIndex === 1) {
        startX = width * (0.79 + clusterSeed * 0.16);
      } else {
        startX = width * (0.36 + clusterSeed * 0.2);
      }

      startX = clamp(startX, 18, Math.max(18, width - clusterWidth - 18));

      for (let cellIndex = 0; cellIndex < clusterLength; cellIndex += 1) {
        const x = startX + cellIndex * (cellWidth + gap);
        const documentY =
          baseDocumentY +
          (seeded(rowIndex * 149 + clusterIndex * 37 + cellIndex) -
            0.5) *
            4;
        const padding = 4;

        if (
          overlapsExclusion(
            x - padding,
            documentY - padding,
            x + cellWidth + padding,
            documentY + cellHeight + padding,
            exclusions,
          )
        ) {
          continue;
        }

        cells.push({
          key:
            rowIndex +
            ":" +
            clusterIndex +
            ":" +
            cellIndex,
          x,
          documentY,
          width: cellWidth,
          height: cellHeight,
          rowIndex,
          clusterIndex,
          cellIndex,
          clusterLength,
        });
      }
    }
  }

  return cells;
}

export default function HomeCacheField() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const main = root?.closest("main");
    const context = canvas?.getContext("2d");

    if (!root || !canvas || !main || !context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const glacier = readChannels("--ascent-glacier", "20, 40, 58");
    const gold = readChannels("--ascent-gold", "169, 130, 47");
    const border = readChannels("--ascent-border-strong", "166, 183, 190");

    let width = 0;
    let height = 0;
    let mainTop = 0;
    let mainBottom = 0;
    let exclusions: Exclusion[] = [];
    let cells: CacheCell[] = [];
    let cellMap = new Map<string, CacheCell>();
    let trail: TrailCell[] = [];
    let miss: MissCell | null = null;
    let nearestKey = "";
    let lastNearestKey = "";
    let lastMissAt = 0;
    let frame = 0;
    let lastFrame = performance.now();
    let visible = true;
    let pointerInside = false;
    let lastPointerTime = performance.now();
    let lastPointerX = -9999;
    let lastPointerY = -9999;

    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      strength: 0,
      targetStrength: 0,
      velocity: 0,
    };

    const updatePageGeometry = () => {
      const scrollY = window.scrollY;
      const mainRect = main.getBoundingClientRect();
      mainTop = scrollY + mainRect.top;
      mainBottom = mainTop + mainRect.height;

      const obstacleSelector = [
        "h1",
        "h2",
        "h3",
        "p",
        "a",
        "button",
        "dl",
        "ol",
        "table",
        "form",
        "[data-cache-obstacle]",
        "#prizes",
      ].join(",");

      exclusions = Array.from(
        main.querySelectorAll<HTMLElement>(obstacleSelector),
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        const padding = element.id === "prizes" ? 0 : 12;

        return {
          left: rect.left - padding,
          right: rect.right + padding,
          top: scrollY + rect.top - padding,
          bottom: scrollY + rect.bottom + padding,
        };
      });
    };

    const fillCell = (
      cell: CacheCell,
      canvasY: number,
      fill: string,
      stroke?: string,
    ) => {
      roundedRect(
        context,
        cell.x,
        canvasY,
        cell.width,
        cell.height,
        3,
      );
      context.fillStyle = fill;
      context.fill();

      if (stroke) {
        context.lineWidth = 1;
        context.strokeStyle = stroke;
        context.stroke();
      }
    };

    const draw = (time: number, delta: number, staticFrame = false) => {
      context.clearRect(0, 0, width, height);
      if (!width || !height) return;

      const scrollY = window.scrollY;
      cells = createCells({
        width,
        scrollY,
        viewportHeight: height,
        mainTop,
        mainBottom,
        exclusions,
      });
      cellMap = new Map(cells.map((cell) => [cell.key, cell]));

      let nearestDistance = Number.POSITIVE_INFINITY;
      let nearestCell: CacheCell | null = null;

      if (pointer.strength > 0.015) {
        for (const cell of cells) {
          const canvasY = cell.documentY - scrollY;
          const distance = Math.hypot(
            cell.x + cell.width / 2 - pointer.x,
            canvasY + cell.height / 2 - pointer.y,
          );

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestCell = cell;
          }
        }
      }

      nearestKey = nearestCell?.key ?? "";
      if (
        nearestKey &&
        nearestKey !== lastNearestKey &&
        nearestDistance < 210
      ) {
        lastNearestKey = nearestKey;
        trail.unshift({ key: nearestKey, life: 1 });
        trail = trail.slice(0, MAX_TRAIL);
      }

      const idleStep = staticFrame ? 2 : Math.floor(time / 520);

      for (const cell of cells) {
        const canvasY = cell.documentY - scrollY;
        const activeIndex =
          (idleStep + Math.abs(cell.rowIndex) + cell.clusterIndex) %
          cell.clusterLength;
        const idleDistance =
          (activeIndex - cell.cellIndex + cell.clusterLength) %
          cell.clusterLength;
        const idleAlpha =
          idleDistance === 0
            ? 0.14
            : idleDistance === 1
              ? 0.09
              : idleDistance === 2
                ? 0.055
                : 0.026;

        let interactiveAlpha = 0;
        if (pointer.strength > 0.015) {
          const distance = Math.hypot(
            cell.x + cell.width / 2 - pointer.x,
            canvasY + cell.height / 2 - pointer.y,
          );

          interactiveAlpha =
            distance < 58
              ? 0.24
              : distance < 112
                ? 0.13
                : distance < 178
                  ? 0.06
                  : 0;
        }

        const trailLife =
          trail.find((sample) => sample.key === cell.key)?.life ?? 0;
        const fillAlpha =
          idleAlpha +
          interactiveAlpha * pointer.strength +
          trailLife * 0.07 * pointer.strength;

        fillCell(
          cell,
          canvasY,
          rgba(glacier, fillAlpha),
          rgba(border, 0.18),
        );
      }

      if (
        nearestCell &&
        nearestDistance < 128 &&
        pointer.strength > 0.05
      ) {
        const canvasY = nearestCell.documentY - scrollY;
        context.fillStyle = rgba(gold, 0.86 * pointer.strength);
        context.fillRect(
          nearestCell.x + 3,
          canvasY + 2,
          Math.max(4, nearestCell.width - 6),
          2,
        );
      }

      for (const sample of trail) {
        sample.life = Math.max(0, sample.life - delta / 1450);
      }
      trail = trail.filter((sample) => sample.life > 0.015);

      if (miss) {
        const age = time - miss.createdAt;
        miss.life = Math.max(0, 1 - age / 780);
        const cell = cellMap.get(miss.key);

        if (cell && miss.life > 0) {
          const canvasY = cell.documentY - scrollY;
          fillCell(
            cell,
            canvasY,
            rgba(gold, 0.12 * miss.life),
            rgba(gold, 0.62 * miss.life),
          );
          context.fillStyle = rgba(gold, 0.86 * miss.life);
          context.fillRect(
            cell.x + cell.width - 5,
            canvasY + 3,
            3,
            3,
          );
        } else if (miss.life <= 0) {
          miss = null;
        }
      }
    };

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      pointer.x = width * 0.82;
      pointer.y = height * 0.42;
      pointer.targetX = pointer.x;
      pointer.targetY = pointer.y;

      updatePageGeometry();
      draw(
        performance.now(),
        0,
        reducedMotion.matches || coarsePointer.matches,
      );
    };

    const updateVisibility = () => {
      const rect = main.getBoundingClientRect();
      visible = rect.bottom > 0 && rect.top < window.innerHeight;

      if (!visible && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const animate = (time: number) => {
      frame = 0;
      const delta = Math.min(48, Math.max(0, time - lastFrame));
      lastFrame = time;

      pointer.x += (pointer.targetX - pointer.x) * 0.12;
      pointer.y += (pointer.targetY - pointer.y) * 0.12;
      pointer.strength +=
        (pointer.targetStrength - pointer.strength) * 0.085;
      pointer.velocity *= 0.9;

      draw(time, delta);

      if (visible && !reducedMotion.matches && !coarsePointer.matches) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    const start = () => {
      updateVisibility();
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
      if (
        event.pointerType === "touch" ||
        reducedMotion.matches ||
        coarsePointer.matches
      ) {
        return;
      }

      const mainRect = main.getBoundingClientRect();
      pointerInside =
        event.clientY >= Math.max(0, mainRect.top) &&
        event.clientY <= Math.min(window.innerHeight, mainRect.bottom);

      if (!pointerInside) {
        pointer.targetStrength = 0;
        return;
      }

      const now = performance.now();
      const delta = Math.max(16, now - lastPointerTime);
      const hasPreviousPointer = lastPointerX > -9000;
      const movement = hasPreviousPointer
        ? Math.hypot(
            event.clientX - lastPointerX,
            event.clientY - lastPointerY,
          )
        : 0;

      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.targetStrength = 1;
      pointer.velocity = movement / delta;

      if (
        pointer.velocity > 0.78 &&
        nearestKey &&
        now - lastMissAt > 460
      ) {
        miss = {
          key: nearestKey,
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
      pointerInside = false;
      pointer.targetStrength = 0;
      lastPointerX = -9999;
      lastPointerY = -9999;
      lastNearestKey = "";
    };

    const handleScroll = () => {
      updateVisibility();

      if (visible && !frame) start();
      if (reducedMotion.matches || coarsePointer.matches) {
        draw(performance.now(), 0, true);
      }
    };

    const handlePreferenceChange = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }

      pointer.targetStrength = 0;
      trail = [];
      miss = null;
      start();
    };

    const resizeObserver = new ResizeObserver(() => {
      updatePageGeometry();
      resize();
    });
    resizeObserver.observe(main);

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    main.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    main.addEventListener("pointerleave", handlePointerLeave);
    reducedMotion.addEventListener("change", handlePreferenceChange);
    coarsePointer.addEventListener("change", handlePreferenceChange);

    document.fonts.ready.then(() => {
      updatePageGeometry();
      draw(
        performance.now(),
        0,
        reducedMotion.matches || coarsePointer.matches,
      );
    });

    resize();
    start();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
      main.removeEventListener("pointermove", handlePointerMove);
      main.removeEventListener("pointerleave", handlePointerLeave);
      reducedMotion.removeEventListener("change", handlePreferenceChange);
      coarsePointer.removeEventListener("change", handlePreferenceChange);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 hidden lg:block"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
