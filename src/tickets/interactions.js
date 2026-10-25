import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { ephemeral } from '../ui.js';
import { channelWarning } from '../welcome/checks.js';
import {
  claimTicket,
  closeTicket,
  createTicket,
  deleteTicket,
  openProblem,
  reopenTicket,
  sendTranscriptHere,
  TicketError,
} from './actions.js';
import {
  buildPublicPanel,
  buildSetupPanel,
  categoryView,
  closeConfirm,
  colorModal,
  logsView,
  maxOpenModal,
  panelMessageModal,
  reasonModal,
  rolesView,
  sendView,
  settingsView,
  ticketMessageModal,
} from './panel.js';
import { getTicket, getTicketSettings, isStaff, resetTicketSettings, updateTicketSettings } from './settings.js';

const panel = (i, settings = getTicketSettings(i.guildId)) => buildSetupPanel(i.guildId, settings);

/** Re-renders the setup panel after a change made from one of its sub-menus. */
async function refreshPanel(i, panelId) {
  if (!panelId) return;
  const message = await i.channel?.messages.fetch(panelId).catch(() => null);
  await message?.edit(panel(i)).catch(() => {});
}

async function open(i, reason) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const channel = await createTicket(i.member, reason);
    await i.editReply(`✅ Your ticket has been created: ${channel}`);
  } catch (err) {
    if (!(err instanceof TicketError)) console.error('[tickets] create failed', err);
    await i.editReply(`❌ ${err instanceof TicketError ? err.message : 'Couldn’t create your ticket. Ask an admin to check my permissions.'}`);
  }
}

// ─── Anyone (the public "Create Ticket" button) ─────────────────────────────

const publicHandlers = {
  create(i) {
    const problem = openProblem(i.member);
    if (problem) return i.reply(ephemeral(`❌ ${problem}`));
    if (getTicketSettings(i.guildId).askReason) return i.showModal(reasonModal());
    return open(i, null);
  },
  m_create: (i) => open(i, i.fields.getTextInputValue('reason').trim()),
};

// ─── Inside a ticket channel ────────────────────────────────────────────────
// Each entry: [who may use it, handler]. 'owner' = the ticket opener or staff.

const ticketHandlers = {
  close: ['owner', (i) => i.reply(closeConfirm())],

  close_confirm: [
    'owner',
    async (i) => {
      await i.deferUpdate();
      await i.message.delete().catch(() => {});
      await closeTicket(i.channel, i.member);
    },
  ],

  close_cancel: [
    'owner',
    async (i) => {
      await i.deferUpdate();
      await i.message.delete().catch(() => {});
    },
  ],

  claim: [
    'staff',
    async (i) => {
      await i.deferUpdate();
      await claimTicket(i.channel, i.member);
    },
  ],

  reopen: [
    'staff',
    async (i) => {
      await i.deferUpdate();
      await i.message.edit({ components: [] }).catch(() => {});
      await reopenTicket(i.channel, i.member);
    },
  ],

  transcript: [
    'staff',
    async (i) => {
      await i.deferReply();
      await i.editReply(await sendTranscriptHere(i.channel));
    },
  ],

  delete: [
    'staff',
    async (i) => {
      await i.deferUpdate();
      await i.message.edit({ components: [] }).catch(() => {});
      await deleteTicket(i.channel, i.member);
    },
  ],
};

// ─── Setup panel (Manage Server) ────────────────────────────────────────────

const setupHandlers = {
  panel_message: (i) => i.showModal(panelMessageModal(getTicketSettings(i.guildId))),
  ticket_message: (i) => i.showModal(ticketMessageModal(getTicketSettings(i.guildId))),
  color: (i) => i.showModal(colorModal(getTicketSettings(i.guildId))),
  category: (i) => i.reply(ephemeral(categoryView(i.message.id))),
  logs: (i) => i.reply(ephemeral(logsView(i.message.id))),
  roles: (i) => i.reply(ephemeral(rolesView(getTicketSettings(i.guildId), i.message.id))),
  settings: (i) => i.reply(ephemeral(settingsView(getTicketSettings(i.guildId)))),
  send: (i) => i.reply(ephemeral(sendView())),
  preview: (i) => i.reply(ephemeral(buildPublicPanel(i.guild, getTicketSettings(i.guildId)))),

  async reset(i) {
    await i.update(panel(i, resetTicketSettings(i.guildId)));
    await i.followUp(ephemeral('🔄 Ticket settings have been reset. Open tickets were not touched.'));
  },
  enable: (i) => i.update(panel(i, updateTicketSettings(i.guildId, { enabled: true }))),
  disable: (i) => i.update(panel(i, updateTicketSettings(i.guildId, { enabled: false }))),

  async m_panel(i) {
    updateTicketSettings(i.guildId, {
      panelTitle: i.fields.getTextInputValue('title').trim(),
      panelDescription: i.fields.getTextInputValue('description').trim(),
      buttonLabel: i.fields.getTextInputValue('button').trim(),
    });
    await i.reply(ephemeral('✅ Panel message updated. Click **Send Panel** to post the new version.'));
  },

  async m_ticket(i) {
    updateTicketSettings(i.guildId, { openMessage: i.fields.getTextInputValue('message').trim() });
    await i.reply(ephemeral('✅ The message inside new tickets has been updated.'));
  },

  async m_color(i) {
    const input = i.fields.getTextInputValue('color').trim();
    if (!/^#?[0-9a-f]{6}$/i.test(input)) return i.reply(ephemeral('❌ That isn’t a valid hex color. Example: `#5865F2`'));
    const color = `#${input.replace('#', '').toUpperCase()}`;
    updateTicketSettings(i.guildId, { color });
    await i.reply(ephemeral(`✅ Ticket color set to \`${color}\`.`));
  },

  async set_category(i, panelId) {
    const category = i.channels.first();
    updateTicketSettings(i.guildId, { categoryId: category.id });
    await i.update({ content: `✅ New tickets will be created in **${category.name}**.`, components: [] });
    await refreshPanel(i, panelId);
  },
  async clear_category(i, panelId) {
    updateTicketSettings(i.guildId, { categoryId: null });
    await i.update({ content: '✅ New tickets will be created outside any category.', components: [] });
    await refreshPanel(i, panelId);
  },

  async set_logs(i, panelId) {
    const channel = i.channels.first();
    updateTicketSettings(i.guildId, { logChannelId: channel.id });
    await i.update({ content: `✅ Ticket logs will be sent to ${channel}.${channelWarning(channel)}`, components: [] });
    await refreshPanel(i, panelId);
  },
  async clear_logs(i, panelId) {
    updateTicketSettings(i.guildId, { logChannelId: null });
    await i.update({ content: '✅ Ticket logs turned off.', components: [] });
    await refreshPanel(i, panelId);
  },

  async set_roles(i, panelId) {
    const roles = i.values.filter((id) => id !== i.guildId);
    updateTicketSettings(i.guildId, { supportRoleIds: roles });
    await i.update({
      content: roles.length ? `✅ Support roles: ${roles.map((r) => `<@&${r}>`).join(' ')}` : '✅ Support roles removed.',
      components: [],
      allowedMentions: { parse: [] },
    });
    await refreshPanel(i, panelId);
  },

  t_reason: (i) => toggleSetting(i, 'askReason'),
  t_ping: (i) => toggleSetting(i, 'pingSupport'),
  t_dm: (i) => toggleSetting(i, 'dmTranscript'),
  max_open: (i) => i.showModal(maxOpenModal(getTicketSettings(i.guildId))),

  m_max(i) {
    const max = Number(i.fields.getTextInputValue('max').trim());
    if (!Number.isInteger(max) || max < 1 || max > 10) return i.reply(ephemeral('❌ Enter a whole number from 1 to 10.'));
    return i.update(settingsView(updateTicketSettings(i.guildId, { maxOpen: max })));
  },

  async send_to(i) {
    const channel = i.channels.first();
    try {
      await channel.send(buildPublicPanel(i.guild, getTicketSettings(i.guildId)));
      await i.update({ content: `✅ Ticket panel posted in ${channel}.`, components: [] });
    } catch (err) {
      await i.update({ content: `❌ Couldn’t post in ${channel}: ${err.message}${channelWarning(channel)}`, components: [] });
    }
  },
};

function toggleSetting(i, key) {
  const current = getTicketSettings(i.guildId)[key];
  return i.update(settingsView(updateTicketSettings(i.guildId, { [key]: !current })));
}

export async function handleTicketInteraction(i) {
  if (!i.inCachedGuild()) return;
  const [, action, panelId] = i.customId.split(':');

  if (publicHandlers[action]) return publicHandlers[action](i);

  if (ticketHandlers[action]) {
    const [who, handler] = ticketHandlers[action];
    const ticket = getTicket(i.guildId, i.channelId);
    if (!ticket) return i.reply(ephemeral('❌ This isn’t an active ticket.'));
    const staff = isStaff(i.member, getTicketSettings(i.guildId));
    if (!staff && (who === 'staff' || ticket.ownerId !== i.user.id)) {
      return i.reply(ephemeral('❌ Only the support team can do that.'));
    }
    try {
      return await handler(i);
    } catch (err) {
      if (!(err instanceof TicketError)) throw err;
      return i.followUp(ephemeral(`❌ ${err.message}`));
    }
  }

  if (!setupHandlers[action]) return;
  if (!i.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return i.reply(ephemeral('❌ You need the **Manage Server** permission to use this.'));
  }
  return setupHandlers[action](i, panelId);
}
