import { buildWelcomeMessage, sendWelcome } from './message.js';
import { getWelcome } from './settings.js';

export async function onMemberJoin(member) {
  const settings = getWelcome(member.guild.id);
  if (!settings.enabled) return;

  if (settings.autoRoleId) {
    await member.roles
      .add(settings.autoRoleId, 'Welcome auto role')
      .catch((err) => console.warn(`[welcome] auto role failed in ${member.guild.name}: ${err.message}`));
  }

  if (settings.channelId) {
    await sendWelcome(member, settings).catch((err) =>
      console.warn(`[welcome] message failed in ${member.guild.name}: ${err.message}`),
    );
  }

  if (settings.dm && !member.user.bot) {
    await member.send(await buildWelcomeMessage(member, settings)).catch(() => {
      // Member has DMs closed — nothing to do.
    });
  }
}
