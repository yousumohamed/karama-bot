# karaama-bot

Discord bot for server essentials. Prefix: `?`

## Setup

1. Create a bot at <https://discord.com/developers/applications> → **New Application** → **Bot**.
2. On the **Bot** page, turn on both **Privileged Gateway Intents**:
   - **Server Members Intent** (to see members joining)
   - **Message Content Intent** (to read `?` commands)
3. Click **Reset Token** and copy the token.
4. Copy `.env.example` to `.env` and paste the token after `DISCORD_TOKEN=`.
5. Set up the free MongoDB database (below) and paste its connection string after `MONGODB_URI=`.
6. Invite the bot: **OAuth2 → URL Generator** → scope `bot` → permissions
   `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`, `Manage Roles`,
   `Manage Channels`, `Manage Messages`, `Manage Server` (needed to see which invite a member used).
7. Install and run:

```bash
npm install
npm start
```

## MongoDB Atlas (free)

All server settings and uploaded welcome images are stored in MongoDB, so they survive restarts.

1. Sign up at <https://www.mongodb.com/cloud/atlas/register> and create a free **M0** cluster.
2. **Database Access** → add a database user with a password (avoid `@ : / ? #` in it, or URL-encode them).
3. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
   Render's free plan has no fixed IP, so this is needed.
4. **Clusters** → **Connect** → **Drivers** → copy the `mongodb+srv://...` string and put your password in it.
5. Paste it as `MONGODB_URI` in `.env` (local) and in Render's environment variables.

On first start the bot copies any old `data/guilds.json` and `data/images/` into MongoDB automatically.

## Hosting on Render

The bot runs a small web server with a health check at `/health`
(200 + JSON while connected to Discord, 503 while starting/disconnected).

1. Push this folder to a GitHub repo (`.env` and `data/` are git-ignored, so your token stays private).
2. On <https://dashboard.render.com> → **New → Blueprint** → pick the repo. Render reads `render.yaml`.
   (Or **New → Web Service**: build `npm install`, start `npm start`, health check path `/health`.)
3. When asked, paste your bot token into `DISCORD_TOKEN` and the Atlas string into `MONGODB_URI`.
4. After deploy, open `https://<your-service>.onrender.com/health` — you should see `"status":"ok"`.

### Keep it awake with cron-job.org

Free Render services go to sleep after 15 minutes without web traffic, which takes the bot offline.

1. Sign up at <https://cron-job.org/en/> → **Create cronjob**.
2. URL: `https://<your-service>.onrender.com/health`
3. Schedule: **every 5 minutes**.
4. Optional: under **Notifications**, turn on "notify on failure" to get an email if the bot goes down.

## Welcome system

Type `?welcome` (needs **Manage Server**) to open the setup panel:

| Button | What it does |
| --- | --- |
| 📝 Edit Message | Title and message text |
| 🎨 Embed Color | Color of the embed's left bar |
| 🖼️ Welcome Image | Small image top right (upload, link, `avatar` or `server`) |
| 🌅 Background | Large image at the bottom (upload or link) |
| 📢 Channel | Where welcomes are posted |
| 👤 Autorole | Role given to every new member |
| 🔵 Buttons | Up to 5 link buttons under the welcome |
| 📄 Embed Settings | Title, footer, timestamp, ping member |
| 🧪 Test Welcome | Posts a real welcome for you in the welcome channel |
| 👀 Preview | Shows the welcome only to you |
| 🌐 Language | Ready-made text in Somali, English or Arabic |
| ⚙️ Advanced | DM welcome, auto-delete |
| 🔄 Reset / ✅ Enable / ❌ Disable | Reset everything, turn on/off |

Placeholders in the title, message and footer: `{user}` `{username}` `{displayname}` `{server}` `{membercount}`

Shortcut commands: `?welcome channel #channel`, `?welcome enable`, `?welcome disable`, `?welcome test`,
`?welcome image` / `?welcome background` (attach an image), `?welcome reset`. See `?help`.

## Ticket system

Type `?ticket` (needs **Manage Server**) to open the setup panel:

| Button | What it does |
| --- | --- |
| 📝 Panel Message | Title, text and button label of the public "Create Ticket" panel |
| 💬 Ticket Message | Message shown inside every new ticket (`{user}` `{server}`) |
| 🎨 Embed Color | Color of the ticket embeds |
| 📂 Category | Category new ticket channels go in |
| 📜 Log Channel | Where open/close/delete logs and transcripts are posted |
| 👮 Support Roles | Roles that can see and manage every ticket |
| ⚙️ Settings | Ask reason, ping support, DM transcript, max tickets per member |
| 👀 Preview / 📤 Send Panel | See the public panel / post it in a channel |
| 🔄 Reset / ✅ Enable / ❌ Disable | Reset settings, turn tickets on/off |

How a ticket works:

1. A member clicks **🎫 Create Ticket**, types a reason, and gets a private `ticket-0001` channel
   that only they, the support roles and the bot can see.
2. Staff click **🙋 Claim** to take it. Anyone in the ticket can click **🔒 Close**.
3. Once closed, the member can't see it anymore and staff get **📑 Transcript**, **🔓 Reopen** and **⛔ Delete**.
4. Deleting saves an HTML transcript to the log channel and DMs it to the member.

Commands inside a ticket: `?ticket close`, `?ticket claim`, `?ticket add @member`, `?ticket remove @member`,
`?ticket rename <name>`. Staff = support roles or anyone with **Manage Channels**.

## Invite tracker

| Command | What it does |
| --- | --- |
| `?invite #channel` | Post who invited each new member in that channel (a plain name like `?invite welcome` works too) |
| `?invite summary` | Top 10 inviters and the 5 lowest |
| `?invite @member` | A member's invites (your own if empty) |
| `?invite off` / `?invite reset` | Stop join messages / reset all counts |

Invites = people who joined with their link minus the ones who left. Counting starts once the bot is online
with the **Manage Server** permission; earlier joins aren't known.

## Bot status

| Command | What it does |
| --- | --- |
| `?ping` | Show ping, uptime, servers, users, memory |
| `?ping #channel` | Post a live status message there that updates every 10 minutes |
| `?ping off` | Remove the live status |

The coloured bar is the ping at each of the last 8 updates: 🟦 under 100 ms, 🟩 under 200, 🟨 under 400, 🟥 slower.

## Help

`?help` lists every command; `?help <command>` shows one (e.g. `?help ticket`).
# karama-bot
