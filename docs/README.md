# Project documents

The originals live in Rafsun's claude.ai account. The links open after signing in to claude.ai, and for other people only once Rafsun shares them. Code tools such as Claude Code cannot open them, so each has a copy in this repo: **read the local copy**.

| Document | Original (claude.ai) | Copy in this repo |
| --- | --- | --- |
| Product and Technical Spec: v1 scope, users, rules, decisions, requirements | https://claude.ai/artifact/3srj5eZptXZpuAAHwZNEkN | [`docs/product.md`](product.md), rules in [`CLAUDE.md`](../CLAUDE.md) |
| Technical Blueprint: state machine, database schema, API contract | https://claude.ai/artifact/UgnJZmVSP3AHcj2ENumsex | State machine in [`CLAUDE.md`](../CLAUDE.md); schema in `apps/api/src/database/migrations/`; API in [`docs/openapi.yaml`](openapi.yaml) |
| Clickable prototype: 30 screens, admin panel, logos | https://claude.ai/artifact/TjyQBmde9ggomc5KSdXhQH | [`docs/design/README.md`](design/README.md) (screen index) and [`docs/design/prototype/`](design/prototype/) (one file per screen) |
| Logos | Logo page of the prototype | [`docs/design/logos/`](design/logos/) |
| Prototype Test Guide: tasks and questions for user testing | https://claude.ai/artifact/Rf6d3CbFgY5z7mcqvghCJU | Not copied; not needed for building |

## Which copy wins

The repo copies are what the code follows. When a decision changes in claude.ai, update the matching local file in the same commit. If a local copy and a request disagree, ask Rafsun before building.
