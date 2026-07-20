# tldraw offline Canvas API — reference

The "tldraw offline" desktop app runs a localhost HTTP server while open. `scripts/canvas.sh`
wraps all of this; read here only when you need something the helpers don't cover.

## Discovery & auth

- Config file: `~/Library/Application Support/tldraw/server.json` → `{ port, token, pid, ... }`.
- The **token rotates every launch** — read it fresh each session, never cache it.
- `GET http://127.0.0.1:<port>/` returns the full, self-documenting API reference (no auth).
  `canvas.sh readme` prints it — check it if the API seems to have changed.
- Every other endpoint needs `Authorization: Bearer <token>`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/search` | Run JS against the `api` object: list docs, read shapes/bindings, screenshots. No `editor`. |
| POST | `/api/doc/:id/exec` | Run JS against the live `editor` (tldraw `Editor`) in a document. |
| POST | `/api/doc/:id/script-workspace` | Write **durable** scripts saved inside the `.tldraw` file (persist across reopen). |
| GET  | `/api/doc/:id/script-status` | Inspect the durable-script watcher state. |

`api` methods (in `/api/search`): `getDocs()`, `getFocusedDoc()`, `getShapes(docId)`,
`getBindings(docId)`, `getScreenshot(docId, opts)`, `getScriptStatus(docId)`, plus
`api.members` (the full Editor API reference) and `api.recipes`.

`editor` (in `/api/doc/:id/exec`): the real tldraw Editor — `createShape(s)`,
`createBindings`, `updateShapes`, `deleteShapes`, `getCurrentPageShapes`,
`getShapePageBounds(id)`, `createPage`, `setCurrentPage`, `getPages`, `zoomToFit`, etc.
Import helpers with `const { createShapeId, toRichText } = await import('tldraw')`.

## Shape records

Shapes are raw tldraw `TLShapePartial`s. Common ones:

```js
// geo (rectangle / ellipse / …)
{ id: createShapeId('n'), type: 'geo', x, y, props: {
    geo: 'rectangle', w, h, color, fill: 'solid'|'semi'|'none'|'pattern',
    dash: 'solid'|'dashed'|'dotted'|'draw', size: 's'|'m'|'l'|'xl',
    font: 'sans'|'draw'|'serif'|'mono', align: 'start'|'middle'|'end',
    verticalAlign: 'start'|'middle'|'end', richText: toRichText('text') } }

// text (free label)
{ id, type: 'text', props: { richText, size, color, font, textAlign, w, autoSize } }

// arrow (connector) — bind endpoints separately (below)
{ id, type: 'arrow', props: { richText, color, dash, size, bend, labelPosition } }

// frame (clipping container with a name) — an alternative to the dashed-box pattern
{ id, type: 'frame', props: { w, h, name } }
```

Colours: `black grey blue light-blue violet light-violet green light-green yellow orange
red light-red white`.

## Arrow bindings

An arrow connects to shapes via **bindings** created after both shapes exist:

```js
editor.createShape(arrowPartial)
editor.createBindings([
  { fromId: arrowId, toId: sourceId, type: 'arrow',
    props: { terminal: 'start', isExact: false, isPrecise: true,
             normalizedAnchor: { x: 0, y: 0.5 } } },   // left-middle of source
  { fromId: arrowId, toId: targetId, type: 'arrow',
    props: { terminal: 'end', isPrecise: true, normalizedAnchor: { x: 1, y: 0.5 } } },
])
```

- `isPrecise:true` + `normalizedAnchor` pins the endpoint to a specific point on the shape
  (0..1 in each axis). Omit / `isPrecise:false` lets tldraw auto-anchor to centre.
- `props.bend` on the arrow arcs it; combine with side anchors to route bypass edges out
  into a clear margin.

## Screenshots

`api.getScreenshot(docId, { size, mode, bounds })` → `{ filePath, width, height, pageName,
viewport, bounds, captureMode }`. It writes a **JPEG to a temp file**; `filePath` is what
you Read to see the result. `size`: `'small'|'medium'|'large'|'full'` (use `large`).
`mode`: `'canvas'` (shapes, default) or `'window'` (whole app incl. UI chrome).

## Persistence

Shapes created through the editor persist in the `.tldraw` file. Runtime JS from `/exec`
(listeners, timers) does **not** survive reopen — for durable interactive behaviour use
`/script-workspace`. Diagrams (plain shapes) need none of that.
