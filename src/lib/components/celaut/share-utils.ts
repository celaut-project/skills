/**
 * Share utilities for the "Share Skill" modal.
 *
 * Generates platform-specific share messages and URLs for a Skill (Twitter/X,
 * Telegram, LinkedIn) plus a copy-to-clipboard fallback. Adapted from the
 * game-of-prompts share-utils, retargeted at skills and this app's deep-link
 * scheme (`?skill=<boxId>`).
 */

export type SharePlatform = 'twitter' | 'telegram' | 'linkedin';

export interface ShareConfig {
  /** Human-readable skill name. */
  skillName: string;
  /** Skill box id — used to build a deep link to the skill. */
  skillBoxId: string;
  /** Optional prose/description, trimmed into the message. */
  description?: string;
  /** Override the base URL (defaults to the current origin). */
  baseUrl?: string;
}

/** Current origin, computed lazily so this module stays SSR-safe. */
function defaultBaseUrl(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Build a deep link to a skill: `<origin>?skill=<boxId>`. */
export function getSkillUrl(skillBoxId: string, baseUrl: string = defaultBaseUrl()): string {
  return `${baseUrl}?skill=${encodeURIComponent(skillBoxId)}`;
}

/** Compose the standardized share message for a skill. */
function generateShareMessage(skillName: string, description?: string): string {
  const cleaned = description
    ? description.substring(0, 100).replace(/[^\w\s\-.]/g, '').trim()
    : '';
  return `Check out the "${skillName}" skill on Unstoppable Skills 🤖${cleaned ? `\n\n${cleaned}` : ''}\n\n#UnstoppableSkills #ErgoBlockchain`;
}

/** Twitter/X web-intent share URL. */
export function getTwitterShareUrl(config: ShareConfig): string {
  const message = generateShareMessage(config.skillName, config.description);
  const url = getSkillUrl(config.skillBoxId, config.baseUrl);
  const params = new URLSearchParams({ text: `${message}\n\n${url}` });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/** Telegram share URL with pre-filled text. */
export function getTelegramShareUrl(config: ShareConfig): string {
  const message = generateShareMessage(config.skillName, config.description);
  const url = getSkillUrl(config.skillBoxId, config.baseUrl);
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`;
}

/** LinkedIn offsite share URL. */
export function getLinkedInShareUrl(config: ShareConfig): string {
  const url = getSkillUrl(config.skillBoxId, config.baseUrl);
  const message = generateShareMessage(config.skillName, config.description);
  const params = new URLSearchParams({
    url,
    title: config.skillName,
    summary: message.substring(0, 300),
    source: 'UnstoppableSkills'
  });
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
}

/** Resolve the share URL for a platform. */
export function getShareUrl(platform: SharePlatform, config: ShareConfig): string {
  switch (platform) {
    case 'twitter':
      return getTwitterShareUrl(config);
    case 'telegram':
      return getTelegramShareUrl(config);
    case 'linkedin':
      return getLinkedInShareUrl(config);
    default:
      throw new Error(`Unknown share platform: ${platform}`);
  }
}

/** Plain shareable text for copy-to-clipboard (message + deep link). */
export function getShareText(config: ShareConfig): string {
  const message = generateShareMessage(config.skillName, config.description);
  const url = getSkillUrl(config.skillBoxId, config.baseUrl);
  return `${message}\n\n${url}`;
}

/** Open a share URL in a centered popup window. */
export function openShareUrl(url: string, platform: SharePlatform): void {
  if (typeof window === 'undefined') return;
  const width = 600;
  const height = 480;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;
  window.open(url, `${platform}-share`, `width=${width},height=${height},left=${left},top=${top}`);
}

/** Copy text to clipboard, returning success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/** UI metadata per platform. */
export function getPlatformMetadata(platform: SharePlatform): { name: string } {
  const metadata: Record<SharePlatform, { name: string }> = {
    twitter: { name: 'Twitter (X)' },
    telegram: { name: 'Telegram' },
    linkedin: { name: 'LinkedIn' }
  };
  return metadata[platform];
}
