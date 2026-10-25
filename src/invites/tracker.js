import { escapeMarkdown, PermissionFlagsBits } from 'discord.js';
import { getInviteSettings, recordJoin, recordLeave } from './settings.js';

// Discord doesn't say which invite a member used, so we remember every invite's
// use count and look for the one that went up when someone joins.
// guildId -> Map(code -> { uses, inviterId, inviterName })
const cache = new Map();

// Joins are handled one at a time per server so two quick joins can't confuse the counts.
const queues = new Map();
function inOrder(guildId, task) {
  const run = (queues.get(guildId) ?? Promise.resolve()).then(task);
  queues.set(guildId, run.catch(() => {}));
  return run;
}

const entry = (invite) => ({
  uses: invite.uses ?? 0,
  inviterId: invite.inviterId ?? invite.inviter?.id ?? null,
  inviterName: invite.inviter?.username ?? null,
});

async function fetchInvites(guild) {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) return null;
  const invites = await guild.invites.fetch().catch(() => null);
  return invites && new Map(invites.map((invite) => [invite.code, entry(invite)]));
}

export async function cacheGuildInvites(guild) {
  const invites = await fetchInvites(guild);
  if (invites) cache.set(guild.id, invites);
}

export async function cacheAllInvites(client) {
  for (const guild of client.guilds.cache.values()) await cacheGuildInvites(guild);
}

export function onInviteCreate(invite) {
  if (!invite.guild) return;
  if (!cache.has(invite.guild.id)) cache.set(invite.guild.id, new Map());
  cache.get(invite.guild.id).set(invite.code, entry(invite));
}
// Deleted invites stay cached on purpose: a one-use invite is deleted the moment
// it's used, and we still need it to work out who invited the member.

// When several people join at once, one fetch can show more than one new use.
// The extra uses wait here for the joins that come right after.
// guildId -> [{ code, uses, inviterId, inviterName }]
const pending = new Map();

async function findUsedInvite(guild) {
  const before = cache.get(guild.id);
  const now = await fetchInvites(guild);
  if (!now) return null;
  cache.set(guild.id, now);
  if (!before) return null; // nothing to compare against yet

  const queue = pending.get(guild.id) ?? [];
  pending.set(guild.id, queue);
  for (const [code, invite] of now) {
    const added = invite.uses - (before.get(code)?.uses ?? 0);
    for (let n = 0; n < added; n++) queue.push({ code, ...invite });
  }
  if (queue.length) return queue.shift();

  const gone = [...before.keys()].filter((code) => !now.has(code));
  if (gone.length === 1) return { code: gone[0], ...before.get(gone[0]) };
  if (guild.vanityURLCode) return { code: guild.vanityURLCode, vanity: true };
  return null;
}

export async function onMemberJoinInvite(member) {
  const { guild } = member;
  const used = await inOrder(guild.id, () => findUsedInvite(guild));
  if (used?.inviterId) recordJoin(guild.id, member.id, used.inviterId);

  const { channelId } = getInviteSettings(guild.id);
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  let inviter = 'Lama yaqaan'; // unknown
  if (used?.vanity) inviter = 'Vanity URL';
  else if (used?.inviterId) {
    const name = used.inviterName ?? (await guild.client.users.fetch(used.inviterId).catch(() => null))?.username;
    inviter = `<@${used.inviterId}>${name ? ` (${escapeMarkdown(name)})` : ''}`;
  }

  const lines = [
    `<@${member.id}> ( **${escapeMarkdown(member.displayName)}** ) ayaa ku soo biiray server-ka.`,
    `Waxaa soo casuumay: ${inviter}`,
  ];
  if (used) lines.push(`Invite code: \`${used.code}\``);

  await channel
    .send({ content: lines.join('\n'), allowedMentions: { parse: [] } })
    .catch((err) => console.warn(`[invites] join message failed in ${guild.name}: ${err.message}`));
}

export function onMemberLeaveInvite(member) {
  recordLeave(member.guild.id, member.id);
}
