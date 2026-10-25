import { ChannelType, PermissionFlagsBits } from 'discord.js';

const CHANNEL_PERMS = {
  ViewChannel: 'View Channel',
  SendMessages: 'Send Messages',
  EmbedLinks: 'Embed Links',
  AttachFiles: 'Attach Files',
};

export function isWelcomeChannel(channel) {
  return channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement;
}

/** Returns a warning line when the bot can't post welcomes in the channel, else ''. */
export function channelWarning(channel) {
  const missing = channel.permissionsFor(channel.guild.members.me)?.missing(Object.keys(CHANNEL_PERMS)) ?? [];
  if (!missing.length) return '';
  return `\n⚠️ I'm missing **${missing.map((p) => CHANNEL_PERMS[p]).join(', ')}** in ${channel} — welcomes will fail until that's fixed.`;
}

/** Returns why a role can't be used as the auto role, or null when it's fine. */
export function autoRoleProblem(role) {
  const { guild } = role;
  const me = guild.members.me;
  if (role.id === guild.id) return '`@everyone` can’t be used as an auto role.';
  if (role.managed) return `${role} is managed by an integration/bot and can’t be given to members.`;
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return 'I need the **Manage Roles** permission to give roles.';
  if (role.position >= me.roles.highest.position) {
    return `${role} is above my highest role. Drag my role above it in **Server Settings → Roles**.`;
  }
  return null;
}
