import _ from "lodash";

import "dotenv/config";
import { SlashCommandBuilder, REST, Routes } from "discord.js";

import { timedLog } from "./base.js";

export const COMMANDS = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("test")
    .setDescription("Replies with test!")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("bluesky")
    .setDescription("Bluesky notification service")
    .addSubcommand(sc =>
      sc.setName("start").setDescription("Start bluesky service")
    )
    .addSubcommand(sc =>
      sc.setName("stop").setDescription("Stop bluesky service")
    )
    .toJSON(),
];

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_APP_ID = process.env.DISCORD_APP_ID;
const DISCORD_SERVER_ID = process.env.DISCORD_SERVER_ID;

async function register() {
  const rest = new REST().setToken(DISCORD_BOT_TOKEN);
  const data = await rest.put(
    Routes.applicationGuildCommands(DISCORD_APP_ID, DISCORD_SERVER_ID),
    { body: COMMANDS }
  );

  timedLog(data);
}

register()
  .then(res => {
    timedLog(`register done with ${res}`);
  })
  .catch(e => {
    timedLog(`register errored with ${e}`);
  });
timedLog("register fired.");
