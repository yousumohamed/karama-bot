import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { BRAND_COLOR, PREFIX } from '../config.js';
import { cacheGuildInvites } from '../invites/tracker.js';
import {
  getInviteSettings,
  inviteLeaderboard,
  inviterStats,
  resetInviteStats,
  updateInviteSettings,
} from '../invites/settings.js';
import { channelWarning } from '../welcome/checks.js';
import { resolveMember, resolveTextChannel } from './args.js';

const NO_ADMIN = '❌ You need the **Manage Server** permission to use this.';
const MEDALS = ['🥇', '🥈', '🥉'];

const plural = (n) => `**${n}** invite${n === 1 ? '' : 's'}`;

const line = (entry, rank) =>
  `${MEDALS[rank] ?? `**${rank + 1}.**`} <@${entry.id}> — ${plural(entry.total)} (${entry.joins} joined, ${entry.left} left)`;

function summaryEmbed(guild) {
  const board = inviteLeaderboard(guild.id);
  const top = board.slice(0, 10);
  const least = board.slice(10).slice(-5).reverse();

  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('📨 Invite Summary')
    .setThumbnail(guild.iconURL())
    .addFields(
      { name: '🏆 Most Invites', value: top.length ? top.map(line).join('\n') : '*No invites tracked yet.*' },
      {
        name: '📉 Least Invites',
        value: least.length
          ? least.map((e) => line(e, board.indexOf(e))).join('\n')
          : board.length
            ? '*Everyone who invited is already in the top 10.*'
            : '*No invites tracked yet.*',
      },
    )
    .setFooter({ text: `${board.length} inviters • ${board.reduce((n, e) => n + e.joins, 0)} tracked joins` });
}

function memberLine(guild, member) {
  const { joins, left, total } = inviterStats(guild.id, member.id);
  const rank = inviteLeaderboard(guild.id).findIndex((e) => e.id === member.id);
  return `📨 ${member} has ${plural(total)} (${joins} joined, ${left} left)${rank >= 0 ? ` — rank **#${rank + 1}**` : ''}.`;
}

export default {
  name: 'invite',
  aliases: ['invites'],
  title: '📨 Invite Tracker',
  usage: [
    ['invite #channel', 'Post who invited each new member in that channel'],
    ['invite summary', 'Top and lowest inviters'],
    ['invite @member', 'How many people a member invited (yours if empty)'],
    ['invite off', 'Stop posting join messages'],
    ['invite reset', 'Reset all invite counts'],
  ],

  async run(message, args) {
    const { guild, member } = message;
    const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild);
    const sub = args[0]?.toLowerCase();

    if (['summary', 'top', 'leaderboard', 'lb'].includes(sub)) {
      return message.reply({ embeds: [summaryEmbed(guild)], allowedMentions: { parse: [] } });
    }

    if (sub === 'off') {
      if (!isAdmin) return message.reply(NO_ADMIN);
      updateInviteSettings(guild.id, { channelId: null });
      return message.reply('✅ Join messages turned off. Invites are still being counted.');
    }

    if (sub === 'reset') {
      if (!isAdmin) return message.reply(NO_ADMIN);
      resetInviteStats(guild.id);
      return message.reply('🔄 All invite counts have been reset.');
    }

    const channel = resolveTextChannel(message, args[0]);
    if (channel) {
      if (!isAdmin) return message.reply(NO_ADMIN);
      updateInviteSettings(guild.id, { channelId: channel.id });
      await cacheGuildInvites(guild);
      const canSeeInvites = guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild);
      return message.reply(
        `✅ Join messages with who invited them will be posted in ${channel}.${channelWarning(channel)}` +
          (canSeeInvites ? '' : '\n⚠️ I need the **Manage Server** permission to see which invite was used.'),
      );
    }

    const target = args[0] ? await resolveMember(message, args[0]) : member;
    if (target) return message.reply({ content: memberLine(guild, target), allowedMentions: { parse: [] } });

    const { channelId } = getInviteSettings(guild.id);
    return message.reply(
      `❓ I couldn't find that channel or member. Join messages: ${channelId ? `<#${channelId}>` : '`off`'}.\n` +
        `Try \`${PREFIX}invite #channel\`, \`${PREFIX}invite summary\` or \`${PREFIX}invite @member\`.`,
    );
  },
};
