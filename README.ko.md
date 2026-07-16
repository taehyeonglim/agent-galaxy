# agent-galaxy

[English](README.md) | **한국어**

**AI 에이전트 팀을 살아있는 은하로 봅니다.** 팀은 행성, 에이전트는 공전하는 위성,
핸드오프는 별 사이를 흐르는 광선 — 멀티 에이전트 시스템을 위한 zero-dependency 3D
시각화입니다. Canvas 2D 하나 위에서 수동 3D 투영으로 렌더링합니다.

![demo](assets/demo.gif)

**[라이브 데모 →](https://taehyeonglim.github.io/agent-galaxy/)**

## 퀵스타트 (30초)

```bash
git clone https://github.com/taehyeonglim/agent-galaxy && cd agent-galaxy
node galaxy.mjs --serve            # 샘플 은하가 http://localhost:8420 에 뜹니다
```

### 내 에이전트로 띄우기 (Claude Code)

```bash
node galaxy.mjs --scan ~/my-project/.claude/agents --serve
```

에이전트 정의(`*.md` frontmatter)를 스캔해 `model`별로 행성으로 묶고(`--group-by dir`도
가능), 내 은하를 엽니다.

## 내 데이터로 띄우기

모든 것은 `data.json` 파일 하나로 구동됩니다. 최소 예시:

```json
{
  "meta":  { "title": "MY LAB" },
  "teams": [
    { "key": "research", "name": "Research", "color": "#9370DB", "emoji": "🔭",
      "agents": [{ "name": "paper-finder", "running": true }] }
  ]
}
```

선택 항목: `links`(팀 사이의 광선), `cores`(중앙 허브, 0~N개), `outposts`(링 밖의
관조 노드), `linkTypes`(광선 색 커스텀).
전체 스키마 계약: [docs/SCHEMA.md](docs/SCHEMA.md) (영문).

스캔 출력은 `galaxy.config.json`으로 커스텀할 수 있습니다(타이틀, 팀 색/이모지, 링크) —
[docs/SCHEMA.md](docs/SCHEMA.md#galaxyconfigjson) 참고.

## 조작법

드래그 = 카메라 궤도 회전 · 휠 = 줌 · 행성에 마우스 = 에이전트 명단 · **F** = 전체화면 · **R** = 부팅 리플레이

## 테스트

```bash
npm install && npx playwright install chromium
npm test
```

Node 18 이상이 필요합니다.

## 라이선스

MIT
