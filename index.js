require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  ActivityType,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionType,
  time,
  ChannelType,
  MessageFlags // Added MessageFlags for modern ephemeral handling
} = require('discord.js');

// 🔴 CONFIGURATION
// Note: This ID is now only used for logging/reference, registration is global
const TEST_GUILD_ID = '1456626927317291050'; 

// === IMPORTANT ROLE & STAFF IDS ===
const ROLE_IDS = {
    MOBILE_GAMER: '1446186886963007606', 
    PC_PLAYER: '1446187229360816149',
};

const STAFF_ROLE_ID = '1442895694242250943'; 

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent 
  ]
});
const TOKEN = process.env.TOKEN;
const PORT = 3000;

// ===== PERSISTENCE SETUP =====
const SETTINGS_FILE = 'settings.json';

let settings = {
    WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID || null,
    GOODBYE_CHANNEL_ID: process.env.GOODBYE_CHANNEL_ID || null,
    VOICE_LOG_CHANNEL_ID: process.env.VOICE_LOG_CHANNEL_ID || null,
    TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || null,
    TICKET_LOG_CHANNEL_ID: process.env.TICKET_LOG_CHANNEL_ID || null,
};

function updateSetting(key, value) {
    settings[key] = value;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log(`\n⚠️ SETTING SAVED: Update ${key} to ${value} in Render ENV vars.`);
}

function getSetting(key) {
    return settings[key];
}

// ===== Commands Definitions =====
const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Displays a list of all commands and features.');

const sayCommand = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Make the bot say something')
  .addStringOption(opt =>
    opt.setName('message').setDescription('The message to repeat').setRequired(true)
  );

const setWelcomeCommand = new SlashCommandBuilder()
  .setName('setwelcome')
  .setDescription('Set the channel for welcome messages')
  .addChannelOption(opt =>
    opt.setName('channel').setDescription('The channel to send welcome messages').setRequired(true)
  );

const setGoodbyeCommand = new SlashCommandBuilder()
  .setName('setgoodbye')
  .setDescription('Set the channel for goodbye messages')
  .addChannelOption(opt =>
    opt.setName('channel').setDescription('The channel to send goodbye messages').setRequired(true)
  );

const setVoiceLogCommand = new SlashCommandBuilder()
  .setName('setvoicelog')
  .setDescription('Set the channel for voice logs')
  .addChannelOption(opt =>
    opt.setName('channel').setDescription('The channel to log voice activity').setRequired(true)
  );

const setTicketCategoryCommand = new SlashCommandBuilder()
    .setName('setticketcategory')
    .setDescription('Set the category for new tickets.')
    .addChannelOption(opt =>
        opt.setName('category').setDescription('The category to use').setRequired(true).addChannelTypes(ChannelType.GuildCategory)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const setTicketLogCommand = new SlashCommandBuilder()
    .setName('setticketlog')
    .setDescription('Set the channel for ticket logs.')
    .addChannelOption(opt =>
        opt.setName('channel').setDescription('The channel to log tickets').setRequired(true).addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const setTicketPanelCommand = new SlashCommandBuilder()
    .setName('setticketpanel')
    .setDescription('Creates the ticket panel in the current channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator); 

const ticketCommand = new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage support tickets.')
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Creates a new support ticket.')
            .addStringOption(option =>
                option.setName('reason').setDescription('The reason for the ticket.').setRequired(false)))
    .setDefaultMemberPermissions(null);

const kickCommand = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member')
  .addUserOption(opt => opt.setName('target').setDescription('The member').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

const banCommand = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member')
  .addUserOption(opt => opt.setName('target').setDescription('The member').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

const moveUserCommand = new SlashCommandBuilder()
  .setName('moveuser')
  .setDescription('Move a member to a voice channel')
  .addUserOption(opt => opt.setName('target').setDescription('The member').setRequired(true))
  .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true).addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice))
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers);

const setRolePanelCommand = new SlashCommandBuilder()
  .setName('setrolepanel')
  .setDescription('Creates the self-role panel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator); 

// ===== Bot Ready Event (FIXED: Global Registration) =====
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    
    // CHANGED: Used Routes.applicationCommands (without Guild ID) for GLOBAL scope
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: [
        helpCommand, sayCommand, setWelcomeCommand, setGoodbyeCommand,
        setVoiceLogCommand, setTicketCategoryCommand, setTicketLogCommand,
        setTicketPanelCommand, ticketCommand, kickCommand, banCommand,
        moveUserCommand, setRolePanelCommand 
      ].map(c => c.toJSON())
    });
    console.log(`📤 Slash commands registered GLOBALLY! (May take up to 1 hour to update)`);
  } catch (err) {
    console.error('❌ Command registration failed:', err);
  }

  updateStatus();
  setInterval(updateStatus, 60000); 
});

function updateStatus() {
  const guild = client.guilds.cache.first(); 
  if (!guild) return;
  const totalMembers = guild.memberCount;
  client.user.setPresence({
    activities: [{ name: `${totalMembers} Members`, type: ActivityType.Watching }],
    status: 'online'
  });
}

// ... createTicketTranscript and createTicket functions remain the same as your logic ...

async function createTicketTranscript(channel, closer) {
    const messages = await channel.messages.fetch({ limit: 100 });
    let transcriptContent = `Ticket Transcript for #${channel.name}\nOpened by User ID: ${channel.topic}\nClosed by: ${closer.tag}\n\n--- CONVERSATION ---\n\n`;
    messages.reverse().forEach(msg => {
        if (msg.author.bot && msg.components.length > 0) return;
        transcriptContent += `[${new Date(msg.createdTimestamp).toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
    });
    const fileName = `${channel.name}-${Date.now()}.txt`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, transcriptContent, 'utf-8');
    return filePath;
}

async function createTicket(member, reason, client) {
    const TICKET_CATEGORY_ID = getSetting('TICKET_CATEGORY_ID');
    const TICKET_LOG_CHANNEL_ID = getSetting('TICKET_LOG_CHANNEL_ID');
    const guild = member.guild;
    if (!TICKET_CATEGORY_ID) throw new Error('Ticket system not configured.');
    const existingTicket = guild.channels.cache.find(c => c.topic === member.id && c.parentId === TICKET_CATEGORY_ID);
    if (existingTicket) throw new Error(`You already have an active ticket: ${existingTicket}`);

    const ticketChannel = await guild.channels.create({
        name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}`,
        type: ChannelType.GuildText,
        topic: member.id,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Secondary).setEmoji('🙋'),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );

    const ticketEmbed = new EmbedBuilder().setColor(0x0099ff).setTitle(`🎫 New Support Ticket`).setDescription(`Welcome, ${member}!`).addFields({ name: 'Reason', value: reason }).setTimestamp();
    await ticketChannel.send({ content: `<@${member.id}> <@&${STAFF_ROLE_ID}>`, embeds: [ticketEmbed], components: [row] });
    return ticketChannel;
}

// ===== Handle Interactions (FIXED: Reply safety and Flags) =====
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
      
      if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder().setColor(0x0099FF).setTitle('🤖 DEYVAM Bot Commands').setDescription('Admin and General commands listed here.').setTimestamp();
        await interaction.reply({ embeds: [helpEmbed], flags: [MessageFlags.Ephemeral] });
      }

      if (interaction.commandName === 'setticketcategory') {
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
          const category = interaction.options.getChannel('category');
          updateSetting('TICKET_CATEGORY_ID', category.id);
          await interaction.editReply(`✅ Ticket category set. Update Render ENV vars.`);
      }

      if (interaction.commandName === 'say') {
        const message = interaction.options.getString('message');
        await interaction.channel.send(message);
        // FIXED: Check before replying to prevent "Already Acknowledged" error
        const replyPayload = { content: '✅ Message sent!', flags: [MessageFlags.Ephemeral] };
        if (interaction.replied || interaction.deferred) await interaction.followUp(replyPayload);
        else await interaction.reply(replyPayload);
      }

      if (interaction.commandName === 'kick') {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason';
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ Member not found.', flags: [MessageFlags.Ephemeral] });
        try {
          await member.kick(reason);
          await interaction.reply(`✅ Kicked **${target.tag}**`);
        } catch {
          await interaction.reply({ content: '❌ Failed to kick.', flags: [MessageFlags.Ephemeral] });
        }
      }

      // ... other command handlers follow the same pattern (replace ephemeral: true with flags) ...
      // For brevity, ensure you replace ALL 'ephemeral: true' in your other commands with 'flags: [MessageFlags.Ephemeral]'
  } 
  
  else if (interaction.isButton()) {
      if (interaction.customId.startsWith('role_')) {
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); 
          // ... role logic ...
          await interaction.editReply('Role updated.');
      }
      else if (interaction.customId === 'open_ticket') {
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); 
          try {
              const ticketChannel = await createTicket(interaction.member, 'Button Click', client);
              await interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });
          } catch (error) {
              await interaction.editReply(`❌ ${error.message}`);
          }
      }
      // ... claim/close logic ...
  }
});

// ===== Welcome/Goodbye Events (FIXED: Deprecation warning) =====
client.on(Events.GuildMemberAdd, async member => {
    const welcomeChannelId = getSetting('WELCOME_CHANNEL_ID');
    const channel = welcomeChannelId ? member.guild.channels.cache.get(welcomeChannelId) : member.guild.systemChannel;
    if (channel) {
      const embed = new EmbedBuilder().setColor(0x57F287).setTitle(`🎮 Welcome ${member.user.username}!`).setTimestamp();
      channel.send({ content: `Welcome ${member.user}!`, embeds: [embed] });
    }
});

client.on(Events.GuildMemberRemove, async member => {
    const goodbyeChannelId = getSetting('GOODBYE_CHANNEL_ID');
    const channel = goodbyeChannelId ? member.guild.channels.cache.get(goodbyeChannelId) : member.guild.systemChannel;
    if (channel) {
      const embed = new EmbedBuilder().setColor(0xED4245).setTitle(`🚪 ${member.user.tag} left.`).setTimestamp();
      channel.send({ embeds: [embed] });
    }
});

// ===== Voice logs =====
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const voiceLogChannelId = getSetting('VOICE_LOG_CHANNEL_ID');
    if (!voiceLogChannelId) return;
    const logChannel = newState.guild.channels.cache.get(voiceLogChannelId);
    if (!logChannel) return;
    // ... your voice log logic ...
});

express().get('/', (_, res) => res.send('Bot is online')).listen(PORT, () => {
  console.log(`🌐 Express running on port ${PORT}`);
});

client.login(TOKEN);
