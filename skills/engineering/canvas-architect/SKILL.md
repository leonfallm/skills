---
name: canvas-architect
description: >-
  Produce polished, presentation-grade architecture and system diagrams on the local
  "tldraw offline" desktop canvas (macOS app that exposes a localhost Canvas API). Draws
  layered service flows, C4 context/container/component models, sequence/interaction
  diagrams with payload-labelled edges, service topologies, and side-by-side option
  comparisons — then screenshot-verifies and refines until they look designed, not
  wireframed. Use this whenever the user wants to diagram, visualise, sketch, map, or
  "draw on the canvas / in tldraw" an architecture, system design, data flow, request
  flow, service topology, C4 model, sequence diagram, or comparison of design options —
  even when they only say "draw / show me / visualise the architecture" without naming
  tldraw. Prefer this over static image or mermaid output whenever the tldraw canvas is
  available, because it produces an editable, presentable diagram the user can keep working on.
---

# canvas-architect

Make architecture diagrams on the live tldraw canvas that look like the best in the
business — clear hierarchy, generous whitespace, disciplined connectors — not a grid of
touching rectangles. The signature look is hand-drawn; you vary only colour (see Themes).
The single highest-leverage habit is the **screenshot-verify loop**: you cannot lay out a
diagram well without looking at it, so draw, capture, look, fix.

**Requires the free "tldraw offline" desktop app** (offline.tldraw.com), running locally —
it exposes the localhost Canvas API this skill drives. `scripts/canvas.sh` launches it if
it's installed but closed; if it isn't installed, point the user to offline.tldraw.com.
This is a hard dependency: with no tldraw offline there is no canvas to draw on.

## The loop

1. **Connect.** The app writes `~/Library/Application Support/tldraw/server.json` (port +
   per-launch token) while running. Use the bundled helper `scripts/canvas.sh` for every
   call — it finds the token, launches the app if it's closed, targets the focused document,
   and captures screenshots, so you never hand-roll curl/token boilerplate.
2. **Plan the layout before drawing — and plan sparse.** Pick an archetype (see
   `references/archetypes.md`), decide the grid (column centres, row Ys). Aim for **~8–14
   nodes**; if the system is bigger, show fewer here and split the rest onto separate pages
   rather than cramming — readability beats completeness (see design-principles §0). Keep the
   main flow a straight spine; attach identity/side services as short edges, never long
   diagonals across the body.
3. **Draw on a dedicated page.** Write a JS file that uses the primitives in
   `scripts/helpers.js`. Prepend the helpers and run it:
   ```bash
   cat scripts/helpers.js mydiagram.js > /tmp/run.js
   scripts/canvas.sh exec /tmp/run.js
   ```
   Always start with `await newPage('<name>')` — it draws on a fresh page so the user's
   own sketch on Page 1 is never touched, and it's idempotent so you can re-run freely.
4. **Screenshot and actually look.**
   ```bash
   scripts/canvas.sh shot        # prints a JPEG path
   ```
   Then **Read that image path.** Judge it as a designer would: overlaps? text overflowing
   boxes? arrows hidden between flush boxes? labels on top of borders? cramped containers?
5. **Refine and re-run.** Edit the JS, re-run (the page clears itself), screenshot again.
   Two or three passes is normal and expected — budget for them. Stop when it reads cleanly.

## Design principles (what separates designed from wireframed)

Full detail with rationale in `references/design-principles.md`; the essentials:

- **Whitespace is not wasted.** Leave ~50–70px between stacked nodes so connectors are
  visible and the eye can group things. Cramped diagrams read as unfinished.
- **Containers need padding.** Nodes must never touch the dashed group wall — inset them
  (the `container()` helper defaults to 40px). Give a group a filled **titled header
  strip**, never a bare text label floating on the border line.
- **Typography hierarchy.** Big `xl` title, `sans` font everywhere (the default hand-drawn
  font looks like a whiteboard, not an architecture doc). Inside a node: a name line plus
  **at most two** concise detail lines. If you're writing a paragraph in a box, cut it.
- **Connector discipline.** Enter/exit at consistent anchors. A structural flow is a solid
  arrow top-to-bottom or left-to-right. An edge that "bypasses" the main path (e.g. a
  write that skips the retrieval layer) should arc out into a clear margin with `bend` and
  be visually distinct (colour + dashed), not cut diagonally across other boxes.
- **Colour carries meaning, consistently.** Pick a small palette and stick to it: one
  accent for the highlighted/chosen thing, red for rejected/cost, green for the canonical
  store, one neutral for infrastructure. Don't rainbow every box.
- **Explain edge styles in a bordered legend box**, not scattered inline labels.
- **Align to a grid.** Shared column centres, shared row Ys across parallel columns. When
  comparing options, keep equivalent rows at the same height so the eye compares across.
- **Name the structure (C4 rule): every container/boundary gets a title, and relationships
  get described** — "reads", "publishes to", "on-behalf-of token" — especially edges that
  cross a boundary. Terse *nodes*, but never anonymous *groupings or arrows*: the detail
  you cut from a node moves outward to the container title, the edge label, or the legend.
  (A plain numbered/linear sequence is the one case where arrows can stay unlabelled.)

## Primitives

`scripts/helpers.js` gives you `newPage`, `box`, `txt`, `arrow`, `container`, `stack`,
`actor`, `legend`, `commit`. Minimal shape:

```js
await newPage('Payments — request flow')
txt('t', 100, -120, 'Payments service — request flow', { size: 'xl' })
const cx = 300, nx = cx - 150                       // column centre / node left (w=300)
const api = box('api', nx, 40, 300, 64, 'blue', 'API gateway\nauth · rate limit')
const svc = box('svc', nx, 160, 300, 80, 'violet', 'Payments service\ncharge · refund · webhook')
const c = container('stores', cx - 190, 300, 380, 'Data stores')
const s = stack(nx, c.bodyTop, 300, [
  { name: 'db', h: 80, color: 'green', text: 'Postgres\nledger (source of truth)' },
  { name: 'q',  h: 80, color: 'orange', text: 'Queue\nasync settlement' },
])
c.close(s.bottom)
arrow('e1', api, svc); arrow('e2', svc, c.strip)
commit()
```

See `scripts/example-layered.js` (a runnable layered flow) and
`references/example-comparison.js` (a two-option comparison — the quality bar to aim for).

## Themes = palettes

The look is a **fixed hand-drawn signature** — that consistency is the identity. The
**layout stays identical** and you vary only **colour**, via a palette. Call `setTheme(...)`
**once at the top of your script, before drawing**:

| Palette | Colours | Feel |
|---|---|---|
| `ink` (default) | neutral grey + one orange accent | restrained, editorial; let shape/position carry meaning |
| `cool` | blue primary + orange accent | calm, systems-y; blue for the "hero", orange for the exception |
| `warm` | orange primary + red accent | energetic, attention-forward |

**Author with role names, not raw colours** — `PAL.primary`, `PAL.accent`, `PAL.neutral`,
`PAL.ink` (and `PAL.good` / `PAL.bad`). Because a diagram references roles, it reskins to
any palette by changing only the `setTheme(...)` line:

```js
setTheme('cool')          // then newPage(...) and draw with PAL.primary / PAL.accent / …
await newPage('…')
const svc = box('svc', x, y, w, h, PAL.primary, 'Service')
```

**Bring your own palette** — pass an object to brand it (tldraw colours are a fixed named
set, so pick the nearest named colour; you cannot set exact hex on a shape):

```js
setTheme({ primary: 'blue', accent: 'orange', neutral: 'grey' })   // e.g. a brand scheme
```

Typography stays hand-drawn on purpose; if you genuinely need another font, set
`THEME.font = 'sans'` after `setTheme`. Per-node overrides still win (pass `{ color, fill,
dash, geo }` to any `box`).

## Archetypes

`references/archetypes.md` has layout skeletons for: **layered flow** (client → edge →
service → stores), **C4 layers** (context/container/component with actors and zoom
transitions), **sequence / interaction** (actors across the top, payload-labelled edges
between lifelines), and **side-by-side comparison** (two aligned columns + a `VS` and
legend in the centre gap). Start from the closest skeleton rather than from nothing.

## Canvas API

`references/canvas-api.md` documents the raw endpoints, the shape record schema (geo /
text / arrow / frame props), arrow bindings, and `getScreenshot`. You rarely need it if
you use `helpers.js` + `canvas.sh`, but reach for it for anything the primitives don't
cover (custom shapes, reading existing shapes, durable document scripts).

## Gotchas

- **Freehand `draw` shapes have no `w`/`h` props** — if you must place around the user's
  existing sketch, use `editor.getShapePageBounds(id)` for real bounds. (On your own new
  page this is moot.)
- **Post big JS via a file**, not an inline `-d` string — `canvas.sh exec <file>` handles
  the JSON encoding so quotes/newlines in your code don't break the shell.
- **Every `box`/`txt`/`arrow` name becomes a shape id, so names must be unique.** A
  collision silently overwrites the earlier shape (e.g. naming both a node and the arrow to
  it `'cache'` makes the arrow replace the node and bind to itself). `helpers.js` now throws
  on a duplicate name so you catch this immediately instead of via a mangled screenshot.
- **`bend` sign is trial-and-error** — draw it, look, flip the sign if it bows the wrong way.
- **`api`/`editor` scope split:** `editor` exists only inside `/api/doc/:id/exec`;
  `api.getDocs()/getFocusedDoc()/getScreenshot()` run inside `/api/search`. `canvas.sh`
  routes each correctly.
- If the app is closed there's no `server.json`; `canvas.sh` will launch it and wait. Tell
  the user you opened it (they can close it after).
