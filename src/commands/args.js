import { ChannelType } from 'discord.js';

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

/** Finds a text channel from a #mention, an ID, or a plain name like "welcome". */
export function resolveTextChannel(message, arg) {
  if (!arg) return null;
  const channel =
    message.mentions.channels.first() ??
    message.guild.channels.cache.get(arg) ??
    message.guild.channels.cache.find((c) => c.name.toLowerCase() === arg.replace(/^#/, '').toLowerCase());
  return TEXT_TYPES.includes(channel?.type) ? channel : null;
}

/** Finds a member from an @mention or an ID. */
export async function resolveMember(message, arg) {
  return message.mentions.members.first() ?? (arg && /^\d+$/.test(arg) ? message.guild.members.fetch(arg).catch(() => null) : null);
}
