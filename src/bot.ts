import _ from "lodash";

import {
  ChannelType,
  Client,
  DMChannel,
  EmbedBuilder,
  Events,
  Message,
  MessageCreateOptions,
  TextChannel
} from "discord.js";

import {
  SendInterface,
  DebugInterface,
  ListenInterface,
  getTimestamp,
  timedLog,
  waitFor,
  InteractionListener,
  Dictionary,
} from "./base.js";

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

function fromError(err: Error) {
  const now = new Date();

  const msg_embed = new EmbedBuilder();

  msg_embed.setTitle(`Error message`);
  msg_embed.setDescription(err.toString());
  msg_embed.setTimestamp(now);

  const stk_embed = new EmbedBuilder();
  stk_embed.setTitle(`Stack trace`);
  stk_embed.setTimestamp(now);
  if (err.stack === undefined) {
    stk_embed.setDescription("Runtime does not support stack in error.");
  } else {
    stk_embed.setDescription(err.stack.toString());
  }

  return [msg_embed, stk_embed];
}

export default class DiscordBot implements DebugInterface, SendInterface, ListenInterface {
  private commands: Dictionary<InteractionListener> = {};
  private default_command?: InteractionListener;

  private max_retry: number;
  private retry_after: number;
  private client: Client;

  private channel?: TextChannel | DMChannel;
  private dbgch?: TextChannel | DMChannel;

  constructor(max_retry: number, retry_after: number) {
    this.max_retry = max_retry;
    this.retry_after = retry_after;
    this.client = new Client({
      intents: []
    });
  }

  async fetchChannel(chid: string): Promise<TextChannel | DMChannel> {
    const ch = await this.client.channels.fetch(chid);
    if (ch === null) {
      throw new Error(`Failed to fetch channel ${chid}`);
    } else if (ch.type === ChannelType.DM) {
      if (ch.partial) {
        throw new Error(`Fetched channel ${chid} is partial`);
      }
      return ch;
    } else if (ch.type === ChannelType.GuildText) {
      return ch;
    } else {
      throw new Error(`Invalid channel type ${ch.type} for ${chid}`);
    }
  }

  async login(token: string, chid: string, dbgchid?: string) {
    await this.client.login(token);
    this.channel = await this.fetchChannel(chid);

    if (dbgchid !== undefined) {
      this.dbgch = await this.fetchChannel(dbgchid);
    }

    this.client.on(Events.InteractionCreate, async i => {
      if (!i.isChatInputCommand()) return;
      timedLog(`Got command ${i.commandName}`);
      for (const [comm, cb] of Object.entries(this.commands)) {
        if (comm === i.commandName) {
          await cb(i);
          return;
        }
      }
      if (this.default_command !== undefined)
        await this.default_command(i);
    });
  }

  register(comm: string | null, callback: InteractionListener) {
    if (comm === null) {
      this.assert(
        _.isUndefined(this.default_command),
        `Duplicated callback comm: ${comm}`
      );
      this.default_command = callback;
    } else {
      this.assert(
        _.isUndefined(this.commands[comm]),
        `Duplicated callback comm: ${comm}`
      );
      this.commands[comm] = callback;
    }
  }

  unregister(comm: string | null) {
    if (comm === null) {
      this.assert(
        _.isUndefined(this.default_command),
        `Duplicated callback comm: ${comm}`
      );
      delete this.default_command;
    } else {
      this.assert(
        !_.isUndefined(this.commands[comm]),
        `Invalid callback comm: ${comm}`
      );

      delete this.commands[comm];
    }
  }

  async send(msg: string | MessageCreateOptions): Promise<Message> {
    if (this.channel === undefined) throw new Error("Channel not initialized");
    for (let i = 0; i < this.max_retry; i++) {
      try {
        return await this.channel.send(msg);
      } catch (e) {
        const err: Error = e instanceof Error ? e : new Error(String(e));
        timedLog(err);
        if (err.stack !== undefined)
          timedLog(err.stack);
        await waitFor(this.retry_after);
      }
    }
    return await this.channel.send(msg);
  }

  debug(msg: string | MessageCreateOptions) {
    if (!_.isUndefined(this.dbgch)) {
      this.dbgch.send(msg)
        .then(_msg => {
          timedLog("Debug message sent.");
        }).catch(e => {
          timedLog(`Debug message send failed: ${e}`);
        });
    }
  }

  catch(err: unknown, msg: string | MessageCreateOptions) {
    const error = toError(err);
    this.debug({
      content: `Exception at ${getTimestamp()} with: ${msg}`,
      embeds: fromError(error)
    });
  }

  assert(cond: Boolean, msg: string | MessageCreateOptions) {
    if (!cond) {
      const err = new Error(`Assertion failed: ${msg}`);
      this.debug({
        content: `Assertion failed at ${getTimestamp()} with: ${msg}`,
        embeds: fromError(err)
      });
      throw err;
    }
  }
}