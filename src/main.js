import { Client, Events, GatewayIntentBits } from "discord.js";
import process from "process";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { Collection, MessageFlags, REST, Routes } from "discord.js";
import { fileURLToPath } from "url";

import { db } from "./db.js";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const foldersPath = path.join(__dirname, "commands");

for (const commandName of fs.readdirSync(foldersPath)) {
  const commandPath = path.join(foldersPath, commandName);
  const command = (await import(commandPath)).default;
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${commandPath} is missing a required "data" or "execute" property.`
    );
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const channelId = oldState.channelId || newState.channelId;

  const trackedChannels = db.data.trackedChannels;
  if (!trackedChannels.includes(channelId)) return;

  try {
    const channel = await newState.guild.channels.fetch(channelId);
    if (channel.members.size === 0) {
      await channel.delete("모든 유저가 퇴장함");
      trackedChannels.splice(trackedChannels.indexOf(channelId), 1);
      await db.write();
    }
  } catch (err) {
    console.error("채널 삭제 실패:", err);
  }
});

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// and deploy your commands!
(async () => {
  try {
    console.log(
      `Started refreshing ${client.commands.size} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_APPLICATION_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: client.commands.map((command) => command.data.toJSON()) }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();

client.login(process.env.DISCORD_TOKEN);
