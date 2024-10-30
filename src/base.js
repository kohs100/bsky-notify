import _ from "lodash";

export const singleton = {
  client: null,
  bot: null,
  translator: null,
  msg_store: null,
  errcnt_mainloop: 0,

  has_translator() {
    return !_.isNull(this.translator);
  },

  async assert(...args) {
    return await this.bot.assert(...args);
  },

  async catch(...args) {
    return await this.bot.catch(...args);
  },

  async debug(...args) {
    return await this.bot.debug(...args);
  }
}

export function getTimestamp() {
  const utc_now = new Date();
  const ofs = utc_now.getTimezoneOffset() * 60000;
  const jst_now = new Date(utc_now - ofs);
  return jst_now.toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '');
}

export function timedLog(...args) {
  const now = getTimestamp();

  console.log(`[${now}]`, ...args);
}

export function waitFor(msec) {
  return new Promise(res => setTimeout(res, msec));
}

export async function tryFor(func, max_retry, retry_after, when_fail) {
  for (const i = 0; i < max_retry; i < retry_after) {
    try {
      return await func(i);
    } catch (e) {
      when_fail(e, i);
    }
  }
  return await func(i);
}

export class AsyncIntervalCtrl {
  constructor() {
    this.running = [];
  }

  async run(cb, interval, iid) {
    await cb();
    if (this.running[iid]) {
      setTimeout(() => this.run(cb, interval, iid), interval);
    }
  };

  async set(cb, interval) {
    if (cb && typeof cb === "function") {
      const iid = this.running.length;
      this.running.push(true);
      this.run(cb, interval, iid);
      return iid;
    } else {
      throw new Error('Callback must be a function');
    }
  }

  async clear(iid) {
    if (this.running[iid])
      this.running[iid] = false;
  }
}

export class GCStorage {
  need_gc = false;
  storage = {};

  add(key, value) {
    singleton.assert(
      _.isUndefined(this.storage[key]),
      `Duplicated value for key ${key}`
    );
    this.storage[key] = {
      alive: true,
      value: value,
    };
  }

  get(key) {
    return this.storage[key];
  }

  mark_dead(key) {
    singleton.assert(
      !_.isUndefined(this.storage[uri]),
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