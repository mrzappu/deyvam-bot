require('dotenv').config();
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  ActivityType,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const sqlite3 = require('sqlite3').verbose(); // Import SQLite

// 🔴 CONFIGURATION
// Replace 'YOUR_TEST_SERVER_ID_HERE' with the ID of your main server.
const TEST_GUILD_ID = 'YOUR_TEST_SERVER_ID_HERE'; 
const DB_FILE = 'my_deyvam.sql'; // The file where all settings are saved

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});
const TOKEN = process.env.TOKEN;
const PORT = 3000;

// ===== Database Setup =====
const db = new sqlite3.Database(DB_FILE);

/**
 * Initializes the database table if it doesn't exist.
 */
function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            guild_id TEXT PRIMARY KEY,
            welcome_channel_id TEXT,
            goodbye_channel_id TEXT,
            voice_log_channel_id TEXT
        )`);
        // Ensure the entry for the main guild exists on first run
        db.run(`INSERT OR IGNORE INTO settings (guild_id) VALUES (?)`, [TEST_GUILD_ID]);
        console.log('📊 Database initialized and ready to use my_deyvam.sql.');
    });
}

/**
 * Retrieves a single setting from the database for the given guild.
 * @param {string} key - The column name (e.g., 'welcome_channel_id')
 * @returns {Promise<string|null>} The channel ID or null
 */
function getSetting(key) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT ${key} FROM settings WHERE guild_id = ?`, [TEST_GUILD_ID], (err, row) => {
            if (err) {
                console.error(`DB Read Error (${key}):`, err);
                return reject(err);
            }
            resolve(row ? row[key] : null);
        });
    });
}

/**
 * Updates a single setting in the database for the given guild.
 * @param {string} key - The column name (e.g., 'welcome_channel_id')
 * @param {string|null} value - The new channel ID or null
 * @returns {Promise<void>}
 */
function updateSetting(key, value) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE settings SET ${key} = ? WHERE guild_id = ?`, [value, TEST_GUILD_ID], function(err) {
            if (err) {
                console.error(`DB Write Error (${key}):`, err);
                return reject(err);
            }
            resolve();
        });
    });
}

// ===== Commands =====
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
    opt.setName('channel')
      .setDescription('The channel to send welcome messages')
      .setRequired(true)
  );

const setGoodbyeCommand = new SlashCommandBuilder()
  .setName('setgoodbye')
  .setDescription('Set the channel for goodbye messages')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('The channel to send goodbye messages')
      .setRequired(true)
  );

const setVoiceLogCommand = new SlashCommandBuilder()
  .setName('setvoicelog')
  .setDescription('Set the channel for voice logs')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('The channel to log voice joins/leaves/moves')
      .setRequired(true)
  );

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
  .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers);

// ===== Bot Ready Event (Includes DB Init) =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  initDb(); // Initialize the database

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, TEST_GUILD_ID), {
      body: [
        sayCommand,
        setWelcomeCommand,
        setGoodbyeCommand,
        setVoiceLogCommand,
        kickCommand,
        banCommand,
        moveUserCommand
      ].map(c => c.toJSON())
    });
    console.log(`📤 Slash commands registered to Guild ID: ${TEST_GUILD_ID}`);
  } catch (err) {
    console.error('❌ Command registration failed:', err);
  }

  updateStatus();
  setInterval(updateStatus, 60000); // update every 1 minute
});

// ===== Dynamic Bot Status (Remains the same) =====
function updateStatus() {
  const guild = client.guilds.cache.first(); 
  if (!guild) return;
  const totalMembers = guild.memberCount;
  client.user.setPresence({
    activities: [{ name: `${totalMembers} Members`, type: ActivityType.Watching }],
    status: 'online'
  });
}

// ===== Handle commands (Uses DB for persistence) =====
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'say') {
    await interaction.reply(interaction.options.getString('message'));
  }

  if (interaction.commandName === 'setwelcome') {
    const channel = interaction.options.getChannel('channel');
    await updateSetting('welcome_channel_id', channel.id);
    await interaction.reply(`✅ Welcome messages will now be sent in ${channel} and saved to **my_deyvam.sql**.`);
  }

  if (interaction.commandName === 'setgoodbye') {
    const channel = interaction.options.getChannel('channel');
    await updateSetting('goodbye_channel_id', channel.id);
    await interaction.reply(`✅ Goodbye messages will now be sent in ${channel} and saved to **my_deyvam.sql**.`);
  }

  if (interaction.commandName === 'setvoicelog') {
    const channel = interaction.options.getChannel('channel');
    await updateSetting('voice_log_channel_id', channel.id);
    await interaction.reply(`✅ Voice logs will now be sent in ${channel} and saved to **my_deyvam.sql**.`);
  }

  if (interaction.commandName === 'kick') {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason given';
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
    try {
      await member.kick(reason);
      await interaction.reply(`✅ Kicked **${target.tag}**. Reason: ${reason}`);
    } catch {
      await interaction.reply({ content: '❌ Failed to kick. Check permissions.', ephemeral: true });
    }
  }

  if (interaction.commandName === 'ban') {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason given';
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
    try {
      await member.ban({ reason });
      await interaction.reply(`✅ Banned **${target.tag}**. Reason: ${reason}`);
    } catch {
      await interaction.reply({ content: '❌ Failed to ban. Check permissions.', ephemeral: true });
    }
  }

  if (interaction.commandName === 'moveuser') {
    const target = interaction.options.getUser('target');
    const channel = interaction.options.getChannel('channel');
    if (channel.type !== 2) return interaction.reply({ content: '❌ Not a voice channel.', ephemeral: true });
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member?.voice.channel) return interaction.reply({ content: '❌ Member not in VC.', ephemeral: true });
    try {
      await member.voice.setChannel(channel);
      await interaction.reply(`✅ Moved **${target.tag}** to **${channel.name}**`);
    } catch {
      await interaction.reply({ content: '❌ Failed to move. Check permissions.', ephemeral: true });
    }
  }
});

// ===== Welcome embed (Reads from DB) =====
client.on(Events.GuildMemberAdd, async member => {
  const welcomeChannelId = await getSetting('welcome_channel_id');
  const channel = welcomeChannelId
    ? member.guild.channels.cache.get(welcomeChannelId)
    : member.guild.systemChannel;

  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287) 
      .setTitle(`🎮 Welcome ${member.user.username} to **DEYVAM Gaming**! 🕹️`)
      .setDescription(
        "━━━━━━━━━━━━━━━━━━━━━\n" +
        "📌 Check out the **#rules** channel first.\n" +
        "📌 Grab a **role** in the **#roles** channel.\n" +
        "📌 Hop into a voice channel and start gaming!\n" +
        "━━━━━━━━━━━━━━━━━━━━━\n\n" +
        "Get ready to grind with us! Let the games begin! 🚀✨"
      )
      .setThumbnail(member.guild.iconURL({ dynamic: true }))
      .setFooter({ text: "DEYVAM • Game On! 🌍" })
      .setTimestamp();

    channel.send({ content: `Welcome ${member.user}!`, embeds: [embed] });
  }
});

// ===== Goodbye embed (Reads from DB) =====
client.on(Events.GuildMemberRemove, async member => {
  const goodbyeChannelId = await getSetting('goodbye_channel_id');
  const channel = goodbyeChannelId
    ? member.guild.channels.cache.get(goodbyeChannelId)
    : member.guild.systemChannel;

  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245) 
      .setTitle(`🚪 ${member.user.tag} logged off from **DEYVAM Gaming**...`)
      .setDescription(
        "━━━━━━━━━━━━━━━━━━━━━\n" +
        "We lost a player! The lobby feels empty now. 💔\n" +
        "We hope to see your high score again soon! 🎮\n" +
        "━━━━━━━━━━━━━━━━━━━━━"
      )
      .setThumbnail(member.guild.iconURL({ dynamic: true }))
      .setFooter({ text: "DEYVAM • AFK Mode 🌌" })
      .setTimestamp();

    channel.send({ embeds: [embed] });
  }
});

// ===== Voice logs (Reads from DB and uses Embeds) =====
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const voiceLogChannelId = await getSetting('voice_log_channel_id');
  if (!voiceLogChannelId) return;
  
  const logChannel = newState.guild.channels.cache.get(voiceLogChannelId);
  if (!logChannel) return;

  const member = newState.member;
  const userTag = member.user.tag;
  const userAvatar = member.user.displayAvatarURL({ dynamic: true });

  // 1. Member joined a VC
  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287) // Green
      .setAuthor({ name: `${userTag} joined voice`, iconURL: userAvatar })
      .setDescription(`**Member:** ${member} (${member.id})\n**Channel:** <#${newState.channelId}>`)
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();
      
    logChannel.send({ embeds: [embed] });

    // DM user
    try {
      await member.send(`🎧 You just joined VC: **${newState.channel.name}**`);
    } catch {
      console.log(`❌ Could not DM ${userTag}`);
    }
  }

  // 2. Member left a VC
  else if (oldState.channelId && !newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245) // Red
      .setAuthor({ name: `${userTag} left voice`, iconURL: userAvatar })
      .setDescription(`**Member:** ${member} (${member.id})\n**Channel:** ${oldState.channel.name} (<#${oldState.channelId}>)`)
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();
      
    logChannel.send({ embeds: [embed] });
  }

  // 3. Member moved VC
  else if (oldState.channelId !== newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C) // Yellow
      .setAuthor({ name: `${userTag} switched voice channel`, iconURL: userAvatar })
      .setDescription(`**Member:** ${member} (${member.id})\n**Previous:** ${oldState.channel.name} (<#${oldState.channelId}>)\n**New:** <#${newState.channelId}>`)
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();
      
    logChannel.send({ embeds: [embed] });

    // DM user
    try {
      await member.send(`🔄 You moved to VC: **${newState.channel.name}**`);
    } catch {
      console.log(`❌ Could not DM ${userTag}`);
    }
  }
  
  // 4. Mute/Deafen/Stream/Video updates
  else if (oldState.channelId === newState.channelId) {
      if (oldState.selfMute !== newState.selfMute) {
          logChannel.send(`🔇 **${userTag}** ${newState.selfMute ? 'self-muted' : 'self-unmuted'} in <#${newState.channelId}>`);
      }
      if (oldState.selfDeaf !== newState.selfDeaf) {
          logChannel.send(`🙉 **${userTag}** ${newState.selfDeaf ? 'self-deafened' : 'self-undeafened'} in <#${newState.channelId}>`);
      }
      if (oldState.streaming !== newState.streaming) {
          logChannel.send(`📺 **${userTag}** ${newState.streaming ? 'started streaming' : 'stopped streaming'} in <#${newState.channelId}>`);
      }
      if (oldState.selfVideo !== newState.selfVideo) {
          logChannel.send(`📹 **${userTag}** ${newState.selfVideo ? 'turned video on' : 'turned video off'} in <#${newState.channelId}>`);
      }
  }
});


// ===== Keep-alive =====
express().get('/', (_, res) => res.send('Bot is online')).listen(PORT, () => {
  console.log(`🌐 Express running on port ${PORT}`);
});

client.login(TOKEN);
