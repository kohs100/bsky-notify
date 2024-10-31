import _ from "lodash";

import "dotenv/config";

import {
  timedLog,
  getTimestamp,
  singleton,
  GCStorage,
  waitFor,
} from "./base.js";

import DeeplTranslator from "./deepl.js";
import BskyClient from "./bluesky.js";
import DiscordBot from "./bot.js";
import InteractiveMessage from "./msgbuilder.js";

const BSKY_SRV = process.env.BSKY_SRV;
const BSKY_ID = process.env.BSKY_ID;
const BSKY_PASS = process.env.BSKY_PASS;
const BSKY_SESS = process.env.BSKY_SESS;
const BSKY_FETCH_RATE = process.env.BSKY_FETCH_RATE;
const BSKY_MAX_RETRY = process.env.BSKY_MAX_RETRY;
const BSKY_FETCH_WINDOW = process.env.BSKY_FETCH_WINDOW;

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_DBGCH_ID = process.env.DISCORD_DBGCH_ID;

const DISCORD_MAX_RETRY = process.env.DISCORD_MAX_RETRY;
const DISCORD_RETRY_AFTER = process.env.DISCORD_RETRY_AFTER;
const DISCORD_CTX_LENGTH = process.env.DISCORD_CTX_LENGTH;

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEEPL_MAX_RETRY = process.env.DEEPL_MAX_RETRY;
const DEEPL_RETRY_AFTER = process.env.DEEPL_RETRY_AFTER;

class BskyFetcher {
  private date_last = new Date();
  private error_cnt = 0;
  private msg_store = new GCStorage<InteractiveMessage>();

  private _running = false;
  get running() {
    return this._running;
  }

  private async inner(date_from: Date, date_to: Date) {
    // timedLog("Start fetching new feeds...");
    const feeds = await singleton.client.getFeeds(
      date_from,
      date_to,
      BSKY_FETCH_WINDOW
    );

    // timedLog(`Unseed feeds before filtering: ${feeds.length}`);

    const filtered = feeds.filter(feed => {
      if (Object.hasOwn(feed, "reply")) {
        // Ignore reply
        return false;
      } else if (Object.hasOwn(feed, "reason")) {
        // Ignore repost
        return false;
      }
      return true;
    });

    if (_.isEmpty(filtered)) {
      // timedLog("No unseen feeds.");
      return;
    } else {
      const num = filtered.length;
      timedLog(`Got ${num} new feeds.`);
    }

    filtered.reverse();

    filtered.forEach((feed, i) => {
      timedLog(`========== Feed ${i} start ==========`);
      timedLog(feed);
      timedLog(`========== Feed ${i} end ==========`);
    });

    for (const afeed of filtered) {
      const msg = new InteractiveMessage(
        afeed.feed,
        DISCORD_CTX_LENGTH,
        imsg => {
          // this.msg_store.mark_dead(imsg.uri);
        }
      );
      await msg.send();
      // this.msg_store.add(msg.uri, msg);
    }
    // this.msg_store.try_gc();
  }

  private async wrapped_loop() {
    while (this.running) {
      try {
        const now = new Date();
        await this.inner(this.date_last, now);
        // Fetch success without error
        this.date_last = now;
        if (this.error_cnt > 0) {
          this.error_cnt = 0;
          singleton.debug(`Bot recovered from error.`);
        }
      } catch (e) {
        this.error_cnt += 1;
        singleton.catch(e, `Bot errored ${this.error_cnt}`);
        if (this.error_cnt >= BSKY_MAX_RETRY) {
          throw new Error(`Error count exceeded MAX_RETRY: ${BSKY_MAX_RETRY}.`);
        }
      }
      await waitFor(BSKY_FETCH_RATE);
    }
  }

  start() {
    singleton.assert(!this.running, "BskyFetcher already started!!");
    timedLog("BskyFetcher started.");
    this._running = true;
    this.error_cnt = 0;
    this.wrapped_loop()
      .catch(e => singleton.catch(e, "BskyFetcher loop failed!"))
      .finally(() => {
        this._running = false;
      });
  }

  stop() {
    singleton.assert(this.running, "BskyFetcher not started!!");
    timedLog("BskyFetcher stopped.");
    this._running = false;
  }
}

async function init_singleton() {
  const client = new BskyClient(BSKY_SRV, BSKY_SESS);
  await client.login(BSKY_ID, BSKY_PASS);

  timedLog("info: bsky login success!");

  const bot = new DiscordBot(DISCORD_MAX_RETRY, DISCORD_RETRY_AFTER);
  await bot.login(DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, DISCORD_DBGCH_ID);

  timedLog("info: bot login success!");

  let translator = null;
  if (_.isUndefined(DEEPL_API_KEY)) {
    timedLog("info: translator not available.");
  } else {
    translator = new DeeplTranslator(
      DEEPL_API_KEY,
      DEEPL_MAX_RETRY,
      DEEPL_RETRY_AFTER
    );
    timedLog("info: translator initialized.");
  }

  singleton.initialize(client, bot, translator);

  bot.debug(`Bot started at ${getTimestamp()}`);
}

async function main() {
  await init_singleton();

  const bskyloop = new BskyFetcher();
  bskyloop.start();

  singleton.bot.register("ping", async i => {
    await i.reply({ content: `You called ${i.commandName}!`, ephemeral: true });
  });

  singleton.bot.register("bluesky", async i => {
    if (i.options.getSubcommand() === "start") {
      if (bskyloop.running) {
        await i.reply({ content: "Bsky already started!", ephemeral: true });
      } else {
        bskyloop.start();
        await i.reply({ content: "Bsky service started.", ephemeral: true });
      }
    } else if (i.options.getSubcommand() === "stop") {
      if (bskyloop.running) {
        bskyloop.stop();
        await i.reply({ content: "Bsky service stopped.", ephemeral: true });
      } else {
        await i.reply({ content: "Bsky already stopped!", ephemeral: true });
      }
    }
  });
  singleton.bot.register(null, async i => {
    await i.reply({
      content: `Unhandled command: ${i.commandName}`,
      ephemeral: true,
    });
  });
}

main()
  .then(res => {
    timedLog(`main done with ${res}`);
  })
  .catch(e => {
    timedLog(`main errored with ${e}`);
  });
timedLog("main fired.");
