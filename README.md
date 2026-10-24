# Questo 1.19 — Shared worlds and co-op guardians

This update synchronizes roaming enemies, attacks, NPC movement, crystals and town scenery within each party. Cooperative battles for all ten portal guardians remain available, with 2–8 players per fight. Private party codes, shared exploration, emotes and Meet here remain available. The game remains playable solo, including offline guest play.

**The download is ready, but multiplayer is not live until you deploy the party server.** Uploading the game ZIP alone updates the interface; it does not create the server.

## Already using party codes? Update BOTH deployments

1. Update your existing game website with all seven files from **questo-cloudflare.zip**.
2. In your existing **questo-party** GitHub repository, replace the server files with those from **questo-party-server.zip**. Upload **worker.js, protocol.js, bosses.js, battle.js, shared-world.js, world-rules.js, world-data.js, terrain.js, wrangler.jsonc, package.json** together at the repository root. Keep your existing custom origin settings if you changed them.
3. Commit to the production branch. Wait for Cloudflare's party Worker deployment to finish. If you deploy from your computer, run `npm install` and `npm run deploy` in the extracted server folder instead.
4. Open the party Worker address followed by **/health**. It must show **"protocol":3**. Apply the game update to **1.19.0** on every player's device.
5. Leave old rooms and create a new party code. Version 1.17 and 1.18 clients and servers are incompatible with co-op's protocol 3. Existing solo adventures remain intact.

No new Cloudflare service, Appwrite database or migration is needed. These downloads do not update either live deployment automatically.

## 1. Update the game

Upload the seven files from **questo-cloudflare.zip** to your existing **orange-sea-cf7a** Cloudflare project, as with previous updates. Keep the existing address so your local saves stay available. In the game, open Settings → Install & updates → Check for updates → Save & apply update. Confirm version **1.19.0**. Do not clear site data.

## 2. Put the party server on GitHub — works from your phone

This is a separate, small server project. Leave your existing game website in place.

1. Download **questo-party-server.zip** and extract it with your phone's Files app or ZArchiver.
2. Sign in at https://github.com and create a repository named **questo-party**. A private repository is fine. Add a README when creating it so the repository has a main branch.
3. Open that repository. Choose **Add file → Upload files**. If the mobile layout hides the button, enable **Desktop site** in your browser.
4. Upload the extracted **worker.js**, **protocol.js**, **bosses.js**, **battle.js**, **shared-world.js**, **world-rules.js**, **world-data.js**, **terrain.js**, **wrangler.jsonc**, and **package.json** at the repository's top level. Upload the files themselves, not the ZIP or a containing folder. Commit the upload to **main**. The included guide and README are optional uploads.

The included configuration allows your game address:

https://orange-sea-cf7a.pasraphev.workers.dev

If you change the game address later, edit **ALLOWED_ORIGINS** in wrangler.jsonc to the new exact origin, with no trailing slash. Multiple game origins can be comma-separated. Do not use a wildcard or add `null` for offline files.

## 3. Deploy the new Worker from Cloudflare

1. Open https://dash.cloudflare.com in your browser. Select the same account that hosts your existing game.
2. Go to **Workers & Pages → Create application → GitHub**. Connect GitHub if prompted, and select the **questo-party** repository.
3. Set the Worker/project name to **questo-party**. It must match `name` in wrangler.jsonc.
4. Use these settings:

| Setting | Value |
| --- | --- |
| Production branch | main |
| Root directory | Repository root (leave blank) |
| Build command | Leave blank |
| Deploy command | npx wrangler deploy |

5. Select **Save and Deploy**. Cloudflare installs the pinned Wrangler dependency and uses the configuration to create the SQLite Durable Object and rate-limit bindings. You do not need an Appwrite API key or database for parties.
6. Wait for a successful production deployment and copy its **workers.dev** address. With the Worker name above and your current account subdomain, the expected address is:

https://questo-party.pasraphev.workers.dev

This is an expected deployment address, not a confirmation that it is already online. Use the address Cloudflare actually shows.

7. Open that address with **/health** at the end. It should show JSON containing `"service":"questo-party"`, `"protocol":3` and `"players":8`.

If deployment fails, open its build log. The common fixes are uploading all ten required files at the repository root, matching the Worker name, and choosing **wrangler deploy** rather than a static-file uploader. The existing game project should still work independently.

## 4. Invite a friend

1. Both players open the hosted game link and enter gameplay. Guest players can join parties too; email login is not required.
2. Open **☰ → Party**. Enter a nickname. Names are not verified account identities; use a nickname rather than your email.
3. If your deployed server address differs from the expected address, open **Server setup**, enter the actual HTTPS address, and save it. All friends must use the same server address.
4. One player taps **Create party**, then **Copy code**. Send the 10-character code to your friend using your usual messaging app.
5. The friend enters that code and taps **Join party**. Codes are case-insensitive and accept the dash or spaces.
6. Close the menu. Players in the same world can see one another moving. Return to Party to wave, cheer, send a heart, or signal ready. **Meet here** switches to a friend's world only if you have already unlocked it.

Anyone with the code can join until the room is full. Rooms expire after 6 hours. There is no host dependency: the person who created a room can leave while others continue. After a page reload, enter the code again; party membership is not part of your adventure save.

## 5. Fight a guardian together

1. Create/join the same party. Everyone must have the guardian's world unlocked on their own adventure. Use **Meet here** to reunite in that world.
2. Each friend opens the world portal and chooses **Party arena · fight together**. A ready room shows who has entered. Solo guardian fights remain a separate button.
3. Wait for everyone, then any participant can press **Start together**. At least two players are required. The ready room closes after two minutes; a fight lasts at most ten minutes.
4. Move, hold Attack, use Skill and Dodge as usual. Everyone sees the same boss health and warnings. The server decides movement, cooldowns, damage and victory. Boss HP scales once at the start: base HP × [1 + 0.65 × (players − 1)].
5. A downed player watches the survivors. Stay in the arena: every still-connected participant, including downed teammates, receives the world unlock and their own first-clear reward when the group wins. The clear saves immediately; rematches never repeat first-clear gear or gold.
6. Return to the portal after the result. Everyone must leave that arena before the party opens another one.

**Party battles use balanced class stats for the selected guardian.** Equipment, upgrades and temporary buffs still apply to solo fights. In co-op the server supplies fixed world-scaled attack power and class range, speed, defense and cooldowns; it does not accept client damage or reward amounts. The existing game's saves and accounts are not an anti-cheat economy, and party nicknames are not authenticated identities.

**The party fight does not pause when one person opens Menu or rotates their phone.** Your character remains vulnerable. Hiding/closing the app or losing the connection withdraws you from that attempt; your friends continue. Reconnecting rejoins exploration, not the running fight. There are no mid-fight entrants, revives or disconnect reward recovery in this release. No potions or Questbucks are consumed. If the server restarts or is redeployed during a fight, retry for free.

## Shared exploration in 1.19

- **One enemy simulation per world in your party.** Everyone sees matching enemy positions, targets, HP, deaths and respawns. Your friends’ weapon swings, spell effects, arrows and magic bolts point at the same monsters.
- **Fight with your own equipment.** In ordinary shared worlds, weapon tier/upgrades, class skills, armor, charms and active combat buffs feed bounded server calculations. The server checks attack ranges, scenery collision and cooldowns. Co-op boss arenas retain their separate balanced party stats.
- **Nearby party credit.** A roaming kill awards its normal gold, elite ore and matching quest progress to active party members within 18 units. You do not need the last hit. Menus, other worlds, arenas and distant players do not qualify. Each client processes a reward event once. Joining later does not replay old loot.
- **Shared crystals.** A collected crystal disappears for everyone and returns after 18 seconds of active world simulation. Only the collector receives the ore and collection progress; two simultaneous requests cannot collect it twice.
- **Shared NPC routes.** Quest giver, town residents and Stranger use common positions and pause near any party member. Personal quest markers, supply parcels, fishing outcomes, relic discoveries, inventory and contract choices remain individual.
- **Common scenery.** The first player's town level, project layouts, banners and milestones become the room's scenery when the party is created. All ten worlds use that layout, even after the creator leaves. Your own purchases and upgrades are still saved only to your adventure. Leave the party to see your personal layout, or create a new room to share your latest upgrades.
- **Sleep and reconnect.** Worlds without an exploring player stop simulating. When the entire room is inactive, shared world state is saved before the server can sleep. Rejoining receives the current state, not a fresh set of enemies. During a server restart/redeployment an active world can reset to its last idle snapshot; earned personal progress stays saved separately.

The existing game uses local adventure equipment and progress. The server bounds those equipment claims but does not verify ownership against an authoritative account inventory. This is not a ranked or trading economy. No trading, text chat, matchmaking or PvP is included. Keep party codes private; anyone with the code can join the room.

## Performance and free-plan use

During exploration the client sends changed movement at most five times per second and draws companions using the existing renderer and shared simple meshes. The party server sends a shared world snapshot at most five times per second per occupied world; clients interpolate movement. Attacks are separate cooldown-checked requests. Each player receives only their current world. Stationary characters send no position updates unless activity or equipment changes. The shared world still updates while someone explores, so enemies and NPCs keep moving. Hiding the app closes its party socket and stops party timers; returning reconnects. Failed connections retry up to five times, then offer Rejoin. Solo play continues if the party server is unavailable.

Co-op adds at most five control packets per second per participant and five shared snapshots per second. Phone arenas keep Battery Saver's 30 FPS cap and low rendering resolution, with simple shared companion meshes. The main world renderer sleeps during the arena. Boss timers stop when the fight finishes. Shared world timers run only while somebody explores; idle worlds do not simulate. The game does not write world state to the database every frame. Active exploration and fights both use server duration, so monitor free-plan usage during the beta.

Cloudflare's free plan has usage limits. Small rooms, hibernating sockets and movement throttling reduce usage, but do not guarantee that an open beta with 50–100 players will stay within free quotas. Check Workers and Durable Objects usage during a small playtest before inviting everyone. The included request limits help with abuse; they are not billing limits. No paid plan is required by this package's configuration.

## Two-phone check after deployment

- Create a party on phone A and join on phone B. Walk near each other and send a wave.
- Find the same roaming enemy. Attack from both phones and verify matching positions, HP, effects and death. Both nearby active players should get normal kill credit once. Wait for its shared respawn.
- Try collecting the same crystal on both phones. It should disappear for both, reward one collector, and respawn together.
- Compare NPC positions and Town Hall scenery. Leave the party and verify each personal town and save are restored.
- Switch to another unlocked world; the roster updates and the player disappears from the previous world. Use Meet here to reunite.
- Both enter Party arena at the same portal, then Start together. Check matching boss HP, warnings, teammate movement, and first-clear rewards on both saves. Repeat and verify no second reward.
- Open Menu during a fight: the other player keeps fighting. Down one character and verify they can spectate the victory. Disconnect one phone and verify the survivor continues.
- Test solo arenas separately; solo Pause still stops combat.
- Background phone B, then return. Its connection should resume without duplicate characters.
- Leave the party. The companion should disappear; ordinary presence and emote messages should not change either save.
- Play for 10–15 minutes with Battery Saver enabled and check heat and smoothness. Real-device performance still needs this check.

## Developer commands

From the extracted server folder on a computer with Node.js:

```
npm install
npx wrangler login
npm run deploy
```

For local development, add `http://127.0.0.1:4173` to ALLOWED_ORIGINS, run `npm run dev`, and set that browser's Party server address to the local Worker URL. Restore the production allowlist before deploying. The game itself can be served with `npm start` from the full game source.

Validation for this release: automated checks for all ten worlds and all eight project-layout combinations, shared world lifecycle/rewards, bundled desktop/mobile integration, all ten solo arenas and the eight-character co-op rendering budget. Real local Cloudflare/workerd WebSocket clients also test identical world snapshots, kill credit, crystal races, late joins, room isolation and a shared boss victory. These do not replace a live two-phone connection and heat test.

Official setup references (checked October 2026):

- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
