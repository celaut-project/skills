import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
// SCORE.md lives at the repo root; $lib resolves to src/lib, so ../../ reaches the root.
import scoreMd from '$lib/../../SCORE.md?raw';

// A dedicated Marked instance so the KaTeX extension doesn't leak into other renderers.
const marked = new Marked();
marked.use(
  markedKatex({
    throwOnError: false,
    // Inherit text color so formulas stay legible in both light and dark themes.
    output: 'html'
  })
);

/**
 * The full SCORE.md scoring spec, pre-rendered to HTML with KaTeX-typeset math.
 * Rendered once at module load — the doc is a trusted in-repo file.
 */
export const scoreDocHtml: string = marked.parse(scoreMd) as string;
