export default function timedLog(...args) {
  const now = new Date().toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '');

  console.log(`[${now}]`, ...args);
}