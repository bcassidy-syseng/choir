# Switching the group to Choir

About 20 minutes. Do the steps in order; until the last step, the old passcodes keep working, so nobody is locked out.

## 1. Commander Grimoire Apps Script (v9.6.0)

1. Open the Grimoire spreadsheet → **Extensions → Apps Script**.
2. Replace these files with the versions from the `grimoire` repo's `src/` folder: `00_Config`, `01_Main`, `09_DiscordCommands`, `10_LivingLeague`, `13_PlayerApp`. Add the new file **`14_ChoirAuth`** with **+ → Script**.
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** Edit the existing deployment so its address stays the same.
4. Back in the sheet (reload it), run **⚔️ Commander Grimoire → 🔗 Set Player App Link** and paste `https://bcassidy-syseng.github.io/choir/`.
5. Run **🧪 Test the Scrying Orb**. It should report build `v9.6.0-choir`.
6. Run **🔑 Show Choir Sign-in Secret** and copy the long code. You need it in step 3.

## 2. Discord bot (Cloudflare Worker)

The updated `src/commands.js` and `src/index.js` add `/grimoire login` and keep it private even if someone asks for a public reply.

1. Put the two files in `Documents\Commander Grimoire\cloudflare-worker\src` (the originals are saved next to them as `*.before-choir.js`).
2. In PowerShell, in the `cloudflare-worker` folder: `npx.cmd wrangler deploy --keep-vars`
3. Register the command list again, the same way you did before (`node register-commands.mjs` with `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN` and, if you used one, `DISCORD_GUILD_ID` set). `/grimoire` now has 25 subcommands, Discord's maximum.
4. In Discord, type `/grimoire login`. You should get a private reply with a **Sign in** button and a code. The first server it's used in becomes the only server sign-in works from.

## 3. MagicCon planner Apps Script (server 9.7)

1. Open the MagicCon spreadsheet → **Extensions → Apps Script**. Replace **`Code.gs`** and the **`Planner`** HTML file with the versions in `MagicCon_Planner_Project\apps-script`. Save.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
3. Reload the sheet, then **🎴 MagicCon → 🔐 Set Choir sign-in secret** and paste the code from step 1.6.
4. **🎴 MagicCon → 🔗 Set app link** → `https://bcassidy-syseng.github.io/choir/magiccon/`. Discord recaps and calendar events will link there.
5. Player Roster gets a new column **G, Discord ID**, the first time someone claims a name. To release a name claimed by mistake, clear that person's cell. A new **Edit Requests** tab records every change someone asked to make to another person's weekend.

## 4. Try it yourself

1. Open https://bcassidy-syseng.github.io/choir/ and sign in with your `/grimoire login` code.
2. Open **Grimoire**, claim your player. Open **MagicCon** (top-left switch), claim your name.
3. On the MagicCon Events tab, open any event's **⋯** → **Change for someone else**, pick a friend and a choice, and ask. It should show under **Weekend → Waiting for approval** for everyone; the friend can approve or veto, anyone else can approve or reject.

## 5. Tell the group

Post in Discord: open the new link, type `/grimoire login`, tap **Sign in** (or type the code in the app), then claim your name in each section. On iPhone, add it to the home screen from Safari's **Share → Add to Home Screen**; the old Grimoire and MagicCon icons keep working too.

## 6. Turn the passcodes off (once everyone has signed in)

- Grimoire sheet: **⚔️ Commander Grimoire → 🚫 Turn Off Passcode Sign-in**
- MagicCon sheet: **🎴 MagicCon → 🚫 Turn off passcode sign-in**

Until then, someone using a passcode can still change anyone's MagicCon picks directly, as before; only Discord sign-ins go through approval. Calendar subscriptions keep working after the passcode is off, and your own **Plan my weekend** dialog in the sheet still works.

## If something goes wrong

- **Someone claimed the wrong name:** Grimoire: **♻️ Release a Claimed Player**. MagicCon: clear their cell in Player Roster column G.
- **A phone or a code may have leaked:** **🚪 Sign Everyone Out of Choir** in the Grimoire sheet makes a new secret. Paste the new secret into MagicCon (step 3.3), and everyone types `/grimoire login` again.
- **Undo a change:** MagicCon's **🕘 History & undo** shows approved changes as "X (approved by Y)".
