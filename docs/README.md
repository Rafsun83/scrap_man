# Docs

The project's documents are grouped by version. Each version folder holds everything decided and built in that round: the product spec, the API contract and reference, the design (split into `household/`, `collector/` and `admin/`), the Postman collection and the milestone notes.

| Version | Status | What it covers | Index |
| --- | --- | --- | --- |
| [`version-0/`](version-0/README.md) | Current | The first build, M0 to M7: backend, household and collector app, admin panel, landing page, pilot readiness | [`version-0/README.md`](version-0/README.md) |

## Starting a new version

When work starts on a new round (for example a design refresh or a new feature set):

1. Create `docs/version-<n>/` with the same layout as the previous version.
2. Copy over only the documents that round will change (for a design round, the affected `design/<app>/` screens; for API changes, `openapi.yaml` and `api.md`). Point `gen:api` in `packages/shared/package.json` at the new `openapi.yaml` if it moves.
3. Write that round's milestone notes in `docs/version-<n>/milestones/`.
4. Add a row to the table above, mark it Current, and mark the previous version as Done. Leave the previous folder as it is: it is the record of what was shipped.

A document that a newer version has not copied is still the one in the newest version that has it.
