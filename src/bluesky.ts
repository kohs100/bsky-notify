import _ from "lodash";

import { AppBskyFeedDefs, AppBskyFeedPost, AtpAgent } from "@atproto/api";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { AugmentedFeed, timedLog } from "./base.js";

function getAugmentedFeed(
  feed: AppBskyFeedDefs.FeedViewPost
): AugmentedFeed | null {
  if (feed.reason === undefined) {
    const post = feed.post;
    if (AppBskyFeedPost.isRecord(post.record)) {
      const record = post.record;
      const itime = new Date(post.indexedAt);
      const ctime = new Date(record.createdAt);
      const now = new Date();

      return {
        feed: feed,
        sortAt: now < ctime ? itime : ctime,
        repost: false,
      };
    }
  } else {
    const reason = feed.reason;
    if (AppBskyFeedDefs.isReasonRepost(reason)) {
      return {
        feed: feed,
        sortAt: new Date(reason.indexedAt),
        repost: true,
      };
    } else {
      return null;
    }
  }
  return null;
}

function sortFeeds(feeds: AppBskyFeedDefs.FeedViewPost[]): AugmentedFeed[] {
  const filtered: AugmentedFeed[] = feeds.reduce(
    (acc: AugmentedFeed[], feed: AppBskyFeedDefs.FeedViewPost) => {
      const afeed = getAugmentedFeed(feed);
      if (_.isNull(afeed)) {
        timedLog(`Info: null sortdate detected. skipping...\n${feed}`);
      } else {
        acc.push(afeed);
      }
      return acc;
    },
    []
  );

  const sorted = filtered.toSorted((f1: AugmentedFeed, f2: AugmentedFeed) => {
    const t1 = f1.sortAt.getTime();
    const t2 = f2.sortAt.getTime();

    // Epoch descending order
    return t2 - t1;
  });

  let success = true;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].sortAt != filtered[i].sortAt) {
      timedLog(`Unsorted entry: ${sorted[i].sortAt} vs ${filtered[i].sortAt}`);
      success = false;
    }
  }
  if (!success) {
    timedLog("Warning: unsorted entry detected!");
  }

  return sorted;
}

export default class BskyClient {
  public readonly agent: AtpAgent;

  constructor(
    server: string,
    private readonly sess_path: string
  ) {
    timedLog(`Creating AtpAgent: ${server} -> ${sess_path}`);
    this.agent = new AtpAgent({
      service: server,
      persistSession: (evt, sess) => {
        timedLog(`persistSession: ${evt}`);
        writeFileSync(sess_path, JSON.stringify(sess));
      },
    });
  }

  async login(id: string, passwd: string) {
    if (existsSync(this.sess_path)) {
      timedLog(`Using existing session from ${this.sess_path}`);
      const data = readFileSync(this.sess_path);
      const sess = JSON.parse(data.toString());
      await this.agent.resumeSession(sess);
    } else {
      timedLog(`Logging in with [${id}] ...`);
      await this.agent.login({
        identifier: id,
        password: passwd,
      });
    }
  }

  async getFeeds(
    date_from: Date,
    date_to: Date,
    limit: number
  ): Promise<AugmentedFeed[]> {
    const { data } = await this.agent.getTimeline({
      limit: limit,
    });
    const { feed: feeds, cursor: nextPage } = data;

    const unseen = sortFeeds(feeds).filter(
      feed => date_from < feed.sortAt && feed.sortAt < date_to
    );
    return unseen;
  }
}
