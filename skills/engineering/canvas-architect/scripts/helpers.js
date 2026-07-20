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

// Flush shapes + bindings to the canvas. Pass {fit:false} to keep the current camera.
function commit(o = {}) {
  editor.createShapes(shapes)
  editor.createBindings(bindings)
  if (o.fit !== false) editor.zoomToFit()
  return { shapes: editor.getCurrentPageShapes().length }
}
