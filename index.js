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
import fs from 'fs/promises';
import dotenv from 'dotenv';
dotenv.config();

import { REST, Routes } from 'discord.js';

const config = JSON.parse(
  await fs.readFile(new URL('./config.json', import.meta.url))
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

let reminderTimeout = null;
let nextReminderTimestamp = null;

client.commands = new Collection();

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
      return interaction.reply({
        content: texts.taskNoPermission,
        flags: MessageFlags.Ephemeral
      });
    }

    const action = interaction.options.getString('action');

    if (action === 'status') {
      if (!nextReminderTimestamp) {
        return interaction.reply({
          content: texts.taskStatusNone,
          flags: MessageFlags.Ephemeral
        });
      }

      const timeLeftMs = nextReminderTimestamp - Date.now();
      const minutes = Math.floor(timeLeftMs / 60000);
      const seconds = Math.floor((timeLeftMs % 60000) / 1000);
      const message = texts.taskStatusText
        .replace('{minutes}', minutes)
        .replace('{seconds}', seconds);

      return interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral
      });
    }

    if (action === 'cancel') {
      if (reminderTimeout) {
        clearTimeout(reminderTimeout);
        reminderTimeout = null;
        nextReminderTimestamp = null;
        return interaction.reply({
          content: texts.taskCanceled,
          flags: MessageFlags.Ephemeral
        });
      } else {
        return interaction.reply({
          content: texts.taskAlreadyCanceled,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (action === 'test') {
      await interaction.reply({
        content: texts.taskTestStart,
        flags: MessageFlags.Ephemeral
      });
      return scheduleReminder(1, texts); // 1 Minute
    }
  }
});

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: [taskCommand.toJSON()] }
  );

  console.log('📎 Slash command /task registered');
});

client.on('messageCreate', async (message) => {
  if (
    message.author.bot &&
    (!Array.isArray(config.allowedBotIds) || config.allowedBotIds.includes(message.author.id)) &&
    message.interaction &&
    message.interaction.commandName === 'bump' &&
    (!config.allowedChannelId || message.channelId === config.allowedChannelId)
  ) {
    if (!reminderTimeout) {
      console.log(`📥 /bump detected from ${message.author.tag} (${message.author.id})`);
      const lang = config.language?.toLowerCase() || message.interaction.locale?.toLowerCase() || 'en';
      const texts = config[`texts_${lang}`] || config.texts_en;
      scheduleReminder(120, texts); // 2 Stunden
    } else {
      console.log('⏳ Reminder already running – ignored.');
    }
  }
});

client.on('interactionCreate', async interaction => {
  const lang = config.language?.toLowerCase() || interaction.locale?.toLowerCase() || 'en';
  const texts = config[`texts_${lang}`] || config.texts_en;

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) {
      await command.execute(interaction);
    }
  }

  if (interaction.isButton() && interaction.customId === 'toggleReminderRole') {
    if (!config.mentionRole) {
      return interaction.reply({
        content: texts.roleDisabled,
        flags: MessageFlags.Ephemeral
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const role = interaction.guild.roles.cache.get(config.roleId);

    if (!role) {
      return interaction.reply({
        content: texts.roleNotFound,
        flags: MessageFlags.Ephemeral
      });
    }

    const hasRole = member.roles.cache.has(role.id);
    try {
      if (hasRole) {
        await member.roles.remove(role);
        await interaction.reply({
          content: texts.roleRemoved,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await member.roles.add(role);
        await interaction.reply({
          content: texts.roleAdded,
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (err) {
      console.error(err);
      await interaction.reply({
        content: texts.roleChangeError,
        flags: MessageFlags.Ephemeral
      });
    }
  }
});

async function scheduleReminder(minutes = 120, texts) {
  if (reminderTimeout) return;

  nextReminderTimestamp = Date.now() + minutes * 60 * 1000;
  console.log(`⏳ Reminder scheduled in ${minutes} minute(s)`);

  reminderTimeout = setTimeout(async () => {
    const channel = await client.channels.fetch(config.channelId);
    const roleMention = config.mentionRole ? `<@&${config.roleId}>` : '';

    const embed = new EmbedBuilder()
      .setTitle(texts.embedTitle)
      .setDescription(texts.embedDescription)
      .setColor(0x00AEFF)
      .setTimestamp();

    let components = [];
    if (config.showButton) {
      const button = new ButtonBuilder()
        .setCustomId('toggleReminderRole')
        .setLabel(texts.buttonLabel)
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);
      components = [row];
    }

    await channel.send({
      content: roleMention,
      embeds: [embed],
      components
    });

    console.log('📤 Reminder sent');
    reminderTimeout = null;
    nextReminderTimestamp = null;
  }, minutes * 60 * 1000);
}

client.login(process.env.DISCORD_TOKEN);
