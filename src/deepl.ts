import * as deepl from 'deepl-node';

import { singleton, waitFor, TranslatorInterface } from './base.js';

export default class DeeplTranslator implements TranslatorInterface {
  private max_retry: number;
  private retry_after: number;
  private translator: deepl.Translator;

  constructor(api_key: string, max_retry: number, retry_after: number) {
    this.max_retry = max_retry;
    this.retry_after = retry_after;
    this.translator = new deepl.Translator(api_key);
  }

  async translate(text: string): Promise<string> {
    for (let i = 0; i < this.max_retry; i++) {
      try {
        const result = await this.translator.translateText(text, null, 'ko');
        return result.text;
      } catch (e) {
        singleton.catch(e, `Translation failure ${i} for ${text}`);
        await waitFor(this.retry_after);
      }
    }
    const result = await this.translator.translateText(text, null, 'ko');
    return result.text;
  }
}