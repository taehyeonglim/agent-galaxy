# data.json — Schema v1

This is the full contract for `data.json`, the single file that drives the galaxy.
It is validated by `validateData()` and defaulted by `applyDefaults()` in
[`schema.mjs`](../schema.mjs) — the same module is imported by both the browser
viewer (`cinema.js`) and the Node adapter (`galaxy.mjs`), so the rules below apply
identically whether you hand-write `data.json` or generate it with `--scan`.

A field is **required** only if `validateData()` raises an error when it's missing;
everything else is optional. **Default** values are the ones `applyDefaults()`
fills in before the data reaches the renderer — if no default is listed, the
field is simply absent/empty when omitted.

## Top-level object

| Field | Required | Type | Default |
|---|---|---|---|
| `meta` | ✅ | object | — |
| `teams` | ✅ | non-empty array | — |
| `links` | – | array of tuples | `[]` |
| `cores` | – | array | `[]` |
| `outposts` | – | array | `[]` |
| `linkTypes` | – | object (keyed by type name) | 4 built-in types (see below) |

## `meta`

| Field | Required | Type | Default | Notes |
|---|---|---|---|---|
| `title` | ✅ | string, non-empty (after trim) | — | Only field `validateData` actually checks inside `meta`. Rendered as the HUD title and boot-screen logo. |
| `subtitle` | – | string | `'AGENT GALAXY'` | Rendered under the title. |
| `version` | – | string | `''` | Rendered as a version chip; hidden entirely when empty. |
| `accent` | – | string | `'#d94a9a'` | Used as the fallback core color when a core has no `color` of its own. Not format-validated (unlike `teams[].color`). |
| `coreLabel` | – | string | `'CORE'` | Label drawn above the hub when there are 2+ cores. |

Any other keys placed under `meta` pass through untouched (`applyDefaults` spreads
`d.meta` over the defaults) but are not read by the viewer.

## `teams` (required, non-empty array)

Each entry:

| Field | Required | Type | Notes |
|---|---|---|---|
| `key` | ✅ | string | Must be unique among all team keys. A duplicate within `teams` raises `teams[i].key: duplicate "..."`. Used as the link/planet identifier. |
| `name` | ✅ | truthy | Display name; also seeds the initials badge (first letters of the first two whitespace/`_`/`-`-separated words, uppercased). |
| `color` | ✅ | hex string matching `^#[0-9a-fA-F]{6}$` | e.g. `#9370DB`. Any other format is rejected. |
| `agents` | ✅ | array | See below. Rejected if not an array. |
| `role` | – | string | Display-only subtitle line (e.g. shown in the hover popup); not validated. |
| `stage` | – | string | Display-only status line; not validated. |
| `emoji` | – | string | Badge glyph. Used only when `image` is absent or fails to load. |
| `image` | – | string (URL/path) | Badge image. Takes priority over `emoji` when it loads successfully; falls back to `emoji`, then to initials, if it doesn't. |

### `teams[].agents`

Each entry:

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | ✅ | truthy | Rejected (`agents[j].name: required`) if missing. |
| `running` | – | boolean | Marks the agent's orbiting moon as "active" (glow + counted in the team's active count). Treated as falsy when omitted. |

## `links`

Optional array. Each entry is a **tuple**, not an object: `[from, to, type, ...]`
(any elements after the third are ignored by validation and the renderer).

| Position | Required | Notes |
|---|---|---|
| `from` (index 0) | ✅ | Must equal a `key` from `teams` or `outposts`; otherwise `links[i]: unknown from "..."`. |
| `to` (index 1) | ✅ | Same rule, `links[i]: unknown to "..."`. |
| `type` (index 2) | ✅ (array must have length ≥ 3, or `links[i]: must be [from, to, type]`) | Looked up in `linkTypes` at render time; an unrecognized type falls back to a default gray (`#aab4d8`) rather than failing validation. |

A `key` that belongs to a **core** (`cores[].id`) is never registered as a valid
link endpoint — cores use `id`, not `key`, and are not added to the endpoint set.
Only team keys and outpost keys are valid `from`/`to` values.

## `linkTypes`

Optional object, keyed by type name. `applyDefaults` starts from these 4 built-in
types and shallow-merges anything you supply on top (so you can override one field
of a built-in type, add new types, or leave it untouched):

| Type | Default color | Default label | `emphasis` |
|---|---|---|---|
| `pipeline` | `#3ef0a0` | `Core Flow` | `true` |
| `cross` | `#aab4d8` | `Secondary` | – |
| `revision` | `#ff69b4` | `Revision` | – |
| `expert` | `#2fd0ff` | `Expert` | – |

Each type entry supports:

| Field | Required | Type | Notes |
|---|---|---|---|
| `color` | – | hex string | Beam color. |
| `label` | – | string | Shown in the legend. |
| `emphasis` | – | boolean | When `true`, the beam renders as a thicker "pipe" (main-flow) line instead of a thin secondary beam. |

None of `linkTypes`' inner fields are checked by `validateData`. At render time: if a link references a type name absent from `linkTypes` entirely, the renderer falls back to the whole default object `{color: '#aab4d8'}`. If a custom type exists but lacks a `color` field, no per-field fallback is applied — it will have `undefined` color. Always specify `color` on custom types to avoid broken beams.

## `cores`

Optional array — the central hub. **0 to N** entries are all valid and change the
layout:

- **0 cores**: no hub is drawn.
- **1 core**: centered.
- **2 cores**: symmetric pair.
- **≥3 cores**: arranged in a polygon ring.

Each entry:

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | ✅ | truthy | Rejected (`cores[i].id: required`) if missing. Rendered as the core's own label. Not a valid link endpoint (see `links` above). |
| `label` | – | string | Optional secondary label drawn below the core. |
| `color` | – | hex string | Falls back to `meta.accent` when omitted. |
| `image` | – | string (URL/path) | Optional icon drawn over the core glyph when it loads successfully. |

## `outposts`

Optional array — observer nodes placed outside the main ring.

| Field | Required | Type | Notes |
|---|---|---|---|
| `key` | ✅ | string | Rejected (`outposts[i].key: required`) if missing. Must not collide with any `teams[].key` or earlier `outposts[].key`; a duplicate raises `outposts[i].key: duplicate "..."`. Valid as a `links` endpoint. |
| `name` | ✅ | truthy | Rejected (`outposts[i].name: required`) if missing. Also seeds the initials badge, same rule as `teams[].name`. |
| `placement` | ✅ | one of `above`, `below`, `outer` | Any other value is rejected (`outposts[i].placement: must be one of above|below|outer`). Controls where the node is positioned relative to the ring. |
| `label` | – | string | Subtitle line drawn under the outpost's name badge. |
| `color` | – | hex string | Not validated. Falls back to `#95a5a6` (not `meta.accent`) when omitted — used for both the badge and its dashed connector line to the hub. |
| `emoji` | – | string | Same fallback chain as `teams[].emoji` (used when `image` is absent/fails to load). |
| `image` | – | string (URL/path) | Same fallback chain as `teams[].image`. |

## `galaxy.config.json`

`node galaxy.mjs --scan` builds `data.json` from your agent directory, then — if a
`galaxy.config.json` file exists in the current working directory — merges it in
via `mergeConfig(data, cfg)`. This lets you rename/recolor scanned teams and add
hand-authored sections (links, cores, outposts, custom link types) without editing
the generated `data.json` directly.

| `galaxy.config.json` key | Merge behavior |
|---|---|
| `title` | Shorthand for `meta.title`: sets `data.meta.title = cfg.title`. |
| `meta` | Shallow-merged on top of the generated `meta` object (`{ ...data.meta, ...cfg.meta }`) — set any of `subtitle`/`version`/`accent`/`coreLabel`/`title` here too. |
| `teams` | Object keyed by team `key`. For each generated team whose `key` has a matching entry, that entry is shallow-merged over the team (`{ ...team, ...cfg.teams[key], key: team.key }`) — the `key` itself is always preserved from the scan, so you can't rename a team's key this way, only its `name`/`color`/`emoji`/`image`/`role`/`stage`/etc. Teams with no matching entry are left untouched. |
| `links` | **Replaces** the generated `links` array entirely (default from scan is `[]`). |
| `cores` | **Replaces** the generated `cores` array entirely (default from scan is a single `CLAUDE CODE` orchestrator core). |
| `outposts` | **Replaces** the generated `outposts` array entirely (default from scan is `[]`). |
| `linkTypes` | **Replaces** the generated `linkTypes` value entirely (i.e. sets `data.linkTypes` before `applyDefaults`'s built-in-type merge runs on top of it). |

The merged result is still passed through `validateData()` before `--scan` writes
it out — an invalid `galaxy.config.json` (e.g. a `teams` override with a bad
`color`, or a `links` tuple pointing at an unknown key) makes the scan fail with
the same error list described above, rather than writing a broken `data.json`.
