import _ from 'lodash';

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { AtpAgent } from '@atproto/api'

import { timedLog } from './base.js';

function getSortDate(feed) {
  if (Object.hasOwn(feed, "reason")) {
    const reason = feed.reason;
    const rtype = reason['$type'];
    if (rtype == "app.bsky.feed.defs#reasonRepost") {
      const repost_at = reason.indexedAt;
      return new Date(repost_at);
    }
  } else {
    const post = feed.post;
    const record = post.record;
    const rtype = record['$type'];
    if (rtype == "app.bsky.feed.post") {
      const itime = new Date(post.indexedAt);
      const ctime = new Date(record.createdAt);
      const now = new Date();
      return now < ctime ? itime : ctime;
    }
  }
  return null;
}

function sortFeeds(feeds) {
  const filtered = feeds.reduce((acc, feed) => {
    const stime = getSortDate(feed);
    if (_.isNull(stime)) {
      timedLog("Info: null sortdate detected. skipping...\n", feed);
    } else {
      feed.sortAt = stime;
      acc.push(feed);
    }
    return acc;
  }, []);

  const sorted = filtered.toSorted((f1, f2) => {
    const t1 = f1.sortAt.getTime();
    const t2 = f2.sortAt.getTime();

    // Epoch descending order
    return t2 - t1;
  });

  let success = true;
  timedLog("Checking sorted");
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].sortAt != filtered[i].sortAt) {
      timedLog("Unsorted entry:", sorted[i].sortAt, filtered[i].sortAt);
      success = false;
    }
  }
  if (!success) {
    timedLog("Warning: unsorted entry detected!");
  }

  return sorted;
}

export default class BskyClient {
  constructor(server, sess_path) {
    this.sess_path = sess_path;
    this.agent = new AtpAgent({
      service: server,
      persistSession: (evt, sess) => {
        timedLog("persistSession:", evt);
        writeFileSync(this.sess_path, JSON.stringify(sess));
      }
    });
  }

  async login(id, passwd) {
    if (existsSync(this.sess_path)) {
      timedLog("Using existing session from", this.sess_path);
      const data = readFileSync(this.sess_path);
      const sess = JSON.parse(data);
      await this.agent.resumeSession(sess);
    } else {
      timedLog("Logging in with", id, "...");
      await this.agent.login({
        identifier: id,
        password: passwd
      });
    }
  }

  async getFeeds(date_from, date_to, limit) {
    const { data } = await this.agent.getTimeline({
      limit: limit
    });
    const {
      feed: feeds,
      cursor: nextPage
    } = data;

    const unseen = sortFeeds(feeds)
      .filter(feed => date_from < feed.sortAt && feed.sortAt < date_to);
    return unseen;
  }
}