import { Client } from "discord.js";
import 'dotenv/config';
import _ from "lodash";
import { timedLog } from "./base";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const BOT_CHID = process.env.DISCORD_CHANNEL_ID;
const BOT_DBG = process.env.DISCORD_DBGCH_ID;

export default class DiscordBot {
  constructor() {
    this.client = new Client({
      intents: []
    });
  }

  async login() {
    await this.client.login(BOT_TOKEN);
    this.channel = await this.client.channels.fetch(BOT_CHID);

    if (!_.isUndefined(BOT_DBG)) {
      try {
        this._dbgch = await this.client.channels.fetch(BOT_DBG);
        timedLog("Fetched debug channel!");
      } catch (e) {
        timedLog("Failed to fetch debug channel:", e);
      }
    }
  }

  async send(msg, opts) {
    return await this.channel.send(msg, opts);
  }

  async dbg(msg, opts) {
    if (!_.isUndefined(this._dbgch)) {
      return await this._dbgch.send(msg, opts);
    }
  }
}