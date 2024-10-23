import _ from 'lodash';

import 'dotenv/config';
import { ComponentType, EmbedBuilder } from 'discord.js';
import DeeplTranslator from './deepl.js';

import { timedLog, AsyncIntervalCtrl, waitFor, getTimestamp, GVAR } from './base.js';
import BskyClient from './bluesky.js';
import DiscordBot from './bot.js';
import { toEmbed, buildRow, toError } from './msgbuilder.js';

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
  const feeds = await GVAR.client.getNew(50);

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
    const embed = toEmbed(feed);
    const row = buildRow(false, false);
    const msg = await GVAR.bot.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: DISCORD_CTX_LENGTH,
    });

    collector.on('end', () => {
      const uri = feed.post.uri;

      delete GVAR.uristore_like[uri];
      delete GVAR.uristore_repost[uri];
    });

    collector.on('collect', async i => {
      const tokens = i.customId.split('-');

      const uri = feed.post.uri;
      const cid = feed.post.cid;

      if (tokens[0] != 'btn') {
        timedLog(i);
        await GVAR.bot.dbg(`Invalid customId: ${i.customId}`);
        // Exit without completing interaction
        return;
      };

      if (tokens[1] == 'bsky') {
        let is_liked = tokens[2][0] == 1;
        let is_reposted = tokens[2][1] == 1;

        if (tokens[2] == 'like') {
          if (is_liked) {
            const uri_like = GVAR.uristore_like[uri];
            await GVAR.client.unlike(uri_like);
            is_liked = false;
          } else {
            const { uri: uri_like } = await GVAR.client.like(uri, cid);
            // timedLog("uri_like:", uri_like);
            GVAR.uristore_like[uri] = uri_like
            is_liked = true;
          }
        } else if (tokens[2] == 'repost') {
          if (is_reposted) {
            const uri_repost = GVAR.uristore_repost[uri];
            await GVAR.client.unrepost(uri_repost);
            is_reposted = false;
          } else {
            const { uri: uri_repost } = await GVAR.client.repost(uri, cid);
            // timedLog("uri_repost:", uri_repost);
            GVAR.uristore_repost[uri] = uri_repost
            is_reposted = true;
          }
        } else {
          timedLog(i);
          await GVAR.bot.dbg(`Invalid bsky button name: ${i.customId}`);
          // Exit without completing interaction
          return;
        }

        const row = buildRow(is_liked, is_reposted);
        await i.update({ components: [row] });
      } else if (tokens[1] == 'trans') {
        if (_.isNull(GVAR.translator)) {
          // Cannot happen.. Maybe?
          timedLog(i);
          await GVAR.bot.dbg(`Translator not initialized!`);
          // Exit without completing interaction
          return;
        }
        const embeds = [];
        for (const rembed of i.message.embeds) {
          const desc = rembed.description;
          const tdesc = await GVAR.translator.translate(desc);

          const embed = new EmbedBuilder(rembed);
          embed.addFields({
            name: 'Translated',
            value: tdesc
          });

          embeds.push(embed);
        }

        await i.update({ embeds: embeds });
      } else {
        timedLog(i);
        await GVAR.bot.dbg(`Invalid button name: ${i.customId}`);
        // Exit without completing interaction
      }
    });
  }
}

async function main() {
  const client = new BskyClient(BSKY_SRV, BSKY_SESS);
  await client.login(BSKY_ID, BSKY_PASS);

  timedLog("info: bsky login success!");

  const bot = new DiscordBot(DISCORD_MAX_RETRY, DISCORD_RETRY_AFTER);
  await bot.login(DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, DISCORD_DBGCH_ID);

  timedLog("info: bot login success!");

  GVAR.client = client;
  GVAR.bot = bot;

  if (_.isUndefined(DEEPL_API_KEY)) {
    timedLog("info: translator not available.");
  } else {
    GVAR.translator = new DeeplTranslator(
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
      if (GVAR.errcnt_mainloop > 0) {
        GVAR.errcnt_mainloop = 0;
        bot.dbg({
          content: `Bot recovered from error.`
        });
      }
    } catch (e) {
      GVAR.errcnt_mainloop += 1;

      bot.dbg({
        content: `Bot errored ${GVAR.errcnt_mainloop} at ${getTimestamp()}`,
        embeds: toError(e)
      });

      if (GVAR.errcnt_mainloop >= BSKY_MAX_RETRY) {
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