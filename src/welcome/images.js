import { AttachmentBuilder } from 'discord.js';
import { deleteImages, loadImage, saveImage } from '../storage.js';

// Uploaded images are kept in MongoDB because Discord attachment links expire.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export async function saveGuildImage(guildId, slot, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}).`);

  const contentType = res.headers.get('content-type')?.split(';')[0];
  const ext = EXTENSIONS[contentType];
  if (!ext) throw new Error('That file is not a PNG, JPG, GIF or WEBP image.');

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Images must be 8 MB or smaller.');

  removeGuildImage(guildId, slot);
  const name = `${guildId}-${slot}.${ext}`;
  await saveImage(name, contentType, buffer);
  return `file:${name}`;
}

export function removeGuildImage(guildId, slot) {
  deleteImages(`${guildId}-${slot}.`);
}

export function removeGuildImages(guildId) {
  deleteImages(`${guildId}-`);
}

/**
 * Parses what an admin typed for an image setting.
 * Returns { value } on success or { error } when the input isn't usable.
 */
export function parseImageInput(input, current) {
  const text = input.trim();
  const lower = text.toLowerCase();
  // Empty keeps the current image; only an explicit "none" removes it.
  if (!text) return { value: current };
  if (lower === 'none') return { value: null };
  if (lower === 'avatar' || lower === 'server') return { value: lower };
  if (text === current) return { value: current };
  try {
    const url = new URL(text);
    if (url.protocol === 'http:' || url.protocol === 'https:') return { value: url.href };
  } catch {
    // fall through
  }
  return { error: 'Enter an image link starting with `https://`, or `avatar`, `server` or `none`.' };
}

/** Turns a stored image value into an embed URL (plus the file to attach, for uploads). */
export async function resolveImage(value, member) {
  if (!value) return null;
  if (value === 'avatar') return { url: member.displayAvatarURL({ extension: 'png', size: 512 }) };
  if (value === 'server') {
    const url = member.guild.iconURL({ extension: 'png', size: 512 });
    return url ? { url } : null;
  }
  if (value.startsWith('file:')) {
    const name = value.slice('file:'.length);
    const data = await loadImage(name);
    if (!data) return null;
    return { url: `attachment://${name}`, file: new AttachmentBuilder(data, { name }) };
  }
  return { url: value };
}

export function describeImage(value) {
  if (!value) return '`None`';
  if (value === 'avatar') return "Member's avatar";
  if (value === 'server') return 'Server icon';
  if (value.startsWith('file:')) return 'Uploaded image';
  return value;
}
