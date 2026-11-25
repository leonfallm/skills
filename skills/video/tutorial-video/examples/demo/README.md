# Try the whole chain

`app.html` is a made-up team portal ("Harbor") with a sign-in, a few pages and a form. It needs
no account and no network. This walk-through captures "invite a colleague" and renders it with
the storyboard in `video.json`. Run it from the skill folder.

```bash
node scripts/doctor.mjs --install
mkdir -p /tmp/harbor && cp examples/demo/video.json /tmp/harbor/

# 1. open the app and sign in (any e-mail), without recording
node scripts/browser.mjs open --dir /tmp/harbor --url "file://$PWD/examples/demo/app.html" --profile harbor-demo
node scripts/browser.mjs type "#email" "maya@northwind.example" --no-record
node scripts/browser.mjs click "text=Continue" --no-record

# 2. keep the signed-in address out of the picture, then capture the flow
node scripts/browser.mjs mask "maya@northwind.example" "you@northwind.example"
node scripts/browser.mjs click "text=Team"
node scripts/browser.mjs click "#inviteBtn"
node scripts/browser.mjs type "#iname" "Freja Holm"
node scripts/browser.mjs type "#imail" "freja@northwind.example"
node scripts/browser.mjs select "#irole" "Admin"
node scripts/browser.mjs click "#iwelcome"
node scripts/browser.mjs click "#send"
node scripts/browser.mjs ring "tr:last-child" --label "Freja Holm, invited"
node scripts/browser.mjs close

# 3. check, then render
node scripts/render.mjs /tmp/harbor check      # look at /tmp/harbor/check/sheet-*.jpg
node scripts/render.mjs /tmp/harbor render     # -> /tmp/harbor/out/invite-a-colleague.mp4
```

The app remembers the sign-in and the invitation in the browser profile. To start over, use a
new `--profile` name.
