# Project documents

The originals live in Rafsun's claude.ai account. The links open after signing in to claude.ai, and for other people only once Rafsun shares them. Code tools such as Claude Code cannot open them, so each has a copy in this repo: **read the local copy**.

| Document | Original (claude.ai) | Copy in this repo |
| --- | --- | --- |
| Product and Technical Spec: v1 scope, users, rules, decisions, requirements | https://claude.ai/artifact/3srj5eZptXZpuAAHwZNEkN | [`docs/version-0/product.md`](product.md), rules in [`CLAUDE.md`](../../CLAUDE.md) |
| Technical Blueprint: state machine, database schema, API contract | https://claude.ai/artifact/UgnJZmVSP3AHcj2ENumsex | State machine in [`CLAUDE.md`](../../CLAUDE.md); schema in `apps/api/src/database/migrations/`; API in [`docs/version-0/openapi.yaml`](openapi.yaml) |
| Clickable prototype: 30 screens, admin panel, logos | https://claude.ai/artifact/TjyQBmde9ggomc5KSdXhQH | [`docs/version-0/design/README.md`](design/README.md) (screen index) and [`docs/version-0/design/`](design/) (one file per screen) |
| Logos | Logo page of the prototype | [`docs/version-0/design/logos/`](design/logos/) |
| Prototype Test Guide: tasks and questions for user testing | https://claude.ai/artifact/Rf6d3CbFgY5z7mcqvghCJU | Not copied; not needed for building |

Made in this repo (no claude.ai original):

| Document | What it is |
| --- | --- |
| [`docs/version-0/api.md`](api.md) | API reference: every endpoint served today, who may call it, rules, errors, and a real request and response for each, plus the Socket.IO events. Samples were recorded from the running API (2026-11-14 to 2026-11-17, M6 included); update this page whenever an endpoint changes |
| [`docs/version-0/postman/bhangariwala.postman_collection.json`](postman/bhangariwala.postman_collection.json) | Postman collection (v2.1) for all 54 routes served today, ordered as a full sale: sign in, publish rates, collector sign-up and approval, request, accept, arrive with the code, weigh, confirm, pay, rate, dispute, then the admin panel views. Requests save tokens and ids for the next step. Setup notes are in its description |
| [`milestones/`](milestones/README.md) | One note per finished milestone with its checklist |

## Which copy wins

The repo copies are what the code follows. When a decision changes in claude.ai, update the matching local file in the same commit. If a local copy and a request disagree, ask Rafsun before building.
