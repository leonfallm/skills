// Runnable example — a layered request flow. Demonstrates the helper primitives.
// Run:  cat helpers.js example-layered.js > /tmp/run.js && canvas.sh exec /tmp/run.js && canvas.sh shot
await newPage('Example — layered flow')

txt('title', 100, -130, 'Example service — request flow', { size: 'xl' })
txt('sub', 102, -74, 'Client → edge → service → data stores. A cache-aside read bypasses the service.', { size: 's', color: 'grey', w: 720 })

const cx = 320, nx = cx - 150                 // column centre; nodes are 300 wide
const client = box('client', nx, 40, 300, 64, 'light-blue', 'Client\nweb · mobile')
const edge   = box('edge',   nx, 160, 300, 64, 'blue', 'API gateway\nauth · rate limit · routing')
const svc    = box('svc',    nx, 280, 300, 84, 'violet', 'Orders service\nvalidate · price · persist')

const c = container('stores', cx - 190, 404, 380, 'Data stores')
const s = stack(nx, c.bodyTop, 300, [
  { name: 'db',    h: 82, color: 'green',  text: 'Postgres\norders ledger — source of truth' },
  { name: 'cache', h: 82, color: 'orange', text: 'Redis\nread cache' },
])
c.close(s.bottom)

arrow('e1', client, edge)
arrow('e2', edge, svc)
arrow('e3', svc, c.strip)
// cache-aside read that skips the service: arc it out into the right margin, distinct style.
// (Note the arrow name 'cacheRead' — it must differ from the 'cache' node's name.)
arrow('cacheRead', edge, s.ids.cache, { precise: true, sa: { x: 1, y: 0.5 }, ea: { x: 1, y: 0.5 }, color: 'orange', dash: 'dashed', bend: -150 })

legend('lg', cx + 320, 300, 360, [
  '→   solid = request path',
  { color: 'orange', text: 'dashed = cache-aside read (skips service)' },
])

commit()
