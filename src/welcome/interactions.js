import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { ephemeral } from '../ui.js';
import { autoRoleProblem, channelWarning } from './checks.js';
import { parseImageInput, removeGuildImage, saveGuildImage } from './images.js';
import { buildWelcomeMessage, sendWelcome } from './message.js';
import {
  advancedView,
  autoroleView,
  buildPanel,
  buttonModal,
  buttonsView,
  channelView,
  colorModal,
  deleteAfterModal,
  embedSettingsView,
  embedTextModal,
  imageModal,
  languageView,
  messageModal,
} from './panel.js';
import { getWelcome, LANGUAGES, MAX_BUTTONS, resetWelcome, updateWelcome } from './settings.js';

const EMOJI_PATTERN =
  /^(?:<a?:\w{2,32}:\d{17,20}>|\p{Regional_Indicator}{2}|[#*0-9]️?⃣|\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic})*)$/u;

/** Re-renders the panel message after a change made from one of its sub-menus. */
async function refreshPanel(interaction, panelId) {
  if (!panelId) return;
  const panel = await interaction.channel?.messages.fetch(panelId).catch(() => null);
  await panel?.edit(buildPanel(getWelcome(interaction.guildId))).catch(() => {});
}

/** Saves an image setting from the image modal (uploaded file wins over the text field). */
async function submitImage(interaction, slot) {
  const current = getWelcome(interaction.guildId)[slot];
  const upload = interaction.fields.getUploadedFiles('file')?.first();

  let value;
  if (upload) {
    await interaction.deferUpdate();
    try {
      value = await saveGuildImage(interaction.guildId, slot, upload.url);
    } catch (err) {
      return interaction.followUp(ephemeral(`❌ ${err.message}`));
    }
  } else {
    const parsed = parseImageInput(interaction.fields.getTextInputValue('url'), current);
    if (parsed.error) return interaction.reply(ephemeral(`❌ ${parsed.error}`));
    value = parsed.value;
    if (!value?.startsWith('file:')) removeGuildImage(interaction.guildId, slot);
    await interaction.deferUpdate();
  }

  const settings = updateWelcome(interaction.guildId, { [slot]: value });
  await interaction.editReply(buildPanel(settings));
  const name = slot === 'thumbnail' ? 'Welcome image' : 'Background';
  await interaction.followUp(ephemeral(`✅ ${name} ${value ? 'updated' : 'removed'}. Click **Preview** to see it.`));
}

const handlers = {
  // ── Panel buttons ──────────────────────────────────────────────────────────
  edit_message: (i) => i.showModal(messageModal(getWelcome(i.guildId))),
  color: (i) => i.showModal(colorModal(getWelcome(i.guildId))),
  thumbnail: (i) => i.showModal(imageModal('thumbnail', getWelcome(i.guildId))),
  background: (i) => i.showModal(imageModal('image', getWelcome(i.guildId))),
  channel: (i) => i.reply(ephemeral(channelView(i.message.id))),
  autorole: (i) => i.reply(ephemeral(autoroleView(getWelcome(i.guildId), i.message.id))),
  buttons: (i) => i.reply(ephemeral(buttonsView(getWelcome(i.guildId)))),
  embed_settings: (i) => i.reply(ephemeral(embedSettingsView(getWelcome(i.guildId)))),
  language: (i) => i.reply(ephemeral(languageView(getWelcome(i.guildId)))),
  advanced: (i) => i.reply(ephemeral(advancedView(getWelcome(i.guildId)))),

  async test(i) {
    const settings = getWelcome(i.guildId);
    if (!settings.channelId) return i.reply(ephemeral('❌ Set a welcome channel first with the **Channel** button.'));
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const sent = await sendWelcome(i.member, settings);
      await i.editReply(`✅ Test welcome sent: ${sent.url}`);
    } catch (err) {
      await i.editReply(`❌ Couldn't send the welcome message: ${err.message}`);
    }
  },

  async preview(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const payload = await buildWelcomeMessage(i.member, getWelcome(i.guildId));
    await i.editReply({ ...payload, allowedMentions: { parse: [] } });
  },

  async reset(i) {
    await i.update(buildPanel(resetWelcome(i.guildId)));
    await i.followUp(ephemeral('🔄 All welcome settings have been reset.'));
  },

  enable(i) {
    if (!getWelcome(i.guildId).channelId) {
      return i.reply(ephemeral('❌ Set a welcome channel first with the **Channel** button.'));
    }
    return i.update(buildPanel(updateWelcome(i.guildId, { enabled: true })));
  },

  disable: (i) => i.update(buildPanel(updateWelcome(i.guildId, { enabled: false }))),

  // ── Panel modals ───────────────────────────────────────────────────────────
  async m_message(i) {
    const settings = updateWelcome(i.guildId, {
      title: i.fields.getTextInputValue('title').trim(),
      message: i.fields.getTextInputValue('message').trim(),
    });
    await i.update(buildPanel(settings));
    await i.followUp(ephemeral('✅ Welcome message updated. Click **Preview** to see it.'));
  },

  async m_color(i) {
    const input = i.fields.getTextInputValue('color').trim();
    if (!/^#?[0-9a-f]{6}$/i.test(input)) {
      return i.reply(ephemeral('❌ That isn’t a valid hex color. Example: `#5865F2`'));
    }
    const color = `#${input.replace('#', '').toUpperCase()}`;
    await i.update(buildPanel(updateWelcome(i.guildId, { color })));
    await i.followUp(ephemeral(`✅ Embed color set to \`${color}\`.`));
  },

  m_thumbnail: (i) => submitImage(i, 'thumbnail'),
  m_background: (i) => submitImage(i, 'image'),

  // ── Channel / autorole sub-menus ───────────────────────────────────────────
  async set_channel(i, panelId) {
    const channel = i.channels.first();
    updateWelcome(i.guildId, { channelId: channel.id });
    await i.update({ content: `✅ Welcome channel set to ${channel}.${channelWarning(channel)}`, components: [] });
    await refreshPanel(i, panelId);
  },

  async set_autorole(i, panelId) {
    const role = i.guild.roles.cache.get(i.values[0]);
    const problem = role ? autoRoleProblem(role) : 'That role no longer exists.';
    if (problem) return i.reply(ephemeral({ content: `❌ ${problem}`, allowedMentions: { parse: [] } }));
    updateWelcome(i.guildId, { autoRoleId: role.id });
    await i.update({ content: `✅ New members will get ${role}.`, components: [], allowedMentions: { parse: [] } });
    await refreshPanel(i, panelId);
  },

  async clear_autorole(i, panelId) {
    updateWelcome(i.guildId, { autoRoleId: null });
    await i.update({ content: '✅ Auto role removed.', components: [] });
    await refreshPanel(i, panelId);
  },

  // ── Buttons sub-menu ───────────────────────────────────────────────────────
  btn_add: (i) => i.showModal(buttonModal()),
  btn_clear: (i) => i.update(buttonsView(updateWelcome(i.guildId, { buttons: [] }))),

  async m_btn_add(i) {
    const { buttons } = getWelcome(i.guildId);
    if (buttons.length >= MAX_BUTTONS) return i.reply(ephemeral(`❌ You can have at most ${MAX_BUTTONS} buttons.`));

    const label = i.fields.getTextInputValue('label').trim();
    const emoji = i.fields.getTextInputValue('emoji').trim() || null;
    let url;
    try {
      url = new URL(i.fields.getTextInputValue('url').trim());
    } catch {
      // handled below
    }
    if (!url || !['http:', 'https:', 'discord:'].includes(url.protocol)) {
      return i.reply(ephemeral('❌ The link must start with `https://`.'));
    }
    if (emoji && !EMOJI_PATTERN.test(emoji)) {
      return i.reply(ephemeral('❌ Use a normal emoji like 📜 or a custom one like `<:name:123456789012345678>`.'));
    }

    buttons.push({ label, url: url.href, emoji });
    await i.update(buttonsView(updateWelcome(i.guildId, { buttons })));
  },

  // ── Embed settings sub-menu ────────────────────────────────────────────────
  es_text: (i) => i.showModal(embedTextModal(getWelcome(i.guildId))),
  es_timestamp: (i) => i.update(embedSettingsView(updateWelcome(i.guildId, { timestamp: !getWelcome(i.guildId).timestamp }))),
  es_ping: (i) => i.update(embedSettingsView(updateWelcome(i.guildId, { pingUser: !getWelcome(i.guildId).pingUser }))),

  m_es_text: (i) =>
    i.update(
      embedSettingsView(
        updateWelcome(i.guildId, {
          title: i.fields.getTextInputValue('title').trim(),
          footer: i.fields.getTextInputValue('footer').trim(),
        }),
      ),
    ),

  // ── Language sub-menu ──────────────────────────────────────────────────────
  async set_language(i) {
    const language = i.values[0];
    updateWelcome(i.guildId, { language, message: LANGUAGES[language].message });
    await i.update({ content: `✅ Welcome message switched to **${LANGUAGES[language].label}**.`, components: [] });
  },

  // ── Advanced sub-menu ──────────────────────────────────────────────────────
  adv_dm: (i) => i.update(advancedView(updateWelcome(i.guildId, { dm: !getWelcome(i.guildId).dm }))),
  adv_delete: (i) => i.showModal(deleteAfterModal(getWelcome(i.guildId))),

  m_adv_delete(i) {
    const seconds = Number(i.fields.getTextInputValue('seconds').trim());
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
      return i.reply(ephemeral('❌ Enter a whole number of seconds between 0 and 3600.'));
    }
    return i.update(advancedView(updateWelcome(i.guildId, { deleteAfter: seconds })));
  },
};

export async function handleWelcomeInteraction(interaction) {
  if (!interaction.inCachedGuild()) return;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply(ephemeral('❌ You need the **Manage Server** permission to use this.'));
  }
  const [, action, panelId] = interaction.customId.split(':');
  await handlers[action]?.(interaction, panelId);
}
