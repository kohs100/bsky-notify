import _ from 'lodash';

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js';

import { GVAR, timedLog } from './base.js';

export function toEmbed(feed) {
  const new_embed = new EmbedBuilder();

  const post = feed.post;

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

export function buildRow(is_liked, is_reposted) {
  const row = new ActionRowBuilder();
  const statuscode = (is_liked ? "1" : "0") + (is_reposted ? "1" : "0");

  const btnLike = new ButtonBuilder()
    .setCustomId(`btn-bsky-like-${statuscode}`)
    .setLabel('Like')
    .setEmoji('❤')
    .setStyle(is_liked ? ButtonStyle.Danger : ButtonStyle.Secondary);
  row.addComponents(btnLike);

  const btnRepost = new ButtonBuilder()
    .setCustomId(`btn-bsky-repost-${statuscode}`)
    .setLabel('Repost')
    .setEmoji('♻')
    .setStyle(is_reposted ? ButtonStyle.Success : ButtonStyle.Secondary);
  row.addComponents(btnRepost);

  if (!_.isNull(GVAR.translator)) {
    const btnTranslate = new ButtonBuilder()
      .setCustomId(`btn-trans-deepl`)
      .setLabel('Translate')
      .setStyle(ButtonStyle.Secondary);
    row.addComponents(btnTranslate);
  }

  return row;
}

export class InteractiveMessage {
  constructor(feed, lifetime) {
    this.lifetime = lifetime;

    this.uri_like = null;
    this.uri_repost = null;
    this.feed = feed;
  }

  async _like() {
    const uri = this.feed.post.uri;
    const cid = this.feed.post.cid;

    await GVAR.bot.assert(
      _.isNull(this.uri_like),
      `Already defined uri_like for post ${uri}`
    );

    const { uri: uri_like } = await GVAR.client.agent.like(uri, cid);
    this.uri_like = uri_like
  }

  async _unlike() {
    const uri = this.feed.post.uri;
    const uri_like = this.uri_like;

    await GVAR.bot.assert(
      !_.isNull(this.uri_like),
      `No uri_like for post ${uri}`
    );

    await GVAR.client.agent.deleteLike(uri_like);
    this.uri_like = null;
  }

  async _repost() {
    const uri = this.feed.post.uri;
    const cid = this.feed.post.cid;

    await GVAR.bot.assert(
      _.isNull(this.uri_repost),
      `Already defined uri_repost for post ${uri}`
    );

    const { uri: uri_repost } = await GVAR.client.agent.repost(uri, cid);
    this.uri_repost = uri_repost
  }

  async _unrepost() {
    const uri = this.feed.post.uri;
    const uri_repost = this.uri_repost;

    await GVAR.bot.assert(
      !_.isNull(this.uri_repost),
      `No uri_repost for post ${uri}`
    );

    await GVAR.client.agent.deleteRepost(uri_repost);
    this.uri_repost = null;
  }

  async send() {
    const embed = toEmbed(this.feed);
    const row = buildRow(false, false);

    const msg = await GVAR.bot.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      // time: this.lifetime,
      time: 20_000,
    });

    collector.on('end', async (collected, reason) => {
      timedLog("end called", reason);
      await msg.edit({ components: [] });
    })

    collector.on('collect', async i => {
      const tokens = i.customId.split('-');

      if (tokens[0] != 'btn') {
        timedLog(i);
        await GVAR.bot.dbg(`Invalid customId: ${i.customId}`);
        // Exit without completing interaction
        return;
      };

      if (tokens[1] == 'bsky') {
        let is_liked = tokens[3][0] == 1;
        let is_reposted = tokens[3][1] == 1;

        if (tokens[2] == 'like') {
          if (is_liked) {
            await this._unlike();
            is_liked = false;
          } else {
            await this._like();
            is_liked = true;
          }
        } else if (tokens[2] == 'repost') {
          if (is_reposted) {
            await this._unrepost();
            is_reposted = false;
          } else {
            await this._repost();
            is_reposted = true;
          }
        } else {
          timedLog(i);
          await GVAR.bot.dbg(`Invalid bsky button name: ${i.customId}`);
          // Exit without completing interaction
          return;
        }

        const row = buildRow(is_liked, is_reposted);
        await i.update({ components: [row] });
      } else if (tokens[1] == 'trans') {
        if (_.isNull(GVAR.translator)) {
          // Cannot happen.. Maybe?
          timedLog(i);
          await GVAR.bot.dbg(`Translator not initialized!`);
          // Exit without completing interaction
          return;
        }
        const embeds = [];
        for (const rembed of i.message.embeds) {
          const desc = rembed.description;
          const tdesc = await GVAR.translator.translate(desc);

          const embed = new EmbedBuilder(rembed);
          embed.addFields({
            name: 'Translated',
            value: tdesc
          });

          embeds.push(embed);
        }

        await i.update({ embeds: embeds });
      } else {
        timedLog(i);
        await GVAR.bot.dbg(`Invalid button name: ${i.customId}`);
        // Exit without completing interaction
      }
    });
  }
}