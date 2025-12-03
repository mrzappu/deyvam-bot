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

// 🔴 FIX: Replace 'YOUR_TEST_SERVER_ID_HERE' with the ID of the server where you want to test commands.
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

// ===== In-memory channel settings =====
let welcomeChannelId = null;
let goodbyeChannelId = null;
let voiceLogChannelId = null;

// ===== Commands (No changes here) =====
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

// ===== Register commands (FIX APPLIED HERE) =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    // 🔴 FIX: Using Routes.applicationGuildCommands for instant testing
    // Change this back to Routes.applicationCommands(client.user.id) to deploy globally later.
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

// ===== Dynamic Bot Status =====
function updateStatus() {
  const guild = client.guilds.cache.first(); // your REDEMPTION server
  if (!guild) return;
  const totalMembers = guild.memberCount;
  client.user.setPresence({
    activities: [{ name: `${totalMembers} Members`, type: ActivityType.Watching }],
    status: 'online'
  });
}

// ===== Handle commands (No changes here) =====
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'say') {
    await interaction.reply(interaction.options.getString('message'));
  }

  if (interaction.commandName === 'setwelcome') {
    const channel = interaction.options.getChannel('channel');
    welcomeChannelId = channel.id;
    await interaction.reply(`✅ Welcome messages will now be sent in ${channel}`);
  }

  if (interaction.commandName === 'setgoodbye') {
    const channel = interaction.options.getChannel('channel');
    goodbyeChannelId = channel.id;
    await interaction.reply(`✅ Goodbye messages will now be sent in ${channel}`);
  }

  if (interaction.commandName === 'setvoicelog') {
    const channel = interaction.options.getChannel('channel');
    voiceLogChannelId = channel.id;
    await interaction.reply(`✅ Voice logs will now be sent in ${channel}`);
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

// ===== Welcome embed (No changes here) =====
client.on(Events.GuildMemberAdd, member => {
  const channel = welcomeChannelId
    ? member.guild.channels.cache.get(welcomeChannelId)
    : member.guild.systemChannel;

  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`👋 Hey ${member.user.username}, welcome to **DEYVAM** 🚗🔥`)
      .setDescription(
        "━━━━▣━━◤◢━━▣━━━━━\n" +
        "📌 Make Sure To Read RP Rules 📌\n" +
        "📌 Check Out Server Updates 📌\n" +
        "━━━━▣━━◤◢━━▣━━━━━\n\n" +
        "🛬 Enjoy your RP journey with us! 🚀✨"
      )
      .setThumbnail(member.guild.iconURL({ dynamic: true }))
      .setFooter({ text: "DEYVAM • Limits 🌍" })
      .setTimestamp();

    channel.send({ content: `Welcome ${member.user}!`, embeds: [embed] });
  }
});

// ===== Goodbye embed (No changes here) =====
client.on(Events.GuildMemberRemove, member => {
  const channel = goodbyeChannelId
    ? member.guild.channels.cache.get(goodbyeChannelId)
    : member.guild.systemChannel;

  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`💔 ${member.user.tag} just left **DEYVAM**...`)
      .setDescription(
        "━━━━▣━━◤◢━━▣━━━━━\n" +
        "We’ll miss your RP vibes ✈️\n" +
        "Hope to see you back soon! 🚀\n" +
        "━━━━▣━━◤◢━━▣━━━━━"
      )
      .setThumbnail(member.guild.iconURL({ dynamic: true }))
      .setFooter({ text: "DEYVAM • Until We Meet Again 🌌" })
      .setTimestamp();

    channel.send({ embeds: [embed] });
  }
});

// ===== Voice logs (No changes here) =====
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (!voiceLogChannelId) return;
  const logChannel = newState.guild.channels.cache.get(voiceLogChannelId);
  if (!logChannel) return;

  // Member joined a VC
  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setDescription(`✅ **${newState.member.user.tag}** joined **${newState.channel.name}**`)
      .setTimestamp();
    logChannel.send({ embeds: [embed] });

    // DM user
    try {
      await newState.member.send(`🎧 You just joined VC: **${newState.channel.name}**`);
    } catch {
      console.log(`❌ Could not DM ${newState.member.user.tag}`);
    }
  }

  // Member left a VC
  else if (oldState.channelId && !newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setDescription(`❌ **${oldState.member.user.tag}** left **${oldState.channel.name}**`)
      .setTimestamp();
    logChannel.send({ embeds: [embed] });
  }

  // Member moved VC
  else if (oldState.channelId !== newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setDescription(`🔄 **${newState.member.user.tag}** moved from **${oldState.channel.name}** ➝ **${newState.channel.name}**`)
      .setTimestamp();
    logChannel.send({ embeds: [embed] });

    // DM user
    try {
      await newState.member.send(`🔄 You moved to VC: **${newState.channel.name}**`);
    } catch {
      console.log(`❌ Could not DM ${newState.member.user.tag}`);
    }
  }
});

// ===== Keep-alive (No changes here) =====
express().get('/', (_, res) => res.send('Bot is online')).listen(PORT, () => {
  console.log(`🌐 Express running on port ${PORT}`);
});

client.login(TOKEN);
