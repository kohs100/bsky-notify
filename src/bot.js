import { Client } from "discord.js";
import 'dotenv/config';

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const BOT_CHID = process.env.DISCORD_CHANNEL_ID;

export default class DiscordBot {
  constructor() {
    this.client = new Client({
      intents: []
    });
  }

  async login() {
    await this.client.login(BOT_TOKEN);
    this.channel = await this.client.channels.fetch(BOT_CHID);
  }

  async send(msg, opts) {
    return await this.channel.send(msg, opts);
  }
}