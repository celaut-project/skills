import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
// NETWORK_TRUST.md lives at the repo root; $lib resolves to src/lib, so ../../ reaches the root.
import networkMd from '$lib/../../NETWORK_TRUST.md?raw';

// A dedicated Marked instance, matching renderScoreDoc so the two in-repo docs
// render identically (GFM tables + optional KaTeX math), without leaking the
// KaTeX extension into other renderers.
const marked = new Marked();
marked.use(
  markedKatex({
    throwOnError: false,
    output: 'html',
    nonStandard: true
  })
);

/**
 * The Networks & Trust Frameworks explainer (NETWORK_TRUST.md), pre-rendered to
 * HTML. Rendered once at module load — the doc is a trusted in-repo file.
 */
export const networkDocHtml: string = marked.parse(networkMd) as string;
