# agent-galaxy

**See your AI agent team as a living galaxy.** Teams are planets, agents orbit as
satellites, handoffs stream between stars — a zero-dependency 3D visualization for
multi-agent systems, rendered with manual 3D projection on a single Canvas 2D.

![demo](assets/demo.gif)

**[Live demo →](https://taehyeonglim.github.io/agent-galaxy/)**

## Quickstart (30 seconds)

```bash
git clone https://github.com/taehyeonglim/agent-galaxy && cd agent-galaxy
node galaxy.mjs --serve            # sample galaxy at http://localhost:8420
```

### Your own agents (Claude Code)

```bash
node galaxy.mjs --scan ~/my-project/.claude/agents --serve
```

This scans your agent definitions (`*.md` frontmatter), groups them into planets
by `model` (or `--group-by dir`), and opens your galaxy.

## Your own data

Everything is driven by one file: `data.json`. Minimal example:

```json
{
  "meta":  { "title": "MY LAB" },
  "teams": [
    { "key": "research", "name": "Research", "color": "#9370DB", "emoji": "🔭",
      "agents": [{ "name": "paper-finder", "running": true }] }
  ]
}
```

Optional: `links` (beams between teams), `cores` (central hub, 0–N), `outposts`
(observer nodes outside the ring), `linkTypes` (custom beam colors).
Full contract: [docs/SCHEMA.md](docs/SCHEMA.md).

Customize scan output with `galaxy.config.json` (title, team colors/emoji, links) —
see [docs/SCHEMA.md](docs/SCHEMA.md#galaxyconfigjson).

## Controls

drag = orbit camera · wheel = zoom · hover a planet = agent roster · **F** = fullscreen · **R** = replay boot

## Tests

```bash
npm install && npx playwright install chromium
npm test
```

## License

MIT
