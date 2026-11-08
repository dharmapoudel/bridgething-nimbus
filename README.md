# bridgething-nimbus

Nimbus — a calm, animated weather app for the Spotify Car Thing running
[bridgething](https://bridgething.com). Big serif temperature, the next
hours, the week ahead, and a sky that changes with the weather and the time
of day.

This repo is a bridgething `catalog.v1` source. The catalog is published to
`https://dharmapoudel.github.io/bridgething-nimbus/catalog.v1.json`, and
Nimbus is listed in the combined catalog at
https://github.com/dharmapoudel/bridgething-apps.

## Layout

- `apps/nimbus/` — the app (see its README for development).
- `source.json` — the source name, description, homepage and Pages URL.

## Develop

```sh
bun install
bun run dev            # develop the app against a connected bridgething instance
bun run dev:device     # show the dev server on the car thing screen
bun run push           # build and install to the device
bun run check          # ensure the catalog is valid
```

## Ship

```sh
bun run bump nimbus patch -m "Fix the wind direction arrow"
git commit -am "nimbus: fix the wind direction arrow" && git push
```

Pushing to main builds the app and regenerates the catalog. A published
version is immutable: changing the app means a new version, always.

## First run

1. Push this repo to `https://github.com/dharmapoudel/bridgething-nimbus`.
2. In **Settings > Pages**, set the source to **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`.

The catalog is published to `https://dharmapoudel.github.io/bridgething-nimbus/catalog.v1.json`.
