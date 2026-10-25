import { EmbedBuilder } from 'discord.js';
import { BRAND_COLOR, PREFIX } from '../config.js';

export default {
  name: 'help',
  description: 'Show all commands.',
  usage: [['help [command]', 'Show all commands, or details for one']],

  run(message, args) {
    const { commands } = message.client;
    const wanted = args[0]?.toLowerCase();
    const list = wanted ? [commands.get(wanted)].filter(Boolean) : [...commands.values()];
    if (!list.length) return message.reply(`❓ No command called \`${wanted}\`.`);

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('📖 Commands')
      .setDescription(`Prefix: \`${PREFIX}\``);

    for (const command of list) {
      embed.addFields({
        name: `${PREFIX}${command.name}`,
        value: command.usage.map(([usage, info]) => `\`${PREFIX}${usage}\` — ${info}`).join('\n'),
      });
    }
    return message.reply({ embeds: [embed] });
  },
};
