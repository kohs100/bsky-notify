import _ from "lodash";

import { AtpAgent } from "@atproto/api";
import { FeedViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { ChatInputCommandInteraction, Message, MessageCreateOptions } from "discord.js";

export class GCStorage<T> {
  need_gc: Boolean = false;
  storage: Dictionary<{ alive: Boolean, value: T }> = {};

  add(key: string, value: T) {
    singleton.assert(
      _.isUndefined(this.storage[key]),
      `Duplicated value for key ${key}`
    );
    this.storage[key] = {
      alive: true,
      value: value,
    };
  }

  get(key: string): T | null {
    if (this.storage[key] === undefined) return null;
    const aval = this.storage[key];
    if (aval.alive) return aval.value;
    return null;
  }

  mark_dead(key: string) {
    singleton.assert(
      !_.isUndefined(this.storage[key]),
      `Trying to mark with invalid key ${key}`
    );
    this.storage[key].alive = false;
    this.need_gc = true;
  }

  try_gc() {
    if (this.need_gc) {
      this.need_gc = false;
      const victims = [];
      for (const [key, aval] of Object.entries(this.storage)) {
        const { alive: alive } = aval;
        if (!alive) victims.push(key);
      }
      for (const key of victims) {
        delete this.storage[key];
      }
      singleton.debug(`Evicted ${victims}`);
    }
  }
}

export type InteractionListener = (i: ChatInputCommandInteraction) => Promise<void>;

export type AugmentedFeed = {
  feed: FeedViewPost;
  sortAt: Date;
};

export interface Dictionary<T> {
  [Key: string]: T;
}

export interface BskyInterface {
  getFeeds(from: Date, to: Date, limit: number): Promise<AugmentedFeed[]>;
  agent: AtpAgent;
}

export interface DebugInterface {
  assert(cond: Boolean, msg: string | MessageCreateOptions): asserts cond;
  catch(err: unknown, msg: string | MessageCreateOptions): void;
  debug(msg: string | MessageCreateOptions): void;
}

export interface SendInterface {
  send(msg: string | MessageCreateOptions): Promise<Message>;
}

export interface ListenInterface {
  register(comm: null | string, cb: InteractionListener): void;
  unregister(comm: null | string): void;
}

export interface TranslatorInterface {
  translate(text: string): Promise<string>
}

interface _Singleton {
  client: BskyInterface,
  bot: DebugInterface & SendInterface & ListenInterface,
  translator: TranslatorInterface | null,
  assert(cond: Boolean, msg: string | MessageCreateOptions): asserts cond,
  catch(err: unknown, msg: string | MessageCreateOptions): void,
  debug(msg: string | MessageCreateOptions): void,
};

export const singleton: _Singleton = {
  client: {
    getFeeds: (from, to, limit) => { throw Error("Not Initialized") },
    get agent() { throw Error("Not Initialized"); return {} as AtpAgent }
  },
  bot: {
    assert: (cond) => {
      if (!cond) throw Error("Not Initialized");
    },
    catch: () => { throw Error("Not Initialized"); },
    debug: () => { throw Error("Not Initialized"); },
    send: () => { throw Error("Not Initialized"); },
    register: () => { throw Error("Not Initialized"); },
    unregister: () => { throw Error("Not Initialized"); }
  },
  translator: null,
  assert(cond: Boolean, msg: string | MessageCreateOptions) {
    if (!cond) {
      const err = new Error(`Assertion failed: ${msg}`);
      this.bot.catch(err, msg);
      throw err;
    }
  },

  catch(err: Error, msg: string | MessageCreateOptions) {
    this.bot.catch(err, msg);
  },

  debug(msg: string | MessageCreateOptions) {
    this.bot.debug(msg);
  }
}

export function getTimestamp() {
  const utc_now = new Date();
  const ofs = utc_now.getTimezoneOffset() * 60000;
  const jst_now = new Date(utc_now.getTime() - ofs);
  return jst_now.toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '');
}

export function timedLog(msg: any) {
  const now = getTimestamp();

  console.log(`[${now}]`, msg);
}

export function waitFor(msec: number) {
  return new Promise(res => setTimeout(res, msec));
}

