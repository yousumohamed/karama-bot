import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { PREFIX } from '../config.js';
import { addMember, claimTicket, removeMember, TicketError } from '../tickets/actions.js';
import { buildPublicPanel, buildSetupPanel, closeConfirm } from '../tickets/panel.js';
import { getTicket, getTicketSettings, isStaff, resetTicketSettings } from '../tickets/settings.js';
import { channelWarning } from '../welcome/checks.js';

const NO_ADMIN = '❌ You need the **Manage Server** permission to use this.';
const NOT_TICKET = '❌ Use this inside a ticket channel.';
const NOT_STAFF = '❌ Only the support team can do that.';

export default {
  name: 'ticket',
  title: '🎫 Tickets',
  usage: [
    ['ticket', 'Open the ticket setup panel'],
    ['ticket send #channel', 'Post the "Create Ticket" panel'],
    ['ticket close', 'Close the current ticket'],
    ['ticket claim', 'Claim the current ticket'],
    ['ticket add @member', 'Add someone to the current ticket'],
    ['ticket remove @member', 'Remove someone from the current ticket'],
    ['ticket rename <name>', 'Rename the current ticket channel'],
    ['ticket reset', 'Reset ticket settings'],
  ],

  async run(message, args) {
    const { guild, member, channel } = message;
    const sub = args.shift()?.toLowerCase();
    const settings = getTicketSettings(guild.id);
    const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild);
    const ticket = getTicket(guild.id, channel.id);
    const staff = isStaff(member, settings);

    try {
      switch (sub) {
        case undefined:
        case 'setup':
          if (!isAdmin) return message.reply(NO_ADMIN);
          return message.reply(buildSetupPanel(guild.id, settings));

        case 'send': {
          if (!isAdmin) return message.reply(NO_ADMIN);
          const target = message.mentions.channels.first() ?? channel;
          if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(target.type)) {
            return message.reply('❌ Pick a text channel.');
          }
          await target.send(buildPublicPanel(guild, settings)).catch((err) => {
            throw new TicketError(`Couldn’t post in ${target}: ${err.message}${channelWarning(target)}`);
          });
          if (target.id !== channel.id) return message.reply(`✅ Ticket panel posted in ${target}.`);
          return message.delete().catch(() => {});
        }

        case 'close':
          if (!ticket) return message.reply(NOT_TICKET);
          if (!staff && ticket.ownerId !== member.id) return message.reply(NOT_STAFF);
          if (ticket.closed) return message.reply('❌ This ticket is already closed.');
          return message.reply(closeConfirm());

        case 'claim':
          if (!ticket) return message.reply(NOT_TICKET);
          if (!staff) return message.reply(NOT_STAFF);
          return claimTicket(channel, member);

        case 'add':
        case 'remove': {
          if (!ticket) return message.reply(NOT_TICKET);
          if (!staff) return message.reply(NOT_STAFF);
          const target = message.mentions.members.first() ?? (await guild.members.fetch(args[0] ?? '0').catch(() => null));
          if (!target) return message.reply(`❌ Mention someone, e.g. \`${PREFIX}ticket ${sub} @member\`.`);
          if (sub === 'add') {
            await addMember(channel, target);
            return message.reply({ content: `✅ Added ${target} to this ticket.`, allowedMentions: { users: [target.id] } });
          }
          await removeMember(channel, target);
          return message.reply({ content: `✅ Removed ${target} from this ticket.`, allowedMentions: { parse: [] } });
        }

        case 'rename': {
          if (!ticket) return message.reply(NOT_TICKET);
          if (!staff) return message.reply(NOT_STAFF);
          const name = args.join('-').toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 90);
          if (!name) return message.reply(`❌ Give a name, e.g. \`${PREFIX}ticket rename payment-issue\`.`);
          await channel.setName(name);
          return message.reply(`✅ Ticket renamed to **${name}**.`);
        }

        case 'reset':
          if (!isAdmin) return message.reply(NO_ADMIN);
          resetTicketSettings(guild.id);
          return message.reply('🔄 Ticket settings have been reset. Open tickets were not touched.');

        default:
          return message.reply(`❓ Unknown option. Type \`${PREFIX}help ticket\` to see what's available.`);
      }
    } catch (err) {
      if (err instanceof TicketError) return message.reply({ content: `❌ ${err.message}`, allowedMentions: { parse: [] } });
      throw err;
    }
  },
};
