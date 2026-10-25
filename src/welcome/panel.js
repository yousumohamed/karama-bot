import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { BRAND_COLOR, PREFIX } from '../config.js';
import { describeImage } from './images.js';
import { PLACEHOLDER_HELP } from './message.js';
import { LANGUAGES, MAX_BUTTONS } from './settings.js';

// Every custom ID is "welcome:<action>[:<panelMessageId>]".
const id = (action, panelId) => (panelId ? `welcome:${action}:${panelId}` : `welcome:${action}`);

const button = (action, label, emoji, style = ButtonStyle.Secondary, panelId) =>
  new ButtonBuilder().setCustomId(id(action, panelId)).setLabel(label).setEmoji(emoji).setStyle(style);

const toggle = (action, label, emoji, on) =>
  button(action, `${label}: ${on ? 'On' : 'Off'}`, emoji, on ? ButtonStyle.Success : ButtonStyle.Secondary);

const row = (...components) => new ActionRowBuilder().addComponents(components);

// ─── Main panel ──────────────────────────────────────────────────────────────

export function buildPanel(settings) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🌸 Welcome Setup Panel')
    .setDescription(
      [
        'Configure the welcome system for your server using the buttons below.',
        'Click any button to configure that setting',
        '',
        `• **Status:** ${settings.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
        `• **Channel:** ${settings.channelId ? `<#${settings.channelId}>` : '`Not set`'}`,
        `• **Auto Role:** ${settings.autoRoleId ? `<@&${settings.autoRoleId}>` : '`None`'}`,
        '',
        `💡 *Use \`${PREFIX}welcome channel #landing\` to set channel directly.*`,
        `💡 *Use \`${PREFIX}welcome reset\` to remove all assigned channels and reset settings.*`,
      ].join('\n'),
    );

  return {
    embeds: [embed],
    components: [
      row(
        button('edit_message', 'Edit Message', '📝'),
        button('color', 'Embed Color', '🎨'),
        button('thumbnail', 'Welcome Image', '🖼️'),
        button('background', 'Background', '🌅'),
        button('channel', 'Channel', '📢'),
      ),
      row(
        button('autorole', 'Autorole', '👤'),
        button('buttons', 'Buttons', '🔵'),
        button('embed_settings', 'Embed Settings', '📄'),
        button('test', 'Test Welcome', '🧪', ButtonStyle.Primary),
        button('preview', 'Preview', '👀', ButtonStyle.Primary),
      ),
      row(
        button('language', 'Language', '🌐'),
        button('advanced', 'Advanced', '⚙️'),
        button('reset', 'Reset', '🔄', ButtonStyle.Danger),
        button('enable', 'Enable', '✅', ButtonStyle.Success),
        button('disable', 'Disable', '❌', ButtonStyle.Danger),
      ),
    ],
  };
}

// ─── Sub-menus (sent as ephemeral replies) ──────────────────────────────────

export function channelView(panelId) {
  return {
    content: '📢 Pick the channel where welcome messages will be sent:',
    components: [
      row(
        new ChannelSelectMenuBuilder()
          .setCustomId(id('set_channel', panelId))
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setPlaceholder('Select a channel'),
      ),
    ],
  };
}

export function autoroleView(settings, panelId) {
  return {
    content:
      '👤 Pick a role to give every new member automatically.\n' +
      `Current: ${settings.autoRoleId ? `<@&${settings.autoRoleId}>` : '`None`'}`,
    components: [
      row(new RoleSelectMenuBuilder().setCustomId(id('set_autorole', panelId)).setPlaceholder('Select a role')),
      row(button('clear_autorole', 'Remove Auto Role', '🗑️', ButtonStyle.Danger, panelId).setDisabled(!settings.autoRoleId)),
    ],
    allowedMentions: { parse: [] },
  };
}

export function buttonsView(settings) {
  const list = settings.buttons.length
    ? settings.buttons.map((b, n) => `${n + 1}. ${b.emoji ? `${b.emoji} ` : ''}**${b.label}** — <${b.url}>`).join('\n')
    : '*No buttons yet.*';
  return {
    content:
      `🔵 **Welcome Buttons** (${settings.buttons.length}/${MAX_BUTTONS})\n` +
      'Link buttons shown under the welcome message (e.g. Rules, Roles, Website).\n\n' +
      list,
    components: [
      row(
        button('btn_add', 'Add Button', '➕', ButtonStyle.Success).setDisabled(settings.buttons.length >= MAX_BUTTONS),
        button('btn_clear', 'Remove All', '🗑️', ButtonStyle.Danger).setDisabled(!settings.buttons.length),
      ),
    ],
  };
}

export function embedSettingsView(settings) {
  return {
    content: [
      '📄 **Embed Settings**',
      `• **Title:** ${settings.title ? `\`${settings.title}\`` : '`None`'}`,
      `• **Footer:** ${settings.footer ? `\`${settings.footer}\`` : '`None`'}`,
      `• **Welcome Image:** ${describeImage(settings.thumbnail)}`,
      `• **Background:** ${describeImage(settings.image)}`,
      `• **Timestamp:** ${settings.timestamp ? 'On' : 'Off'}`,
      `• **Ping member above embed:** ${settings.pingUser ? 'On' : 'Off'}`,
    ].join('\n'),
    components: [
      row(
        button('es_text', 'Title & Footer', '✏️'),
        toggle('es_timestamp', 'Timestamp', '🕒', settings.timestamp),
        toggle('es_ping', 'Ping Member', '🔔', settings.pingUser),
      ),
    ],
  };
}

export function languageView(settings) {
  return {
    content:
      '🌐 **Language**\nPick a language — the welcome message text is replaced with a ready-made one in that language. ' +
      'You can still customise it afterwards with **Edit Message**.',
    components: [
      row(
        new StringSelectMenuBuilder()
          .setCustomId(id('set_language'))
          .setPlaceholder('Select a language')
          .addOptions(
            Object.entries(LANGUAGES).map(([value, lang]) => ({
              label: lang.label,
              value,
              emoji: lang.emoji,
              default: value === settings.language,
            })),
          ),
      ),
    ],
  };
}

export function advancedView(settings) {
  return {
    content: [
      '⚙️ **Advanced Settings**',
      `• **DM Welcome:** ${settings.dm ? 'On' : 'Off'} — also send the welcome to the new member in DMs`,
      `• **Auto-Delete:** ${settings.deleteAfter ? `${settings.deleteAfter}s` : 'Off'} — delete the welcome message after a delay`,
    ].join('\n'),
    components: [
      row(
        toggle('adv_dm', 'DM Welcome', '📩', settings.dm),
        button(
          'adv_delete',
          `Auto-Delete: ${settings.deleteAfter ? `${settings.deleteAfter}s` : 'Off'}`,
          '⏱️',
          settings.deleteAfter ? ButtonStyle.Success : ButtonStyle.Secondary,
        ),
      ),
    ],
  };
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function textField(customId, label, { style = TextInputStyle.Short, value, placeholder, required = false, max, description } = {}) {
  const input = new TextInputBuilder().setCustomId(customId).setStyle(style).setRequired(required);
  if (value) input.setValue(value);
  if (placeholder) input.setPlaceholder(placeholder);
  if (max) input.setMaxLength(max);
  const field = new LabelBuilder().setLabel(label).setTextInputComponent(input);
  if (description) field.setDescription(description);
  return field;
}

export function messageModal(settings) {
  return new ModalBuilder()
    .setCustomId(id('m_message'))
    .setTitle('Edit Welcome Message')
    .addLabelComponents(
      textField('title', 'Title', { value: settings.title, max: 256, placeholder: '{server}' }),
      textField('message', 'Message', {
        style: TextInputStyle.Paragraph,
        value: settings.message,
        max: 4000,
        description: `Placeholders: ${PLACEHOLDER_HELP}`,
      }),
    );
}

export function colorModal(settings) {
  return new ModalBuilder()
    .setCustomId(id('m_color'))
    .setTitle('Embed Color')
    .addLabelComponents(
      textField('color', 'Hex color', { value: settings.color, required: true, max: 7, placeholder: '#5865F2' }),
    );
}

/** slot is the settings key: 'thumbnail' (Welcome Image) or 'image' (Background). */
export function imageModal(slot, settings) {
  const isThumbnail = slot === 'thumbnail';
  return new ModalBuilder()
    .setCustomId(id(isThumbnail ? 'm_thumbnail' : 'm_background'))
    .setTitle(isThumbnail ? 'Welcome Image (small, top right)' : 'Background (large image)')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Upload an image')
        .setDescription('PNG, JPG, GIF or WEBP, up to 8 MB. Leave empty to use the link below.')
        .setFileUploadComponent(new FileUploadBuilder().setCustomId('file').setRequired(false).setMaxValues(1)),
      textField('url', 'Or image link / avatar / server / none', {
        value: settings[slot] ?? 'none',
        max: 1000,
        description: "avatar = new member's picture, server = server icon, none = remove",
      }),
    );
}

export function buttonModal() {
  return new ModalBuilder()
    .setCustomId(id('m_btn_add'))
    .setTitle('Add Welcome Button')
    .addLabelComponents(
      textField('label', 'Label', { required: true, max: 80, placeholder: 'Rules' }),
      textField('url', 'Link', { required: true, max: 512, placeholder: 'https://discord.com/channels/...' }),
      textField('emoji', 'Emoji (optional)', { max: 64, placeholder: '📜' }),
    );
}

export function embedTextModal(settings) {
  return new ModalBuilder()
    .setCustomId(id('m_es_text'))
    .setTitle('Title & Footer')
    .addLabelComponents(
      textField('title', 'Title', { value: settings.title, max: 256, placeholder: '{server}' }),
      textField('footer', 'Footer', { value: settings.footer, max: 2048, placeholder: 'Enjoy your stay!' }),
    );
}

export function deleteAfterModal(settings) {
  return new ModalBuilder()
    .setCustomId(id('m_adv_delete'))
    .setTitle('Auto-Delete Welcome Message')
    .addLabelComponents(
      textField('seconds', 'Delete after (seconds)', {
        value: String(settings.deleteAfter),
        required: true,
        max: 4,
        description: '0 = never delete. Max 3600 (1 hour).',
      }),
    );
}
