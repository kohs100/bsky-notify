export const GVAR = {
  client: null,
  bot: null,
  translator: null,
  errcnt_mainloop: 0
}

export function getTimestamp() {
  const now = new Date().toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '');
  return now;
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