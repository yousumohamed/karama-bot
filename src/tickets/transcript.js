import { formatNumber } from './settings.js';

const MAX_MESSAGES = 5000;

const escape = (text) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const time = (ms) => `${new Date(ms).toISOString().replace('T', ' ').slice(0, 16)} UTC`;

async function fetchAllMessages(channel) {
  const messages = [];
  let before;
  while (messages.length < MAX_MESSAGES) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    messages.push(...batch.values());
    before = batch.lastKey();
    if (batch.size < 100) break;
  }
  return messages.reverse();
}

function renderText(text, message) {
  const { guild } = message;
  return escape(text)
    .replace(/&lt;@!?(\d+)&gt;/g, (_, id) => {
      const user = message.mentions.users.get(id) ?? guild.members.cache.get(id)?.user;
      return `<span class="mention">@${escape(user?.username ?? 'unknown-user')}</span>`;
    })
    .replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => `<span class="mention">@${escape(guild.roles.cache.get(id)?.name ?? 'deleted-role')}</span>`)
    .replace(/&lt;#(\d+)&gt;/g, (_, id) => `<span class="mention">#${escape(guild.channels.cache.get(id)?.name ?? 'deleted-channel')}</span>`)
    .replace(/\n/g, '<br>');
}

function renderMessage(message) {
  const parts = [];
  if (message.content) parts.push(`<div class="text">${renderText(message.content, message)}</div>`);

  for (const embed of message.embeds) {
    const fields = embed.fields
      .map((f) => `<div class="field"><b>${escape(f.name)}</b><br>${renderText(f.value, message)}</div>`)
      .join('');
    parts.push(
      `<div class="embed" style="border-color:${embed.hexColor ?? '#4f545c'}">` +
        (embed.title ? `<div class="embed-title">${escape(embed.title)}</div>` : '') +
        (embed.description ? `<div>${renderText(embed.description, message)}</div>` : '') +
        fields +
        (embed.image ? `<img src="${escape(embed.image.url)}" alt="">` : '') +
        (embed.footer ? `<div class="footer">${escape(embed.footer.text)}</div>` : '') +
        '</div>',
    );
  }

  for (const file of message.attachments.values()) {
    parts.push(
      file.contentType?.startsWith('image/')
        ? `<a href="${escape(file.url)}"><img src="${escape(file.url)}" alt="${escape(file.name)}"></a>`
        : `<a class="file" href="${escape(file.url)}">📎 ${escape(file.name)}</a>`,
    );
  }

  const author = message.member?.displayName ?? message.author.username;
  return `<div class="msg">
  <img class="avatar" src="${escape(message.author.displayAvatarURL({ extension: 'png', size: 64 }))}" alt="">
  <div><div class="head"><span class="name">${escape(author)}</span>${message.author.bot ? '<span class="bot">BOT</span>' : ''}<span class="time">${time(message.createdTimestamp)}</span></div>${parts.join('')}</div>
</div>`;
}

/** Returns { name, data } — an HTML file of the whole ticket conversation. */
export async function buildTranscript(channel, ticket) {
  const messages = await fetchAllMessages(channel);
  const number = ticket ? `#${formatNumber(ticket.number)}` : channel.name;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket ${escape(number)} — ${escape(channel.guild.name)}</title>
<style>
body{margin:0;background:#313338;color:#dbdee1;font:15px/1.4 system-ui,"Segoe UI",sans-serif}
header{padding:20px 24px;background:#2b2d31;border-bottom:1px solid #1e1f22}
header h1{margin:0 0 6px;font-size:20px;color:#f2f3f5}
header p{margin:2px 0;color:#b5bac1;font-size:13px}
main{padding:12px 16px}
.msg{display:flex;gap:14px;padding:8px}
.msg:hover{background:#2e3035}
.avatar{width:40px;height:40px;border-radius:50%;flex:none}
.head{display:flex;align-items:center;gap:8px}
.name{font-weight:600;color:#f2f3f5}
.bot{background:#5865f2;color:#fff;font-size:10px;font-weight:700;padding:1px 4px;border-radius:3px}
.time{color:#949ba4;font-size:12px}
.text{white-space:normal;word-wrap:break-word}
.mention{background:#3c4270;color:#c9cdfb;border-radius:3px;padding:0 2px}
.embed{margin-top:6px;max-width:520px;background:#2b2d31;border-left:4px solid;border-radius:4px;padding:8px 12px}
.embed-title{font-weight:600;color:#f2f3f5;margin-bottom:4px}
.field{margin-top:6px}
.footer{margin-top:6px;font-size:12px;color:#b5bac1}
img{max-width:400px;max-height:300px;border-radius:4px;margin-top:6px;display:block}
.file{display:inline-block;margin-top:6px;color:#00a8fc}
</style></head><body>
<header>
  <h1>🎫 Ticket ${escape(number)}</h1>
  <p>Server: ${escape(channel.guild.name)} • Channel: #${escape(channel.name)}</p>
  ${ticket ? `<p>Opened by: ${escape(channel.guild.members.cache.get(ticket.ownerId)?.user.username ?? ticket.ownerId)} • ${time(ticket.createdAt)}</p>` : ''}
  <p>${messages.length} messages • Saved ${time(Date.now())}</p>
</header>
<main>
${messages.map(renderMessage).join('\n')}
</main></body></html>`;

  return { name: `transcript-${channel.name}.html`, data: Buffer.from(html, 'utf8') };
}
