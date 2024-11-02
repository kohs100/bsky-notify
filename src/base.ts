import _ from "lodash";

import { AppBskyFeedDefs, AtpAgent } from "@atproto/api";
import {
  ChatInputCommandInteraction,
  Message,
  MessageCreateOptions,
} from "discord.js";

export type InteractionListener = (
  i: ChatInputCommandInteraction
) => Promise<void>;

export type AugmentedFeed = {
  feed: AppBskyFeedDefs.FeedViewPost;
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
  return new Promise(res => setTimeout(res, msec));
}
