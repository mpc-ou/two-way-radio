---
name: mpc-voicelink
description: Implement or review MPC VoiceLink, a LAN browser Push-to-Talk system (one NestJS service serving a Vite 8 React build, Socket.IO and mediasoup) plus a separate PeerJS P2P app. Use for web client, signaling, WebRTC, audio, LAN configuration, workspace and test work in this repository.
---

# MPC VoiceLink — Project Engineering Rules

This is the repository-level guide for every AI or developer contributing to this project. Read it before changing code. The Codex-discoverable copy is kept at `.codex/skills/mpc-voicelink/SKILL.md`; keep both in sync.

Before changing behavior, read these files in order:

1. `MPC_VoiceLink_Architecture.md`
2. `PROJECT_STATUS.md`
3. `README.md`

## Approved architecture

- **LAN mode (primary):** a single NestJS process (`apps/server`) serves HTTPS, the built web UI (`apps/web/dist`), Socket.IO signaling and the mediasoup SFU. There is no separate web server, dev server or proxy.
- `apps/web` is React + Vite 8 and is only built (`vite build`, `vite build --watch` in dev). It connects to Socket.IO on its own origin.
- Channels are fixed and declared by the operator in `CHANNELS_FILE` (`apps/server/channels.json`), each with an optional PIN. Clients enter only a display name, pick a channel and talk.
- Audio is WebRTC + Opus through mediasoup on one `WebRtcServer` port (UDP, with TCP on the same port as fallback only). Socket.IO carries control messages only, never audio.
- **P2P mode:** `apps/web-p2p` (PeerJS, Vercel) and `packages/ui` are independent. Do not change them in LAN-mode work unless explicitly asked.
- Use npm workspaces and Turborepo. Shared event names and payload types live in `packages/protocol`.

Do not add Flutter, Expo, React Native, raw-audio WebSockets, a second media server, custom RTP/codec handling, a database, or a cloud dependency without explicit approval.

## Browser, network, and audio rules

- Phone microphones require a trusted HTTPS origin. The server must run with `TLS_CERT_PATH/TLS_KEY_PATH`; phones install the local CA (`scripts/new-lan-tls.ps1`, use `-ReuseCa` when only the IP changes). Never commit keys or certificates.
- `MEDIASOUP_ANNOUNCED_ADDRESS` is the server LAN IP (empty = auto-detect; a stale private IP is replaced automatically). `0.0.0.0` is a bind address only.
- The microphone may be opened when a client joins a channel, but its Producer must be created **paused** on the server and resumed **only** by the server when it grants the floor (see invariants). The client keeps its own producer paused until `FLOOR_GRANTED`.
- Standard WebRTC Opus: mono capture, 20 ms, in-band FEC on, DTX off. Do not force incompatible codec settings.
- Prefer the shortest playback path (one `<audio>` element per remote producer) over extra Web Audio buffering.
- Never store, log, stream to disk or expose raw user audio. Keep buffering bounded.

## PTT and security invariants

- The server is the sole authority for who may speak. At most one floor holder per channel.
- Floor acquisition is atomic in `RoomsService`; no `await` between the availability check and assignment.
- Every grant has an opaque floor token, required for heartbeat and release. Stale tokens are rejected.
- On grant: resume the holder's Producer **before** emitting `FLOOR_GRANTED`. On release/expiry/force/disconnect: pause the Producer **before** emitting `FLOOR_RELEASED`. These media operations are serialized per channel in the gateway.
- Client state machine: `IDLE → REQUESTING → TALKING → RELEASING/IDLE`; ignore repeat presses while requesting.
- Release on pointer/key release, heartbeat expiry, socket disconnect, tab hide/close and transport failure.
- A member is removed only by the socket that owns it (reconnects may arrive before the old disconnect).
- Validate every Socket.IO payload at the server boundary. PINs and the admin code are compared in constant time; repeated wrong PINs are throttled per IP.
- Do not log PINs, admin codes, tokens, certificate material or audio. Secrets live only in untracked `.env` / `channels.json`; update `.env.example` / `channels.example.json` with safe placeholders.

## Coding conventions

- TypeScript strict. The server uses NodeNext resolution, so local ESM imports keep their `.js` extension.
- Add or change events and payloads in `packages/protocol` first; never duplicate event strings.
- Web client: socket/channel/PTT logic lives in `services/voiceLinkClient.ts`, media in `services/voiceMedia.ts`; React components only render state (`useSyncExternalStore`) and call actions.
- Make teardown idempotent: workers, routers, transports, producers, consumers, timers, listeners and tracks are released on every exit path.
- Configuration comes from `apps/server/src/config/config.ts` (read once and cached) and environment variables only.
- Prefer small focused changes; do not refactor unrelated files.

## Required verification and documentation

From the repository root:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Also run targeted smoke/E2E checks for changed behavior (Socket.IO client against the HTTPS server; headless Chrome with `--use-fake-device-for-media-stream` for media). A real-audio feature is not complete until tested between physical phones on the target Wi-Fi, including floor contention, reconnect and cleanup.

Update `PROJECT_STATUS.md` whenever a milestone, verification result, known limitation or next action changes. When you add or change a user-facing error message, banner, server log line or failure mode, update `TROUBLESHOOTING.md` (cause + fix) in the same change. Never claim a benchmark, security property or physical-device validation that has not actually been performed.
