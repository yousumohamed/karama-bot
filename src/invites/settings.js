import { deleteSection, getSection, setSection } from '../storage.js';

// Where join messages go.
const DEFAULT_SETTINGS = { channelId: null };

export const getInviteSettings = (guildId) => getSection(guildId, 'invites', DEFAULT_SETTINGS);

export function updateInviteSettings(guildId, patch) {
  const settings = { ...getInviteSettings(guildId), ...patch };
  setSection(guildId, 'invites', settings);
  return settings;
}

// ─── Stats ───────────────────────────────────────────────────────────────────
// { inviters: { [userId]: { joins, left } }, members: { [memberId]: inviterId } }

const DEFAULT_STATS = { inviters: {}, members: {} };

const getStats = (guildId) => getSection(guildId, 'inviteStats', DEFAULT_STATS);

export function recordJoin(guildId, memberId, inviterId) {
  const stats = getStats(guildId);
  const inviter = (stats.inviters[inviterId] ??= { joins: 0, left: 0 });
  inviter.joins++;
  stats.members[memberId] = inviterId;
  setSection(guildId, 'inviteStats', stats);
  return inviter;
}

export function recordLeave(guildId, memberId) {
  const stats = getStats(guildId);
  const inviterId = stats.members[memberId];
  if (!inviterId) return;
  if (stats.inviters[inviterId]) stats.inviters[inviterId].left++;
  delete stats.members[memberId];
  setSection(guildId, 'inviteStats', stats);
}

/** Inviters as [{ id, joins, left, total }], highest total first. */
export function inviteLeaderboard(guildId) {
  return Object.entries(getStats(guildId).inviters)
    .map(([id, { joins, left }]) => ({ id, joins, left, total: joins - left }))
    .sort((a, b) => b.total - a.total || b.joins - a.joins);
}

export function inviterStats(guildId, userId) {
  const { joins = 0, left = 0 } = getStats(guildId).inviters[userId] ?? {};
  return { joins, left, total: joins - left };
}

export function resetInviteStats(guildId) {
  deleteSection(guildId, 'inviteStats');
}
