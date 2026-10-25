import { AttachmentBuilder, ChannelType, EmbedBuilder, OverwriteType, PermissionFlagsBits } from 'discord.js';
import { parseColor } from '../welcome/message.js';
import { closedMessage, openTicketMessage, ticketControls } from './panel.js';
import {
  formatNumber,
  getTicket,
  getTicketSettings,
  nextTicketNumber,
  openTicketsOf,
  removeTicket,
  saveTicket,
} from './settings.js';
import { buildTranscript } from './transcript.js';

const { ViewChannel, SendMessages, ReadMessageHistory, AttachFiles, EmbedLinks, ManageChannels, ManageMessages } =
  PermissionFlagsBits;
const MEMBER_PERMS = [ViewChannel, SendMessages, ReadMessageHistory, AttachFiles, EmbedLinks];
// Same permissions in the form permissionOverwrites.edit() takes.
const MEMBER_ALLOW = { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true };

/** An error whose message is safe to show to the member. */
export class TicketError extends Error {}

// Stops double-clicks from opening two tickets at once.
const creating = new Set();

/** Returns why this member can't open a ticket right now, or null. */
export function openProblem(member) {
  const settings = getTicketSettings(member.guild.id);
  if (!settings.enabled) return 'Tickets are currently closed.';
  const open = openTicketsOf(member.guild.id, member.id);
  if (open.length >= settings.maxOpen) {
    return `You already have an open ticket: ${open.map((c) => `<#${c}>`).join(' ')}`;
  }
  if (!member.guild.members.me.permissions.has([ManageChannels, PermissionFlagsBits.ManageRoles])) {
    return 'I need the **Manage Channels** and **Manage Roles** permissions to create tickets. Ask an admin.';
  }
  return null;
}

export async function createTicket(member, reason) {
  const { guild } = member;
  const lock = `${guild.id}:${member.id}`;
  if (creating.has(lock)) throw new TicketError('Your ticket is already being created…');

  const problem = openProblem(member);
  if (problem) throw new TicketError(problem);

  creating.add(lock);
  try {
    const settings = getTicketSettings(guild.id);
    const category = guild.channels.cache.get(settings.categoryId);
    const supportRoles = settings.supportRoleIds.filter((r) => guild.roles.cache.has(r));
    const number = nextTicketNumber(guild.id);

    const channel = await guild.channels.create({
      name: `ticket-${formatNumber(number)}`,
      type: ChannelType.GuildText,
      parent: category?.type === ChannelType.GuildCategory ? category.id : null,
      topic: `Ticket #${formatNumber(number)} • ${member.user.username} (${member.id})`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [ViewChannel] },
        { id: member.id, allow: MEMBER_PERMS },
        { id: guild.members.me.id, allow: [...MEMBER_PERMS, ManageChannels, ManageMessages] },
        ...supportRoles.map((r) => ({ id: r, allow: MEMBER_PERMS })),
      ],
      reason: `Ticket opened by ${member.user.username}`,
    });

    const ticket = {
      number,
      ownerId: member.id,
      members: [],
      reason: reason || null,
      claimedBy: null,
      closed: false,
      controlMessageId: null,
      createdAt: Date.now(),
    };
    saveTicket(guild.id, channel.id, ticket);
    const control = await channel.send(openTicketMessage(member, settings, ticket));
    ticket.controlMessageId = control.id;
    saveTicket(guild.id, channel.id, ticket);

    await sendLog(guild, settings, logEmbed('🟢 Ticket Opened', settings, ticket, member, channel, reason && { Reason: reason }));
    return channel;
  } finally {
    creating.delete(lock);
  }
}

export async function claimTicket(channel, staff) {
  const ticket = getTicket(channel.guild.id, channel.id);
  if (ticket.claimedBy) throw new TicketError(`This ticket is already claimed by <@${ticket.claimedBy}>.`);
  ticket.claimedBy = staff.id;
  saveTicket(channel.guild.id, channel.id, ticket);

  const control = await channel.messages.fetch(ticket.controlMessageId).catch(() => null);
  await control?.edit({ components: [ticketControls(staff.displayName)] }).catch(() => {});
  await channel.send({ content: `🙋 <@${staff.id}> has claimed this ticket and will help you.`, allowedMentions: { parse: [] } });
}

export async function closeTicket(channel, closedBy) {
  const { guild } = channel;
  const ticket = getTicket(guild.id, channel.id);
  if (ticket.closed) throw new TicketError('This ticket is already closed.');

  for (const userId of [ticket.ownerId, ...ticket.members]) {
    await channel.permissionOverwrites
      .edit(userId, { ViewChannel: false }, { type: OverwriteType.Member, reason: 'Ticket closed' })
      .catch(() => {});
  }
  ticket.closed = true;
  saveTicket(guild.id, channel.id, ticket);

  const settings = getTicketSettings(guild.id);
  await channel.send(closedMessage(closedBy, settings.color));
  await sendLog(guild, settings, logEmbed('🔒 Ticket Closed', settings, ticket, closedBy, channel));
}

export async function reopenTicket(channel, reopenedBy) {
  const { guild } = channel;
  const ticket = getTicket(guild.id, channel.id);
  if (!ticket.closed) throw new TicketError('This ticket is already open.');

  for (const userId of [ticket.ownerId, ...ticket.members]) {
    await channel.permissionOverwrites
      .edit(userId, MEMBER_ALLOW, { type: OverwriteType.Member, reason: 'Ticket reopened' })
      .catch(() => {});
  }
  ticket.closed = false;
  saveTicket(guild.id, channel.id, ticket);

  const settings = getTicketSettings(guild.id);
  await channel.send({
    embeds: [new EmbedBuilder().setColor(parseColor(settings.color)).setDescription(`🔓 Ticket reopened by <@${reopenedBy.id}>`)],
  });
  await sendLog(guild, settings, logEmbed('🔓 Ticket Reopened', settings, ticket, reopenedBy, channel));
}

export async function deleteTicket(channel, deletedBy) {
  const { guild } = channel;
  const ticket = getTicket(guild.id, channel.id);
  const settings = getTicketSettings(guild.id);

  await channel.send('⛔ This ticket will be deleted in 5 seconds…');
  const transcript = await buildTranscript(channel, ticket).catch((err) => {
    console.warn(`[tickets] transcript failed: ${err.message}`);
    return null;
  });
  const files = () => (transcript ? [new AttachmentBuilder(transcript.data, { name: transcript.name })] : []);

  await sendLog(guild, settings, logEmbed('⛔ Ticket Deleted', settings, ticket, deletedBy, channel), files());

  if (settings.dmTranscript && transcript) {
    const owner = await guild.client.users.fetch(ticket.ownerId).catch(() => null);
    await owner
      ?.send({ content: `📑 Here is the transcript of your ticket **#${formatNumber(ticket.number)}** in **${guild.name}**.`, files: files() })
      .catch(() => {});
  }

  removeTicket(guild.id, channel.id);
  setTimeout(() => channel.delete(`Ticket deleted by ${deletedBy.user.username}`).catch(() => {}), 5000);
}

export async function sendTranscriptHere(channel) {
  const transcript = await buildTranscript(channel, getTicket(channel.guild.id, channel.id));
  return { content: '📑 Transcript:', files: [new AttachmentBuilder(transcript.data, { name: transcript.name })] };
}

export async function addMember(channel, member) {
  const ticket = getTicket(channel.guild.id, channel.id);
  if (member.id === ticket.ownerId || ticket.members.includes(member.id)) {
    throw new TicketError(`${member} is already in this ticket.`);
  }
  await channel.permissionOverwrites.edit(member.id, MEMBER_ALLOW, { type: OverwriteType.Member, reason: 'Added to ticket' });
  ticket.members.push(member.id);
  saveTicket(channel.guild.id, channel.id, ticket);
}

export async function removeMember(channel, member) {
  const ticket = getTicket(channel.guild.id, channel.id);
  if (member.id === ticket.ownerId) throw new TicketError('You can’t remove the person who opened the ticket.');
  if (!ticket.members.includes(member.id)) throw new TicketError(`${member} isn’t added to this ticket.`);
  await channel.permissionOverwrites.delete(member.id, 'Removed from ticket');
  ticket.members = ticket.members.filter((m) => m !== member.id);
  saveTicket(channel.guild.id, channel.id, ticket);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function logEmbed(title, settings, ticket, actor, channel, extra = {}) {
  const embed = new EmbedBuilder()
    .setColor(parseColor(settings.color))
    .setTitle(title)
    .addFields(
      { name: 'Ticket', value: `#${formatNumber(ticket.number)} (${channel.name})`, inline: true },
      { name: 'Opened by', value: `<@${ticket.ownerId}>`, inline: true },
      { name: 'Action by', value: `<@${actor.id}>`, inline: true },
    )
    .setTimestamp();
  if (ticket.claimedBy) embed.addFields({ name: 'Claimed by', value: `<@${ticket.claimedBy}>`, inline: true });
  for (const [name, value] of Object.entries(extra || {})) embed.addFields({ name, value: String(value).slice(0, 1024) });
  return embed;
}

async function sendLog(guild, settings, embed, files = []) {
  if (!settings.logChannelId) return;
  const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel
    .send({ embeds: [embed], files, allowedMentions: { parse: [] } })
    .catch((err) => console.warn(`[tickets] log failed in ${guild.name}: ${err.message}`));
}
