require('dotenv').config();
const express = require('express');
const fs = require('fs');
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

// 🔴 CONFIGURATION
// Your Guild ID from the logs is used here for slash command registration
const TEST_GUILD_ID = '1435919529745059883'; 

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});
const TOKEN = process.env.TOKEN;
const PORT = 3000;

// ===== PERSISTENCE SETUP (FREE RENDER TIER: Environment Variables) =====
const SETTINGS_FILE = 'settings.json';

// Load settings from Environment Variables (Render) or default to null
let settings = {
    WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID || null,
    GOODBYE_CHANNEL_ID: process.env.GOODBYE_CHANNEL_ID || null,
    VOICE_LOG_CHANNEL_ID: process.env.VOICE_LOG_CHANNEL_ID || null
};

/**
 * Saves settings locally and prompts the user to update Render ENV vars.
 */
function updateSetting(key, value) {
    settings[key] = value;
    
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    
    console.log(`\n=============================================================`);
    console.log(`⚠️ ACTION REQUIRED: SETTING SAVED LOCALLY!`);
    console.log(`Copy the new value for ${key} and paste it into your Render Environment Variables.`);
    console.log(`New value for ${key}: ${value}`);
    console.log(`=============================================================\n`);
}

/**
 * Retrieves setting, prioritizing the Environment Variables set in Render.
 */
function getSetting(key) {
    return settings[key];
}

// ===== Commands Definitions (HELP COMMAND ADDED) =====
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

// ===== Bot Ready Event =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  console.log(`Current Welcome Channel ID: ${settings.WELCOME_CHANNEL_ID || 'Not set (Update ENV)'}`);

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, TEST_GUILD_ID), {
      body: [
        helpCommand, // <--- ADDED HELP COMMAND
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
  setInterval(updateStatus, 60000); 
});

// ===== Dynamic Bot Status =====
function updateStatus() {
  const guild = client.guilds.cache.first(); 
  if (!guild) return;
  const totalMembers = guild.memberCount;
  client.user.setPresence({
    activities: [{ name: `${totalMembers} Members`, type: ActivityType.Watching }],
    status: 'online'
  });
}

// ===== Handle commands (Includes HELP command) =====
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  // --- HELP COMMAND HANDLER ---
  if (interaction.commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
        .setColor(0x0099FF) // Bright blue
        .setTitle('🤖 DEYVAM Bot Command List')
        .setDescription('Here is a list of commands you can use in the server.')
        .setThumbnail(interaction.client.user.displayAvatarURL())
        .addFields(
            { 
                name: '⚙️ Configuration Commands (Admin)', 
                value: 
                    '**/setwelcome #channel**: Set the channel for member arrival messages.\n' +
                    '**/setgoodbye #channel**: Set the channel for member exit messages.\n' +
                    '**/setvoicelog #channel**: Set the channel to log all voice activity (Join/Leave/Move/Mute/Stream).\n\n' +
                    '*Note: These settings require manual updates in Render ENV variables to be permanent.*',
                inline: false 
            },
            { 
                name: '🛠️ Moderation Commands (Admin)', 
                value: 
                    '**/kick @user [reason]**: Removes a member from the server.\n' +
                    '**/ban @user [reason]**: Permanently bans a member from the server.\n' +
                    '**/moveuser @user #channel**: Moves a user to a different voice channel.',
                inline: false 
            },
            { 
                name: '💬 General Commands', 
                value: 
                    '**/say [message]**: Makes the bot repeat your message.\n' +
                    '**/help**: Shows this command list.',
                inline: false 
            }
        )
        .setFooter({ text: `Serving ${interaction.guild.memberCount} members in ${interaction.guild.name}` })
        .setTimestamp();

    // Use ephemeral: true so only the user who ran the command sees the help message
    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }
  // --- END HELP COMMAND HANDLER ---

  if (interaction.commandName === 'say') {
    await interaction.reply(interaction.options.getString('message'));
  }

  if (interaction.commandName === 'setwelcome') {
    await interaction.deferReply({ ephemeral: true });
    
    const channel = interaction.options.getChannel('channel');
    updateSetting('WELCOME_CHANNEL_ID', channel.id);
    
    await interaction.editReply(`✅ Welcome messages will now be sent in ${channel}. \n\n**🛑 WARNING:** **You MUST** manually update the \`WELCOME_CHANNEL_ID\` Environment Variable on Render to make this permanent.`);
  }

  if (interaction.commandName === 'setgoodbye') {
    await interaction.deferReply({ ephemeral: true });
    
    const channel = interaction.options.getChannel('channel');
    updateSetting('GOODBYE_CHANNEL_ID', channel.id);
    
    await interaction.editReply(`✅ Goodbye messages will now be sent in ${channel}. \n\n**🛑 WARNING:** **You MUST** manually update the \`GOODBYE_CHANNEL_ID\` Environment Variable on Render to make this permanent.`);
  }

  if (interaction.commandName === 'setvoicelog') {
    await interaction.deferReply({ ephemeral: true });
    
    const channel = interaction.options.getChannel('channel');
    updateSetting('VOICE_LOG_CHANNEL_ID', channel.id);
    
    await interaction.editReply(`✅ Voice logs will now be sent in ${channel}. \n\n**🛑 WARNING:** **You MUST** manually update the \`VOICE_LOG_CHANNEL_ID\` Environment Variable on Render to make this permanent.`);
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

// ===== Welcome embed (Reads from ENV) =====
client.on(Events.GuildMemberAdd, async member => {
  const welcomeChannelId = getSetting('WELCOME_CHANNEL_ID');
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

// ===== Goodbye embed (Reads from ENV) =====
client.on(Events.GuildMemberRemove, async member => {
  const goodbyeChannelId = getSetting('GOODBYE_CHANNEL_ID');
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

// ===== Voice logs (Reads from ENV and uses Enhanced Embeds) =====
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const voiceLogChannelId = getSetting('VOICE_LOG_CHANNEL_ID');
  if (!voiceLogChannelId) return;
  
  const logChannel = newState.guild.channels.cache.get(voiceLogChannelId);
  if (!logChannel) return;

  const member = newState.member;
  const userTag = member.user.tag;
  const userAvatar = member.user.displayAvatarURL({ dynamic: true });

  // Helper function to show current user status
  const getStatus = (state) => {
    let status = [];
    if (state.selfMute) status.push('🎤 Muted');
    if (state.selfDeaf) status.push('🔇 Deafened');
    if (state.streaming) status.push('📺 Streaming');
    if (state.selfVideo) status.push('📹 Video On');
    return status.length > 0 ? status.join(', ') : '✅ None';
  };
  
  const BLURPLE = 0x5865F2;
  const YELLOW = 0xFEE75C;

  // 1. Member joined a VC
  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287) // Green
      .setAuthor({ name: `[CONNECT] ${userTag} connected`, iconURL: userAvatar })
      .setDescription(`**Member:** ${member} (\`${member.id}\`) has connected to voice.`)
      .addFields(
        { name: 'Channel', value: `<#${newState.channelId}>`, inline: true },
        { name: 'Session Status', value: getStatus(newState), inline: true }
      )
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();
      
    logChannel.send({ embeds: [embed] });

    // DM user
    try {
      await member.send(`🎧 You have successfully joined the voice channel: **${newState.channel.name}** in ${newState.guild.name}.`);
    } catch {
      console.log(`❌ Could not DM ${userTag}`);
    }
  }

  // 2. Member left a VC
  else if (oldState.channelId && !newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245) // Red
      .setAuthor({ name: `[DISCONNECT] ${userTag} disconnected`, iconURL: userAvatar })
      .setDescription(`**Member:** ${member} (\`${member.id}\`) has disconnected from voice.`)
      .addFields(
        { name: 'Channel Left', value: `\#${oldState.channel.name}`, inline: true },
        { name: 'Server', value: newState.guild.name, inline: true }
      )
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();
      
    logChannel.send({ embeds: [embed] });
  }

  // 3. Member moved VC
  else if (oldState.channelId !== newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(YELLOW) 
      .setAuthor({ name: `[MOVE] ${userTag} switched channels`, iconURL: userAvatar })
      .setDescription(`**Member:** ${member} (\`${member.id}\`) switched channels.`)
      .addFields(
        { name: 'Previous Channel', value: `\#${oldState.channel.name}`, inline: true },
        { name: 'New Channel', value: `<#${newState.channelId}>`, inline: true },
        { name: 'Session Status', value: getStatus(newState), inline: true }
      )
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();
      
    logChannel.send({ embeds: [embed] });

    // DM user
    try {
      await member.send(`🔄 You have been moved to the voice channel: **${newState.channel.name}** in ${newState.guild.name}.`);
    } catch {
      console.log(`❌ Could not DM ${userTag}`);
    }
  }
  
  // 4. Mute/Deafen/Stream/Video updates (Now using embeds for all status changes)
  else if (oldState.channelId === newState.channelId) {
      const currentChannel = newState.channelId ? `<#${newState.channelId}>` : 'Unknown Channel';
      
      // Helper function to generate and send status update embed
      const sendStatusEmbed = (statusType, isAdded, color, emojiOn, emojiOff) => {
          const action = isAdded ? 'ON' : 'OFF';
          const emoji = isAdded ? emojiOn : emojiOff;
          
          const embed = new EmbedBuilder()
              .setColor(color)
              .setAuthor({ name: `[STATUS] ${statusType} Update`, iconURL: userAvatar })
              .setDescription(`${emoji} **${userTag}** turned ${statusType} ${action}.`)
              .addFields({ name: 'Channel', value: currentChannel, inline: true })
              .setFooter({ text: `User ID: ${member.id}` })
              .setTimestamp();
              
          logChannel.send({ embeds: [embed] });
      };
      
      if (oldState.selfMute !== newState.selfMute) {
          sendStatusEmbed('Mute', newState.selfMute, BLURPLE, '🎤', '🔊'); 
      }
      if (oldState.selfDeaf !== newState.selfDeaf) {
          sendStatusEmbed('Deaf', newState.selfDeaf, BLURPLE, '🔇', '🦻'); 
      }
      if (oldState.streaming !== newState.streaming) {
          sendStatusEmbed('Stream', newState.streaming, YELLOW, '📺', '🔴'); 
      }
      if (oldState.selfVideo !== newState.selfVideo) {
          sendStatusEmbed('Video', newState.selfVideo, YELLOW, '📹', '❌'); 
      }
  }
});


// ===== Keep-alive =====
express().get('/', (_, res) => res.send('Bot is online')).listen(PORT, () => {
  console.log(`🌐 Express running on port ${PORT}`);
});

client.login(TOKEN);
