# Security policy

## What Ironvale is

One HTML file that runs in a browser. It has no server, no accounts, no
telemetry, no analytics, no runtime dependencies and no build step. It stores
nothing about you anywhere except your own browser's `localStorage`, under keys
beginning `ironvale.v3.`, and it never sends any of it anywhere.

The only network request the shipped file makes is a stylesheet from Google
Fonts. Everything else — every texture, every sound, every sprite — is
generated in the page at load.

That makes the attack surface small, and worth stating plainly rather than
padding out.

## Supported versions

`main`, and only `main`. There are no releases and no version branches. If you
are running a copy you took a while ago, take a fresh one before reporting
anything.

## Reporting a vulnerability

Use GitHub's private reporting: **Security → Report a vulnerability** on this
repository. Please do not open a public issue for something that is genuinely
exploitable.

This is a one-person project, so the honest commitment is best-effort rather
than a service level: you will get an acknowledgement when I see it, and I will
tell you what I intend to do and when. If I decide something is not worth
fixing, I will say that too, and why.

Include the save file, the browser and the steps. A repro that ends in "and
then this ran" is worth ten that end in "and this looks wrong".

## In scope

- **Save files.** Import is the only externally supplied input the game has.
  A save is parsed with `JSON.parse` — there is no `eval`, no `new Function`
  and no string-bodied timer anywhere in the file — and the metadata shown in
  the slot list is recomputed from live state rather than read out of the file.
  It is still the first place to look, and a crafted save that gets script
  running, corrupts unrelated storage, or hangs the page is a real finding.
- **Anything that gets script running on a host's origin.** The game builds
  parts of its interface with `innerHTML` from game state. That state should
  only ever be constant tables and computed numbers. If you find a path from a
  save file, a URL, or anything else you control to one of those, that is the
  bug worth reporting.
- **Anything that reads or writes outside the game's own storage keys.**
- **The test tooling**, if a dependency issue would affect somebody running
  `npm test` on a checkout. `package.json` has no runtime dependencies; the dev
  dependency is Playwright.

## Not in scope

- **Editing your own save, or your own `localStorage`.** Ironvale is
  single-player with no server and makes no anti-cheat claim. Giving yourself
  nine hundred thousand gold is a feature of owning a computer, not a
  vulnerability.
- **The Google Fonts request.** It is deliberate, it is the only one, and it is
  removable in one line if you would rather not make it.
- **Anything that needs the attacker to already control the page**, including
  anything typed into your own developer console.
- **Missing security headers**, CSP included. The file ships as a fragment
  without an `<html>` tag because whatever publishes it supplies the document
  skeleton — so headers belong to whoever is hosting it, not to this repo.
- **Reports from automated scanners** with nothing behind them. A scanner
  flagging `innerHTML` is a starting point for you, not a finding for me.

## If you host it

Saves live in `localStorage`, which is per-origin and per-browser. Anything
else served from the same origin can read them, so put it on its own origin if
that matters to you. There is nothing sensitive in a save — it is a game
state — but it is yours.
