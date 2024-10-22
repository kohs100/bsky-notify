import * as deepl from 'deepl-node';

import { GVAR, waitFor } from './base.js';
import { toError } from './msgbuilder.js';

export default class DeeplTranslator {
  constructor(api_key, max_retry, retry_after) {
    this.max_retry = max_retry;
    this.retry_after = retry_after;
    this.translator = new deepl.Translator(api_key);
  }

  async translate(text) {
    for (const i = 0; i < this.max_retry; i++) {
      try {
        const result = await this.translator.translateText(text, null, 'ko');
        return result.text;
      } catch (e) {
        GVAR.bot.dbg(toError(e));
        await waitFor(this.retry_after);
      }
    }
    const result = await this.translator.translateText(text, null, 'ko');
    return result.text;
  }
}