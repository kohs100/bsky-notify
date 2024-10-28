import _ from 'lodash';

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js';

import { singleton, timedLog } from './base.js';

export default class InteractiveMessage {
  constructor(feed, lifetime) {
    this.feed = feed;
    this.lifetime = lifetime;

    this.uri_like = null;
    this.uri_repost = null;

    this.translated = false;
  }

  is_liked() {
    return !_.isNull(this.uri_like);
  }

  is_reposted() {
    return !_.isNull(this.uri_repost);
  }

  buildEmbed() {
    const new_embed = new EmbedBuilder();

    const post = this.feed.post;

    const author = post.author;
    const author_hndl = author.handle;
    const author_name = author.displayName;
    const author_icon = author.avatar;

    new_embed.setAuthor({
      name: author_name,
      iconURL: author_icon
    });

    let contain_image = false;
    if (Object.hasOwn(post, "embed")) {
      const embed = post.embed;
      if (Object.hasOwn(embed, "images")) {
        const images = embed.images;
        if (!_.isEmpty(images)) {
          new_embed.setImage(images[0].fullsize);
          contain_image = true;
        }
      }
    }

    const uri = post.uri;
    const uris = uri.split('/');
    if (uris[3] == 'app.bsky.feed.post') {
      const pid = uris[4];
      const url = `https://bsky.app/profile/${author_hndl}/post/${pid}`
      new_embed.setURL(url);
      new_embed.setTitle(`Post by ${author_name}`);
    }

    const record = post.record;
    if (record['$type'] == 'app.bsky.feed.post') {
      new_embed.setDescription(record.text);
      new_embed.setTimestamp(new Date(record.createdAt));
    }

    return new_embed;
  }

  buildRow() {
    const row = new ActionRowBuilder();

    const btnLike = new ButtonBuilder()
      .setCustomId(`btn-bsky-like`)
      .setLabel('Like')
      .setEmoji('❤')
      .setStyle(this.is_liked() ? ButtonStyle.Danger : ButtonStyle.Secondary);
    row.addComponents(btnLike);

    const btnRepost = new ButtonBuilder()
      .setCustomId(`btn-bsky-repost`)
      .setLabel('Repost')
      .setEmoji('♻')
      .setStyle(this.is_reposted() ? ButtonStyle.Success : ButtonStyle.Secondary);
    row.addComponents(btnRepost);

    if (singleton.has_translator()) {
      if (!this.translated) {
        const btnTranslate = new ButtonBuilder()
          .setCustomId(`btn-trans-deepl`)
          .setLabel('Translate')
          .setStyle(ButtonStyle.Secondary);
        row.addComponents(btnTranslate);
      }
    }

    return row;
  }

  async _like() {
    const uri = this.feed.post.uri;
    const cid = this.feed.post.cid;

    await singleton.bot.assert(
      _.isNull(this.uri_like),
      `Already defined uri_like for post ${uri}`
    );

    const { uri: uri_like } = await singleton.client.agent.like(uri, cid);
    this.uri_like = uri_like
  }

  async _unlike() {
    const uri = this.feed.post.uri;
    const uri_like = this.uri_like;

    await singleton.bot.assert(
      !_.isNull(this.uri_like),
      `No uri_like for post ${uri}`
    );

    await singleton.client.agent.deleteLike(uri_like);
    this.uri_like = null;
  }

  async _repost() {
    const uri = this.feed.post.uri;
    const cid = this.feed.post.cid;

    await singleton.bot.assert(
      _.isNull(this.uri_repost),
      `Already defined uri_repost for post ${uri}`
    );

    const { uri: uri_repost } = await singleton.client.agent.repost(uri, cid);
    this.uri_repost = uri_repost
  }

  async _unrepost() {
    const uri = this.feed.post.uri;
    const uri_repost = this.uri_repost;

    await singleton.bot.assert(
      !_.isNull(this.uri_repost),
      `No uri_repost for post ${uri}`
    );

    await singleton.client.agent.deleteRepost(uri_repost);
    this.uri_repost = null;
  }

  async send() {
    const msg = await singleton.bot.send({
      embeds: [this.buildEmbed()],
      components: [this.buildRow()]
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: this.lifetime,
      // time: 20_000,
    });

    collector.on('end', async (collected, reason) => {
      try {
        timedLog(`collector end: reason: ${reason}`);
        await msg.edit({ components: [] });
      } catch (e) {
        await singleton.catch(e, `MsgComponentCollector event failed: end: ${reason}.`);
      }
    })

    collector.on('collect', async i => {
      const tokens = i.customId.split('-');

      if (tokens[0] != 'btn') {
        timedLog(i);
        await singleton.bot.dbg(`Invalid customId: ${i.customId}`);
        // Exit without completing interaction
        return;
      };

      if (tokens[1] == 'bsky') {
        if (tokens[2] == 'like') {
          if (this.is_liked())
            await this._unlike();
          else
            await this._like();
        } else if (tokens[2] == 'repost') {
          if (this.is_reposted())
            await this._unrepost();
          else
            await this._repost();
        } else {
          timedLog(i);
          await singleton.bot.dbg(`Invalid bsky button name: ${i.customId}`);
          // Exit without completing interaction
          return;
        }

        await i.update({
          components: [this.buildRow()]
        });
      } else if (tokens[1] == 'trans') {
        await singleton.bot.assert(!this.translated, "Already translated");
        await singleton.bot.assert(singleton.has_translator(), "Translator not initialized");

        const embeds = [];
        for (const rembed of i.message.embeds) {
          const desc = rembed.description;
          const tdesc = await singleton.translator.translate(desc);

          const embed = new EmbedBuilder(rembed);
          embed.setFields({
            name: 'Translated',
            value: tdesc
          });

          embeds.push(embed);
        }

        this.translated = true;
        await i.update({
          embeds: embeds,
          components: [this.buildRow()]
        });

      } else {
        timedLog(i);
        await singleton.bot.dbg(`Invalid button name: ${i.customId}`);
        // Exit without completing interaction
      }
    });
  }
}