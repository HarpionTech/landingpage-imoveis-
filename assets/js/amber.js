/* ═══════════════════════════════════════════════════════
   AMBER POINTILLISM — Ribbon dourado em pontos
   Milhares de partículas seguem um caminho ondulado.
   Cada ponto tem brilho próprio + glow aditivo (lighter).
═══════════════════════════════════════════════════════ */
(function () {
  var canvas = document.getElementById('amberCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d', { desynchronized: true, alpha: true });
  var w, h, dpr;
  var dots = [];
  var orbs = [];
  var paused = false;
  var t = 0;
  var lastTs = 0;

  // Device tier — afeta densidade, DPR e fps cap (perf-aware)
  var isMobile = window.matchMedia('(max-width: 767px)').matches;
  var isTablet = !isMobile && window.matchMedia('(max-width: 1024px)').matches;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Throttle de frames por tier (ms entre frames)
  var minFrameMs = isMobile ? 1000 / 35 : isTablet ? 1000 / 50 : 0; // desktop = full 60fps
  var lastDrawTs = 0;

  // Densidades por tier (px² por ponto — quanto menor, mais denso)
  var DENSITY = isMobile ? 1400 : isTablet ? 900 : 600;
  var MAX_PER_BAND = isMobile ? 1600 : isTablet ? 2400 : 3200;
  var ORB_COUNT = isMobile ? 8 : isTablet ? 14 : 20;

  var lastWidth = 0;
  var lockedHeight = isMobile ? Math.max(window.innerHeight, screen.height || window.innerHeight) : 0;

  document.addEventListener('visibilitychange', function () { paused = document.hidden; });

  function resize() {
    // DPR=1 sempre — pontos são pequenos, 2x não agrega valor visual e dobra fillrate
    dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
    w = window.innerWidth;
    h = isMobile ? lockedHeight : window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 3 ribbons — celular tem ondas mais lineares (amplitude menor, frequencia menor)
  // mas mesmas posicoes, fases, densidade e velocidade
  var BANDS = isMobile ? [
    { cy: 0.50, phase: 0.00, freq: 1.40, amp: 0.07, t1: 0.35, t2: 0.27 },
    { cy: 0.30, phase: 1.30, freq: 1.60, amp: 0.05, t1: 0.42, t2: 0.31 },
    { cy: 0.72, phase: 2.40, freq: 1.25, amp: 0.06, t1: 0.30, t2: 0.23 }
  ] : [
    { cy: 0.50, phase: 0.00, freq: 1.80, amp: 0.08, t1: 0.35, t2: 0.27 },
    { cy: 0.30, phase: 1.30, freq: 2.00, amp: 0.06, t1: 0.42, t2: 0.31 },
    { cy: 0.72, phase: 2.40, freq: 1.60, amp: 0.07, t1: 0.30, t2: 0.23 }
  ];
  // segundas harmonicas tambem mais suaves no celular
  var SECONDARY_AMP = isMobile ? 0.025 : 0.03;
  var TERTIARY_AMP = isMobile ? 0.018 : 0.02;

  function init() {
    resize();
    dots = [];
    var area = w * h;
    var perBand = Math.min(Math.floor(area / DENSITY), MAX_PER_BAND);
    for (var b = 0; b < BANDS.length; b++) {
      for (var i = 0; i < perBand; i++) {
        var v = (Math.random() * 2 - 1);
        v = v * v * v;
        var hue = 36 + Math.random() * 16;
        var sat = 78 + Math.random() * 18;
        var light = 52 + Math.random() * 24;
        dots.push({
          band: b,
          u: Math.random(),
          v: v,
          size: Math.random() * 1.8 + 0.5,
          baseAlpha: Math.random() * 0.6 + 0.35,
          speed: Math.random() * 0.6 + 0.4,
          flicker: Math.random() * Math.PI * 2,
          flickRate: Math.random() * 1.6 + 0.8,
          // PRE-COMPUTE: parte fixa da string de cor, só concatena alpha por frame
          colorBase: 'hsla(' + (hue | 0) + ',' + (sat | 0) + '%,' + (light | 0) + '%,',
          bright: Math.random() < 0.12
        });
      }
    }
    orbs = [];
    for (var j = 0; j < ORB_COUNT; j++) {
      orbs.push({
        band: j % BANDS.length,
        u: (j / ORB_COUNT) + Math.random() * 0.04,
        radius: Math.random() * 60 + 60,
        speed: Math.random() * 0.3 + 0.1,
        alpha: Math.random() * 0.10 + 0.06
      });
    }
  }

  function ribbon(u, time, band) {
    var B = BANDS[band];
    var x = w * 0.04 + u * w * 0.92;
    var cy = h * B.cy;
    var phase = u * Math.PI * B.freq + time * B.t1 + B.phase;
    var y = cy
          + Math.sin(phase) * h * B.amp
          + Math.sin(phase * 1.9 + time * B.t2) * h * SECONDARY_AMP
          + Math.cos(u * Math.PI * 5.3 + time * 0.18 + B.phase) * h * TERTIARY_AMP;
    return { x: x, y: y };
  }

  function draw(ts) {
    if (paused) return;
    // Frame throttle por tier (skip frame se vier antes do mínimo)
    if (minFrameMs && ts - lastDrawTs < minFrameMs) return;
    lastDrawTs = ts;

    var dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
    lastTs = ts;
    t += dt;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < orbs.length; k++) {
      var o = orbs[k];
      o.u += o.speed * dt * 0.04;
      if (o.u > 1) o.u -= 1;
      var op = ribbon(o.u, t, o.band);
      var rg = ctx.createRadialGradient(op.x, op.y, 0, op.x, op.y, o.radius);
      rg.addColorStop(0, 'rgba(255, 188, 92, ' + o.alpha.toFixed(3) + ')');
      rg.addColorStop(0.5, 'rgba(220, 140, 50, ' + (o.alpha * 0.35).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(160, 80, 20, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(op.x - o.radius, op.y - o.radius, o.radius * 2, o.radius * 2);
    }

    var ribbonHalf = isMobile ? Math.min(h * 0.32, 240) : Math.min(h * 0.30, 230);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      d.u += d.speed * dt * 0.018;
      if (d.u > 1) d.u -= 1;
      var p = ribbon(d.u, t, d.band);

      var wob = Math.sin(t * 0.7 + d.flicker) * 0.08;
      var n = d.v + wob;
      var y = p.y + n * ribbonHalf;
      var falloff = Math.exp(-n * n * 1.8);

      var flick = 0.65 + 0.35 * Math.sin(t * d.flickRate + d.flicker);
      var alpha = d.baseAlpha * falloff * flick;
      if (alpha < 0.012) continue;

      var size = d.size * (0.75 + falloff * 0.55);

      // Alpha quantizado (evita toFixed que aloca string) — divide por 1024, multiplica de volta
      var aStr = (((alpha * 1000) | 0) / 1000);
      ctx.fillStyle = d.colorBase + aStr + ')';
      ctx.beginPath();
      ctx.arc(p.x, y, size, 0, Math.PI * 2);
      ctx.fill();

      if (d.bright && falloff > 0.45) {
        var aCore = (((alpha * 900) | 0) / 1000);
        ctx.fillStyle = 'rgba(255,240,200,' + aCore + ')';
        ctx.beginPath();
        ctx.arc(p.x, y, size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  var rT;
  lastWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    // mobile: ignora resize disparado por toolbar do navegador (so largura conta)
    if (isMobile && window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(rT);
    rT = setTimeout(init, 200);
  }, { passive: true });
  // orientationchange recaptura altura travada
  window.addEventListener('orientationchange', function () {
    lockedHeight = Math.max(window.innerHeight, screen.height || window.innerHeight);
    clearTimeout(rT);
    rT = setTimeout(init, 300);
  }, { passive: true });

  init();
  (function loop(ts) { draw(ts || 0); requestAnimationFrame(loop); })();
})();
