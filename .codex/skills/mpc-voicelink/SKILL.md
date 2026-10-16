---
name: mpc-voicelink
description: Implement or review MPC VoiceLink, a LAN-only browser Push-to-Talk system using React, NestJS and mediasoup. Use for web client, signaling, WebRTC, audio, LAN configuration, Turborepo and test work; do not use for unrelated projects.
---

# MPC VoiceLink web engineering guide

Before changing behavior, read:

1. MPC_VoiceLink_Detailed_Prompt.md
2. MPC_VoiceLink_Architecture.md
3. PROJECT_STATUS.md

## Architecture invariants

- The approved MVP is React/Vite browser client, NestJS + Socket.IO, mediasoup and Opus on a laptop LAN server.
- Use npm workspaces + Turborepo for all app/package tasks. apps/web is the browser UI, apps/server is server/media, packages/protocol owns shared event constants and payload contracts.
- Do not add Flutter, Expo, React Native, cloud relay, raw-audio WebSocket, custom RTP/codec implementation or a second media server without explicit user approval.
- Hotspot only provides Wi-Fi. Browser audio must stay client -> laptop SFU -> listeners in LAN; no cloud/TURN fallback by default.
- Do not record, persist, log or retain audio payloads. All queues, buffers, metrics caches and listeners require bounded lifetime.

## Browser and transport rules

- LAN browser microphone/WebRTC requires a trusted HTTPS origin. HTTP is acceptable only for UI/control development on localhost; do not claim a phone browser can capture microphone from arbitrary LAN HTTP.
- Use WSS for signaling when page origin is HTTPS. Configure TLS certificate/key locally through environment values; never commit keys.
- Browser receives actual audio permission/capture only after server FLOOR_GRANTED. Stop tracks on release, expiry, disconnect and page teardown.
- Standard WebRTC Opus router capability is 48 kHz two-channel RTP; request mono capture/stereo=0 at browser level.
- Keep control plane separate from media plane. Server may configure relay profile/bitrate/lease but cannot force uniform physical playback latency across devices.

## PTT authority

- Server is authoritative. One room has one active floor holder at a time.
- The floor check-and-assign operation must be atomic in RoomsService; never insert await between availability check and lease assignment.
- Maintain event names in packages/protocol: JOIN_ROOM, ROOM_STATE, REQUEST_FLOOR, FLOOR_GRANTED, FLOOR_DENIED, RELEASE_FLOOR, FLOOR_RELEASED, HEARTBEAT, CLIENT_DISCONNECTED and ERROR.
- Bind floor token to room, client and current session. Reject stale token/media after release, reconnect, disconnect or expiry.
- When media is added, validate active floor ownership again before accepting/relaying Producer. Button state is not authorization.
- Release floor and resources on explicit release, missing heartbeat, lease expiry, tab close/socket disconnect and failed signaling.

## Code conventions

- Server TypeScript is strict ESM/NodeNext and uses .js suffix for relative imports. Validate all untrusted Socket.IO input and emit ERROR rather than throwing across handlers.
- Web is strict TypeScript React. Keep connection state, floor state and media lifecycle separate. Pointer cancel/release must stop an active request/lease.
- Use packages/protocol instead of copied event strings and hand-maintained duplicated types.
- All laptop address, CORS, TLS, port, room code, timing and media settings belong in server config/.env.example. Never read, log or commit apps/server/.env.
- Close WebRtcTransports, Producers, Consumers, MediaStream tracks, timers, socket listeners and room maps deterministically.

## Verification and documentation

- Update PROJECT_STATUS.md whenever scope, progress, tests or blockers change.
- Minimum server/web validation: npm.cmd run typecheck and npm.cmd run build.
- Before calling media complete, test two physical browsers via laptop, concurrent PTT, disconnect/lease expiry, slow listener behavior and 30–60 minute soak.
- Do not claim compatibility, latency, capacity, CPU/RAM or quality without benchmark on intended laptop and Hotspot models.
