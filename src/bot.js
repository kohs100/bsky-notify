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
  #commands = {};

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
      for (const [comm, cb] of Object.entries(this.#commands)) {
        if (comm === i.commandName) {
          await cb(i);
          return;
        }
      }
      await this.#commands[null](i);
    });
  }

  register(comm, callback) {
    this.assert(
      _.isUndefined(this.#commands[comm]),
      `Duplicated callback comm: ${comm}`
    );

    this.#commands[comm] = callback;
  }

  unregister(comm) {
    this.assert(
      !_.isUndefined(this.#commands[comm]),
      `Invalid callback comm: ${comm}`
    );

    delete this.#commands[comm];
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

  debug(msg, opts) {
    if (!_.isUndefined(this._dbgch)) {
      this._dbgch.send(msg, opts)
        .then(_msg => {
          timedLog("Debug message sent.");
        }).catch(e => {
          timedLog(`Debug message send failed: e`);
        });
    }
  }

  catch(err, msg) {
    this.debug({
      content: `Exception at ${getTimestamp()} with: ${msg}`,
      embeds: fromError(err)
    });
  }

  assert(condition, msg) {
    if (!condition) {
      const err = new Error(`Assertion failed: ${msg}`);
      this.debug({
        content: `Assertion failed at ${getTimestamp()} with: ${msg}`,
        embeds: fromError(err)
      });
      throw err;
    }
  }
}