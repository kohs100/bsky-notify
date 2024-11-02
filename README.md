# Bluesky notification bot

## Introduction

Enable bluesky feed notification through discord bot.

### Currently supports

- Fetch posts from main feed and send to configured channel
- Image support (If multiple images, first image only)
- Like/Unlike/Repost/Unrepost from discord with action row button
- Optional debug channel to post debug informations
- Translation with DeepL API

### TODO

- Multiple images support
- (!) Self-replying post tree support

## Configuration

Rename .env.example to .env and fill token informations.

## Run

### Natively

```
$ npm run start
```

### With docker

```
$ docker build . -t bsky-notify
$ docker run \
  --volume ./.env:/app/.env \
  --detach \
  --name bsky-notify \
  bsky-notify
```

## References

- [discord.js docs](https://discordjs.guide/popular-topics/embeds.html#using-the-embed-constructor)
- [Bluesky API docs](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed)
