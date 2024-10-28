import _ from 'lodash';

import 'dotenv/config';

import { timedLog, AsyncIntervalCtrl, getTimestamp, singleton } from './base.js';

import DeeplTranslator from './deepl.js';
import BskyClient from './bluesky.js';
import DiscordBot from './bot.js';
import InteractiveMessage from './msgbuilder.js';

const BSKY_SRV = process.env.BSKY_SRV;
const BSKY_ID = process.env.BSKY_ID;
const BSKY_PASS = process.env.BSKY_PASS;
const BSKY_SESS = process.env.BSKY_SESS;
const BSKY_FETCH_RATE = process.env.BSKY_FETCH_RATE;
const BSKY_MAX_RETRY = process.env.BSKY_MAX_RETRY;
const BSKY_RETRY_AFTER = process.env.BSKY_RETRY_AFTER;

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_DBGCH_ID = process.env.DISCORD_DBGCH_ID;

const DISCORD_MAX_RETRY = process.env.DISCORD_MAX_RETRY;
const DISCORD_RETRY_AFTER = process.env.DISCORD_RETRY_AFTER;
const DISCORD_CTX_LENGTH = process.env.DISCORD_CTX_LENGTH;

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEEPL_MAX_RETRY = process.env.DEEPL_MAX_RETRY;
const DEEPL_RETRY_AFTER = process.env.DEEPL_RETRY_AFTER;

async function loop() {
  timedLog("Start fetching new feeds...");
  const feeds = await singleton.client.getNew(50);

  timedLog(`Unseed feeds before filtering: ${feeds.length}`);

  const filtered = feeds.filter(feed => {
    if (Object.hasOwn(feed, 'reply')) {
      // Ignore reply
      return false;
    } else if (Object.hasOwn(feed, 'reason')) {
      // Ignore repost
      return false;
    }
    return true;
  })

  if (_.isEmpty(filtered)) {
    timedLog("No unseen feeds.");
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

  for (const feed of filtered) {
    const msg = new InteractiveMessage(feed, DISCORD_CTX_LENGTH);
    await msg.send();
  }
}

async function main() {
  const client = new BskyClient(BSKY_SRV, BSKY_SESS);
  await client.login(BSKY_ID, BSKY_PASS);

  timedLog("info: bsky login success!");

  const bot = new DiscordBot(DISCORD_MAX_RETRY, DISCORD_RETRY_AFTER);
  await bot.login(DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, DISCORD_DBGCH_ID);

  timedLog("info: bot login success!");

  singleton.client = client;
  singleton.bot = bot;

  if (_.isUndefined(DEEPL_API_KEY)) {
    timedLog("info: translator not available.");
  } else {
    singleton.translator = new DeeplTranslator(
      DEEPL_API_KEY,
      DEEPL_MAX_RETRY,
      DEEPL_RETRY_AFTER
    );
    timedLog("info: translator initialized.");
  }

  await bot.dbg(`Bot started at ${getTimestamp()}`);

  const ictrl = new AsyncIntervalCtrl();
  await ictrl.set(async () => {
    try {
      await loop();
      if (singleton.errcnt_mainloop > 0) {
        singleton.errcnt_mainloop = 0;
        await bot.dbg({
          content: `Bot recovered from error.`
        });
      }
    } catch (e) {
      singleton.errcnt_mainloop += 1;

      await bot.catch(e, `Bot errored ${singleton.errcnt_mainloop}`);

      if (singleton.errcnt_mainloop >= BSKY_MAX_RETRY) {
        throw new Error(`Error count exceeded MAX_RETRY: ${BSKY_MAX_RETRY}.`)
      }
    }
  }, BSKY_FETCH_RATE);
}

main().then(res => {
  timedLog("main done with", res);
}).catch(e => {
  timedLog("main errored with", e);
});
timedLog("main fired.");