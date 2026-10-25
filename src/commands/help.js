import { EmbedBuilder } from 'discord.js';
import { BRAND_COLOR, PREFIX } from '../config.js';

export default {
  name: 'help',
  aliases: ['commands', 'h'],
  title: '📖 Help',
  usage: [['help [command]', 'Show all commands, or details for one']],

  run(message, args) {
    const { client } = message;
    const wanted = args[0]?.toLowerCase().replace(PREFIX, '');
    const list = wanted ? [client.commands.get(wanted)].filter(Boolean) : client.commandList;
    if (!list.length) return message.reply(`❓ No command called \`${wanted}\`. Type \`${PREFIX}help\` to see them all.`);

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`📖 ${client.user.username} — Commands`)
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription(
        `Prefix: \`${PREFIX}\`\n` +
          (wanted ? '' : `Type \`${PREFIX}help <command>\` to see one command, e.g. \`${PREFIX}help ticket\`.`),
      )
      .setFooter({ text: 'Setup commands need the Manage Server permission' });

    for (const command of list) {
      const aliases = command.aliases?.length ? ` *(also ${command.aliases.map((a) => `\`${PREFIX}${a}\``).join(', ')})*` : '';
      embed.addFields({
        name: command.title ?? `${PREFIX}${command.name}`,
        value: command.usage.map(([usage, info]) => `\`${PREFIX}${usage}\` — ${info}`).join('\n') + (wanted ? aliases : ''),
      });
    }
    return message.reply({ embeds: [embed] });
  },
};
