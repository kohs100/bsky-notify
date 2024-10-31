import * as ts from 'typescript'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BSKY_SRV: string;
      BSKY_ID: string;
      BSKY_PASS: string;
      BSKY_SESS: string;
      BSKY_FETCH_RATE: number;
      BSKY_MAX_RETRY: number;
      BSKY_FETCH_WINDOW: number;

      DISCORD_BOT_TOKEN: string;
      DISCORD_APP_ID: string;
      DISCORD_SERVER_ID: string;
      DISCORD_CHANNEL_ID: string;
      DISCORD_DBGCH_ID: string | undefined;
      DISCORD_CTX_LENGTH: number;
      DISCORD_MAX_RETRY: number;
      DISCORD_RETRY_AFTER: number;

      DEEPL_API_KEY: string | undefined;
      DEEPL_MAX_RETRY: number;
      DEEPL_RETRY_AFTER: number;
    }
  }
}