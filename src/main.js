import BskyClient from './bluesky.js';
import DiscordBot from './bot.js';
import AsyncIntervalCtrl from './asyncinterval.js';
import toEmbed from './embedbuilder.js';
import timedLog from './base.js';

import _ from 'lodash';

import 'dotenv/config';

const main = async () => {
  const client = new BskyClient();
  await client.login();

  timedLog("info: bsky login success!");

  const bot = new DiscordBot();
  await bot.login();

  timedLog("info: bot login success!");

  const ictrl = new AsyncIntervalCtrl();

  ictrl.set(async () => {
    timedLog("Start fetching new feeds...");
    const feeds = await client.getNew(50);

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

    filtered.forEach((feed, i) => {
      timedLog(`========== Feed ${i} start ==========`);
      timedLog(feed);
      timedLog(`========== Feed ${i} end ==========`);
    });

    const embeds = filtered.map(toEmbed);
    embeds.reverse();
    await bot.send({ embeds: embeds });
  }, 10000); // 10 second
}

main().then(res => {
  timedLog("main done with", res);
}).catch(e => {
  timedLog("main errored with", e);
});
timedLog("main fired.");