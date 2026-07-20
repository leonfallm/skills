// canvas-architect drawing primitives.
// Usage: prepend this to your drawing script, then call commit() at the end:
//     cat helpers.js draw.js > /tmp/run.js && canvas.sh exec /tmp/run.js && canvas.sh shot
// Everything runs inside /api/doc/:id/exec, so `editor` and top-level await are available.

const { createShapeId, toRichText } = await import('tldraw')
const shapes = [], bindings = []

// Every box/txt/arrow name becomes a tldraw shape id, so names must be unique — a
// collision would silently overwrite the earlier shape. Turn that into a loud error.
// Shape ids must be unique across the whole document, not just one page. createShapeId(name)
// is deterministic, so two pages sharing node names ('client', 'db', …) would collide and
// tldraw relocates each shape to the most-recent page (earlier pages go empty). We namespace
// ids by page (NS, set in newPage) to keep them page-local, and still guard dupes within a page.
let NS = 'p_'
const _used = new Set()
function _id(name) {
  if (_used.has(name)) throw new Error(`duplicate shape name "${name}" — names must be unique within a page`)
  _used.add(name)
  return createShapeId(NS + name)
}

// The signature look is a fixed hand-drawn typography — that consistency is the identity.
// You vary only COLOUR, via a palette. Author diagrams with the role names
// (PAL.primary / accent / neutral / ink, and good/bad) rather than raw colours, so a diagram
// reskins to any palette by changing one line.
// NB: tldraw shape colours are a FIXED named palette (black grey blue light-blue violet green
// yellow orange red white …) — you cannot set arbitrary brand hex on a shape, so a "brand"
// palette approximates with the nearest named colour.
const TYPOGRAPHY = { font: 'draw', dash: 'draw', fill: 'solid', arrowDash: 'draw' } // the hand-drawn signature
const PALETTES = {
  ink:  { primary: 'grey',   accent: 'orange', neutral: 'grey', ink: 'black', good: 'green', bad: 'red' }, // restrained: neutral + one accent
  cool: { primary: 'blue',   accent: 'orange', neutral: 'grey', ink: 'black', good: 'green', bad: 'red' }, // blue system + complementary pop
  warm: { primary: 'orange', accent: 'red',    neutral: 'grey', ink: 'black', good: 'green', bad: 'red' }, // warm, energetic
}
let THEME = { ...TYPOGRAPHY }
let PAL = { ...PALETTES.ink }
// setTheme('ink'|'cool'|'warm') selects a shipped palette; setTheme({primary,accent,…})
// applies your own (e.g. a brand palette). Typography stays hand-drawn — that's deliberate;
// if you truly need another font, set THEME.font = 'sans' after calling setTheme.
function setTheme(p) {
  PAL = { ...PALETTES.ink, ...(typeof p === 'string' ? (PALETTES[p] || {}) : (p || {})) }
  THEME = { ...TYPOGRAPHY }
  return PAL
}

// Create (or reuse+clear) a dedicated page so the user's existing sketch is untouched.
async function newPage(name) {
  let p = editor.getPages().find(x => x.name === name)
  if (!p) { editor.createPage({ name }); p = editor.getPages().find(x => x.name === name) }
  editor.setCurrentPage(p.id)
  NS = 'p_' + name.replace(/[^A-Za-z0-9]+/g, '_') + '_'   // page-local id namespace (see _id)
  _used.clear()
  // Clear the TARGET page by its id — not getCurrentPageShapes(), whose setCurrentPage may
  // not have flushed yet, which would wipe the *previous* page when drawing several pages.
  const ids = [...editor.getPageShapeIds(p.id)]
  if (ids.length) editor.deleteShapes(ids)                // idempotent re-runs
  return p.id
}

// A titled node. color: black|grey|blue|light-blue|violet|light-violet|green|light-green|
// yellow|orange|red|light-red|white. Keep text to a bold-ish name line + <=2 concise detail lines.
function box(name, x, y, w, h, color, text, o = {}) {
  const id = _id(name)
  shapes.push({ id, type: 'geo', x, y, props: {
    geo: o.geo || 'rectangle', w, h, color,
    fill: o.fill || THEME.fill, dash: o.dash || THEME.dash,
    size: o.size || 's', font: o.font || THEME.font,
    align: o.align || 'middle', verticalAlign: o.valign || 'middle',
    richText: toRichText(text || '') } })
  return id
}

// Free text (titles, captions, labels). align: start|middle|end. Pass w to wrap.
function txt(name, x, y, t, o = {}) {
  const id = _id(name)
  const props = { richText: toRichText(t), size: o.size || 'm', color: o.color || 'black', font: o.font || THEME.font, textAlign: o.align || 'start' }
  if (o.w) { props.w = o.w; props.autoSize = false }
  shapes.push({ id, type: 'text', x, y, props })
  return id
}

// Connector between two shape ids. o: {label, color, dash:'dashed', bend, precise, sa, ea}.
// sa/ea are normalized anchors {x,y} (0..1) on the source/target — use with precise:true to
// route from a specific edge (e.g. sa:{x:0,y:0.5} = left-middle). bend arcs the line; flip the
// sign if it bows the wrong way. Route "bypass" edges out into a clear margin with a bend.
function arrow(name, from, to, o = {}) {
  const id = _id(name)
  const props = { richText: toRichText(o.label || ''), color: o.color || 'black', dash: o.dash || THEME.arrowDash, size: o.size || 's' }
  if (o.bend != null) props.bend = o.bend
  if (o.labelPosition != null) props.labelPosition = o.labelPosition
  shapes.push({ id, type: 'arrow', props })
  bindings.push({ fromId: id, toId: from, type: 'arrow', props: { terminal: 'start', isExact: false, isPrecise: !!o.precise, normalizedAnchor: o.sa || { x: 0.5, y: 0.5 } } })
  bindings.push({ fromId: id, toId: to,   type: 'arrow', props: { terminal: 'end',   isExact: false, isPrecise: !!o.precise, normalizedAnchor: o.ea || { x: 0.5, y: 0.5 } } })
  return id
}

// Dashed grouping container with a filled, titled header strip (never a bare label on the border).
// Returns { strip, innerX, innerW, bodyTop, close(bottomY) }. Call close() after placing contents.
function container(name, x, y, w, title, o = {}) {
  if (!title || !String(title).trim()) throw new Error('container() requires a label — an unlabeled dashed grouping box should not exist')
  const pad = o.pad != null ? o.pad : 40                  // side padding so nodes never touch walls
  const strip = box(name + '_strip', x + pad, y + 18, w - 2 * pad, 40, o.stripColor || 'grey', title, { fill: 'semi', size: 's' })
  return {
    strip, innerX: x + pad, innerW: w - 2 * pad, bodyTop: y + 74,
    close(bottomY) { return box(name + '_frame', x, y, w, (bottomY + 24) - y, o.color || 'grey', '', { fill: 'none', dash: 'dashed' }) },
  }
}

// Stack equal-width nodes with a consistent gap. items: [{name,h,color,text,o?}].
// Returns { ids:{name->id}, bottom }.
function stack(x, top, w, items, gap = 26) {
  const ids = {}; let y = top
  for (const it of items) { ids[it.name] = box(it.name, x, y, w, it.h, it.color, it.text, it.o || {}); y += it.h + gap }
  return { ids, bottom: y - gap }
}

// Actor glyph (person/system boundary): a circle "head" with a caption underneath.
function actor(name, x, y, label) {
  const id = box(name, x, y, 56, 56, 'black', '', { geo: 'ellipse', fill: 'none' })
  txt(name + '_cap', x - 32, y + 62, label, { size: 's', align: 'middle', w: 120 })
  return id   // the shape id, so arrows can bind to the actor
}

// Bordered legend box with a title and one row per entry. Each row may be a plain string
// (text only) or { color, geo, text } — a color renders an actual swatch (a small filled
// shape, geo defaults to 'rectangle', e.g. 'oval' for a datastore) so the key is visual,
// not just the word "blue". Height is computed from the row count.
function legend(name, x, y, w, rows, o = {}) {
  const padL = 24, padT = 56, rowH = o.rowH || 52, sw = 28
  const h = padT + rows.length * rowH + 4
  const frame = box(name, x, y, w, h, o.color || PAL.neutral, '', { fill: 'none' })
  txt(name + '_ttl', x + padL, y + 16, o.title || 'LEGEND', { size: 's' })
  rows.forEach((r, i) => {
    const ry = y + padT + i * rowH
    if (typeof r === 'string' || !r.color) {
      txt(name + '_r' + i, x + padL, ry, typeof r === 'string' ? r : r.text, { size: 's', w: w - 2 * padL })
    } else {
      box(name + '_sw' + i, x + padL, ry, sw, sw, r.color, '', { geo: r.geo || 'rectangle', fill: 'solid' })
      txt(name + '_rt' + i, x + padL + sw + 14, ry + 2, r.text, { size: 's', w: w - 2 * padL - sw - 14 })
    }
  })
  return frame
}

// Layout linter — scans the current page for the defects that keep recurring, so the verify
// step is deterministic (not just eyeballed). Catches raw-drawn mistakes too, since it reads
// the canvas, not our helper calls. commit() runs it automatically and returns the report.
// Returns { ok, count, issues:[{type, msg, at:[x,y]}] }. Advisory — still look at the screenshot.
function lint() {
  const text = (rt) => { let o = ''; const w = (n) => { if (!n) return; if (typeof n.text === 'string') o += n.text; if (Array.isArray(n.content)) n.content.forEach(w) }; try { w(rt) } catch (e) {} ; return o.trim() }
  const shp = editor.getCurrentPageShapes()
  const bnd = (s) => { const b = editor.getShapePageBounds(s.id); return { x1: b.minX, y1: b.minY, x2: b.maxX, y2: b.maxY, w: b.w, h: b.h } }
  const area = (a, b) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1))
  const isStrip = (s) => String(s.id).includes('_strip')
  const geos = shp.filter(s => s.type === 'geo')
  const frames = geos.filter(s => s.props.dash === 'dashed' && s.props.fill === 'none')   // dashed grouping boxes
  const nodes = geos.filter(s => text(s.props.richText) && !frames.includes(s) && !isStrip(s))
  const issues = []
  const push = (type, b, msg) => issues.push({ type, at: [Math.round(b.x1), Math.round(b.y1)], msg })

  // A. every dashed container must be labeled (own text, or a wide header strip at its top)
  for (const f of frames) {
    const fb = bnd(f)
    if (text(f.props.richText)) continue
    const strip = geos.find(s => { const b = bnd(s); return text(s.props.richText) && b.y1 <= fb.y1 + 40 && b.y1 >= fb.y1 - 6 && (b.x2 - b.x1) > 0.5 * fb.w })
    if (!strip) push('unlabeled-container', fb, 'dashed container has no label — add a titled header strip, or don\'t draw the box')
  }
  // B. a node that's mostly inside a container must not poke past its walls
  for (const f of frames) { const fb = bnd(f)
    for (const n of nodes) { const nb = bnd(n)
      if (area(nb, fb) <= 0.4 * nb.w * nb.h) continue
      const outside = nb.x1 < fb.x1 + 6 || nb.x2 > fb.x2 - 6 || nb.y1 < fb.y1 + 6 || nb.y2 > fb.y2 - 6
      if (outside) push('container-overflow', nb, `"${text(n.props.richText).slice(0, 22)}" pokes outside its container — inset it or widen the container`)
    }
  }
  // C. content boxes must not overlap each other
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = bnd(nodes[i]), b = bnd(nodes[j])
    if (area(a, b) > 100) push('overlap', a, `"${text(nodes[i].props.richText).slice(0, 18)}" overlaps "${text(nodes[j].props.richText).slice(0, 18)}"`)
  }
  // D. adjacent content boxes crammed < 12px apart (bias toward air; the canvas is infinite)
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = bnd(nodes[i]), b = bnd(nodes[j])
    const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1)
    if (ox > 4 && oy <= 0 && Math.abs(oy) < 12) push('crowded', a, 'two boxes are <12px apart vertically — add spacing')
    else if (oy > 4 && ox <= 0 && Math.abs(ox) < 12) push('crowded', a, 'two boxes are <12px apart horizontally — add spacing')
  }
  return { ok: issues.length === 0, count: issues.length, issues }
}

// Flush shapes + bindings to the canvas, then lint. Pass {fit:false} to keep the current camera.
// Returns { shapes, lint } — check lint.issues and fix any before considering the diagram done.
function commit(o = {}) {
  editor.createShapes(shapes)
  editor.createBindings(bindings)
  if (o.fit !== false) editor.zoomToFit()
  return { shapes: editor.getCurrentPageShapes().length, lint: lint() }
}
