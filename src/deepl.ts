import * as deepl from "deepl-node";

import { TranslatorInterface, singleton, waitFor } from "./base.js";

export default class DeeplTranslator implements TranslatorInterface {
  private readonly translator: deepl.Translator;

  constructor(
    api_key: string,
    private readonly max_retry: number,
    private readonly retry_after: number,
    private readonly tgt_lang: deepl.TargetLanguageCode
  ) {
    this.translator = new deepl.Translator(api_key);
  }

  async translate(text: string): Promise<string> {
    for (let i = 0; i < this.max_retry; i++) {
      try {
        const result = await this.translator.translateText(
          text,
          null,
          this.tgt_lang
        );
        return result.text;
      } catch (e) {
        singleton.catch(e, `Translation failure ${i} for ${text}`);
        await waitFor(this.retry_after);
      }
    }
    const result = await this.translator.translateText(
      text,
      null,
      this.tgt_lang
    );
    return result.text;
  }
}
