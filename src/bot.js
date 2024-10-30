import _ from "lodash";

import { Client, EmbedBuilder, Events } from "discord.js";

import { getTimestamp, timedLog, waitFor } from "./base.js";

function fromError(err) {
  const now = new Date();

  const msg_embed = new EmbedBuilder();

  msg_embed.setTitle(`Error message`);
  msg_embed.setDescription(err.toString());
  msg_embed.setTimestamp(now);

  const stk_embed = new EmbedBuilder();

  stk_embed.setTitle(`Stack trace`);
  stk_embed.setDescription(err.stack.toString());
  stk_embed.setTimestamp(now);

  return [msg_embed, stk_embed];
}

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

    this.client.on(Events.InteractionCreate, async i => {
      timedLog("Got interaction", i);
      if (!i.isChatInputCommand()) return;

      timedLog("Got command", i.commandName);
      await i.reply({ content: `You called ${i.commandName}!`, ephemeral: true });
    })
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

  async debug(msg, opts) {
    if (!_.isUndefined(this._dbgch)) {
      return await this._dbgch.send(msg, opts);
    }
  }

  async catch(err, msg) {
    return await this.debug({
      content: `Exception at ${getTimestamp()} with: ${msg}`,
      embeds: fromError(err)
    });
  }

  async assert(condition, msg) {
    if (!condition) {
      try {
        throw new Error(msg);
      } catch (e) {
        return await this.debug({
          content: `Assertion failed at ${getTimestamp()}`,
          embeds: fromError(e)
        });
      }
    }
  }
}