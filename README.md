# 🔔 Discord Bump Reminder Bot

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node-18%2B-green.svg)
![Discord.js Version](https://img.shields.io/badge/discord.js-v14.x-purple.svg)

> A multilingual Discord bot that watches `/bump` commands (e.g. from Disboard) and reminds users after 2 hours. Includes role management, slash command control, and optional button toggles.

---

## 🚀 Features

✅ Auto-detect `/bump` usage from allowed bots  
⏰ Sends a reminder 2 hours later in a specific channel  
🔁 Test mode for fast debugging (1-minute reminder)  
🔔 Optional role mention and toggle button  
🌐 Multi-language support (`en`, `de`, `fr`, `es`)  
🛠 Slash command `/task` with subactions: `status`, `cancel`, `test`  
🔐 Owner-only command permissions  
🧠 Language auto-detection or forced via config

---

## 📸 Screenshot

![Reminder Preview](https://i.imgur.com/V5u1ft5.png)

---

## 📦 Setup

### 1. Clone & Install

```bash
git clone https://github.com/FlexKleks/bump-reminder.git
cd bump-reminder
npm install
```

---

### 2. Configuration

#### `.env`

```bash
cp .env.example .env
```

Then open `.env` and insert your bot token:

```env
DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
```

#### `config.json`

Set your:
- `clientId`, `guildId`, `channelId`, `roleId`, `ownerId`
- Allowed bump bot IDs (e.g. Disboard)
- Optional channel filter
- Language: `"en"`, `"de"`, `"fr"`, `"es"` — or leave blank for auto

---

## ▶️ Running the bot

```bash
npm start
```

---

## 🛠 Slash Command: `/task`

| Action  | Description                   |
|---------|-------------------------------|
| status  | See time left until reminder |
| cancel  | Cancel active reminder        |
| test    | Send test reminder in 1 min   |

> Only the owner (set in `config.json`) can use this command.

---

## 🌐 Language Support

- English 🇬🇧
- Deutsch 🇩🇪
- Français 🇫🇷
- Español 🇪🇸

Auto-detects the user's Discord language.  
Can be forced globally with `"language": "xx"` in config.

---

## 📄 License

MIT © 2025 FlexKleks


---

## 🏷️ GitHub Topics

These are the recommended topics to help others discover this project:

`discord` ‧ `discord-bot` ‧ `discordjs` ‧ `bump` ‧ `reminder` ‧ `slash-commands`  
`multi-language` ‧ `nodejs` ‧ `javascript` ‧ `open-source`
