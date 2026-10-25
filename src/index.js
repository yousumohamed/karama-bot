import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { commands } from './commands/index.js';
import { MONGODB_URI, PREFIX, TOKEN } from './config.js';
import { startHealthServer } from './health.js';
import { connectStorage } from './storage.js';
import { handleWelcomeInteraction } from './welcome/interactions.js';
import { onMemberJoin } from './welcome/join.js';

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and paste your bot token into it.');
  process.exit(1);
}
if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI. Add your MongoDB Atlas connection string to .env (see README).');
  process.exit(1);
}

// Button/menu/modal custom IDs start with "<feature>:" and are routed here.
const interactionHandlers = {
  welcome: handleWelcomeInteraction,
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
client.commands = commands;

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag} — prefix "${PREFIX}" — ${c.guilds.cache.size} server(s)`);
  c.user.setActivity(`${PREFIX}help`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.inGuild() || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = commands.get(args.shift()?.toLowerCase());
  if (!command) return;

  try {
    await command.run(message, args);
  } catch (err) {
    console.error(`[command ${command.name}]`, err);
    await message.reply('❌ Something went wrong running that command.').catch(() => {});
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;
  const handler = interactionHandlers[interaction.customId.split(':')[0]];
  if (!handler) return;

  try {
    await handler(interaction);
  } catch (err) {
    console.error(`[interaction ${interaction.customId}]`, err);
    const reply = { content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral };
    await (interaction.replied || interaction.deferred ? interaction.followUp(reply) : interaction.reply(reply)).catch(() => {});
  }
});

client.on(Events.GuildMemberAdd, onMemberJoin);
client.on(Events.Error, (err) => console.error('[client]', err));
process.on('unhandledRejection', (err) => console.error('[unhandled]', err));

startHealthServer(client);
await connectStorage();
await client.login(TOKEN);
