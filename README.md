# Choir

One app for our group: **Grimoire** (Commander battles, standings and game nights) and **MagicCon Detroit** (the trip planner). Sign in once with Discord and switch between them from the top bar.

**Open it:** https://bcassidy-syseng.github.io/choir/

## How it fits together

| Path | What it is |
| --- | --- |
| `index.html` | Front page: Discord sign-in, and the switch between sections |
| `choir.js` | Shared by every page: keeps the sign-in token on the device |
| `grimoire/` | The Grimoire section. Talks to the Commander Grimoire Apps Script ([bcassidy-syseng/grimoire](https://github.com/bcassidy-syseng/grimoire)) |
| `magiccon/` | The MagicCon section. The same file is the MagicCon Apps Script's `Planner` HTML |
| `sw.js`, `manifest.webmanifest`, `icons/` | One home-screen app, offline copy for every section |
| `privacy.html` | What is kept and why (Discord's developer terms require it) |
| `SETUP.md` | Switching the group over to Choir and Discord sign-in |

Each section keeps its own Google Sheet and Apps Script. Nothing was merged or migrated: the old `grimoire` and `magiccon` addresses forward here, and anything saved on a phone (passcodes, picks waiting to send) carries over, because it's the same site.

## Sign-in

1. In Discord, type `/grimoire login`. Only you see the reply.
2. Tap **Sign in**, or type the 8-character code on the front page. Typing it matters on iPhones: a home-screen app keeps its own storage, separate from Safari.
3. The app keeps a signed token for 90 days. Both Apps Scripts check it with a shared secret and take your identity from it, never from what the phone says.

The first time, you claim your Grimoire player and your MagicCon name. Each can be claimed once; the organizer can release a wrong claim.

## Privacy

This repository is public, so nothing private goes in it: no passcodes, secrets, Discord IDs or real player data. The Apps Script addresses in the pages are safe to show; every request needs a sign-in token or the group passcode.

Magic: The Gathering is © Wizards of the Coast. Choir is unofficial Fan Content permitted under the Fan Content Policy; not approved or endorsed by Wizards. Card data and images from Scryfall.
