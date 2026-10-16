---
name: mpc-voicelink
description: Implement or review MPC VoiceLink, a LAN-only browser Push-to-Talk system using React, NestJS, Socket.IO, mediasoup, and Turborepo. Use for web client, signaling, WebRTC, audio, LAN configuration, workspace, and test work in this repository.
---

# MPC VoiceLink — Project Engineering Rules

This is the repository-level guide for every AI or developer contributing to this project. Read it before changing code. The Codex-discoverable copy is kept at `.codex/skills/mpc-voicelink/SKILL.md`.

Before changing behavior, read these files in order:

1. `MPC_VoiceLink_Detailed_Prompt.md`
2. `MPC_VoiceLink_Architecture.md`
3. `PROJECT_STATUS.md`

## Approved architecture

- The product is a **LAN-only browser Push-to-Talk system**: React + Vite web client, NestJS + Socket.IO signaling server, and mediasoup SFU on the laptop/server.
- Use npm workspaces and Turborepo. Applications live in `apps/web` and `apps/server`; shared messages and types live in `packages/protocol`.
- Audio uses WebRTC and Opus through mediasoup. The server controls delay-related policy but cannot guarantee identical physical latency for every client.
- The Wi-Fi hotspot/LAN is the only network path for the MVP. There is no cloud relay, cloud recording, database persistence, or TURN service unless explicitly approved.

Do not add Flutter, Expo, React Native, raw-audio WebSockets, a second media server, custom RTP/codec handling, or a cloud dependency without explicit approval.

## Browser, network, and audio rules

- Browser microphone access on a phone/LAN requires a trusted HTTPS context. HTTP is acceptable only for early local UI/control testing; it is not a completed audio setup.
- When the API is HTTPS, use secure Socket.IO transport/WSS as well. Configure certificate paths only through server environment variables; never commit keys or certificates.
- Configure the actual server LAN IP as `MEDIASOUP_ANNOUNCED_ADDRESS`; `0.0.0.0` is a bind address, not a client-reachable address.
- Restrict CORS to intended web origins. Do not use wildcard CORS for the real LAN deployment.
- Capture microphone audio only after the server grants the floor. Stop media tracks, close transports, and clear UI state when leaving or disconnecting.
- Use standard WebRTC-compatible Opus. Default to mono capture (`channelCount: 1`) and do not force incompatible server-side codec settings.
- Never store, log, stream to disk, or expose raw user audio. Keep audio-related buffering bounded.

## PTT and security invariants

- The server is the sole authority for who may speak. At most one active floor holder is allowed per room.
- Floor acquisition must be atomic in `RoomsService`; do not place `await` operations between availability checks and assignment.
- Every accepted floor grant has an opaque floor token. Require the token for heartbeat, producer creation, release, and all cleanup-sensitive actions. Reject stale tokens.
- The client is stateful: `idle → requesting → talking → releasing/idle`. Disable repeat requests while awaiting a response.
- Release the floor on pointer/keyboard release, heartbeat expiry, socket disconnect, browser/tab close where possible, and any transport/producer failure.
- Validate every Socket.IO payload at the server boundary. Never trust a displayed name, room id, floor token, device id, or media capability supplied by the client.
- Do not log join codes, tokens, certificate material, or audio payloads. Keep secrets only in untracked `.env` files; update `.env.example` with safe placeholders when adding config.

## Coding conventions

- Keep TypeScript strict. The NestJS server uses NodeNext module resolution, so local ESM imports retain their `.js` extension.
- Add or change client/server event names and payload types in `packages/protocol` first. Do not duplicate magic event strings in applications.
- Separate React connection state, PTT/floor state, media state, and presentational components. Avoid a single component owning unrelated lifecycle logic.
- Make teardown idempotent. mediasoup workers, routers, transports, producers, consumers, intervals, listeners, and tracks must all be released on every exit path.
- Keep configuration in `apps/server/src/config.ts` and environment variables; do not read `.env` ad hoc throughout the codebase.
- Prefer small focused changes. Do not refactor unrelated files in a feature or bug-fix task.

## Required verification and documentation

For code changes, run from the repository root when relevant:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Also run targeted tests or smoke checks for the changed behavior. A feature involving real audio is not complete until it has been tested between physical devices on the target hotspot/LAN, including floor contention and cleanup.

Update `PROJECT_STATUS.md` whenever a milestone, verification result, known limitation, or next action changes. Do not claim a benchmark, security property, or physical-device validation that has not actually been performed.
