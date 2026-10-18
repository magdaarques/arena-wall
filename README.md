# Arena VJ Wall · v0.1

An audio-reactive wall of images from an [Are.na](https://www.are.na) channel, made to run inside [Hydra](https://hydra.ojack.xyz) by Olivia Jack.

The wall draws on a hidden canvas that Hydra uses as a video source, so you can keep processing it with Hydra code. You control it from a panel in a separate pop-up window, which keeps the Hydra output clean for capture in Resolume, OBS or a projector.

## Quick start

Paste this into the Hydra editor and run it with **Ctrl+Shift+Enter**:

```js
await loadScript("https://cdn.jsdelivr.net/gh/magdaarques/arena-wall@main/arena_wall.js")
if (!window.arenaCanvas) throw new Error("arena_wall.js didn't load")
s0.init({ src: arenaCanvas, dynamic: true })
src(s0).out()
arenaWall.panel()
```

- If the browser blocks the pop-up panel, allow pop-ups for hydra.ojack.xyz or click the **ARENA** button at the bottom right.
- Press **Ctrl+Shift+H** in Hydra to hide the code before capturing the output.

> Load the file through `cdn.jsdelivr.net/gh/…`, not through a `github.com/…/blob/…` link. A `blob` link is a web page, not the script itself, and Hydra's `loadScript` fails without showing an error.

## What it does

**Images:** loads up to 100 images from an Are.na channel. You can change the channel from the panel or with `arenaWall.load("channel-slug")`.

**Movement modes**
- **sin/cos:** each image orbits around its own point.
- **DVD:** images bounce off the edges.
- **Random:** images glide to new random positions at a set interval.

**Layouts**
- **Free:** images float over the whole screen.
- **Collage:** images fill an irregular grid. The grid is reshuffled with *New collage*.

**Audio modes**
- **Individual:** each image grows and stretches on its own with the sound.
- **Combined:** the whole screen is treated as one image. The sound zooms the wall as a wave that travels across the screen (left to right, from the centre, etc.), and the stretch bends the whole scene.

**Effects**
- **Stretch ("xicle"):** pulls the images like chewing gum with a wavy edge. It can run in four directions.
- **Trail, background colour and blend modes:** normal, multiply, difference and screen.
- **Image looks:** pixelation, contrast, brightness, posterised ink levels, greyscale, duotone and a risograph palette.
- **Presets:** for movement and for looks, plus 8 slots to save your own settings in the browser.

**Audio input:** microphone or sound card input, with gain and smoothing, and five levels: volume, peak, bass, mids and treble. Each effect can follow any of them, or a manual slider. There's also a simulated signal for testing without a microphone.

## Using it from Hydra code

| Code | What it does |
|---|---|
| `arenaWall.panel()` | Opens the control panel, or brings it to the front |
| `arenaWall.load("slug")` | Loads another Are.na channel |
| `arenaWall.set({ scope: "global" })` | Changes any setting from code |
| `arenaWall.level.bass` | Live audio level (0–1): `vol`, `peak`, `bass`, `mid`, `treble` |
| `arenaWall.reshuffle()` | New random positions, or a new collage |
| `arenaWall.stop()` | Stops the wall and releases the microphone |

The wall's audio can also drive Hydra:

```js
src(s0).modulate(noise(3), () => arenaWall.level.bass * 0.3).out()
```

## Panel shortcuts

These work when the panel window is active.

| Key | Action |
|---|---|
| `A` | Individual / combined audio mode |
| `1` `2` `3` | sin/cos · DVD · random movement |
| `L` | Free / collage layout |
| `G` | New collage |
| `E` | Next stretch direction |
| `C` | Clear the canvas |
| `Space` | Reshuffle |

## Notes and known limits

- **Images without CORS permission are skipped.** Hydra can't use the canvas at all if any image on it lacks CORS permission. The panel's status line shows how many images were skipped.
- **The panel text is in Catalan** in this edition.
- **jsDelivr caching:** after you push changes, `@main` can keep serving an old copy for a few hours. To load a new version straight away, replace `@main` with the commit's code (e.g. `@22b0953…`).
- **Performance:** if it runs slowly, lower *Resolució del llenç* (canvas resolution) or *Llesques* (stretch slices) in the panel.
- Developed for Chrome. Other browsers may block pop-ups or microphone access differently.

## Credits

- [Hydra](https://hydra.ojack.xyz) by Olivia Jack
- Images from [Are.na](https://www.are.na)
- Thanks to the community of [SFPC](https://sfpc.study/), and especial mention to [V Buckenham](https://vbuckenham.com/)
- [VT323 Font](https://fonts.google.com/specimen/VT323?preview.script=Latn)
