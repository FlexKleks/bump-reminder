# 🔔 Discord Bump Reminder Bot

A Discord bot that watches for `/bump` commands from supported bots and sends a reminder after 2 hours — with role mention and toggleable buttons.

---

## 🚀 Features

- Detect `/bump` usage by other bots
- Sends a reminder after 2 hours (or 1 min test mode)
- Optional role mention + toggle button
- Multi-language support (`en`, `de`, `fr`, `es`)
- Slash command `/task` for control (`status`, `cancel`, `test`)
- Language auto-detection or forced via config

---

## 📦 Setup

```bash
git clone https://github.com/FlexKleks/bump-reminder.git
cd bump-reminder
npm install
```

---

## ⚙️ Configuration

1. **Set up the environment file**

Copy `.env.example` and rename it:

```bash
cp .env.example .env
```

Then open `.env` and insert your Discord bot token:

```env
DISCORD_TOKEN=your_real_token_here
```

2. **Edit `config.json`**

Set up your bot/client ID, guild ID, channel, roles, and other options.  
Language-specific texts are included for `en`, `de`, `fr`, and `es`.

---

## ▶️ Running the bot

```bash
npm start
```

---

## 🛠 Slash Commands

| Command        | Action                          |
|----------------|---------------------------------|
| `/task status` | Show time until next reminder   |
| `/task cancel` | Cancel the current reminder     |
| `/task test`   | Sends a test reminder in 1 min  |

> Only the `ownerId` in your config can use `/task`!

---

## 🌐 Language Support

- Auto-detected per user (`interaction.locale`)
- Or forced globally via `"language"` in `config.json`
- Translations included:
  - English 🇬🇧
  - Deutsch 🇩🇪
  - Français 🇫🇷
  - Español 🇪🇸

---

## 🧾 License

MIT
