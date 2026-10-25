import {
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextInputStyle,
} from 'discord.js';
import { BRAND_COLOR, PREFIX } from '../config.js';
import { row, textField } from '../ui.js';
import { parseColor } from '../welcome/message.js';
import { countOpenTickets, formatNumber, MAX_SUPPORT_ROLES } from './settings.js';

// Every custom ID is "ticket:<action>[:<panelMessageId>]".
const id = (action, panelId) => (panelId ? `ticket:${action}:${panelId}` : `ticket:${action}`);

const button = (action, label, emoji, style = ButtonStyle.Secondary, panelId) =>
  new ButtonBuilder().setCustomId(id(action, panelId)).setLabel(label).setEmoji(emoji).setStyle(style);

const toggle = (action, label, emoji, on) =>
  button(action, `${label}: ${on ? 'On' : 'Off'}`, emoji, on ? ButtonStyle.Success : ButtonStyle.Secondary);

const mentionRoles = (ids) => (ids.length ? ids.map((r) => `<@&${r}>`).join(' ') : '`None`');

// ─── Setup panel (admins) ────────────────────────────────────────────────────

export function buildSetupPanel(guildId, settings) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🎫 Ticket Setup Panel')
    .setDescription(
      [
        'Configure the ticket system for your server using the buttons below.',
        'Click any button to configure that setting',
        '',
        `• **Status:** ${settings.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
        `• **Category:** ${settings.categoryId ? `<#${settings.categoryId}>` : '`None`'}`,
        `• **Support Roles:** ${mentionRoles(settings.supportRoleIds)}`,
        `• **Log Channel:** ${settings.logChannelId ? `<#${settings.logChannelId}>` : '`None`'}`,
        `• **Open Tickets:** ${countOpenTickets(guildId)}`,
        '',
        `💡 *Use \`${PREFIX}ticket send #support\` to post the ticket panel directly.*`,
        `💡 *Use \`${PREFIX}ticket reset\` to reset all ticket settings.*`,
      ].join('\n'),
    );

  return {
    embeds: [embed],
    components: [
      row(
        button('panel_message', 'Panel Message', '📝'),
        button('ticket_message', 'Ticket Message', '💬'),
        button('color', 'Embed Color', '🎨'),
        button('category', 'Category', '📂'),
        button('logs', 'Log Channel', '📜'),
      ),
      row(
        button('roles', 'Support Roles', '👮'),
        button('settings', 'Settings', '⚙️'),
        button('preview', 'Preview', '👀', ButtonStyle.Primary),
        button('send', 'Send Panel', '📤', ButtonStyle.Primary),
      ),
      row(
        button('reset', 'Reset', '🔄', ButtonStyle.Danger),
        button('enable', 'Enable', '✅', ButtonStyle.Success),
        button('disable', 'Disable', '❌', ButtonStyle.Danger),
      ),
    ],
    allowedMentions: { parse: [] },
  };
}

export function categoryView(panelId) {
  return {
    content: '📂 Pick the category new ticket channels are created in:',
    components: [
      row(
        new ChannelSelectMenuBuilder()
          .setCustomId(id('set_category', panelId))
          .setChannelTypes(ChannelType.GuildCategory)
          .setPlaceholder('Select a category'),
      ),
      row(button('clear_category', 'No Category', '🗑️', ButtonStyle.Danger, panelId)),
    ],
  };
}

export function logsView(panelId) {
  return {
    content: '📜 Pick the channel where ticket logs and transcripts are sent:',
    components: [
      row(
        new ChannelSelectMenuBuilder()
          .setCustomId(id('set_logs', panelId))
          .setChannelTypes(ChannelType.GuildText)
          .setPlaceholder('Select a channel'),
      ),
      row(button('clear_logs', 'No Log Channel', '🗑️', ButtonStyle.Danger, panelId)),
    ],
  };
}

export function rolesView(settings, panelId) {
  const select = new RoleSelectMenuBuilder()
    .setCustomId(id('set_roles', panelId))
    .setPlaceholder('Select support roles')
    .setMinValues(0)
    .setMaxValues(MAX_SUPPORT_ROLES);
  if (settings.supportRoleIds.length) select.setDefaultRoles(settings.supportRoleIds);
  return {
    content:
      '👮 Pick the roles that can see and manage tickets (up to 10). Unselect all to remove them.\n' +
      `Current: ${mentionRoles(settings.supportRoleIds)}`,
    components: [row(select)],
    allowedMentions: { parse: [] },
  };
}

export function settingsView(settings) {
  return {
    content: [
      '⚙️ **Ticket Settings**',
      `• **Ask Reason:** ${settings.askReason ? 'On' : 'Off'} — members type why they need help before the ticket opens`,
      `• **Ping Support:** ${settings.pingSupport ? 'On' : 'Off'} — mention support roles in new tickets`,
      `• **DM Transcript:** ${settings.dmTranscript ? 'On' : 'Off'} — send the member a transcript when their ticket is deleted`,
      `• **Max Tickets:** ${settings.maxOpen} — open tickets allowed per member`,
    ].join('\n'),
    components: [
      row(
        toggle('t_reason', 'Ask Reason', '✍️', settings.askReason),
        toggle('t_ping', 'Ping Support', '🔔', settings.pingSupport),
        toggle('t_dm', 'DM Transcript', '📩', settings.dmTranscript),
        button('max_open', `Max Tickets: ${settings.maxOpen}`, '🔢'),
      ),
    ],
  };
}

export function sendView() {
  return {
    content: '📤 Pick the channel to post the ticket panel in:',
    components: [
      row(
        new ChannelSelectMenuBuilder()
          .setCustomId(id('send_to'))
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setPlaceholder('Select a channel'),
      ),
    ],
  };
}

// ─── Setup modals ────────────────────────────────────────────────────────────

export function panelMessageModal(settings) {
  return new ModalBuilder()
    .setCustomId(id('m_panel'))
    .setTitle('Ticket Panel Message')
    .addLabelComponents(
      textField('title', 'Title', { value: settings.panelTitle, max: 256 }),
      textField('description', 'Description', { style: TextInputStyle.Paragraph, value: settings.panelDescription, max: 4000 }),
      textField('button', 'Button label', { value: settings.buttonLabel, required: true, max: 80 }),
    );
}

export function ticketMessageModal(settings) {
  return new ModalBuilder()
    .setCustomId(id('m_ticket'))
    .setTitle('Message Inside New Tickets')
    .addLabelComponents(
      textField('message', 'Message', {
        style: TextInputStyle.Paragraph,
        value: settings.openMessage,
        required: true,
        max: 4000,
        description: 'Placeholders: {user} {server}',
      }),
    );
}

export function colorModal(settings) {
  return new ModalBuilder()
    .setCustomId(id('m_color'))
    .setTitle('Embed Color')
    .addLabelComponents(textField('color', 'Hex color', { value: settings.color, required: true, max: 7, placeholder: '#5865F2' }));
}

export function maxOpenModal(settings) {
  return new ModalBuilder()
    .setCustomId(id('m_max'))
    .setTitle('Max Tickets Per Member')
    .addLabelComponents(
      textField('max', 'Open tickets allowed per member', { value: String(settings.maxOpen), required: true, max: 2, description: '1 to 10' }),
    );
}

export function reasonModal() {
  return new ModalBuilder()
    .setCustomId(id('m_create'))
    .setTitle('Open a Ticket')
    .addLabelComponents(
      textField('reason', 'What do you need help with?', { style: TextInputStyle.Paragraph, required: true, max: 1000 }),
    );
}

// ─── Public panel & messages inside tickets ─────────────────────────────────

export function buildPublicPanel(guild, settings) {
  const embed = new EmbedBuilder().setColor(parseColor(settings.color)).setFooter({ text: guild.name });
  if (settings.panelTitle) embed.setTitle(settings.panelTitle);
  embed.setDescription(settings.panelDescription || 'Click the button below to open a ticket.');
  return {
    embeds: [embed],
    components: [row(button('create', settings.buttonLabel, '🎫', ButtonStyle.Primary))],
  };
}

export function ticketControls(claimedByName) {
  return row(
    button('close', 'Close', '🔒', ButtonStyle.Danger),
    claimedByName
      ? button('claim', `Claimed by ${claimedByName}`.slice(0, 80), '🙋', ButtonStyle.Success).setDisabled(true)
      : button('claim', 'Claim', '🙋', ButtonStyle.Success),
  );
}

export function openTicketMessage(member, settings, ticket) {
  const embed = new EmbedBuilder()
    .setColor(parseColor(settings.color))
    .setTitle(`🎫 Ticket #${formatNumber(ticket.number)}`)
    .setDescription(
      settings.openMessage.replaceAll('{user}', `<@${member.id}>`).replaceAll('{server}', member.guild.name).slice(0, 4096),
    )
    .setTimestamp();
  if (ticket.reason) embed.addFields({ name: 'Reason', value: ticket.reason.slice(0, 1024) });

  const pings = [`<@${member.id}>`];
  if (settings.pingSupport) pings.push(...settings.supportRoleIds.map((r) => `<@&${r}>`));

  return {
    content: pings.join(' '),
    embeds: [embed],
    components: [ticketControls(null)],
    allowedMentions: { users: [member.id], roles: settings.pingSupport ? settings.supportRoleIds : [] },
  };
}

export function closeConfirm() {
  return {
    content: '🔒 Are you sure you want to close this ticket?',
    components: [
      row(button('close_confirm', 'Close', '🔒', ButtonStyle.Danger), button('close_cancel', 'Cancel', '✖️')),
    ],
  };
}

export function closedMessage(closedBy, color) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(parseColor(color))
        .setDescription(`🔒 Ticket closed by <@${closedBy.id}>\n\nSupport team controls:`),
    ],
    components: [
      row(
        button('transcript', 'Transcript', '📑'),
        button('reopen', 'Reopen', '🔓', ButtonStyle.Success),
        button('delete', 'Delete', '⛔', ButtonStyle.Danger),
      ),
    ],
  };
}
