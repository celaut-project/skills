import { writable } from 'svelte/store';

/**
 * Single side-rail Forum panel state. Per Josemi 2026-06-16: every Forum
 * usage funnels through one full-height chat panel; the panel title surfaces
 * which topic is being discussed (skill general, a specific benchmark, a
 * specific result, a specific coverage, etc.).
 */
export interface ForumSidebarState {
  open: boolean;
  topicId: string | null;
  title: string;
}

const initial: ForumSidebarState = {
  open: false,
  topicId: null,
  title: ''
};

export const forumSidebar = writable<ForumSidebarState>(initial);

/** Open the panel for a given topic id with a human title shown in the header. */
export function openForum(topicId: string, title: string): void {
  forumSidebar.set({ open: true, topicId, title });
}

/** Close the panel; topic stays so re-opening the same one preserves position. */
export function closeForum(): void {
  forumSidebar.update((s) => ({ ...s, open: false }));
}
