// Runnable example — a side-by-side comparison (the comparison archetype). The quality bar.
// Run: cat scripts/helpers.js references/example-comparison.js > /tmp/run.js && scripts/canvas.sh exec /tmp/run.js && scripts/canvas.sh shot
setTheme('cool')
await newPage('Example — comparison')

txt('title', 100, -160, 'Order capture — two designs', { size: 'xl' })
txt('sub', 102, -104, 'Same front door; the options differ in how the payment is captured. Colour: primary = automatic path · accent = where an operator steps in · neutral = passive component.', { size: 's', color: 'grey', w: 1160 })
txt('vs', 640, 360, 'VS', { size: 'xl', color: 'grey' })

// One column: shared front-end, then an "Execution" container of option-specific steps.
const column = (P, cx, headColor, headText, rows) => {
  const nx = cx - 150
  box(P + 'h', cx - 170, -40, 340, 74, headColor, headText)
  const api = box(P + 'api', nx, 96, 300, 64, PAL.neutral, 'API gateway\nauth · validate')
  const svc = box(P + 'svc', nx, 206, 300, 72, PAL.primary, 'Order service\nprice · persist')
  arrow(P + 'e1', api, svc, { label: 'request' })
  const c = container(P + 'c', cx - 190, 326, 380, 'Execution')
  const s = stack(nx, c.bodyTop, 300, rows)
  c.close(s.bottom)
  arrow(P + 'e2', svc, c.strip, { label: 'capture' })
}

column('A', 320, PAL.good, 'OPTION A — synchronous\n✓ simplest · strong consistency', [
  { name: 'A_pay', h: 88, color: PAL.primary, text: 'Payment API\ncaptured inline' },
  { name: 'A_op',  h: 88, color: PAL.accent,  text: 'Operator\nretries hard failures' },
])

column('B', 980, PAL.bad, 'OPTION B — async queue\n✗ eventual · more moving parts', [
  { name: 'B_q',   h: 84, color: PAL.primary, text: 'Queue\ndecouples capture' },
  { name: 'B_w',   h: 84, color: PAL.neutral, text: 'Worker\nsettles out-of-band' },
  { name: 'B_dlq', h: 84, color: PAL.accent,  text: 'Dead-letter\noperator inspects' },
])

legend('lg', 540, 430, 300, [
  { color: PAL.primary, text: 'automatic path' },
  { color: PAL.accent,  text: 'operator steps in' },
  { color: PAL.neutral, text: 'passive component' },
])

commit()
