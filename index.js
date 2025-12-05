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
  ChannelType
} = require('discord.js');

// 🔴 CONFIGURATION
const TEST_GUILD_ID = '1435919529745059883'; // <--- ⚠️ REPLACE with your server ID

// === IMPORTANT ROLE & STAFF IDS ===
const ROLE_IDS = {
    MOBILE_GAMER: '1446186886963007606', 
    PC_PLAYER: '1446187229360816149',
};

// ⚠️ IMPORTANT: REPLACE WITH YOUR MODERATOR/STAFF ROLE ID
const STAFF_ROLE_ID = '1442895694242250943'; // <--- ⚠️ REPLACE this ID

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

// ===== PERSISTENCE SETUP (FREE RENDER TIER: Environment Variables) =====
const SETTINGS_FILE = 'settings.json';

// --- UPDATED SETTINGS ---
let settings = {
    WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID || null,
    GOODBYE_CHANNEL_ID: process.env.GOODBYE_CHANNEL_ID || null,
    VOICE_LOG_CHANNEL_ID: process.env.VOICE_LOG_CHANNEL_ID || null,
    TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || null,
    TICKET_LOG_CHANNEL_ID: process.env.TICKET_LOG_CHANNEL_ID || null,
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

// --- NEW TICKET SETUP COMMANDS ---
const setTicketCategoryCommand = new SlashCommandBuilder()
    .setName('setticketcategory')
    .setDescription('Set the category where new tickets will be created.')
    .addChannelOption(opt =>
        opt.setName('category')
            .setDescription('The category to use for tickets')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const setTicketLogCommand = new SlashCommandBuilder()
    .setName('setticketlog')
    .setDescription('Set the channel where ticket creation/closure/transcripts are logged.')
    .addChannelOption(opt =>
        opt.setName('channel')
            .setDescription('The channel to log ticket activity')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// --- NEW TICKET COMMAND ---
const ticketCommand = new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage support tickets.')
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Creates a new private support ticket.')
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('The reason for opening the ticket.')
                    .setRequired(false)))
    .setDefaultMemberPermissions(null); // Everyone can create a ticket

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

const setRolePanelCommand = new SlashCommandBuilder()
  .setName('setrolepanel')
  .setDescription('Creates the button-based self-role panel in the current channel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator); 

// ===== Bot Ready Event =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, TEST_GUILD_ID), {
      body: [
        helpCommand, 
        sayCommand,
        setWelcomeCommand,
        setGoodbyeCommand,
        setVoiceLogCommand,
        setTicketCategoryCommand, // NEW
        setTicketLogCommand, // NEW
        ticketCommand, // NEW
        kickCommand,
        banCommand,
        moveUserCommand,
        setRolePanelCommand 
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

/**
 * Creates a text transcript of the ticket channel.
 */
async function createTicketTranscript(channel, closer) {
    // Fetch all messages in the channel (up to 100)
    const messages = await channel.messages.fetch({ limit: 100 });
    let transcriptContent = `Ticket Transcript for #${channel.name}\n`;
    transcriptContent += `Opened by User ID: ${channel.topic}\n`; // User ID is stored in the topic
    transcriptContent += `Closed by: ${closer.tag} (${closer.id})\n`;
    transcriptContent += `Date Closed: ${new Date().toUTCString()}\n\n`;
    transcriptContent += '--- CONVERSATION ---\n\n';

    // Reverse messages to show them chronologically (oldest first)
    messages.reverse().forEach(msg => {
        // Skip bot's system messages (like the initial embed with buttons)
        if (msg.author.bot && msg.components.length > 0) return;
        
        const timestamp = new Date(msg.createdTimestamp).toLocaleString();
        transcriptContent += `[${timestamp}] ${msg.author.tag}: ${msg.content}\n`;
        msg.attachments.forEach(att => {
            transcriptContent += `[ATTACHMENT] ${att.url}\n`;
        });
    });

    // Save to a temporary file
    const fileName = `${channel.name}-${Date.now()}.txt`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, transcriptContent, 'utf-8');
    return filePath;
}


// ===== Handle commands and Button Interactions =====
client.on(Events.InteractionCreate, async interaction => {
  // --- HANDLE SLASH COMMANDS ---
  if (interaction.isChatInputCommand()) {
      
      // --- HELP COMMAND HANDLER (UPDATED) ---
      if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 DEYVAM Bot Command List')
            .setDescription('Here is a list of commands you can use in the server.')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .addFields(
                { 
                    name: '⚙️ Configuration Commands (Admin)', 
                    value: 
                        '**/setwelcome #channel**: Set the channel for member arrival messages.\n' +
                        '**/setgoodbye #channel**: Set the channel for member exit messages.\n' +
                        '**/setvoicelog #channel**: Set the channel to log all voice activity (Join/Leave/Move/Mute/Stream).\n' +
                        '**/setticketcategory <category>**: Set the parent category for new tickets.\n' +
                        '**/setticketlog #channel**: Set the channel for ticket transcripts and creation/closure logs.\n' +
                        '**/setrolepanel**: Creates the self-role button panel in the current channel.\n\n' +
                        '*Note: Settings require manual ENV variable updates to be permanent.*',
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
                    name: '💬 General & Utility Commands', 
                    value: 
                        '**/ticket create [reason]**: Opens a private support ticket.\n' +
                        '**/say [message]**: Makes the bot repeat your message.\n' +
                        '**/help**: Shows this command list.',
                    inline: false 
                }
            )
            .setFooter({ text: `Serving ${interaction.guild.memberCount} members in ${interaction.guild.name}` })
            .setTimestamp();

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
      }

      // --- NEW TICKET SETUP HANDLERS ---
      if (interaction.commandName === 'setticketcategory') {
          await interaction.deferReply({ ephemeral: true });
          const category = interaction.options.getChannel('category');
          updateSetting('TICKET_CATEGORY_ID', category.id);
          await interaction.editReply(`✅ Ticket category set to **${category.name}**. \n\n**🛑 WARNING:** **You MUST** manually update the \`TICKET_CATEGORY_ID\` Environment Variable on Render to make this permanent.`);
      }
      
      if (interaction.commandName === 'setticketlog') {
          await interaction.deferReply({ ephemeral: true });
          const channel = interaction.options.getChannel('channel');
          updateSetting('TICKET_LOG_CHANNEL_ID', channel.id);
          await interaction.editReply(`✅ Ticket logs will now be sent in ${channel}. \n\n**🛑 WARNING:** **You MUST** manually update the \`TICKET_LOG_CHANNEL_ID\` Environment Variable on Render to make this permanent.`);
      }

      // --- TICKET CREATE HANDLER (ADVANCED) ---
      if (interaction.commandName === 'ticket' && interaction.options.getSubcommand() === 'create') {
          await interaction.deferReply({ ephemeral: true });

          const TICKET_CATEGORY_ID = getSetting('TICKET_CATEGORY_ID');
          if (!TICKET_CATEGORY_ID) {
              return interaction.editReply('❌ Ticket system not configured. An administrator must use **/setticketcategory** first.');
          }

          const reason = interaction.options.getString('reason') || 'No reason provided.';
          const member = interaction.member;
          const guild = interaction.guild;
          
          // Check for an existing ticket by looking for a channel where the topic matches the user's ID
          const existingTicket = guild.channels.cache.find(c => c.topic === member.id && c.parentId === TICKET_CATEGORY_ID);
          if (existingTicket) {
              return interaction.editReply(`❌ You already have an active ticket open: ${existingTicket}.`);
          }

          // Create the private channel
          const ticketChannel = await guild.channels.create({
              name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}`,
              type: ChannelType.GuildText,
              topic: member.id, // Store user ID for identification and close permissions
              parent: TICKET_CATEGORY_ID,
              permissionOverwrites: [
                  // Deny @everyone access
                  { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                  // Allow the ticket creator access
                  { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                  // Allow the Staff Role access
                  { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
              ],
          });

          // Create Buttons
          const claimButton = new ButtonBuilder()
              .setCustomId('claim_ticket')
              .setLabel('Claim')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🙋');
              
          const closeButton = new ButtonBuilder()
              .setCustomId('close_ticket')
              .setLabel('Close')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔒');

          const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

          // Initial Ticket Message
          const ticketEmbed = new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle(`🎫 New Support Ticket Opened`)
              .setDescription(`Welcome, ${member}! Our staff team has been notified.`)
              .addFields(
                  { name: 'Opened By', value: `${member.user.tag}`, inline: true },
                  { name: 'Reason', value: reason }
              )
              .setFooter({ text: 'Staff: Click "Claim" to take this ticket.' })
              .setTimestamp();

          await ticketChannel.send({ content: `<@${member.id}> <@&${STAFF_ROLE_ID}>`, embeds: [ticketEmbed], components: [row] });
          await interaction.editReply({ content: `✅ Your ticket has been created in ${ticketChannel}.` });

          // Log the creation
          const logChannel = client.channels.cache.get(getSetting('TICKET_LOG_CHANNEL_ID'));
          if (logChannel) {
               const logEmbed = new EmbedBuilder()
                  .setColor(0x00ff00)
                  .setTitle('Ticket Created')
                  .setDescription(`User ${member} opened a new ticket: ${ticketChannel}`)
                  .addFields(
                      { name: 'Ticket ID', value: ticketChannel.id, inline: true },
                      { name: 'Reason', value: reason, inline: false }
                  )
                  .setTimestamp();
               logChannel.send({ embeds: [logEmbed] });
          }
      }

      // --- EXISTING SLASH COMMANDS ---
      
      if (interaction.commandName === 'setrolepanel') {
          // Send the role panel embed with buttons
          const rolePanelEmbed = new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle('🎮 Self-Assignable Roles')
              .setDescription('Click the buttons below to assign yourself a gaming role:')
              .addFields(
                  { name: '📱 Mobile Gamer', value: 'Get notifications for mobile gaming events.', inline: true },
                  { name: '💻 PC Player', value: 'Get notifications for PC gaming events.', inline: true }
              )
              .setFooter({ text: 'Click again to remove the role.' });

          const mobileButton = new ButtonBuilder()
              .setCustomId('role_mobile_gamer')
              .setLabel('Mobile Gamer')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('📱');

          const pcButton = new ButtonBuilder()
              .setCustomId('role_pc_player')
              .setLabel('PC Player')
              .setStyle(ButtonStyle.Success)
              .setEmoji('💻');

          const row = new ActionRowBuilder().addComponents(mobileButton, pcButton);

          await interaction.reply({
              embeds: [rolePanelEmbed],
              components: [row]
          });
      }
      
      if (interaction.commandName === 'say') {
        const message = interaction.options.getString('message');
        await interaction.channel.send(message);
        await interaction.reply({ content: '✅ Message sent!', ephemeral: true });
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

      // --- KICK COMMAND ---
      if (interaction.commandName === 'kick') {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason given';
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
        try {
          await member.kick(reason);
          await interaction.reply(`✅ Kicked **${target.tag}** (\`${target.id}\`). Reason: ${reason}`);
        } catch {
          await interaction.reply({ content: '❌ Failed to kick. Check permissions.', ephemeral: true });
        }
      }

      // --- BAN COMMAND ---
      if (interaction.commandName === 'ban') {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason given';
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
        try {
          await member.ban({ reason });
          await interaction.reply(`✅ Banned **${target.tag}** (\`${target.id}\`). Reason: ${reason}`);
        } catch {
          await interaction.reply({ content: '❌ Failed to ban. Check permissions.', ephemeral: true });
        }
      }

      if (interaction.commandName === 'moveuser') {
        const target = interaction.options.getUser('target');
        const channel = interaction.options.getChannel('channel');
        if (channel.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ Not a voice channel.', ephemeral: true });
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member?.voice.channel) return interaction.reply({ content: '❌ Member not in VC.', ephemeral: true });
        try {
          await member.voice.setChannel(channel);
          await interaction.reply(`✅ Moved **${target.tag}** to **${channel.name}**`);
        } catch {
          await interaction.reply({ content: '❌ Failed to move. Check permissions.', ephemeral: true });
        }
      }

  } // End of isChatInputCommand check
  
  // --- HANDLE BUTTON CLICKS ---
  else if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
      
      // --- SELF-ROLE LOGIC ---
      if (interaction.customId.startsWith('role_')) {
          await interaction.deferReply({ ephemeral: true }); 

          const member = interaction.member;
          let roleId, roleName;
          
          switch (interaction.customId) {
              case 'role_mobile_gamer':
                  roleId = ROLE_IDS.MOBILE_GAMER;
                  roleName = 'Mobile Gamer';
                  break;
              case 'role_pc_player':
                  roleId = ROLE_IDS.PC_PLAYER;
                  roleName = 'PC Player';
                  break;
              default:
                  return interaction.editReply('❌ Unknown role button.');
          }
          
          // Add/Remove Role Logic
          try {
              if (member.roles.cache.has(roleId)) {
                  await member.roles.remove(roleId);
                  await interaction.editReply(`🔴 Removed the **${roleName}** role.`);
              } else {
                  await member.roles.add(roleId);
                  await interaction.editReply(`🟢 Added the **${roleName}** role!`);
              }
          } catch (error) {
              console.error(`Error processing role for ${member.user.tag}:`, error);
              await interaction.editReply(`❌ Failed to modify the role. Check the bot's permissions (Must have "Manage Roles" and the bot's role must be above the role being assigned).`);
          }
      }

      // --- ADVANCED TICKET CLAIM LOGIC ---
      else if (interaction.customId === 'claim_ticket') {
          // Check if user is staff
          if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
              return interaction.reply({ content: '❌ Only staff members can claim tickets.', ephemeral: true });
          }

          await interaction.deferReply();
          
          const channel = interaction.channel;
          // Find the initial message (the one with the buttons)
          const messages = await channel.messages.fetch({ limit: 5 });
          const initialMessage = messages.find(m => m.components.length > 0 && m.components[0].components.some(c => c.customId === 'claim_ticket'));

          if (!initialMessage) {
               return interaction.editReply('❌ Could not find the initial ticket message to update.');
          }

          // Modify channel permissions to hide it from other staff (optional: only allow the claiming staff member)
          // For simplicity, we just hide the claim button here and mark it claimed.
          
          // Allow only the claiming user to view it from now on (removing the STAFF_ROLE_ID group access)
          try {
             await channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
                ViewChannel: false,
                SendMessages: false,
             });
             await channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
             });
             // Also ensure the ticket creator still has access
             if (channel.topic) {
                await channel.permissionOverwrites.edit(channel.topic, {
                    ViewChannel: true,
                    SendMessages: true,
                });
             }
          } catch (e) {
             console.error('Error modifying permissions during claim:', e);
             return interaction.editReply('❌ Failed to modify channel permissions for claiming. Check bot permissions.');
          }


          // Update initial message and remove the Claim button
          const closeButton = new ButtonBuilder()
              .setCustomId('close_ticket')
              .setLabel('Close Ticket')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔒');
              
          const row = new ActionRowBuilder().addComponents(closeButton);
          
          const claimEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🎫 Ticket Claimed')
            .setDescription(`This ticket has been claimed by ${interaction.member}. They will assist you shortly.`)
            .setFooter({ text: 'The claim button is now removed.' })
            .setTimestamp();
            
          await initialMessage.edit({
              content: `Ticket claimed by ${interaction.member}.`,
              embeds: [claimEmbed],
              components: [row]
          });
          
          await interaction.editReply({ content: `✅ You have claimed this ticket! Only you and the ticket creator can view this now.`, ephemeral: true });
          channel.send(`🙋 This ticket has been claimed by ${interaction.member}.`);
      }

      // --- ADVANCED TICKET CLOSE LOGIC (WITH TRANSCRIPT) ---
      else if (interaction.customId === 'close_ticket') {
          await interaction.deferReply();
          
          const channel = interaction.channel;
          const logChannel = client.channels.cache.get(getSetting('TICKET_LOG_CHANNEL_ID'));
          
          // Permission Check: Must be staff OR the original ticket creator (stored in channel topic)
          const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID);
          const isCreator = channel.topic === interaction.user.id;
          
          if (!isStaff && !isCreator) {
              return interaction.editReply({ content: '❌ You must be staff or the ticket creator to close this ticket.', ephemeral: true });
          }

          const closer = interaction.user;

          try {
              await channel.send(`🔒 Ticket is closing and transcript is being generated by ${closer.tag}...`);

              // 1. Generate Transcript
              const transcriptFilePath = await createTicketTranscript(channel, closer);
              
              // 2. Log and Send Transcript
              if (logChannel) {
                  const logEmbed = new EmbedBuilder()
                      .setColor(0xff0000)
                      .setTitle('Ticket Closed')
                      .setDescription(`Ticket #${channel.name} closed by ${closer.tag}. Transcript attached.`)
                      .addFields({name: 'Ticket Creator ID', value: channel.topic || 'N/A'})
                      .setTimestamp();
                  
                  await logChannel.send({ embeds: [logEmbed], files: [transcriptFilePath] });
              }
              
              // 3. Delete Temp File
              fs.unlinkSync(transcriptFilePath);

              // 4. Delete Channel
              await channel.delete(`Ticket closed by ${closer.tag}`);

          } catch (error) {
              console.error('Error during ticket closure:', error);
              // Send a fallback message if channel deletion fails or logging fails
              await interaction.editReply('❌ Failed to close ticket. The channel may need to be deleted manually, or the logging channel is misconfigured.');
          }
      }
  }

}); // End of InteractionCreate

// ===== Welcome embed =====
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
          "━━━━━━━━━━━━━━━━━━━━━"
        )
        .addFields({
          name: 'Account Created',
          value: time(member.user.createdAt, 'R'), 
          inline: true
        })
        .setThumbnail(member.guild.iconURL({ dynamic: true }))
        .setFooter({ text: "DEYVAM • Game On! 🌍" })
        .setTimestamp();
  
      channel.send({ content: `Welcome ${member.user}!`, embeds: [embed] });
    }
});

// ===== Goodbye embed =====
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

// ===== Voice logs (DM messages removed) =====
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
    const GREEN = 0x57F287;
    const RED = 0xED4245;
  
    // 1. Member joined a VC
    if (!oldState.channelId && newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor(GREEN) 
        .setAuthor({ name: `[CONNECT] ${userTag} connected`, iconURL: userAvatar })
        .setDescription(`**Member:** ${member} (\`${member.id}\`) has connected to voice.`)
        .addFields(
          { name: 'Channel', value: `<#${newState.channelId}>`, inline: true },
          { name: 'Session Status', value: getStatus(newState), inline: true }
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();
        
      logChannel.send({ embeds: [embed] });
    }
  
    // 2. Member left a VC
    else if (oldState.channelId && !newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor(RED) 
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
    }
    
    // 4. Mute/Deafen/Stream/Video updates
    else if (oldState.channelId === newState.channelId) {
        const currentChannel = newState.channelId ? `<#${newState.channelId}>` : 'Unknown Channel';
        
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
