import _ from "lodash";

import { Client } from "discord.js";

import { timedLog, waitFor } from "./base.js";

export default class DiscordBot {
  constructor(max_retry, retry_after) {
    this.max_retry = max_retry;
    this.retry_after = retry_after;
    this.client = new Client({
      intents: []
    });
  }

  async login(token, chid, dbgchid) {
    await this.client.login(token);
    this.channel = await this.client.channels.fetch(chid);

    if (!_.isUndefined(dbgchid)) {
      try {
        this._dbgch = await this.client.channels.fetch(dbgchid);
        timedLog("Fetched debug channel!");
      } catch (e) {
        timedLog("Failed to fetch debug channel:", e);
      }
    }
  }

  async send(msg, opts) {
    for (const i = 0; i < this.max_retry; i++) {
      try {
        return await this.channel.send(msg, opts);
      } catch (e) {
        timedLog(e);
        timedLog(e.stack);
        await waitFor(this.retry_after);
      }
    }
    return await this.channel.send(msg, opts);
  }

  async dbg(msg, opts) {
    if (!_.isUndefined(this._dbgch)) {
      return await this._dbgch.send(msg, opts);
    }
  }
}