import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { resolveImage } from './images.js';

export const PLACEHOLDER_HELP = '{user} {username} {displayname} {server} {membercount}';

export function applyPlaceholders(text, member) {
  return text
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{displayname}', member.displayName)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));
}

export function parseColor(hex) {
  return Number.parseInt(hex.replace('#', ''), 16);
}

/** Builds the message payload a new member sees (matches the panel's settings). */
export async function buildWelcomeMessage(member, settings) {
  const fill = (text) => applyPlaceholders(text, member);
  const embed = new EmbedBuilder().setColor(parseColor(settings.color));
  const files = [];

  if (settings.title) embed.setTitle(fill(settings.title).slice(0, 256));
  if (settings.message) embed.setDescription(fill(settings.message).slice(0, 4096));

  const [thumbnail, image] = await Promise.all([
    resolveImage(settings.thumbnail, member),
    resolveImage(settings.image, member),
  ]);
  if (thumbnail) {
    embed.setThumbnail(thumbnail.url);
    if (thumbnail.file) files.push(thumbnail.file);
  }

  if (image) {
    embed.setImage(image.url);
    if (image.file) files.push(image.file);
  }

  if (settings.footer) embed.setFooter({ text: fill(settings.footer).slice(0, 2048) });
  if (settings.timestamp) embed.setTimestamp();

  // An embed needs at least some content to be sendable.
  if (!settings.title && !settings.message && !thumbnail && !image && !settings.footer) {
    embed.setDescription(`Welcome <@${member.id}>!`);
  }

  const components = [];
  if (settings.buttons.length) {
    const row = new ActionRowBuilder();
    for (const { label, url, emoji } of settings.buttons) {
      const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
      if (emoji) button.setEmoji(emoji);
      row.addComponents(button);
    }
    components.push(row);
  }

  return {
    content: settings.pingUser ? `<@${member.id}>` : undefined,
    embeds: [embed],
    files,
    components,
    allowedMentions: { users: [member.id] },
  };
}

export async function sendWelcome(member, settings) {
  const channel = await member.guild.channels.fetch(settings.channelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('The welcome channel no longer exists.');

  const sent = await channel.send(await buildWelcomeMessage(member, settings));
  if (settings.deleteAfter > 0) {
    setTimeout(() => sent.delete().catch(() => {}), settings.deleteAfter * 1000);
  }
  return sent;
}
