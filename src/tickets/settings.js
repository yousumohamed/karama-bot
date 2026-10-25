import { PermissionFlagsBits } from 'discord.js';
import { deleteSection, getSection, setSection } from '../storage.js';

export const DEFAULT_TICKETS = {
  enabled: true,
  categoryId: null,
  supportRoleIds: [],
  logChannelId: null,
  color: '#5865F2',
  panelTitle: '🎫 Support Tickets',
  panelDescription:
    'Need help? Click the button below to open a private ticket.\n' +
    'Our staff will be with you as soon as possible.',
  buttonLabel: 'Create Ticket',
  openMessage:
    'Thanks for opening a ticket, {user}!\n\n' +
    'Support will be with you shortly. Please describe your issue in as much detail as you can.',
  askReason: true,
  pingSupport: true,
  dmTranscript: true,
  maxOpen: 1,
};

export const MAX_SUPPORT_ROLES = 10;

export function getTicketSettings(guildId) {
  return getSection(guildId, 'tickets', DEFAULT_TICKETS);
}

export function updateTicketSettings(guildId, patch) {
  const settings = { ...getTicketSettings(guildId), ...patch };
  setSection(guildId, 'tickets', settings);
  return settings;
}

export function resetTicketSettings(guildId) {
  deleteSection(guildId, 'tickets');
  return getTicketSettings(guildId);
}

// ─── Ticket records ──────────────────────────────────────────────────────────
// { counter, tickets: { [channelId]: { number, ownerId, members, reason, claimedBy, closed, controlMessageId, createdAt } } }

const DEFAULT_DATA = { counter: 0, tickets: {} };

const getData = (guildId) => getSection(guildId, 'ticketData', DEFAULT_DATA);
const setData = (guildId, data) => setSection(guildId, 'ticketData', data);

export function nextTicketNumber(guildId) {
  const data = getData(guildId);
  data.counter++;
  setData(guildId, data);
  return data.counter;
}

export function getTicket(guildId, channelId) {
  return getData(guildId).tickets[channelId] ?? null;
}

export function saveTicket(guildId, channelId, ticket) {
  const data = getData(guildId);
  data.tickets[channelId] = ticket;
  setData(guildId, data);
}

export function removeTicket(guildId, channelId) {
  const data = getData(guildId);
  if (!data.tickets[channelId]) return;
  delete data.tickets[channelId];
  setData(guildId, data);
}

export function openTicketsOf(guildId, userId) {
  return Object.entries(getData(guildId).tickets)
    .filter(([, t]) => t.ownerId === userId && !t.closed)
    .map(([channelId]) => channelId);
}

export function countOpenTickets(guildId) {
  return Object.values(getData(guildId).tickets).filter((t) => !t.closed).length;
}

export const formatNumber = (number) => String(number).padStart(4, '0');

/** Staff = anyone with a support role, or Manage Channels. */
export function isStaff(member, settings) {
  return (
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    settings.supportRoleIds.some((id) => member.roles.cache.has(id))
  );
}
