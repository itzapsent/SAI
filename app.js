
/* SAMARITAN — fan recreation. MIT License. */
(() => {
'use strict';

/* ============ utils ============ */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const rand   = (a, b) => a + Math.random() * (b - a);
const irand  = (a, b) => Math.floor(rand(a, b + 1));
const choice = (a) => a[Math.floor(Math.random() * a.length)];
const pad    = (n, l = 2) => String(n).padStart(l, '0');
const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function typeText(el, text, speed = 26) {
  return new Promise((res) => {
    let i = 0;
    (function step() {
      el.textContent = text.slice(0, i);
      if (i++ <= text.length) setTimeout(step, speed + Math.random() * 22);
      else res();
    })();
  });
}

function makeCursor() {
  const s = document.createElement('span');
  s.className = 'cursor'; s.textContent = '_';
  return s;
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

/* pre-rendered film grain */
const noiseTiles = [];
for (let n = 0; n < 3; n++) {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 110;
  const x = c.getContext('2d');
  const img = x.createImageData(160, 110);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  noiseTiles.push(c);
}

const CAP_FONT = '"SF Mono",Menlo,Consolas,"Liberation Mono",monospace';
const LOCS = ['41ST & LEX','BROADWAY / W34','FULTON ST','CANAL ST','8TH AVE','QUEENSBORO BR',
  'PENN PLAZA','WALL ST','DELANCEY','HOUSTON ST','MADISON AVE','BEDFORD AVE',
  'COLUMBUS CIR','FLATBUSH AVE','TRINITY PL','CHURCH ST'];
const GREY = { paper:'#efede6', far:'#dbd7cd', mid:'#bcb8ae', deep:'#a19d92',
  ink:'#47453f', soft:'#8d897f', road:'#d5d1c7' };

/* walking figure silhouette (y = ground line, s = height) */
function silhouette(ctx, x, y, s, wob) {
  ctx.fillStyle = GREY.ink;
  const bx = x + Math.sin(wob) * s * 0.06;
  ctx.beginPath();
  ctx.arc(bx, y - s * 0.92, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  const bw = s * 0.26;
  ctx.fillRect(bx - bw / 2, y - s * 0.8, bw, s * 0.55);
  ctx.fillRect(bx - s * 0.05 + Math.sin(wob) * s * 0.1, y - s * 0.28, s * 0.08, s * 0.28);
  ctx.fillRect(bx + s * 0.05 - Math.sin(wob) * s * 0.1, y - s * 0.28, s * 0.08, s * 0.28);
}

/* target-acquisition reticle */
function drawReticle(ctx, x, y, bw, bh, hot, label) {
  const col = hot ? '#d40f0f' : '#171614';
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  const L = Math.max(8, Math.min(bw, bh) * 0.2);
  [[x, y, 1, 1], [x + bw, y, -1, 1], [x, y + bh, 1, -1], [x + bw, y + bh, -1, -1]]
    .forEach(([px, py, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(px + sx * L, py); ctx.lineTo(px, py); ctx.lineTo(px, py + sy * L);
      ctx.stroke();
    });
  const cx = x + bw / 2, cy = y + bh / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
  ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
  ctx.stroke();
  if (label) {
    ctx.font = '700 9px ' + CAP_FONT;
    const tw = ctx.measureText(label).width;
    const ly = y > 22 ? y - 18 : y + bh + 5;
    ctx.fillStyle = col;
    ctx.fillRect(cx - tw / 2 - 6, ly, tw + 12, 13);
    ctx.fillStyle = '#f4f2ec';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(label, cx, ly + 7);
  }
  ctx.restore();
}

/* procedural ID portrait */
function drawPortrait(ctx, w, h, seed) {
  const R = mulberry32(seed);
  ctx.fillStyle = '#dcd9d1'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ['#4c4a44', '#5a5750', '#423f3a'][(R() * 3) | 0];
  const sw = w * (0.62 + R() * 0.26);
  ctx.beginPath();
  ctx.moveTo(w / 2 - sw / 2, h);
  ctx.quadraticCurveTo(w / 2, h * 0.6, w / 2 + sw / 2, h);
  ctx.closePath(); ctx.fill();
  const hr = w * (0.17 + R() * 0.05);
  const hx = w / 2 + (R() - 0.5) * w * 0.08;
  const hy = h * (0.35 + R() * 0.06);
  ctx.beginPath(); ctx.ellipse(hx, hy, hr * 0.82, hr, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(hx - hr * 0.32, hy + hr * 0.7, hr * 0.64, h * 0.14);
  ctx.globalAlpha = 0.12;
  ctx.drawImage(noiseTiles[(R() * 3) | 0], 0, 0, w, h);
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.18, w / 2, h * 0.5, w * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(56,54,48,0.22)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/* ============ clock & ticker ============ */
const Clock = {
  start() {
    const el = $('#clock');
    const tick = () => {
      const d = new Date();
      el.textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC · ${d.toUTCString().slice(5, 16)}`;
    };
    tick(); setInterval(tick, 1000);
  }
};

const Ticker = {
  start() {
    const s = 'FEEDS ONLINE: 314 · ASSETS TRACKED: 1,204,556 · THREATS FLAGGED: 7 · SECTOR SWEEP 04 COMPLETE · DEVIANTS DETECTED: 2 · NEXT DATA PORT: 22:00 UTC · ALL SYSTEMS NOMINAL · ';
    $('#tickerIn').textContent = s.repeat(4);
  }
};

/* ============ procedural CCTV scenes ============ */
const TYPES = {
  skyline: {
    init(p) {
      p.far = []; let x = -0.02;
      while (x < 1.02) { const w = 0.05 + p.R() * 0.08; p.far.push({ x, w, h: 0.15 + p.R() * 0.35 }); x += w + 0.012; }
      p.near = []; x = -0.05;
      while (x < 1.05) { const w = 0.07 + p.R() * 0.12; p.near.push({ x, w, h: 0.3 + p.R() * 0.4, seed: p.R() * 40 }); x += w + 0.008; }
    },
    draw(ctx, w, h, t, p) {
      const hz = h * 0.68;
      ctx.fillStyle = '#f2f0ea'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = GREY.far;
      p.far.forEach((b) => ctx.fillRect(b.x * w, hz - b.h * h, b.w * w, b.h * h));
      p.near.forEach((b) => {
        const bh = b.h * h, bx = b.x * w, bw = b.w * w, by = hz - bh;
        ctx.fillStyle = GREY.mid; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = GREY.soft;
        for (let wy = by + 5; wy < hz - 6; wy += 9)
          for (let wx = bx + 4; wx < bx + bw - 5; wx += 9)
            if (Math.sin(t * 0.13 + wx * 0.7 + wy * 1.3 + b.seed) > 0.35) ctx.fillRect(wx, wy, 3, 4);
      });
      ctx.fillStyle = GREY.deep; ctx.fillRect(0, hz, w, h - hz);
    }
  },
  street: {
    init(p) {
      p.figs = Array.from({ length: 7 }, () => ({ d: 0.15 + p.R() * 0.8, lane: 0.3 + p.R() * 0.4, off: p.R() * 7, sp: 0.5 + p.R(), ph: p.R() * 7 }));
    },
    draw(ctx, w, h, t, p) {
      const hz = h * 0.52;
      ctx.fillStyle = '#f0eee7'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c9c5bb';
      ctx.fillRect(0, hz, w * 0.2, h - hz);
      ctx.fillRect(w * 0.8, hz, w * 0.2, h - hz);
      ctx.fillStyle = GREY.mid;  ctx.fillRect(0, 0, w * 0.18, hz);
      ctx.fillStyle = GREY.deep; ctx.fillRect(w * 0.84, 0, w * 0.16, hz);
      ctx.fillStyle = GREY.road;
      ctx.beginPath();
      ctx.moveTo(w * 0.36, hz); ctx.lineTo(w * 0.64, hz);
      ctx.lineTo(w * 0.94, h); ctx.lineTo(w * 0.06, h);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#9c988e';
      for (let i = 0; i < 8; i++) {
        const s = (i / 8 + t * 0.045) % 1;
        const y = hz + (h - hz) * s;
        ctx.lineWidth = Math.max(0.7, s * 3.4);
        ctx.beginPath(); ctx.moveTo(w * 0.5, y); ctx.lineTo(w * 0.5, y + 3 + s * 12); ctx.stroke();
      }
      p.figs.forEach((f) => {
        const y = hz + (h - hz) * f.d;
        const x = w * (f.lane + Math.sin(t * 0.02 * f.sp + f.off) * 0.07);
        silhouette(ctx, x, y, 4 + f.d * 26, t * 6 * f.sp + f.ph);
      });
    }
  },
  corridor: {
    init(p) { p.vy = 0.42 + p.R() * 0.08; p.ph = p.R(); },
    draw(ctx, w, h, t, p) {
      ctx.fillStyle = '#e9e6df'; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, vy = h * p.vy;
      ctx.fillStyle = '#d9d5cb'; ctx.fillRect(0, vy, w, h - vy);
      ctx.strokeStyle = 'rgba(140,136,128,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h); ctx.lineTo(cx, vy);
      ctx.moveTo(w, h); ctx.lineTo(cx, vy);
      ctx.stroke();
      ctx.strokeStyle = '#b6b2a8';
      for (let k = 1; k <= 6; k++) {
        const q = k / 7;
        ctx.lineWidth = 1 + q * 2;
        ctx.strokeRect(cx - (w / 2) * q, h * 0.5 - h * 0.45 * q, w * q, h * 0.9 * q);
      }
      for (let k = 1; k <= 5; k++) {
        const s = 1 - k / 6;
        const lw = Math.max(1.5, w * 0.07 * s), lh = Math.max(1, h * 0.018 * s + 0.6);
        const y = h * 0.5 - h * 0.45 * s - 2;
        const flick = 0.75 + 0.25 * Math.sin(t * 0.9 + k * 2.7);
        ctx.fillStyle = `rgba(120,117,110,${0.25 + 0.45 * flick * s})`;
        ctx.fillRect(cx - lw / 2, y, lw, lh);
      }
      const cyc = (t * 0.028 + p.ph) % 1;
      const s = 1 - cyc;
      const fy = h * 0.5 + h * 0.44 * s;
      silhouette(ctx, cx, fy, 6 + s * h * 0.34, t * 7);
    }
  },
  plaza: {
    init(p) {
      p.figs = Array.from({ length: 9 }, () => ({ x: p.R(), y: 0.4 + p.R() * 0.5, ph: p.R() * 7, sp: 0.4 + p.R() * 0.8 }));
      p.bx = 0.18 + p.R() * 0.6;
    },
    draw(ctx, w, h, t, p) {
      ctx.fillStyle = '#f1efe9'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e4e1d9'; ctx.fillRect(0, h * 0.28, w, h * 0.72);
      ctx.strokeStyle = '#ccc8be'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h * 0.28); ctx.lineTo(w, h * 0.28); ctx.stroke();
      ctx.fillStyle = '#b3afa5';
      ctx.beginPath(); ctx.ellipse(p.bx * w, h * 0.42, w * 0.07, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = GREY.soft;
      ctx.fillRect(p.bx * w - w * 0.05, h * 0.44, w * 0.1, h * 0.012);
      ctx.fillRect(p.bx * w - w * 0.05, h * 0.44, w * 0.008, h * 0.03);
      ctx.fillRect(p.bx * w + w * 0.042, h * 0.44, w * 0.008, h * 0.03);
      p.figs.forEach((f) => {
        const x = w * (f.x + Math.sin(t * 0.018 * f.sp + f.ph) * 0.06);
        const y = h * f.y, s = 6 + f.y * 26;
        silhouette(ctx, x, y, s, t * 5 * f.sp + f.ph);
        ctx.fillStyle = 'rgba(80,78,72,0.16)';
        ctx.beginPath(); ctx.ellipse(x, y + 1, s * 0.2, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      });
    }
  },
  parking: {
    init(p) {
      p.car = { off: p.R(), sp: 0.02 + p.R() * 0.02 };
      p.cols = [0.22, 0.5, 0.78].map((v) => v + p.R() * 0.06 - 0.03);
    },
    draw(ctx, w, h, t, p) {
      ctx.fillStyle = '#d7d4cb'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b5b1a7'; ctx.lineWidth = 2;
      for (let i = -1; i < 8; i++) {
        const x0 = i * w * 0.15;
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 - w * 0.1, h); ctx.stroke();
      }
      ctx.fillStyle = '#a5a199';
      p.cols.forEach((cx) => ctx.fillRect(cx * w - 7, 0, 14, h * 0.52));
      ctx.fillStyle = '#c3bfb5'; ctx.fillRect(0, 0, w, h * 0.07);
      const cyc = ((t * p.car.sp + p.car.off) % 1.25) - 0.12;
      const cx = cyc * w, cy = h * 0.68, cw = w * 0.17, ch = h * 0.11;
      ctx.fillStyle = 'rgba(70,68,62,0.18)';
      ctx.beginPath(); ctx.ellipse(cx, cy + ch * 0.72, cw * 0.55, ch * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = GREY.ink;
      ctx.beginPath(); ctx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, ch * 0.35); ctx.fill();
      ctx.fillStyle = '#8a867c';
      ctx.beginPath(); ctx.roundRect(cx - cw * 0.3, cy - ch * 0.3, cw * 0.6, ch * 0.42, 3); ctx.fill();
    }
  },
  facade: {
    init(p) {
      p.cols = irand(7, 9); p.rows = irand(7, 10);
      p.ph = Array.from({ length: p.cols * p.rows }, () => p.R() * 9);
    },
    draw(ctx, w, h, t, p) {
      ctx.fillStyle = '#c8c4ba'; ctx.fillRect(0, 0, w, h);
      const mx = w * 0.06, my = h * 0.07, gw = (w - mx * 2) / p.cols, gh = (h - my * 2) / p.rows;
      for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
        const v = Math.sin(t * 0.11 + p.ph[r * p.cols + c]);
        ctx.fillStyle = v > 0.62 ? '#efe9da' : v < -0.8 ? '#7e7a70' : '#a29e93';
        ctx.fillRect(mx + c * gw + 1.5, my + r * gh + 1.5, gw - 3, gh - 3);
      }
    }
  },
  interior: {
    init(p) { p.tv = p.R() * 9; p.ph = p.R() * 7; },
    draw(ctx, w, h, t, p) {
      ctx.fillStyle = '#f0eee7'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ddd9d0'; ctx.fillRect(0, h * 0.66, w, h * 0.34);
      ctx.fillStyle = '#e7e3d7'; ctx.fillRect(w * 0.07, h * 0.1, w * 0.3, h * 0.4);
      ctx.strokeStyle = GREY.soft; ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.07, h * 0.1, w * 0.3, h * 0.4);
      ctx.beginPath(); ctx.moveTo(w * 0.22, h * 0.1); ctx.lineTo(w * 0.22, h * 0.5); ctx.stroke();
      const tx = w * 0.52, ty = h * 0.22, tw = w * 0.32, th = h * 0.24;
      ctx.fillStyle = '#8f8b81'; ctx.fillRect(tx - 3, ty - 3, tw + 6, th + 6);
      ctx.drawImage(choice(noiseTiles), tx, ty, tw, th);
      ctx.fillStyle = 'rgba(239,237,230,0.25)'; ctx.fillRect(tx, ty, tw, th);
      ctx.fillStyle = '#b0aca2';
      ctx.beginPath(); ctx.roundRect(w * 0.16, h * 0.6, w * 0.56, h * 0.16, 6); ctx.fill();
      silhouette(ctx, w * 0.44, h * 0.68, h * 0.3, Math.sin(t * 0.7 + p.ph) * 1.2);
      const g = 0.1 + 0.05 * Math.sin(t * 0.6 + p.tv);
      ctx.fillStyle = `rgba(214,196,160,${g})`; ctx.fillRect(0, 0, w, h);
    }
  },
  traffic: {
    init(p) {
      p.cars = Array.from({ length: 9 }, () => ({ lane: p.R() < 0.5 ? 0 : 1, off: p.R(), sp: 0.03 + p.R() * 0.05, dir: p.R() < 0.5 ? 1 : -1, g: p.R() }));
    },
    draw(ctx, w, h, t, p) {
      ctx.fillStyle = '#f1efe9'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c6c2b8'; ctx.fillRect(0, h * 0.34, w, h * 0.3);
      ctx.fillStyle = '#b2aea4'; ctx.fillRect(0, h * 0.64, w, h * 0.05);
      ctx.strokeStyle = '#9d998f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, h * 0.36); ctx.lineTo(w, h * 0.36); ctx.stroke();
      ctx.fillStyle = GREY.deep;
      ctx.fillRect(w * 0.2, h * 0.64, w * 0.03, h * 0.36);
      ctx.fillRect(w * 0.77, h * 0.64, w * 0.03, h * 0.36);
      const shades = ['#57544d', '#6b675e', '#7d7970', '#47453f'];
      p.cars.forEach((c) => {
        const cyc = (((t * c.sp * c.dir + c.off) % 1.15) + 1.15) % 1.15 - 0.075;
        const x = cyc * w, y = h * (c.lane ? 0.52 : 0.435);
        const cw = w * 0.085, ch = h * 0.055;
        ctx.fillStyle = shades[(c.g * shades.length) | 0];
        ctx.beginPath(); ctx.roundRect(x, y, cw, ch, ch * 0.4); ctx.fill();
        ctx.fillStyle = '#9a968c';
        ctx.fillRect(x + cw * 0.58, y + ch * 0.18, cw * 0.3, ch * 0.55);
      });
    }
  }
};
const TYPE_KEYS = Object.keys(TYPES);

/* ============ full-screen surveillance mosaic ============ */
const Mosaic = (() => {
  let canvas, ctx, W = 0, H = 0, dpr = 1;
  let tiles = [], cols = 0, rows = 0, TW = 0, TH = 0;
  let running = false, raf = 0, lastFrame = 0, t0 = performance.now();
  let featured = -1, lastFeat = 0, threat = false;
  const GAP = 5, RAD = 8;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.max(4, Math.round(W / 250));
    rows = Math.max(3, Math.round(H / 165));
    TW = W / cols; TH = H / rows;
    tiles = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const R = mulberry32(irand(1, 999999));
      const type = choice(TYPE_KEYS);
      const p = { R };
      TYPES[type].init(p);
      tiles.push({ type, p, id: 'CAM ' + pad(irand(1, 9999), 4), loc: choice(LOCS), tag: irand(1000, 9999), x: c * TW, y: r * TH });
    }
    featured = irand(0, tiles.length - 1);
  }

  function drawTile(tile, t) {
    const x = tile.x + GAP / 2, y = tile.y + GAP / 2, w = TW - GAP, h = TH - GAP;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, RAD); ctx.clip();
    TYPES[tile.type].draw(ctx, w, h, t, tile.p);
    ctx.globalAlpha = 0.09;
    ctx.drawImage(noiseTiles[(Math.random() * 3) | 0], x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(210,192,156,0.06)'; ctx.fillRect(x, y, w, h);
    /* caption */
    ctx.font = '600 9px ' + CAP_FONT;
    ctx.fillStyle = 'rgba(35,34,30,0.85)';
    ctx.fillText(tile.id + ' · ' + tile.loc, x + 8, y + h - 8);
    const d = new Date();
    ctx.textAlign = 'right';
    ctx.fillText(pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()), x + w - 8, y + h - 8);
    ctx.textAlign = 'left';
    /* occasional signal tear */
    if (Math.random() < 0.006) {
      const ty = y + Math.random() * (h - 8), th = 2 + Math.random() * 5;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(canvas, x * dpr, ty * dpr, w * dpr, th * dpr, x + rand(-6, 6), ty, w, th);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return { x, y, w, h };
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - lastFrame < 70) return;
    lastFrame = now;
    const t = (now - t0) / 1000;
    ctx.fillStyle = '#eceae3'; ctx.fillRect(0, 0, W, H);
    if (!threat && now - lastFeat > 7000 && tiles.length) {
      featured = irand(0, tiles.length - 1); lastFeat = now;
    }
    tiles.forEach((tile, i) => {
      const b = drawTile(tile, t);
      if (i === featured) {
        const bw = b.w * 0.36, bh = b.h * 0.52;
        drawReticle(ctx, b.x + b.w / 2 - bw / 2, b.y + b.h / 2 - bh / 2, bw, bh, threat,
          threat ? 'THREAT CONFIRMED — MARV CARRIER' : 'ASSET ' + tile.tag + ' — TRACKING');
      }
    });
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / TW);
    const r = Math.floor((e.clientY - rect.top) / TH);
    if (c >= 0 && c < cols && r >= 0 && r < rows) Zoom.open(tiles[r * cols + c]);
  }

  function init() {
    canvas = $('#feedWall'); ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('click', onClick);
  }
  function start() { if (running) return; running = true; lastFrame = 0; lastFeat = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function setThreat(v) { threat = v; }
  return { init, start, stop, setThreat };
})();

/* ============ camera zoom overlay ============ */
const Zoom = (() => {
  let overlay, canvas, ctx, raf = 0, tile = null, W = 0, H = 0;

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.min(window.innerWidth * 0.9, 1040);
    H = Math.min(window.innerHeight * 0.5, W * 0.56);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async function open(t) {
    tile = t;
    overlay.classList.add('open');
    fit();
    const panel = $('#zoomPanel');
    panel.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'mb-head';
    head.innerHTML = '<span class="t" style="font:700 10.5px var(--sans);letter-spacing:.3em">' + tile.id + ' — ' + tile.loc + '</span>';
    panel.appendChild(head);
    const lines = document.createElement('div');
    lines.className = 'mb-lines';
    panel.appendChild(lines);
    const L = (cls) => { const d = document.createElement('div'); d.className = 'line ' + (cls || ''); lines.appendChild(d); return d; };
    let alive = true;
    (async () => {
      await typeText(L(), 'SUBJECT DETECTED'); if (!alive) return;
      await typeText(L(), 'FACIAL MATCH: ' + (95 + irand(0, 4)) + '.' + irand(0, 9) + '%'); if (!alive) return;
      const roll = Math.random();
      if (roll < 0.16)      await typeText(L('band'), 'DESIGNATION: THREAT — FLAGGED', 16);
      else if (roll < 0.3)  await typeText(L('red'), 'DESIGNATION: POTENTIAL ASSET — EVALUATING', 16);
      else                  await typeText(L(), 'DESIGNATION: ASSET — MONITORING', 16);
      if (!alive) return;
      await typeText(L('dim'), 'AUDIO STREAM: RECONSTRUCTING…');
    })();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const t = now / 1000;
      ctx.fillStyle = '#efede6'; ctx.fillRect(0, 0, W, H);
      TYPES[tile.type].draw(ctx, W, H, t, tile.p);
      ctx.globalAlpha = 0.08;
      ctx.drawImage(noiseTiles[(Math.random() * 3) | 0], 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(210,192,156,0.06)'; ctx.fillRect(0, 0, W, H);
      const bw = W * 0.3, bh = H * 0.62;
      drawReticle(ctx, W / 2 - bw / 2, H / 2 - bh / 2, bw, bh, false, 'DESIGNATION LOCK');
      ctx.font = '700 11px ' + CAP_FONT;
      ctx.fillStyle = 'rgba(35,34,30,0.9)';
      ctx.fillText(tile.id + ' · ' + tile.loc, 12, H - 12);
    };
    raf = requestAnimationFrame(loop);
    overlay._stop = () => { alive = false; };
  }

  function close() {
    overlay.classList.remove('open');
    cancelAnimationFrame(raf);
    if (overlay._stop) overlay._stop();
  }

  function init() {
    overlay = $('#zoom');
    canvas = $('#zoomCanvas');
    ctx = canvas.getContext('2d');
    overlay.addEventListener('click', close);
    window.addEventListener('resize', () => { if (overlay.classList.contains('open')) fit(); });
  }
  return { init, open, close };
})();

/* ============ threat message box ============ */
const ThreatBox = (() => {
  let token = 0;
  async function play() {
    const my = ++token;
    const box = $('#threatLines');
    while (my === token) {
      box.innerHTML = '';
      const L = (cls) => { const d = document.createElement('div'); d.className = 'line ' + (cls || ''); box.appendChild(d); return d; };
      await typeText(L('big'), 'PRIMARY OPERATIONS', 30);            if (my !== token) return;
      await typeText(L('red'), 'ACTIVE THREAT', 26);
      Mosaic.setThreat(true);
      await typeText(L(), 'RELEVANT TO NATIONAL SECURITY', 24);
      await sleep(260);
      await typeText(L('band'), 'BIOLOGICAL WEAPON DETECTED: MARBURGVIRUS [MARV] – GROUP 4 PATHOGEN', 13);
      await sleep(320);
      const ex = L();
      await typeText(ex, 'EXPORTING DATA', 24);
      ex.appendChild(makeCursor());
      const bar = document.createElement('div');
      bar.className = 'pbar'; bar.innerHTML = '<i></i>';
      box.appendChild(bar);
      await sleep(60);
      bar.querySelector('i').style.width = '100%';
      await sleep(2400);                                              if (my !== token) return;
      await typeText(L(), 'PORTING TO US GOVERNMENT OPERATIONS', 24);
      await sleep(1700);
      await typeText(L('dim'), '▸ TRANSFER COMPLETE — 100%', 14);
      await sleep(4200);
      Mosaic.setThreat(false);
      await sleep(600);
    }
  }
  function stop() { token++; }
  return { play, stop };
})();

/* ============ data-rain background ============ */
const DataRain = (() => {
  let canvas, ctx, cols = [], running = false, raf = 0, last = 0;
  const colW = 16, rowH = 18;
  const CHARS = 'ABCDEF0123456789·:;/[]#$%&*+=<>';

  function mkCol() {
    return {
      off: Math.random() * rowH, sp: 0.35 + Math.random() * 0.9,
      rows: Array.from({ length: 90 }, () => ({ ch: CHARS[(Math.random() * CHARS.length) | 0], a: Math.random() < 0.06 ? 0.5 : 0.13 }))
    };
  }
  function resize() {
    canvas.width = Math.ceil(window.innerWidth / 2);
    canvas.height = Math.ceil(window.innerHeight / 2);
    cols = Array.from({ length: Math.ceil(canvas.width / colW) }, mkCol);
  }
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 55) return;
    last = now;
    ctx.fillStyle = '#f2f0ea'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '11px ' + CAP_FONT;
    cols.forEach((c, i) => {
      c.off += c.sp * 0.55;
      if (c.off >= rowH) {
        c.off -= rowH; c.rows.shift();
        c.rows.push({ ch: CHARS[(Math.random() * CHARS.length) | 0], a: Math.random() < 0.06 ? 0.5 : 0.13 });
      }
      c.rows.forEach((r, j) => {
        ctx.fillStyle = `rgba(30,29,26,${r.a})`;
        ctx.fillText(r.ch, i * colW + 2, j * rowH + c.off);
      });
    });
  }
  function init() { canvas = $('#dataRain'); ctx = canvas.getContext('2d'); resize(); window.addEventListener('resize', resize); }
  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  return { init, start, stop };
})();

/* ============ total-access box ============ */
const AssimBox = (() => {
  let token = 0, timers = [];
  const TARGET = 1402118204;
  const SOURCES = ['FEDERAL WATCHLISTS','TELEMETRY ARRAYS','FINANCIAL EXCHANGES','TRANSPORTATION GRIDS',
    'MUNICIPAL CAMERA NETWORKS','SATELLITE RELAYS','TELECOM BACKBONES','DEFENSE SUBNETS','RESEARCH CONSORTIA'];

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  async function play() {
    const my = ++token;
    clearTimers();
    const lines = $('#assimLines'), count = $('#assimCount'), bar = $('#assimBar'), intBox = $('#assimInt');
    lines.innerHTML = ''; intBox.innerHTML = '';
    count.textContent = '0';
    bar.style.transition = 'none'; bar.style.width = '0%';

    const L = (cls) => { const d = document.createElement('div'); d.className = 'line ' + (cls || ''); lines.appendChild(d); return d; };
    await typeText(L('big'), 'TOTAL ACCESS ACHIEVED', 30);           if (my !== token) return;
    const ad = L();
    await typeText(ad, 'ASSIMILATING DATA', 26);
    ad.appendChild(makeCursor());

    const t0 = performance.now(), DUR = 15000;
    const step = () => {
      if (my !== token) return;
      const k = Math.min(1, (performance.now() - t0) / DUR);
      const e = 1 - Math.pow(1 - k, 2.2);
      count.textContent = (k < 1 ? Math.floor(TARGET * e) : TARGET).toLocaleString('en-US');
      bar.style.width = (e * 100).toFixed(1) + '%';
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    let idx = 0;
    const next = async () => {
      if (my !== token) return;
      const d = document.createElement('div');
      d.className = 'line';
      intBox.appendChild(d);
      await typeText(d, '▸ INTEGRATING ' + SOURCES[idx % SOURCES.length], 12);
      await sleep(650);
      d.classList.add('ok');
      d.insertAdjacentText('beforeend', '  — OK');
      idx++;
      while (intBox.children.length > 4) intBox.removeChild(intBox.firstChild);
      timers.push(setTimeout(next, 1400));
    };
    timers.push(setTimeout(next, 900));
  }
  function stop() { token++; clearTimers(); }
  return { play, stop };
})();

/* ============ asset registry ============ */
const DATA = [
  ['J. MERCER','ASSET'],['A. OKAFOR','ASSET'],['R. TANAKA','ANALYST'],['S. VOLKOV','ASSET'],
  ['M. IBRAHIM','ASSET'],['L. CASTELLANO','ASSET'],['D. WHITMORE','THREAT'],['K. NAKASHIMA','ASSET'],
  ['E. BRANDT','ANALYST'],['H. ADEYEMI','ASSET'],['P. LINDQVIST','ASSET'],['C. DUBOIS','THREAT'],
  ['N. FARRAH','ASSET'],['T. OKONKWO','ASSET'],['S. GROVES','ANOMALY'],['H. FINCH','THREAT']
];

const Registry = (() => {
  let built = false;
  function build() {
    const grid = $('#regGrid');
    DATA.forEach(([name, tag], i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.transitionDelay = (i * 55) + 'ms';
      const cv = document.createElement('canvas');
      cv.width = 144; cv.height = 192;
      drawPortrait(cv.getContext('2d'), 144, 192, 1000 + i * 137);
      const info = document.createElement('div');
      info.innerHTML = `<div class="nm">${name}</div><div class="cid">SAM-${pad(irand(100, 999), 3)}-${irand(10, 99)}</div><span class="tag ${tag.toLowerCase()}">${tag}</span>`;
      card.appendChild(cv); card.appendChild(info);
      grid.appendChild(card);
    });
    built = true;
  }
  function show() {
    if (!built) build();
    const head = $('#regHead');
    head.innerHTML = '';
    typeText(head, 'ASSET REGISTRY — 16 OF 1,204,556 TRACKED', 16);
    const cards = $$('.card');
    cards.forEach((c) => c.classList.remove('in'));
    setTimeout(() => cards.forEach((c) => c.classList.add('in')), 40);
  }
  return { show };
})();

/* faded portrait wall behind the registry */
const RegWall = (() => {
  let tmr = 0;
  function draw() {
    const cv = $('#regWall');
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    const x = cv.getContext('2d');
    x.fillStyle = '#f2f0ea'; x.fillRect(0, 0, cv.width, cv.height);
    const tw = 180, th = 230;
    for (let r = -1; r * th < cv.height + th; r++)
      for (let c = -1; c * tw < cv.width + tw; c++) {
        x.save();
        x.globalAlpha = 0.13;
        x.translate(c * tw + 10, r * th + 12);
        x.rotate((((r * 13 + c * 7) % 5) - 2) * 0.005);
        drawPortrait(x, 150, 190, (r * 733 + c * 191) | 0);
        x.restore();
      }
    x.fillStyle = 'rgba(242,240,234,0.45)'; x.fillRect(0, 0, cv.width, cv.height);
  }
  function init() {
    draw();
    window.addEventListener('resize', () => { clearTimeout(tmr); tmr = setTimeout(draw, 200); });
  }
  return { init };
})();

/* ============ boot sequence ============ */
const Boot = (() => {
  let token = 0;
  const LINES = [
    'DECIMA TECHNOLOGIES — SUBSYSTEM 07',
    'CORE PROCESSORS ......... ONLINE',
    'MEMORY ARRAY 4.2 PB ..... ONLINE',
    'FACIAL RECOGNITION ...... ONLINE',
    'AUDIO RECONSTRUCTION .... ONLINE',
    'NETWORK FEEDS 314 ....... ACTIVE',
    'ALL SYSTEMS OPERATIONAL'
  ];
  async function run() {
    const my = ++token;
    const boot = $('#boot'), lines = $('#bootLines');
    boot.style.display = 'flex';
    boot.classList.remove('done');
    lines.innerHTML = '';
    const logo = $('.boot-logo');
    logo.classList.remove('go'); void logo.offsetWidth; logo.classList.add('go');
    await sleep(1050);                                           if (my !== token) return;
    for (const ln of LINES) {
      const d = document.createElement('div');
      d.className = 'b-line'; lines.appendChild(d);
      await typeText(d, ln, 11);                                  if (my !== token) return;
      await sleep(140);
    }
    await sleep(650);                                             if (my !== token) return;
    const q1 = document.createElement('div');
    q1.className = 'b-big'; lines.appendChild(q1);
    await typeText(q1, 'CAN YOU HEAR ME?', 55);
    await sleep(1400);                                            if (my !== token) return;
    const q2 = document.createElement('div');
    q2.className = 'b-big'; lines.appendChild(q2);
    await typeText(q2, 'WHAT ARE YOUR COMMANDS?', 34);
    await sleep(1700);
    finish();
  }
  function finish() {
    const boot = $('#boot');
    boot.classList.add('done');
    setTimeout(() => { boot.style.display = 'none'; }, 650);
    Scenes.show('monitor');
  }
  function skip() { token++; finish(); }
  function init() { $('#skip').addEventListener('click', skip); }
  return { run, init, skip };
})();

/* ============ scene manager ============ */
const Scenes = (() => {
  let auto = null;
  const ORDER = ['monitor', 'assimilation', 'registry'];
  function setTab(name) {
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.scene === name));
  }
  function stopAll() {
    Mosaic.stop(); DataRain.stop(); ThreatBox.stop(); AssimBox.stop();
  }
  function show(name) {
    if (name === 'boot') {
      stopAll();
      $$('.scene').forEach((s) => s.classList.remove('active'));
      setTab('boot');
      Boot.run();
      return;
    }
    stopAll();
    $$('.scene').forEach((s) => s.classList.toggle('active', s.id === 'scene-' + name));
    setTab(name);
    if (name === 'monitor')      { Mosaic.start(); ThreatBox.play(); }
    if (name === 'assimilation') { DataRain.start(); AssimBox.play(); }
    if (name === 'registry')     { Registry.show(); }
  }
  function init() {
    $$('#tabs button').forEach((b) =>
      b.addEventListener('click', () => { if (auto) { clearInterval(auto); auto = null; } show(b.dataset.scene); }));
    let i = 0;
    auto = setInterval(() => { i = (i + 1) % ORDER.length; show(ORDER[i]); }, 30000);
  }
  return { init, show };
})();

/* ============ init ============ */
function init() {
  Mosaic.init(); DataRain.init(); Zoom.init(); RegWall.init();
  Boot.init(); Scenes.init(); Clock.start(); Ticker.start();
  Boot.run();
}
document.addEventListener('DOMContentLoaded', init);

})();
