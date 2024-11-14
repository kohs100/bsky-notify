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
You can change the translation [target language](https://developers.deepl.com/docs/resources/supported-languages#target-languages) (Default is korean).

## Run

### Natively

```
$ npm run start
```

### With docker (Recommended)

```
$ docker run \
  --volume ./.env:/app/.env:ro \
  --detach \
  --name YOUR_CONTAINER_NAME \
  kohs100/bsky-notify
```

### With docker (Build yourself)

Maybe you should specify .env file path with absolute path, not like (./.env).

```
$ docker build . -t YOUR_IMAGE_NAME
$ docker run \
  --volume ./.env:/app/.env:ro \
  --detach \
  --name YOUR_CONTAINER_NAME \
  YOUR_IMAGE_NAME
```

## References

- [discord.js docs](https://discordjs.guide/popular-topics/embeds.html#using-the-embed-constructor)
- [Bluesky API docs](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed)
