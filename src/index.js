import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { commandList, commands } from './commands/index.js';
import { MONGODB_URI, PREFIX, TOKEN } from './config.js';
import { startHealthServer } from './health.js';
import {
  cacheAllInvites,
  cacheGuildInvites,
  onInviteCreate,
  onMemberJoinInvite,
  onMemberLeaveInvite,
} from './invites/tracker.js';
import { startStatusUpdater } from './status/status.js';
import { connectStorage } from './storage.js';
import { handleTicketInteraction } from './tickets/interactions.js';
import { removeTicket } from './tickets/settings.js';
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
  ticket: handleTicketInteraction,
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
  ],
  // Lets "member left" fire for members who joined before the bot started.
  partials: [Partials.GuildMember],
});
client.commands = commands;
client.commandList = commandList;

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag} — prefix "${PREFIX}" — ${c.guilds.cache.size} server(s)`);
  c.user.setActivity(`${PREFIX}help`);
  await cacheAllInvites(c);
  startStatusUpdater(c);
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
client.on(Events.GuildMemberAdd, onMemberJoinInvite);
client.on(Events.GuildMemberRemove, onMemberLeaveInvite);
client.on(Events.InviteCreate, onInviteCreate);
client.on(Events.GuildCreate, cacheGuildInvites);
// A ticket channel deleted by hand shouldn't count as an open ticket any more.
client.on(Events.ChannelDelete, (channel) => channel.guild && removeTicket(channel.guild.id, channel.id));
client.on(Events.Error, (err) => console.error('[client]', err));
process.on('unhandledRejection', (err) => console.error('[unhandled]', err));

startHealthServer(client);
await connectStorage();
await client.login(TOKEN);
