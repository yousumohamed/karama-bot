import { EmbedBuilder } from 'discord.js';
import { BRAND_COLOR } from '../config.js';
import { getSection, setSection } from '../storage.js';

export const UPDATE_MINUTES = 10;
const HISTORY = 8;

// Gateway ping at each update, oldest first — drawn as the coloured bar.
const pings = [];

const DEFAULT_STATUS = { channelId: null, messageId: null };
export const getStatusSettings = (guildId) => getSection(guildId, 'status', DEFAULT_STATUS);
export const setStatusSettings = (guildId, settings) => setSection(guildId, 'status', settings);

const square = (ms) => (ms < 100 ? '🟦' : ms < 200 ? '🟩' : ms < 400 ? '🟨' : '🟥');

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

/** live = the auto-updating message (shows "Next Update"); otherwise a one-off ?ping reply. */
export function buildStatusEmbed(client, { live = false } = {}) {
  const ping = Math.round(client.ws.ping);
  const history = live ? pings : [...pings, ping].slice(-HISTORY);
  const bar = Array.from({ length: HISTORY }, (_, i) => (history[i] >= 0 ? square(history[i]) : '⬛')).join('');
  const users = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);

  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🟢 ${client.user.username} Bot Status`)
    .setDescription(`**Bot-ku waa mid firfircoon oo shaqeynaya.**\n\n${bar}`)
    .addFields(
      { name: 'Gateway Ping', value: ping >= 0 ? `${ping}ms` : 'Checking…', inline: true },
      { name: 'Uptime (Tan iyo markii uu shaqo bilaabay)', value: formatUptime(process.uptime()), inline: true },
      { name: 'Servers (Server-rada)', value: String(client.guilds.cache.size), inline: true },
      { name: 'Users (Isticmaalayaasha)', value: users.toLocaleString('en-US'), inline: true },
      live
        ? { name: 'Next Update (Cusboonaysiinta Xigta)', value: `${UPDATE_MINUTES} daqiiqo`, inline: true }
        : { name: 'Memory (Xusuusta)', value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`, inline: true },
      { name: 'Status (Xaaladda)', value: 'Online', inline: true },
    )
    .setFooter({ text: `${client.user.username} status monitor` })
    .setTimestamp();
}

/** Posts or edits the live status message in one server. */
export async function updateStatusMessage(client, guildId) {
  const settings = getStatusSettings(guildId);
  if (!settings.channelId) return;
  const channel = await client.channels.fetch(settings.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const payload = { embeds: [buildStatusEmbed(client, { live: true })] };
  const existing = settings.messageId && (await channel.messages.fetch(settings.messageId).catch(() => null));
  if (existing) {
    await existing.edit(payload).catch((err) => console.warn(`[status] edit failed: ${err.message}`));
    return;
  }
  const sent = await channel.send(payload).catch((err) => console.warn(`[status] send failed: ${err.message}`));
  if (sent) setStatusSettings(guildId, { ...settings, messageId: sent.id });
}

export function startStatusUpdater(client) {
  const tick = async () => {
    if (client.ws.ping >= 0) {
      pings.push(Math.round(client.ws.ping));
      if (pings.length > HISTORY) pings.shift();
    }
    for (const guildId of client.guilds.cache.keys()) await updateStatusMessage(client, guildId);
  };
  // First update once the gateway has measured a ping, then every UPDATE_MINUTES.
  setTimeout(tick, 15_000);
  setInterval(tick, UPDATE_MINUTES * 60_000);
}
