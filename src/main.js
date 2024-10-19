import BskyClient from './bluesky.js';
import DiscordBot from './bot.js';
import { toEmbed, buildRow } from './msgbuilder.js';
import { timedLog, AsyncIntervalCtrl } from './base.js';

import _ from 'lodash';

import 'dotenv/config';
import { ComponentType } from 'discord.js';

const GVAR = {
  client: null,
  bot: null,
  uristore_like: {},
  uristore_repost: {},
}

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
      time: 60_000,
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

      if (tokens[0] != 'btn') return;

      let is_liked = tokens[2][0] == 1;
      let is_reposted = tokens[2][1] == 1;

      if (tokens[1] == 'like') {
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
      } else if (tokens[1] == 'repost') {
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
        return;
      }

      const row = buildRow(is_liked, is_reposted);
      await i.update({ components: [row] });
    });
  }
}

const main = async () => {
  const client = new BskyClient();
  await client.login();

  timedLog("info: bsky login success!");

  const bot = new DiscordBot();
  await bot.login();

  timedLog("info: bot login success!");

  GVAR.client = client;
  GVAR.bot = bot;

  const ictrl = new AsyncIntervalCtrl();
  await ictrl.set(loop, 10000); // 10 second
}

main().then(res => {
  timedLog("main done with", res);
}).catch(e => {
  timedLog("main errored with", e);
});
timedLog("main fired.");