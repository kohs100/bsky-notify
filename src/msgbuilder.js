import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import _ from 'lodash';

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
  const statuscode = (is_liked ? "1" : "0") + (is_reposted ? "1" : "0");

  const btnLike = new ButtonBuilder()
    .setCustomId(`btn-like-${statuscode}`)
    .setLabel('Like')
    .setEmoji('❤')
    .setStyle(is_liked ? ButtonStyle.Danger : ButtonStyle.Secondary);

  const btnRepost = new ButtonBuilder()
    .setCustomId(`btn-repost-${statuscode}`)
    .setLabel('Repost')
    .setEmoji('♻')
    .setStyle(is_reposted ? ButtonStyle.Success : ButtonStyle.Secondary);

  const row = new ActionRowBuilder()
    .addComponents(btnLike)
    .addComponents(btnRepost);

  return row;
}