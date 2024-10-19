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