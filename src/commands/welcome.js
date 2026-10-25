import { PermissionFlagsBits } from 'discord.js';
import { PREFIX } from '../config.js';
import { channelWarning, isWelcomeChannel } from '../welcome/checks.js';
import { MAX_IMAGE_BYTES, parseImageInput, removeGuildImage, saveGuildImage } from '../welcome/images.js';
import { sendWelcome } from '../welcome/message.js';
import { buildPanel } from '../welcome/panel.js';
import { getWelcome, resetWelcome, updateWelcome } from '../welcome/settings.js';

async function setImage(message, args, slot) {
  const guildId = message.guild.id;
  const attachment = message.attachments.first();
  let value;

  if (attachment) {
    if (attachment.size > MAX_IMAGE_BYTES) return message.reply('❌ Images must be 8 MB or smaller.');
    try {
      value = await saveGuildImage(guildId, slot, attachment.url);
    } catch (err) {
      return message.reply(`❌ ${err.message}`);
    }
  } else if (args.length) {
    const parsed = parseImageInput(args.join(' '), getWelcome(guildId)[slot]);
    if (parsed.error) return message.reply(`❌ ${parsed.error}`);
    value = parsed.value;
    if (!value?.startsWith('file:')) removeGuildImage(guildId, slot);
  } else {
    const sub = slot === 'thumbnail' ? 'image' : 'background';
    return message.reply(`Attach an image, or use \`${PREFIX}welcome ${sub} <link | avatar | server | none>\`.`);
  }

  updateWelcome(guildId, { [slot]: value });
  const name = slot === 'thumbnail' ? 'Welcome image' : 'Background';
  return message.reply(`✅ ${name} ${value ? 'updated' : 'removed'}.`);
}

export default {
  name: 'welcome',
  description: 'Open the welcome setup panel.',
  usage: [
    ['welcome', 'Open the welcome setup panel'],
    ['welcome channel #channel', 'Set the welcome channel'],
    ['welcome enable / disable', 'Turn welcomes on or off'],
    ['welcome test', 'Send a test welcome for yourself'],
    ['welcome image <attach | link | avatar | none>', 'Small image in the top right'],
    ['welcome background <attach | link | none>', 'Large image at the bottom'],
    ['welcome reset', 'Reset all welcome settings'],
  ],

  async run(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ You need the **Manage Server** permission to use this.');
    }

    const guildId = message.guild.id;
    const sub = args.shift()?.toLowerCase();

    switch (sub) {
      case undefined:
      case 'panel':
        return message.reply(buildPanel(getWelcome(guildId)));

      case 'channel': {
        const channel = message.mentions.channels.first() ?? message.guild.channels.cache.get(args[0]);
        if (!isWelcomeChannel(channel)) {
          return message.reply(`❌ Mention a text channel, e.g. \`${PREFIX}welcome channel #landing\`.`);
        }
        updateWelcome(guildId, { channelId: channel.id });
        return message.reply(`✅ Welcome channel set to ${channel}.${channelWarning(channel)}`);
      }

      case 'enable':
        if (!getWelcome(guildId).channelId) {
          return message.reply(`❌ Set a channel first with \`${PREFIX}welcome channel #channel\`.`);
        }
        updateWelcome(guildId, { enabled: true });
        return message.reply('🟢 Welcome system enabled.');

      case 'disable':
        updateWelcome(guildId, { enabled: false });
        return message.reply('🔴 Welcome system disabled.');

      case 'test': {
        const settings = getWelcome(guildId);
        if (!settings.channelId) {
          return message.reply(`❌ Set a channel first with \`${PREFIX}welcome channel #channel\`.`);
        }
        try {
          const sent = await sendWelcome(message.member, settings);
          return message.reply(`✅ Test welcome sent: ${sent.url}`);
        } catch (err) {
          return message.reply(`❌ Couldn't send the welcome message: ${err.message}`);
        }
      }

      case 'image':
        return setImage(message, args, 'thumbnail');

      case 'background':
        return setImage(message, args, 'image');

      case 'reset':
        resetWelcome(guildId);
        return message.reply('🔄 All welcome settings have been reset.');

      default:
        return message.reply(`❓ Unknown option. Type \`${PREFIX}help welcome\` to see what's available.`);
    }
  },
};
