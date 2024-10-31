import _ from "lodash";

import { AtpAgent } from "@atproto/api";
import { FeedViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import {
  ChatInputCommandInteraction,
  Message,
  MessageCreateOptions,
} from "discord.js";

export class GCStorage<T> {
  need_gc: Boolean = false;
  storage: Dictionary<{ alive: Boolean; value: T }> = {};

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

export type InteractionListener = (
  i: ChatInputCommandInteraction
) => Promise<void>;

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
  translate(text: string): Promise<string>;
}

export class singleton {
  private static _client?: BskyInterface;
  private static _bot?: DebugInterface & SendInterface & ListenInterface;
  private static _translator?: TranslatorInterface | null;

  private constructor() {}

  static get client(): BskyInterface {
    if (singleton._client === undefined) {
      throw new Error("Client is not initialized!!");
    } else {
      return singleton._client;
    }
  }

  static get bot(): DebugInterface & SendInterface & ListenInterface {
    if (singleton._bot === undefined) {
      throw new Error("Client is not initialized!!");
    } else {
      return singleton._bot;
    }
  }

  static get translator(): TranslatorInterface | null {
    if (singleton._translator === undefined) {
      throw new Error("Client is not initialized!!");
    } else {
      return singleton._translator;
    }
  }

  static initialize(
    c: BskyInterface,
    b: DebugInterface & SendInterface & ListenInterface,
    t: TranslatorInterface | null
  ) {
    singleton._client = c;
    singleton._bot = b;
    singleton._translator = t;
  }

  static assert(
    cond: Boolean,
    msg: string | MessageCreateOptions
  ): asserts cond {
    if (!cond) {
      const err = new Error(`Assertion failed: ${msg}`);
      singleton.bot.catch(err, msg);
      throw err;
    }
  }

  static catch(err: unknown, msg: string | MessageCreateOptions) {
    singleton.bot.catch(err, msg);
  }

  static debug(msg: string | MessageCreateOptions) {
    singleton.bot.debug(msg);
  }
}

export function getTimestamp() {
  const utc_now = new Date();
  const ofs = utc_now.getTimezoneOffset() * 60000;
  const jst_now = new Date(utc_now.getTime() - ofs);
  return jst_now.toISOString().replace(/T/, " ").replace(/\..+/, "");
}

export function timedLog(msg: any) {
  const now = getTimestamp();

  console.log(`[${now}]`, msg);
}

export function waitFor(msec: number) {
  return new Promise((res) => setTimeout(res, msec));
}
