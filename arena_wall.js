/*
  Arena VJ wall · versió per a Hydra (hydra.ojack.xyz)

  Ús dins de l'editor de Hydra:

    await loadScript("https://EL-TEU-HOST/arena-wall.js")
    s0.init({ src: arenaCanvas, dynamic: true })
    src(s0).out()

  - El mur es dibuixa en un llenç ocult (arenaCanvas) que Hydra fa servir com a textura.
  - El panell de control s'obri en una finestra emergent. Si el navegador la bloqueja,
    apareix un botó «ARENA» a la cantonada de Hydra: fes-hi clic per obrir-la.
  - Tornar a executar el codi de Hydra no crea còpies: el mur només s'inicia una vegada.

  Funcions disponibles des de Hydra:
    arenaWall.panel()            obri (o porta al davant) el panell
    arenaWall.load("canal")      carrega un altre canal d'Are.na (el «slug» de la URL)
    arenaWall.set({ ... })       canvia paràmetres des del codi, p. ex. arenaWall.set({ scope: "global" })
    arenaWall.state              l'estat complet (es pot llegir des de Hydra, p. ex. () => arenaWall.level.bass)
    arenaWall.level              nivells d'àudio en directe: vol, peak, bass, mid, treble (0..1)
    arenaWall.stop()             atura el mur i allibera el micròfon
*/
(function () {
  if (window.arenaWall && window.arenaWall.running) {
    // ja està en marxa: no dupliquem res, només tornem a exposar el llenç
    window.arenaCanvas = window.arenaWall.canvas;
    return;
  }

  const DEFAULT_CHANNEL = window.ARENA_CHANNEL || "ddbb-of-social-manifestations";
  const imageObjects = [];

  /* ---------------------------------------------------------------- estat */
  const DEFAULTS = {
    mode: "sin",
    // moviment
    amp: 1.5, freq: 1, dvdSpeed: 150, interval: 600, ease: 0.8,
    // àudio
    gain: 3, smooth: 0.5, sim: true,
    // mode d'àudio: "single" (cada imatge per separat) o "global" (el conjunt com una sola imatge)
    scope: "single",
    gSweep: "lr", gDelay: 0.6, gZoomMin: 0.9, gZoomMax: 1.4, gBase: 1, gStrips: 48,
    // mapatge tamany / velocitat
    sizeSrc: "vol", sizeMin: 0.6, sizeMax: 2.2, sizeLevel: 0.3,
    speedSrc: "bass", speedMin: 0.3, speedMax: 3, speedLevel: 0.3,
    // disposició: "free" (flotant) o "collage" (grid irregular)
    layout: "free", cCount: 12, cGap: 4, cIrreg: 0.6, cPulse: 0.3, cSeed: 1,
    // estirament (xicle)
    stretchDir: "none",
    stretchSrc: "bass", stretchMin: 0.1, stretchMax: 1, stretchLevel: 0.5,
    pivot: 0.25, pivotTravel: 0.2,
    waveAmp: 0.25, waveFreq: 2, slices: 40,
    // fons i superposició
    trail: 0, bg: "#ffffff", blend: "source-over",
    // imatge
    pixel: 0, contrast: 1, bright: 0, levels: 0, tint: "color",
    colA: "#101010", colB: "#ff3d2e",
    // resolució del llenç respecte a la finestra (1 = mateixa mida que Hydra)
    res: 1,
  };
  const S = { ...DEFAULTS };

  const SOURCES = [
    ["manual", "Manual"], ["vol", "Volum (RMS)"], ["peak", "Pic"],
    ["bass", "Greus"], ["mid", "Mitjos"], ["treble", "Aguts"],
  ];

  const PRESETS = [
    { name: "Respira", set: { mode: "sin", amp: 1.5, freq: 0.8, sizeSrc: "vol", sizeMin: 0.7, sizeMax: 1.8, speedSrc: "bass", speedMin: 0.3, speedMax: 1.5 } },
    { name: "Òrbita ràpida", set: { mode: "sin", amp: 3, freq: 1.6, sizeSrc: "mid", sizeMin: 0.5, sizeMax: 2.5, speedSrc: "peak", speedMin: 0.5, speedMax: 4 } },
    { name: "DVD", set: { mode: "dvd", dvdSpeed: 150, sizeSrc: "vol", sizeMin: 0.8, sizeMax: 1.8, speedSrc: "bass", speedMin: 0.4, speedMax: 3 } },
    { name: "DVD frenètic", set: { mode: "dvd", dvdSpeed: 260, sizeSrc: "bass", sizeMin: 0.5, sizeMax: 2.5, speedSrc: "peak", speedMin: 1, speedMax: 6 } },
    { name: "Aleatori suau", set: { mode: "random", interval: 1500, ease: 0.6, sizeSrc: "vol", sizeMin: 0.7, sizeMax: 1.6, speedSrc: "mid", speedMin: 0.3, speedMax: 1.5 } },
    { name: "Caos", set: { mode: "random", interval: 250, ease: 2.5, sizeSrc: "peak", sizeMin: 0.4, sizeMax: 3, speedSrc: "treble", speedMin: 1, speedMax: 6 } },
    { name: "Onada conjunt →", set: { scope: "global", gSweep: "lr", gDelay: 0.8, gZoomMin: 0.85, gZoomMax: 1.6, sizeSrc: "bass" } },
    { name: "Batec des del centre", set: { scope: "global", gSweep: "center", gDelay: 0.5, gZoomMin: 0.95, gZoomMax: 1.5, sizeSrc: "peak" } },
  ];

  const LOOKS = [
    { name: "Net", set: { trail: 0, pixel: 0, contrast: 1, bright: 0, levels: 0, tint: "color", blend: "source-over", stretchDir: "none" } },
    { name: "Rastre", set: { trail: 0.92, pixel: 0, contrast: 1, bright: 0, levels: 0, tint: "color", blend: "source-over" } },
    { name: "Risograph", set: { trail: 0.8, pixel: 45, contrast: 2, bright: 0, levels: 4, tint: "riso", blend: "multiply" } },
    { name: "Tinta plana", set: { trail: 0.6, pixel: 60, contrast: 2.5, bright: 0, levels: 2, tint: "duo", blend: "multiply" } },
    { name: "Pixel color", set: { trail: 0, pixel: 70, contrast: 1.4, bright: 0, levels: 5, tint: "color", blend: "source-over" } },
    { name: "Xicle vertical", set: { stretchDir: "down", stretchSrc: "bass", stretchMin: 0.1, stretchMax: 1, waveAmp: 0.25, waveFreq: 2, pivot: 0.25, pivotTravel: 0.2 } },
    { name: "Xicle horitzontal", set: { stretchDir: "left", stretchSrc: "bass", stretchMin: 0.1, stretchMax: 1, waveAmp: 0.25, waveFreq: 2, pivot: 0.25, pivotTravel: 0.2 } },
  ];

  /* ---------------------------------------------------------------- utils */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const RISO = ["#14142b", "#2a3fd8", "#ff3d9a", "#ffe14d", "#fffdf5"].map(hex);

  /* ---------------------------------------------------------------- llenços (ocults) */
  // cv és el llenç que veu Hydra. No s'afegeix a la pàgina: Hydra el llegeix com a textura.
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d");
  // llenços per al mode conjunt: tota l'escena es dibuixa ací i després es deforma sencera
  const scene = document.createElement("canvas");
  const sctx = scene.getContext("2d");
  const scene2 = document.createElement("canvas");
  const s2ctx = scene2.getContext("2d");
  let dpr = 1;
  // mida lògica (en píxels CSS) del mur: segueix la finestra de Hydra
  let VW = window.innerWidth, VH = window.innerHeight;
  let lastRes = S.res;
  function resize() {
    VW = window.innerWidth;
    VH = window.innerHeight;
    dpr = S.res;
    lastRes = S.res;
    cv.width = scene.width = scene2.width = Math.max(2, Math.round(VW * dpr));
    cv.height = scene.height = scene2.height = Math.max(2, Math.round(VH * dpr));
    clearCanvas();
  }
  function clearCanvas() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = S.bg;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  window.addEventListener("resize", resize);

  /* ---------------------------------------------------------------- àudio */
  const audio = {
    ctx: null, stream: null, analyser: null, gainNode: null, td: null, fd: null,
    level: { vol: 0, peak: 0, bass: 0, mid: 0, treble: 0 },
  };

  async function startAudio(deviceId) {
    stopAudio();
    setStatus("Demanant accés al micròfon… (el permís apareix a la pestanya de Hydra)");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        },
      });
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") await actx.resume();
      const src = actx.createMediaStreamSource(stream);
      const gainNode = actx.createGain();
      const analyser = actx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.5;
      src.connect(gainNode);
      gainNode.connect(analyser); // no el connectem a la sortida: evita retorn
      Object.assign(audio, {
        ctx: actx, stream, analyser, gainNode,
        td: new Uint8Array(analyser.fftSize),
        fd: new Uint8Array(analyser.frequencyBinCount),
      });
      S.sim = false;
      syncUI();
      setStatus("Entrada activa: " + (stream.getAudioTracks()[0]?.label || "micròfon"));
      fillDevices(stream.getAudioTracks()[0]?.getSettings().deviceId);
    } catch (err) {
      setStatus("No s'ha pogut accedir a l'àudio: " + err.message);
    }
  }

  function stopAudio() {
    if (audio.stream) audio.stream.getTracks().forEach((t) => t.stop());
    if (audio.ctx) audio.ctx.close();
    audio.ctx = audio.stream = audio.analyser = audio.gainNode = null;
  }

  async function fillDevices(currentId) {
    const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
    devSel.innerHTML = "";
    list.forEach((d, i) => {
      const o = el("option", null, d.label || "Entrada " + (i + 1));
      o.value = d.deviceId;
      if (d.deviceId === currentId) o.selected = true;
      devSel.appendChild(o);
    });
  }

  function updateAudio(t) {
    let raw;
    if (audio.analyser && !S.sim) {
      audio.gainNode.gain.value = S.gain;
      audio.analyser.getByteTimeDomainData(audio.td);
      let sum = 0, pk = 0;
      for (let i = 0; i < audio.td.length; i++) {
        const x = (audio.td[i] - 128) / 128;
        sum += x * x;
        if (Math.abs(x) > pk) pk = Math.abs(x);
      }
      const rms = Math.sqrt(sum / audio.td.length);
      audio.analyser.getByteFrequencyData(audio.fd);
      const bw = audio.ctx.sampleRate / audio.analyser.fftSize;
      const band = (f1, f2) => {
        const a = Math.floor(f1 / bw), b = Math.min(audio.fd.length - 1, Math.ceil(f2 / bw));
        let s = 0, n = 0;
        for (let i = a; i <= b; i++) { s += audio.fd[i]; n++; }
        return n ? s / n / 255 : 0;
      };
      raw = {
        vol: clamp(rms * 3, 0, 1), peak: clamp(pk, 0, 1),
        bass: band(20, 250), mid: band(250, 2000), treble: band(2000, 8000),
      };
    } else {
      // senyal sintètic per provar sense micro
      const g = S.gain / 3;
      const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 4)), 6);
      raw = {
        vol: clamp((0.3 + 0.2 * Math.sin(t * 0.9) + 0.4 * beat) * g, 0, 1),
        peak: clamp(beat * g, 0, 1),
        bass: clamp((0.15 + 0.85 * beat) * g, 0, 1),
        mid: clamp((0.45 + 0.4 * Math.sin(t * 1.7)) * g, 0, 1),
        treble: clamp((0.4 + 0.4 * Math.sin(t * 3.1) * Math.sin(t * 0.7)) * g, 0, 1),
      };
    }
    const attack = 0.6;
    const release = 0.02 + (1 - S.smooth) * 0.4;
    for (const k in raw) {
      const cur = audio.level[k];
      audio.level[k] = cur + (raw[k] - cur) * (raw[k] > cur ? attack : release);
    }
  }

  function level(src, manual) {
    return src === "manual" ? manual : audio.level[src];
  }

  /*
    Historial dels nivells (últims 4 s) per al mode conjunt: cada zona de la pantalla llegeix
    l'àudio amb un retard segons la seua posició, i el so recorre el viewport com una onada.
  */
  const hist = [];
  function recordLevels(t) {
    hist.push({ t, l: { ...audio.level } });
    while (hist.length > 2 && hist[0].t < t - 4) hist.shift();
  }
  function levelAt(src, delay, manual) {
    if (src === "manual") return manual;
    if (!hist.length || delay <= 0) return audio.level[src];
    const target = hist[hist.length - 1].t - delay;
    if (hist[0].t >= target) return hist[0].l[src];
    let lo = 0, hi = hist.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (hist[mid].t <= target) lo = mid; else hi = mid - 1;
    }
    return hist[lo].l[src];
  }

  /* ---------------------------------------------------------------- processat d'imatge */
  let sigVersion = 0, lastSig = "";
  let needsProc = false;

  function makeRamp() {
    const stops = S.tint === "gray" ? [[0, 0, 0], [255, 255, 255]]
      : S.tint === "duo" ? [hex(S.colA), hex(S.colB)] : RISO;
    const lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const p = (i / 255) * (stops.length - 1);
      const a = Math.min(stops.length - 2, Math.floor(p));
      const f = p - a;
      for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(lerp(stops[a][c], stops[a + 1][c], f));
    }
    return lut;
  }

  function processImage(o) {
    const nw = o.img.naturalWidth, nh = o.img.naturalHeight;
    if (!nw || !nh) return;
    const cols = Math.round(160 * Math.pow(5 / 160, S.pixel / 100));
    const ww = Math.max(2, S.pixel > 0 ? cols : Math.min(nw, 240));
    const wh = Math.max(2, Math.round((ww * nh) / nw));
    const c = o.pc || (o.pc = document.createElement("canvas"));
    c.width = ww; c.height = wh;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(o.img, 0, 0, ww, wh);

    try {
      const id = g.getImageData(0, 0, ww, wh);
      const d = id.data;
      const k = S.contrast, b = S.bright;
      const L = S.levels >= 2 ? S.levels : S.levels === 1 ? 2 : 0;
      const lut = S.tint !== "color" ? makeRamp() : null;
      for (let i = 0; i < d.length; i += 4) {
        let r = (d[i] - 128) * k + 128 + b;
        let gc = (d[i + 1] - 128) * k + 128 + b;
        let bl = (d[i + 2] - 128) * k + 128 + b;
        if (!lut) {
          if (L) {
            const q = L - 1;
            r = (Math.round((clamp(r, 0, 255) / 255) * q) / q) * 255;
            gc = (Math.round((clamp(gc, 0, 255) / 255) * q) / q) * 255;
            bl = (Math.round((clamp(bl, 0, 255) / 255) * q) / q) * 255;
          }
          d[i] = r; d[i + 1] = gc; d[i + 2] = bl;
        } else {
          let lum = clamp((0.299 * r + 0.587 * gc + 0.114 * bl) / 255, 0, 1);
          if (L) lum = Math.min(L - 1, Math.floor(lum * L)) / (L - 1);
          const j = Math.round(lum * 255) * 3;
          d[i] = lut[j]; d[i + 1] = lut[j + 1]; d[i + 2] = lut[j + 2];
        }
      }
      g.putImageData(id, 0, 0);
    } catch (e) {
      // no hauria de passar (només carreguem imatges amb CORS); si passa, deixem d'usar-la
      o.loaded = false;
      o.failed = true;
    }
  }

  /* ---------------------------------------------------------------- moviment */
  let rndTimer = 0;

  function randomDirection(o) {
    const a = ((20 + Math.random() * 50) * Math.PI) / 180;
    o.vx = Math.cos(a) * (Math.random() > 0.5 ? 1 : -1);
    o.vy = Math.sin(a) * (Math.random() > 0.5 ? 1 : -1);
  }

  function setMode(m) {
    S.mode = m;
    imageObjects.forEach((o) => {
      if (m === "sin") {
        o.hx = o.x - Math.sin(o.t + o.phase) * o.ampX * S.amp;
        o.hy = o.y - Math.cos(o.t + o.phase) * o.ampY * S.amp;
      } else if (m === "dvd") {
        randomDirection(o);
      } else {
        o.tx = o.x; o.ty = o.y;
      }
    });
    rndTimer = 0;
    syncUI();
  }

  function reshufflePositions() {
    if (S.layout === "collage") { S.cSeed++; return; } // nou collage
    imageObjects.forEach((o) => {
      const nx = Math.random() * VW, ny = Math.random() * VH;
      if (S.mode === "sin") { o.hx = nx; o.hy = ny; }
      else if (S.mode === "dvd") { o.x = nx; o.y = ny; randomDirection(o); }
      else { o.tx = nx; o.ty = ny; }
    });
  }

  function step(o, dt, speedMul, W, H) {
    o.t += dt * speedMul * S.freq * 0.8;
    if (S.mode === "sin") {
      o.x = o.hx + Math.sin(o.t + o.phase) * o.ampX * S.amp;
      o.y = o.hy + Math.cos(o.t + o.phase) * o.ampY * S.amp;
    } else if (S.mode === "dvd") {
      const sp = S.dvdSpeed * speedMul;
      o.x += o.vx * sp * dt;
      o.y += o.vy * sp * dt;
      const hw = (o.w0 * o.s) / 2, hh = (o.h0 * o.s) / 2;
      if (o.x < hw) { o.x = hw; o.vx = Math.abs(o.vx); }
      else if (o.x > W - hw) { o.x = W - hw; o.vx = -Math.abs(o.vx); }
      if (o.y < hh) { o.y = hh; o.vy = Math.abs(o.vy); }
      else if (o.y > H - hh) { o.y = H - hh; o.vy = -Math.abs(o.vy); }
    } else {
      const k = 1 - Math.exp(-dt * S.ease * speedMul);
      o.x += (o.tx - o.x) * k;
      o.y += (o.ty - o.y) * k;
    }
  }

  /* ---------------------------------------------------------------- estirament (xicle) */
  /*
    La imatge es dibuixa en llesques. A partir d'un punt (pivot) les llesques llegeixen cada
    cop menys imatge font, i els píxels s'allarguen cap al final com un xicle; cada llesca es
    desplaça de costat amb una ona que creix amb la distància al pivot.
    "g" és el context on es dibuixa (el llenç final o l'escena del mode conjunt).
  */
  function drawStretched(o, src, dir, s, dw, dh, crop, ext, g) {
    const vert = dir === "down" || dir === "up";
    const rev = dir === "up" || dir === "left";
    const sw = crop.w, sh = crop.h, ox = crop.x, oy = crop.y;
    const len = vert ? dh : dw;
    const cross = vert ? dw : dh;
    const slen = vert ? sh : sw;
    const D = len * (1 + ext * s);
    const p = clamp(S.pivot + S.pivotTravel * Math.sin(o.t * 0.6 + o.phase), 0.02, 0.95);
    const gamma = 1 + s * 4;
    const U = (t) => (t <= p ? t : p + (1 - p) * Math.pow((t - p) / (1 - p), gamma));
    const N = Math.max(8, Math.round(S.slices));

    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N;
      const u0 = U(t0), u1 = U(t1);
      let sl = Math.max(0.5, (u1 - u0) * slen);
      let sp = (rev ? 1 - u1 : u0) * slen;
      if (sp + sl > slen) sp = slen - sl;
      if (sp < 0) sp = 0;

      const d0 = rev ? len / 2 - t1 * D : -len / 2 + t0 * D;
      const dl = (t1 - t0) * D + 0.6;

      const tm = (t0 + t1) / 2;
      let off = 0;
      if (tm > p) {
        const w = (tm - p) / (1 - p);
        off = Math.sin(tm * S.waveFreq * Math.PI * 2 + o.t * 2 + o.phase) * S.waveAmp * cross * s * w;
      }

      if (vert) g.drawImage(src, ox, oy + sp, sw, sl, -cross / 2 + off, d0, cross, dl);
      else g.drawImage(src, ox + sp, oy, sl, sh, d0, -cross / 2 + off, dl, cross);
    }
  }

  /* ---------------------------------------------------------------- collage (grid irregular) */
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let lastLayout = S.layout, lastCollageSig = "";

  function buildCollage() {
    const rnd = mulberry(S.cSeed * 9973 + 17);
    const W = VW, H = VH, g = S.cGap;
    const order = imageObjects.filter((o) => o.loaded);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const n = Math.min(Math.round(S.cCount), order.length);
    imageObjects.forEach((o) => { o.cell = null; });
    if (!n) return;

    const ir = S.cIrreg;
    const cells = [{ x: g / 2, y: g / 2, w: W - g, h: H - g }];
    while (cells.length < n) {
      let bi = 0, bw = -1;
      cells.forEach((c, i) => {
        const w = c.w * c.h * (1 - ir * 0.8 + ir * 0.8 * rnd());
        if (w > bw) { bw = w; bi = i; }
      });
      const c = cells[bi];
      const vertical = c.w > c.h * 1.25 ? true : c.h > c.w * 1.25 ? false : rnd() < 0.5;
      const r = clamp(0.5 + (rnd() - 0.5) * ir * 0.9, 0.2, 0.8);
      if (vertical) {
        cells.splice(bi, 1,
          { x: c.x, y: c.y, w: c.w * r, h: c.h },
          { x: c.x + c.w * r, y: c.y, w: c.w * (1 - r), h: c.h });
      } else {
        cells.splice(bi, 1,
          { x: c.x, y: c.y, w: c.w, h: c.h * r },
          { x: c.x, y: c.y + c.h * r, w: c.w, h: c.h * (1 - r) });
      }
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    cells.forEach((c, i) => {
      const o = order[i];
      const w = Math.max(4, c.w - g), h = Math.max(4, c.h - g);
      o.cell = { cx: c.x + c.w / 2, cy: c.y + c.h / 2, w, h };
      if (o.cw == null) { o.cw = o.w0; o.ch = o.h0; }
    });
  }

  /* ---------------------------------------------------------------- dibuix */
  function drawImages(g, perImageFx) {
    g.imageSmoothingEnabled = S.pixel === 0;
    g.globalCompositeOperation = S.blend;
    const dir = S.stretchDir;
    const s = !perImageFx || dir === "none" ? 0 : clamp(lerp(S.stretchMin, S.stretchMax, level(S.stretchSrc, S.stretchLevel)), 0, 1);
    const col = S.layout === "collage";
    const lv = perImageFx ? level(S.sizeSrc, S.sizeLevel) : 0;
    for (const o of imageObjects) {
      if (!o.loaded) continue;
      if (col && !o.cell) continue;
      const src = needsProc && o.pc ? o.pc : o.img;
      const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
      if (!sw || !sh) continue;
      g.setTransform(dpr * o.s, 0, 0, dpr * o.s, o.x * dpr, o.y * dpr);
      let dw = o.w0, dh = o.h0, crop = { x: 0, y: 0, w: sw, h: sh };
      if (col) {
        dw = o.cw; dh = o.ch;
        const ca = dw / dh, ia = sw / sh;
        let cw = sw, ch = sh;
        if (ia > ca) cw = sh * ca; else ch = sw / ca;
        const z = 1 + S.cPulse * lv;
        cw /= z; ch /= z;
        crop = { x: (sw - cw) / 2, y: (sh - ch) / 2, w: cw, h: ch };
        g.save();
        g.beginPath();
        g.rect(-dw / 2, -dh / 2, dw, dh);
        g.clip();
      }
      if (s < 0.01) g.drawImage(src, crop.x, crop.y, crop.w, crop.h, -dw / 2, -dh / 2, dw, dh);
      else drawStretched(o, src, dir, s, dw, dh, crop, col ? 0 : 0.5, g);
      if (col) g.restore();
    }
    g.globalCompositeOperation = "source-over";
  }

  /* ---------------------------------------------------------------- mode conjunt */
  const GLOBAL_OBJ = { t: 0, phase: 0 };

  function sweepFrac(t) {
    switch (S.gSweep) {
      case "lr": case "tb": return t;
      case "rl": case "bt": return 1 - t;
      case "center": return Math.abs(t - 0.5) * 2;
      case "edges": return 1 - Math.abs(t - 0.5) * 2;
      default: return 0;
    }
  }

  // l'escena es talla en franges; cada franja s'escala amb l'àudio amb un retard segons la posició
  function drawZoomStrips(g, src) {
    const W = src.width, H = src.height;
    const N = Math.max(4, Math.round(S.gStrips));
    const horiz = S.gSweep === "tb" || S.gSweep === "bt";
    const len = horiz ? H : W, cross = horiz ? W : H;
    const seg = len / N;
    const f = new Array(N);
    let total = 0;
    for (let i = 0; i < N; i++) {
      const delay = sweepFrac((i + 0.5) / N) * S.gDelay;
      f[i] = lerp(S.gZoomMin, S.gZoomMax, levelAt(S.sizeSrc, delay, S.sizeLevel));
      total += seg * f[i];
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    let pos = len / 2 - total / 2;
    for (let i = 0; i < N; i++) {
      const out = seg * f[i], c = cross * f[i];
      if (!horiz) g.drawImage(src, i * seg, 0, seg, H, pos, H / 2 - c / 2, out + 1, c);
      else g.drawImage(src, 0, i * seg, W, seg, W / 2 - c / 2, pos, c, out + 1);
      pos += out;
    }
  }

  function composeGlobal() {
    const dir = S.stretchDir;
    const s = dir === "none" ? 0 : clamp(lerp(S.stretchMin, S.stretchMax, level(S.stretchSrc, S.stretchLevel)), 0, 1);
    const zoomOn = !(S.gZoomMin === 1 && S.gZoomMax === 1);
    ctx.imageSmoothingEnabled = S.pixel === 0;
    if (s >= 0.01) {
      let src = scene;
      if (zoomOn) {
        s2ctx.setTransform(1, 0, 0, 1, 0, 0);
        s2ctx.clearRect(0, 0, scene2.width, scene2.height);
        s2ctx.imageSmoothingEnabled = S.pixel === 0;
        drawZoomStrips(s2ctx, scene);
        src = scene2;
      }
      ctx.globalCompositeOperation = S.blend;
      ctx.setTransform(1, 0, 0, 1, cv.width / 2, cv.height / 2);
      drawStretched(GLOBAL_OBJ, src, dir, s, cv.width, cv.height,
        { x: 0, y: 0, w: src.width, h: src.height }, 0, ctx);
    } else {
      ctx.globalCompositeOperation = S.blend;
      if (zoomOn) drawZoomStrips(ctx, scene);
      else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(scene, 0, 0); }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  let last = performance.now();
  let frameCount = 0;
  let rafId = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (S.res !== lastRes) resize();
    updateAudio(now / 1000);
    recordLevels(now / 1000);
    updateMeters();

    const W = VW, H = VH;
    const global = S.scope === "global";

    const sig = [S.pixel, S.contrast, S.bright, S.levels, S.tint, S.colA, S.colB].join("|");
    if (sig !== lastSig) { lastSig = sig; sigVersion++; }
    needsProc = S.pixel > 0 || S.contrast !== 1 || S.bright !== 0 || S.levels > 0 || S.tint !== "color";

    const sizeMul = lerp(S.sizeMin, S.sizeMax, level(S.sizeSrc, S.sizeLevel));
    const speedMul = lerp(S.speedMin, S.speedMax, level(S.speedSrc, S.speedLevel));
    GLOBAL_OBJ.t += dt * speedMul * S.freq * 0.8;

    if (S.mode === "random") {
      rndTimer += dt * 1000;
      if (rndTimer >= S.interval) {
        rndTimer = 0;
        imageObjects.forEach((o) => { o.tx = Math.random() * W; o.ty = Math.random() * H; });
      }
    }

    if (S.layout !== lastLayout) {
      lastLayout = S.layout;
      if (S.layout !== "collage") setMode(S.mode);
    }
    if (S.layout === "collage") {
      const loadedN = imageObjects.reduce((a, o) => a + (o.loaded ? 1 : 0), 0);
      const csig = [S.cCount, S.cGap, S.cIrreg, S.cSeed, W, H, loadedN, loadGen].join("|");
      if (csig !== lastCollageSig) { lastCollageSig = csig; buildCollage(); }
      const k = 1 - Math.exp(-dt * 6);
      for (const o of imageObjects) {
        o.s = 1;
        o.t += dt * speedMul * S.freq * 0.8;
        if (!o.cell) continue;
        o.x += (o.cell.cx - o.x) * k;
        o.y += (o.cell.cy - o.y) * k;
        o.cw += (o.cell.w - o.cw) * k;
        o.ch += (o.cell.h - o.ch) * k;
      }
    } else {
      const s = global ? S.gBase : sizeMul;
      for (const o of imageObjects) { o.s = s; step(o, dt, speedMul, W, H); }
    }

    if (needsProc) {
      const t0 = performance.now();
      for (const o of imageObjects) {
        if (o.loaded && o.ver !== sigVersion) {
          processImage(o);
          o.ver = sigVersion;
          if (performance.now() - t0 > 6) break;
        }
      }
    }

    // fons / rastre
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = S.bg;
    if (S.trail < 0.005) {
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, cv.width, cv.height);
    } else if (S.trail < 0.995) {
      const a = 1 - S.trail;
      const N = Math.min(6, Math.max(1, Math.floor(0.1 / a)));
      frameCount++;
      if (frameCount % N === 0) {
        ctx.globalAlpha = 1 - Math.pow(1 - a, N);
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.globalAlpha = 1;
      }
    }

    if (global) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = "source-over";
      sctx.clearRect(0, 0, scene.width, scene.height);
      drawImages(sctx, false);
      composeGlobal();
    } else {
      drawImages(ctx, true);
    }
    rafId = requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- imatges (Are.na) */
  /*
    Hydra usa el llenç com a textura WebGL: si una sola imatge no permet CORS, el navegador
    bloqueja tot el llenç. Per això només es fan servir imatges que carreguen amb CORS;
    les altres s'ometen (i es compten a l'estat del panell).
  */
  let channel = DEFAULT_CHANNEL;
  let loadGen = 0;

  async function loadChannel(slug) {
    channel = (slug || channel).trim();
    if (chanInput) chanInput.value = channel;
    const gen = ++loadGen;
    imageObjects.length = 0;
    setStatus(`Carregant «${channel}»…`);
    try {
      const response = await fetch(`https://api.are.na/v2/channels/${encodeURIComponent(channel)}?per=100`);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (gen !== loadGen) return;
      const blocks = data.contents.filter((b) => b.class === "Image" && b.image);
      let ok = 0, failed = 0;
      const report = () => {
        if (gen !== loadGen) return;
        const msg = `«${channel}»: ${ok} imatges` + (failed ? ` · ${failed} omeses (sense CORS)` : "") +
          (ok + failed < blocks.length ? ` · carregant ${blocks.length - ok - failed}…` : ".");
        setStatus(msg);
      };

      blocks.forEach((block) => {
        const base = 80 + Math.random() * 200;
        const url = block.image.display.url;
        const img = new Image();
        const x = Math.random() * VW;
        const y = Math.random() * VH;
        const o = {
          img, base, loaded: false, failed: false, ver: -1, pc: null,
          x, y, hx: x, hy: y, tx: x, ty: y, vx: 0, vy: 0,
          w0: base, h0: base, s: 1, t: Math.random() * 100,
          ampX: (50 + Math.random() * 50) * (Math.random() > 0.5 ? 1 : -1),
          ampY: (50 + Math.random() * 50) * (Math.random() > 0.5 ? 1 : -1),
          phase: Math.random() * Math.PI * 2,
        };
        randomDirection(o);

        img.crossOrigin = "anonymous";
        img.onload = () => {
          o.h0 = (base * img.naturalHeight) / img.naturalWidth;
          o.loaded = true;
          ok++;
          report();
        };
        img.onerror = () => { o.failed = true; failed++; report(); };
        img.src = url;
        imageObjects.push(o);
      });
      report();
    } catch (err) {
      if (gen === loadGen) setStatus("Error carregant Are.na: " + err.message);
    }
  }

  /* ---------------------------------------------------------------- panell (finestra emergent) */
  const CSS = `
    html, body { margin: 0; background: #fff; font-family: monospace; }
    #panel { box-sizing: border-box; padding: 12px 12px 24px; font-size: 11px; color: #000; }
    #panel h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; margin: 18px 0 8px;
      border-bottom: 1px solid #000; padding-bottom: 3px; }
    #panel h3 { font-size: 11px; font-weight: normal; opacity: .6; margin: 10px 0 2px; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; margin: 7px 0; align-items: center; }
    .row input[type=range] { grid-column: 1 / -1; width: 100%; margin: 0; accent-color: #000; }
    .row output { opacity: .6; }
    .row.inline { grid-template-columns: auto 1fr; justify-content: start; }
    input[type=color] { width: 34px; height: 20px; padding: 0; border: 1px solid #000; background: #fff; }
    input[type=text] { width: 100%; box-sizing: border-box; font: 11px monospace; border: 1px solid #000; padding: 4px; }
    select { width: 100%; font: 11px monospace; border: 1px solid #000; background: #fff; padding: 3px; margin: 2px 0 4px; }
    .btns { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
    button.b { font: 11px monospace; border: 1px solid #000; background: #fff; padding: 4px 7px; cursor: pointer; }
    button.b:hover { background: #eee; }
    button.b.on { background: #000; color: #fff; }
    .meter { display: grid; grid-template-columns: 44px 1fr; align-items: center; margin: 3px 0; }
    .meter div.bar { height: 6px; background: #eee; }
    .meter div.bar i { display: block; height: 100%; width: 0; background: #000; }
    #status { opacity: .7; margin: 10px 0 6px; line-height: 1.4; border-top: 1px solid #000; padding-top: 8px; }
    .hint, .note { opacity: .55; line-height: 1.4; }
    .hint { margin-top: 14px; }
    .note { margin: 4px 0 8px; }
  `;

  const panel = el("div");
  panel.id = "panel";
  const syncFns = [];
  function syncUI() { syncFns.forEach((f) => f()); }
  let statusEl = null, lastStatus = "";
  function setStatus(msg) { lastStatus = msg; if (statusEl) statusEl.textContent = msg; }

  function section(title) {
    panel.appendChild(el("h2", null, title));
    const box = el("div");
    panel.appendChild(box);
    return box;
  }

  function addSlider(parent, key, label, min, max, step) {
    const row = el("label", "row");
    const out = el("output");
    const input = el("input");
    input.type = "range"; input.min = min; input.max = max; input.step = step;
    const fmt = (v) => (step < 1 ? (+v).toFixed(step < 0.1 ? 2 : 1) : Math.round(v));
    input.oninput = () => { S[key] = parseFloat(input.value); out.textContent = fmt(S[key]); };
    row.append(el("span", null, label), out, input);
    parent.appendChild(row);
    syncFns.push(() => { input.value = S[key]; out.textContent = fmt(S[key]); });
  }

  function addSelect(parent, key, label, options, onChange) {
    parent.appendChild(el("div", null, label));
    const sel = el("select");
    options.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.appendChild(o); });
    sel.onchange = () => { S[key] = sel.value; if (onChange) onChange(); };
    parent.appendChild(sel);
    syncFns.push(() => { sel.value = S[key]; });
  }

  function addCheck(parent, key, label, onChange) {
    const row = el("label", "row inline");
    const c = el("input"); c.type = "checkbox";
    c.onchange = () => { S[key] = c.checked; if (onChange) onChange(); };
    row.append(c, el("span", null, label));
    parent.appendChild(row);
    syncFns.push(() => { c.checked = S[key]; });
  }

  function addColor(parent, key, label) {
    const row = el("label", "row inline");
    const c = el("input"); c.type = "color";
    c.oninput = () => { S[key] = c.value; };
    row.append(c, el("span", null, label));
    parent.appendChild(row);
    syncFns.push(() => { c.value = S[key]; });
  }

  function addButton(parent, text, fn) {
    const b = el("button", "b", text);
    b.onclick = fn;
    parent.appendChild(b);
    return b;
  }

  function applySet(set) {
    const wasSim = S.sim;
    Object.assign(S, set);
    S.sim = wasSim;
    setMode(S.mode);
  }

  const STRETCH_DIRS = [
    ["none", "Sense estirament"],
    ["down", "De dalt a baix"],
    ["up", "De baix a dalt"],
    ["right", "D'esquerra a dreta"],
    ["left", "De dreta a esquerra"],
  ];

  /* --- Canal d'Are.na */
  let box = section("Canal d'Are.na");
  const chanInput = el("input");
  chanInput.type = "text";
  chanInput.value = channel;
  chanInput.placeholder = "slug del canal (p. ex. ddbb-of-social-manifestations)";
  chanInput.onkeydown = (e) => { if (e.key === "Enter") loadChannel(chanInput.value); e.stopPropagation(); };
  box.appendChild(chanInput);
  const chanBtns = el("div", "btns");
  addButton(chanBtns, "Carrega el canal", () => loadChannel(chanInput.value));
  box.appendChild(chanBtns);
  addSlider(box, "res", "Resolució del llenç (× mida de la finestra)", 0.25, 2, 0.05);

  /* --- Mode d'àudio */
  box = section("Mode d'àudio");
  const scopes = [["single", "Individual"], ["global", "Conjunt"]];
  const scopeBtns = el("div", "btns");
  const scopeButtons = scopes.map(([m, t]) => addButton(scopeBtns, t, () => { S.scope = m; syncUI(); }));
  box.appendChild(scopeBtns);
  syncFns.push(() => scopeButtons.forEach((b, i) => b.classList.toggle("on", scopes[i][0] === S.scope)));
  box.appendChild(el("div", "note",
    "Individual: cada imatge s'escala i s'estira per separat.<br>" +
    "Conjunt: tot el viewport es tracta com una sola imatge; el tamany fa un zoom del conjunt " +
    "que recorre la pantalla amb retard, i el xicle estira l'escena sencera."));
  box.appendChild(el("h3", null, "Opcions del mode conjunt"));
  addSelect(box, "gSweep", "Recorregut de l'onada", [
    ["none", "Tot alhora"],
    ["lr", "D'esquerra a dreta"], ["rl", "De dreta a esquerra"],
    ["tb", "De dalt a baix"], ["bt", "De baix a dalt"],
    ["center", "Del centre cap a les vores"], ["edges", "De les vores cap al centre"],
  ]);
  addSlider(box, "gDelay", "Retard del recorregut (s)", 0, 3, 0.01);
  addSlider(box, "gZoomMin", "Zoom mínim del conjunt (×)", 0.3, 3, 0.01);
  addSlider(box, "gZoomMax", "Zoom màxim del conjunt (×)", 0.3, 3, 0.01);
  addSlider(box, "gBase", "Tamany base de les imatges (×)", 0.2, 4, 0.05);
  addSlider(box, "gStrips", "Franges (suavitat de l'onada)", 8, 160, 1);
  box.appendChild(el("div", "note", "La font d'àudio del zoom és la de «Mapatge → tamany»."));

  /* --- Moviment */
  box = section("Moviment");
  const modeBtns = el("div", "btns");
  const modes = [["sin", "1 · sin/cos"], ["dvd", "2 · DVD"], ["random", "3 · aleatori"]];
  const modeButtons = modes.map(([m, t]) => addButton(modeBtns, t, () => setMode(m)));
  box.appendChild(modeBtns);
  syncFns.push(() => modeButtons.forEach((b, i) => b.classList.toggle("on", modes[i][0] === S.mode)));
  addSlider(box, "amp", "Amplitud sin/cos", 0.2, 5, 0.05);
  addSlider(box, "freq", "Freqüència sin/cos", 0.1, 4, 0.05);
  addSlider(box, "dvdSpeed", "Velocitat base DVD (px/s)", 20, 600, 5);
  addSlider(box, "interval", "Interval aleatori (ms)", 80, 4000, 10);
  addSlider(box, "ease", "Suavitat d'arribada (aleatori)", 0.1, 5, 0.05);
  const shuffleBtns = el("div", "btns");
  addButton(shuffleBtns, "Rebarrejar (espai)", reshufflePositions);
  box.appendChild(shuffleBtns);

  /* --- Collage */
  box = section("Disposició · collage");
  addSelect(box, "layout", "Disposició (L: canvia)", [
    ["free", "Lliure (flotant)"], ["collage", "Collage (grid irregular)"],
  ]);
  addSlider(box, "cCount", "Quantitat d'imatges", 1, 100, 1);
  addSlider(box, "cIrreg", "Irregularitat de la graella", 0, 1, 0.01);
  addSlider(box, "cGap", "Separació entre imatges (px)", 0, 40, 1);
  addSlider(box, "cPulse", "Zoom amb el so (font = font del tamany, només individual)", 0, 1, 0.01);
  const collageBtns = el("div", "btns");
  addButton(collageBtns, "Nou collage (G)", () => { S.cSeed++; });
  box.appendChild(collageBtns);

  /* --- Pressets */
  box = section("Pressets");
  box.appendChild(el("h3", null, "Moviment"));
  const presetBtns = el("div", "btns");
  PRESETS.forEach((p) => addButton(presetBtns, p.name, () => applySet(p.set)));
  box.appendChild(presetBtns);
  box.appendChild(el("h3", null, "Aspecte"));
  const lookBtns = el("div", "btns");
  LOOKS.forEach((p) => addButton(lookBtns, p.name, () => { applySet(p.set); clearCanvas(); }));
  box.appendChild(lookBtns);
  box.appendChild(el("h3", null, "Ranures pròpies (tot l'estat)"));
  const slotSel = el("select");
  for (let i = 1; i <= 8; i++) { const o = el("option", null, "Ranura " + i); o.value = i; slotSel.appendChild(o); }
  box.appendChild(slotSel);
  const slotBtns = el("div", "btns");
  addButton(slotBtns, "Guarda", () => {
    try {
      localStorage.setItem("arenaVJ.slot." + slotSel.value, JSON.stringify(S));
      setStatus("Guardat a la ranura " + slotSel.value);
    } catch (e) { setStatus("No s'ha pogut guardar: " + e.message); }
  });
  addButton(slotBtns, "Carrega", () => {
    try {
      const raw = localStorage.getItem("arenaVJ.slot." + slotSel.value);
      if (!raw) return setStatus("Ranura " + slotSel.value + " buida.");
      applySet(JSON.parse(raw));
      setStatus("Carregat de la ranura " + slotSel.value);
    } catch (e) { setStatus("No s'ha pogut carregar: " + e.message); }
  });
  addButton(slotBtns, "Reinicia", () => { applySet(DEFAULTS); clearCanvas(); });
  box.appendChild(slotBtns);

  /* --- Mapatge tamany */
  box = section("Mapatge → tamany");
  addSelect(box, "sizeSrc", "Font", SOURCES);
  addSlider(box, "sizeMin", "Tamany mínim (×, individual)", 0.05, 6, 0.05);
  addSlider(box, "sizeMax", "Tamany màxim (×, individual)", 0.05, 6, 0.05);
  addSlider(box, "sizeLevel", "Nivell manual (si font = Manual)", 0, 1, 0.01);

  /* --- Mapatge velocitat */
  box = section("Mapatge → velocitat");
  addSelect(box, "speedSrc", "Font", SOURCES);
  addSlider(box, "speedMin", "Velocitat mínima (×)", 0, 8, 0.05);
  addSlider(box, "speedMax", "Velocitat màxima (×)", 0, 8, 0.05);
  addSlider(box, "speedLevel", "Nivell manual (si font = Manual)", 0, 1, 0.01);

  /* --- Estirament */
  box = section("Estirament · xicle");
  addSelect(box, "stretchDir", "Direcció (E: canvia)", STRETCH_DIRS);
  addSelect(box, "stretchSrc", "Font de l'àudio → estirament", SOURCES);
  addSlider(box, "stretchMin", "Estirament mínim", 0, 1, 0.01);
  addSlider(box, "stretchMax", "Estirament màxim", 0, 1, 0.01);
  addSlider(box, "stretchLevel", "Nivell manual (si font = Manual)", 0, 1, 0.01);
  addSlider(box, "pivot", "Punt d'inici de l'estirament", 0.02, 0.95, 0.01);
  addSlider(box, "pivotTravel", "Recorregut del punt (anada i tornada)", 0, 0.5, 0.01);
  addSlider(box, "waveAmp", "Amplitud de l'ona", 0, 1, 0.01);
  addSlider(box, "waveFreq", "Nombre d'ondes", 0.2, 8, 0.1);
  addSlider(box, "slices", "Llesques (qualitat / rendiment)", 12, 120, 1);

  /* --- Rastre i fons */
  box = section("Fons i rastre");
  addSlider(box, "trail", "Rastre (0 = net, 1 = infinit)", 0, 1, 0.01);
  addColor(box, "bg", "Color de fons");
  addSelect(box, "blend", "Superposició dels cartells", [
    ["source-over", "Normal"], ["multiply", "Multiplica (tinta sobre tinta)"],
    ["difference", "Diferència"], ["screen", "Pantalla (screen)"],
  ]);
  const clearBtns = el("div", "btns");
  addButton(clearBtns, "Neteja el llenç (C)", clearCanvas);
  box.appendChild(clearBtns);

  /* --- Imatge */
  box = section("Imatge · pixelat i tinta");
  addSlider(box, "pixel", "Pixelat (0 = sense)", 0, 100, 1);
  addSlider(box, "contrast", "Contrast", 0.2, 5, 0.05);
  addSlider(box, "bright", "Brillantor", -100, 100, 1);
  addSlider(box, "levels", "Nivells de tinta (0 = continu, 2 = plana)", 0, 12, 1);
  addSelect(box, "tint", "Tintes", [
    ["color", "Colors originals (posteritzat)"], ["gray", "Escala de grisos"],
    ["duo", "Duotò (dos colors)"], ["riso", "Risograph (blau, rosa, groc)"],
  ]);
  addColor(box, "colA", "Duotò: tinta fosca");
  addColor(box, "colB", "Duotò: tinta clara");

  /* --- Àudio */
  box = section("Àudio");
  const audioBtns = el("div", "btns");
  addButton(audioBtns, "Activa micròfon", () => startAudio(devSel.value || undefined));
  addButton(audioBtns, "Atura", () => { stopAudio(); S.sim = true; syncUI(); setStatus("Àudio aturat (simulació)."); });
  box.appendChild(audioBtns);
  const devSel = el("select");
  devSel.onchange = () => { if (audio.stream) startAudio(devSel.value); };
  box.appendChild(devSel);
  addCheck(box, "sim", "Simulació d'àudio (sense micro)");
  addSlider(box, "gain", "Gain d'entrada", 0, 12, 0.1);
  addSlider(box, "smooth", "Suavitzat (release)", 0, 0.95, 0.01);
  const meters = {};
  [["vol", "vol"], ["peak", "pic"], ["bass", "greus"], ["mid", "mitjos"], ["treble", "aguts"]].forEach(([k, name]) => {
    const m = el("div", "meter", `<span>${name}</span><div class="bar"><i></i></div>`);
    box.appendChild(m);
    meters[k] = m.querySelector("i");
  });
  let meterTick = 0;
  function updateMeters() {
    if (!panelWin || panelWin.closed) return; // si el panell està tancat no cal actualitzar-los
    if (++meterTick % 2) return;
    for (const k in meters) meters[k].style.width = audio.level[k] * 100 + "%";
  }

  statusEl = el("div");
  statusEl.id = "status";
  statusEl.textContent = lastStatus;
  panel.appendChild(statusEl);
  panel.appendChild(el("div", "hint",
    "Dreceres (amb aquesta finestra activa):<br>" +
    "A: àudio individual / conjunt<br>1 · 2 · 3: mode de moviment<br>" +
    "E: canvia la direcció de l'estirament<br>L: lliure / collage<br>G: nou collage<br>" +
    "C: neteja el llenç<br>Espai: rebarreja<br><br>" +
    "A Hydra: <code>s0.init({src: arenaCanvas, dynamic: true})</code><br>" +
    "Ctrl+Shift+H amaga el codi de Hydra per capturar-ne la sortida."));

  // les dreceres només viuen a la finestra del panell: a Hydra interferirien amb el codi
  function onKey(e) {
    const t = e.target;
    if (t.tagName === "SELECT" || t.tagName === "INPUT" && t.type === "text") return;
    const k = e.key.toLowerCase();
    if (k === "a") { S.scope = S.scope === "global" ? "single" : "global"; syncUI(); }
    else if (k === "1") setMode("sin");
    else if (k === "2") setMode("dvd");
    else if (k === "3") setMode("random");
    else if (k === "c") clearCanvas();
    else if (k === "l") { S.layout = S.layout === "collage" ? "free" : "collage"; syncUI(); }
    else if (k === "g") { S.cSeed++; }
    else if (k === "e") {
      const order = STRETCH_DIRS.map((d) => d[0]);
      S.stretchDir = order[(order.indexOf(S.stretchDir) + 1) % order.length];
      syncUI();
    } else if (e.key === " " && !(t.tagName === "BUTTON" || t.tagName === "INPUT")) {
      e.preventDefault();
      reshufflePositions();
    }
  }

  /*
    El panell es mou a una finestra emergent. El codi i l'estat continuen vivint a la pestanya
    de Hydra, de manera que els controls funcionen igual.
  */
  let panelWin = null;

  // botó petit a la pàgina de Hydra, només visible quan el panell està tancat
  const opener = document.createElement("button");
  opener.textContent = "ARENA";
  opener.title = "Obri el panell de l'Arena VJ wall";
  opener.style.cssText =
    "position:fixed;right:10px;bottom:10px;z-index:99999;font:11px monospace;padding:5px 8px;" +
    "border:1px solid #000;background:#fff;color:#000;cursor:pointer;opacity:.6;";
  opener.onclick = () => openPanel();
  document.body.appendChild(opener);

  function openPanel() {
    if (panelWin && !panelWin.closed) { panelWin.focus(); return true; }
    const w = window.open("", "arenaVJpanel", "width=340,height=900,menubar=no,toolbar=no,location=no");
    if (!w) {
      opener.style.display = "block";
      setStatus("Finestra emergent bloquejada.");
      console.warn("[arena-wall] El navegador ha bloquejat la finestra del panell. Fes clic al botó ARENA (cantonada inferior dreta) o permet els pop-ups per a hydra.ojack.xyz.");
      return false;
    }
    panelWin = w;
    const d = w.document;
    d.open();
    d.write(`<!doctype html><html lang="ca"><head><meta charset="utf-8"><title>Arena VJ · control</title><style>${CSS}</style></head><body></body></html>`);
    d.close();
    d.body.appendChild(d.adoptNode(panel));
    d.addEventListener("keydown", onKey);
    w.addEventListener("pagehide", () => {
      // la finestra s'ha tancat: el panell torna a la memòria de la pestanya de Hydra
      document.adoptNode(panel);
      panelWin = null;
      if (window.arenaWall && window.arenaWall.running) opener.style.display = "block";
    });
    opener.style.display = "none";
    syncUI();
    return true;
  }

  function closePanel() {
    if (panelWin && !panelWin.closed) panelWin.close();
  }

  // si es tanca o es recarrega Hydra, tanquem també el panell
  window.addEventListener("pagehide", closePanel);

  function stop() {
    cancelAnimationFrame(rafId);
    stopAudio();
    closePanel();
    opener.remove();
    window.removeEventListener("resize", resize);
    api.running = false;
  }

  /* ---------------------------------------------------------------- API per a Hydra */
  const api = {
    running: true,
    canvas: cv,
    state: S,
    level: audio.level,
    panel: openPanel,
    closePanel,
    load: loadChannel,
    set(values) { Object.assign(S, values); if ("mode" in values) setMode(S.mode); else syncUI(); },
    reshuffle: reshufflePositions,
    clear: clearCanvas,
    stop,
  };
  window.arenaWall = api;
  window.arenaCanvas = cv;

  resize();
  syncUI();
  loadChannel(channel);
  rafId = requestAnimationFrame(frame);
  openPanel(); // si el navegador la bloqueja, queda el botó ARENA
})();
