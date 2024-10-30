import _ from "lodash";

export const singleton = {
  client: null,
  bot: null,
  translator: null,
  msg_store: null,

  has_translator() {
    return !_.isNull(this.translator);
  },

  assert(...args) {
    this.bot.assert(...args);
  },

  catch(...args) {
    this.bot.catch(...args);
  },

  debug(...args) {
    this.bot.debug(...args);
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