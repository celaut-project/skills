<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  // Conway's Game of Life rendered as a faint ambient decoration in the two
  // empty side margins of the page (mirrors the effect on the
  // game-of-prompts.github.io landing). Purely cosmetic: fixed behind all
  // content, pointer-events disabled, honours prefers-reduced-motion.

  const CELL = 14; // px per cell
  const STEP_MS = 220; // ms between generations
  const SPAWN_CHANCE = 0.32; // initial alive density

  let leftCanvas: HTMLCanvasElement;
  let rightCanvas: HTMLCanvasElement;

  interface Grid {
    cols: number;
    rows: number;
    cells: Uint8Array;
  }

  function makeGrid(w: number, h: number): Grid {
    const cols = Math.max(1, Math.ceil(w / CELL));
    const rows = Math.max(1, Math.ceil(h / CELL));
    const cells = new Uint8Array(cols * rows);
    for (let i = 0; i < cells.length; i++) {
      cells[i] = Math.random() < SPAWN_CHANCE ? 1 : 0;
    }
    return { cols, rows, cells };
  }

  function step(grid: Grid): void {
    const { cols, rows, cells } = grid;
    const next = new Uint8Array(cells.length);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (x + dx + cols) % cols;
            const ny = (y + dy + rows) % rows;
            n += cells[ny * cols + nx];
          }
        }
        const alive = cells[y * cols + x];
        next[y * cols + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
      }
    }
    grid.cells = next;
  }

  function draw(ctx: CanvasRenderingContext2D, grid: Grid, color: string): void {
    const { cols, rows, cells } = grid;
    ctx.clearRect(0, 0, cols * CELL, rows * CELL);
    ctx.fillStyle = color;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (cells[y * cols + x]) {
          ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
        }
      }
    }
  }

  onMount(() => {
    if (!browser) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const leftCtx = leftCanvas.getContext("2d");
    const rightCtx = rightCanvas.getContext("2d");
    if (!leftCtx || !rightCtx) return;

    // Cells use the theme foreground colour; opacity is handled in CSS.
    const color =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim() || "0 0% 0%";
    const fill = `hsl(${color})`;

    let leftGrid: Grid;
    let rightGrid: Grid;

    const resize = () => {
      const w = leftCanvas.clientWidth;
      const h = leftCanvas.clientHeight;
      for (const c of [leftCanvas, rightCanvas]) {
        c.width = c.clientWidth;
        c.height = c.clientHeight;
      }
      leftGrid = makeGrid(w, h);
      rightGrid = makeGrid(rightCanvas.clientWidth, rightCanvas.clientHeight);
      draw(leftCtx, leftGrid, fill);
      draw(rightCtx, rightGrid, fill);
    };

    resize();
    window.addEventListener("resize", resize);

    let timer: ReturnType<typeof setInterval> | undefined;
    if (!reduce) {
      timer = setInterval(() => {
        step(leftGrid);
        step(rightGrid);
        draw(leftCtx, leftGrid, fill);
        draw(rightCtx, rightGrid, fill);
      }, STEP_MS);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (timer) clearInterval(timer);
    };
  });
</script>

<div class="gol-layer" aria-hidden="true">
  <canvas bind:this={leftCanvas} class="gol-canvas gol-left"></canvas>
  <canvas bind:this={rightCanvas} class="gol-canvas gol-right"></canvas>
</div>

<style lang="postcss">
  .gol-layer {
    @apply fixed inset-0 pointer-events-none;
    z-index: -1;
  }

  .gol-canvas {
    @apply absolute top-0 h-full;
    /* Each strip fills the gutter between the viewport edge and the centred
       content column (which caps around 1280px). */
    width: max(0px, calc((100vw - 1280px) / 2));
    opacity: 0.5;
  }

  .gol-left {
    left: 0;
  }

  .gol-right {
    right: 0;
  }

  /* On narrow viewports there is no gutter, so hide the decoration entirely. */
  @media (max-width: 1320px) {
    .gol-layer {
      display: none;
    }
  }
</style>
