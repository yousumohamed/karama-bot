import { PermissionFlagsBits } from 'discord.js';
import { buildStatusEmbed, getStatusSettings, setStatusSettings, UPDATE_MINUTES, updateStatusMessage } from '../status/status.js';
import { channelWarning } from '../welcome/checks.js';
import { resolveTextChannel } from './args.js';

const NO_ADMIN = '❌ You need the **Manage Server** permission to use this.';

export default {
  name: 'ping',
  aliases: ['status'],
  title: '📶 Bot Status',
  usage: [
    ['ping', 'Show the bot status'],
    ['ping #channel', `Post a live status there that updates every ${UPDATE_MINUTES} minutes`],
    ['ping off', 'Stop the live status'],
  ],

  async run(message, args) {
    const { guild, member, client } = message;
    const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!args.length) return message.reply({ embeds: [buildStatusEmbed(client)] });

    // Removes the current live status message, if there is one.
    const removeOld = async () => {
      const { channelId, messageId } = getStatusSettings(guild.id);
      if (!channelId || !messageId) return;
      const old = await client.channels.fetch(channelId).catch(() => null);
      await old?.messages.delete(messageId).catch(() => {});
    };

    if (args[0].toLowerCase() === 'off') {
      if (!isAdmin) return message.reply(NO_ADMIN);
      await removeOld();
      setStatusSettings(guild.id, { channelId: null, messageId: null });
      return message.reply('✅ Live status turned off.');
    }

    const channel = resolveTextChannel(message, args[0]);
    if (!channel) return message.reply('❌ I couldn’t find that channel. Example: `?ping #bot-status`');
    if (!isAdmin) return message.reply(NO_ADMIN);

    await removeOld();
    setStatusSettings(guild.id, { channelId: channel.id, messageId: null });
    await updateStatusMessage(client, guild.id);
    return message.reply(`✅ Live bot status posted in ${channel}. It updates every ${UPDATE_MINUTES} minutes.${channelWarning(channel)}`);
  },
};
