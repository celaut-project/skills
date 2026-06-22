/**
 * Svelte action that relocates a node to a target element (default `<body>`).
 *
 * Modal backdrops are `position: fixed`, but when they render inside a parent
 * that establishes a stacking/containing context (e.g. the sticky navbar's
 * stacking context, or a `.container` wrapper) they get trapped *under* the
 * app frame — so the header and menu stay visible through the "full-screen"
 * overlay. Teleporting the node to `<body>` lifts it out of every ancestor
 * context so its z-index is measured against the document root.
 *
 * Svelte's scoped style classes live on the node itself and are injected
 * globally, so styling survives the move.
 */
export function portal(node: HTMLElement, target: string | HTMLElement = 'body') {
  let targetEl: HTMLElement | null = null;

  function mount(t: string | HTMLElement) {
    targetEl = typeof t === 'string' ? document.querySelector<HTMLElement>(t) : t;
    if (targetEl) targetEl.appendChild(node);
  }

  // Actions only run in the browser, so `document` is always available here.
  mount(target);

  return {
    update(t: string | HTMLElement) {
      mount(t);
    },
    destroy() {
      node.parentNode?.removeChild(node);
    }
  };
}
