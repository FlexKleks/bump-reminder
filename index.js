import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  SlashCommandBuilder
} from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import { setTimeout as wait } from 'timers/promises';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import winston from 'winston';

dotenv.config();

// Logger setup with Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}] ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'bot.log' })
  ]
});

if (!process.env.DISCORD_TOKEN) {
  logger.error('❌ Discord token is missing. Check your .env file.');
  process.exit(1);
}

// Read config once
const config = JSON.parse(
  await fs.readFile(new URL('./config.json', import.meta.url))
);

// Database initialization
let db;
async function initDb() {
  db = await open({
    filename: './data/reminders.sqlite',
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reminder (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_timestamp INTEGER
    )
  `);
}

// Minimal required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
let reminderController = null;
let nextReminderTimestamp = null;

// Slash command setup
const taskCommand = new SlashCommandBuilder()
  .setName('task')
  .setDescription('Manage the bump reminder task')
  .addStringOption(option =>
    option
      .setName('action')
      .setDescription('What should happen?')
      .setRequired(true)
      .addChoices(
        { name: 'status', value: 'status' },
        { name: 'cancel', value: 'cancel' },
        { name: 'test (1 min)', value: 'test' }
      )
  );

client.commands.set(taskCommand.name, {
  data: taskCommand,
  async execute(interaction) {
    const lang = config.language?.toLowerCase() || interaction.locale?.toLowerCase() || 'en';
    const texts = config[`texts_${lang}`] || config.texts_en;

    if (interaction.user.id !== config.ownerId) {
      return interaction.reply({ content: texts.taskNoPermission, flags: MessageFlags.Ephemeral });
    }

    const action = interaction.options.getString('action');

    if (action === 'status') {
      if (!nextReminderTimestamp) {
        return interaction.reply({ content: texts.taskStatusNone, flags: MessageFlags.Ephemeral });
      }
      const msLeft = nextReminderTimestamp - Date.now();
      const minutes = Math.floor(msLeft / 60000);
      const seconds = Math.floor((msLeft % 60000) / 1000);
      const message = texts.taskStatusText
        .replace('{minutes}', minutes)
        .replace('{seconds}', seconds);
      return interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }

    if (action === 'cancel') {
      if (cancelReminder()) {
        return interaction.reply({ content: texts.taskCanceled, flags: MessageFlags.Ephemeral });
      } else {
        return interaction.reply({ content: texts.taskAlreadyCanceled, flags: MessageFlags.Ephemeral });
      }
    }

    if (action === 'test') {
      await interaction.reply({ content: texts.taskTestStart, flags: MessageFlags.Ephemeral });
      scheduleReminder(1, texts);
    }
  }
});

client.once('ready', async () => {
  logger.info(`✅ Logged in as ${client.user.tag}`);
  // Register slash commands
  const { REST, Routes } = await import('discord.js');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: [taskCommand.toJSON()] }
  );
  logger.info('📎 Slash command /task registered');

  // Initialize DB and resume any pending reminder
  await initDb();
  const row = await db.get('SELECT next_timestamp FROM reminder WHERE id = 1');
  if (row?.next_timestamp && row.next_timestamp > Date.now()) {
    const minutesLeft = Math.ceil((row.next_timestamp - Date.now()) / 60000);
    const lang = config.language?.toLowerCase() || 'en';
    const texts = config[`texts_${lang}`] || config.texts_en;
    logger.info(`🔄 Resuming reminder in ${minutesLeft} minute(s)`);
    scheduleReminder(minutesLeft, texts);
  }
});

// Rate limit handling
client.on('rateLimit', (info) => {
  logger.warn(`Rate limited: ${JSON.stringify(info)}`);
});

client.on('messageCreate', async (message) => {
  if (
    message.author.bot &&
    (!Array.isArray(config.allowedBotIds) || config.allowedBotIds.includes(message.author.id)) &&
    message.interaction?.commandName === 'bump' &&
    (!config.allowedChannelId || message.channelId === config.allowedChannelId)
  ) {
    if (!reminderController) {
      logger.info(`/bump detected from ${message.author.tag}`);
      const lang = config.language?.toLowerCase() || message.interaction.locale?.toLowerCase() || 'en';
      const texts = config[`texts_${lang}`] || config.texts_en;
      scheduleReminder(120, texts);
    } else {
      logger.info('⏳ Reminder already running – ignored.');
    }
  }
});

client.on('interactionCreate', async interaction => {
  const lang = config.language?.toLowerCase() || interaction.locale?.toLowerCase() || 'en';
  const texts = config[`texts_${lang}`] || config.texts_en;

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction);
  }

  if (interaction.isButton() && interaction.customId === 'toggleReminderRole') {
    if (!config.mentionRole) return interaction.reply({ content: texts.roleDisabled, flags: MessageFlags.Ephemeral });
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const role = interaction.guild.roles.cache.get(config.roleId);
    if (!role) return interaction.reply({ content: texts.roleNotFound, flags: MessageFlags.Ephemeral });

    try {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        await interaction.reply({ content: texts.roleRemoved, flags: MessageFlags.Ephemeral });
      } else {
        await member.roles.add(role);
        await interaction.reply({ content: texts.roleAdded, flags: MessageFlags.Ephemeral });
      }
    } catch (err) {
      logger.error(`Role change error: ${err}`);
      await interaction.reply({ content: texts.roleChangeError, flags: MessageFlags.Ephemeral });
    }
  }
});

async function scheduleReminder(minutes = 120, texts) {
  if (reminderController) return;
  const controller = new AbortController();
  reminderController = controller;
  nextReminderTimestamp = Date.now() + minutes * 60000;

  // Persist to DB
  await db.run(
    'INSERT INTO reminder (id, next_timestamp) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET next_timestamp=excluded.next_timestamp',
    nextReminderTimestamp
  );

  logger.info(`⏳ Reminder scheduled in ${minutes} minute(s)`);

  try {
    await wait(minutes * 60000, null, { signal: controller.signal });
    const channel = await client.channels.fetch(config.channelId);
    const roleMention = config.mentionRole ? `<@&${config.roleId}>` : '';
    const embed = new EmbedBuilder()
      .setTitle(texts.embedTitle)
      .setDescription(texts.embedDescription)
      .setColor(0x00AEFF)
      .setTimestamp();
    const components = config.showButton
      ? [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('toggleReminderRole')
            .setLabel(texts.buttonLabel)
            .setStyle(ButtonStyle.Primary)
        )]
      : [];
    await channel.send({ content: roleMention, embeds: [embed], components });
    logger.info('📤 Reminder sent');
  } catch (err) {
    if (err.name === 'AbortError') logger.info('❌ Reminder canceled');
    else logger.error(`❌ Error in reminder schedule: ${err}`);
  } finally {
    reminderController = null;
    nextReminderTimestamp = null;
    await db.run('DELETE FROM reminder WHERE id = 1');
  }
}

function cancelReminder() {
  if (reminderController) {
    reminderController.abort();
    return true;
  }
  return false;
}

// Graceful shutdown
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down...`);
  if (reminderController) cancelReminder();
  await db.close();
  client.destroy();
  process.exit(0);
}

client.login(process.env.DISCORD_TOKEN);
