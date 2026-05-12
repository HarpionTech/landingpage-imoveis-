/* ══════════════════════════════════════════════════════════════
   HELOÍSA — Lenis + GSAP ScrollTrigger
   Foco: fluidez. Sem scrub agressivo, sem overshoot,
   reveals curtos com easings naturais.
══════════════════════════════════════════════════════════════ */
gsap.registerPlugin(ScrollTrigger);

/* ── Lenis smooth scroll — modo Igloo/Pioneer (lerp puro) ── */
var lenis = new Lenis({
  lerp: 0.085,            // interpolação contínua — fluido como Igloo
  smoothWheel: true,
  syncTouch: false,       // toque mantém scroll nativo (mais responsivo no celular)
  wheelMultiplier: 1.0,
  touchMultiplier: 1.0    // velocidade natural do dedo
});
function lenisRaf(time) { lenis.raf(time); requestAnimationFrame(lenisRaf); }
requestAnimationFrame(lenisRaf);
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.lagSmoothing(500, 33);

/* ── Hero entrance — stagger curto e direto ── */
gsap.set('.scroll-item', { opacity: 0, y: 24 });

var heroTl = gsap.timeline({ delay: 0.15, defaults: { ease: 'power2.out', duration: 0.7 } });
heroTl
  .to('.hero-title',             { opacity: 1, y: 0 })
  .to('.hero-subtitle',          { opacity: 1, y: 0 }, '-=0.45')
  .to('.hero-actions',           { opacity: 1, y: 0 }, '-=0.45')
  .to('.hero-stats',             { opacity: 1, y: 0 }, '-=0.40')
  .to('.hero-scroll-indicator',  { opacity: 1     }, '-=0.30');

/* ── Hero parallax leve (sem scrub pesado) ── */
gsap.to('.hero-content', {
  yPercent: -8,
  ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.4 }
});

/* ── Generic scroll items (não-hero, não-card) ── */
document.querySelectorAll('.scroll-item').forEach(function (el) {
  if (el.closest('.hero')) return;
  if (el.classList.contains('property-card'))   return;
  if (el.classList.contains('region-card'))     return;
  if (el.classList.contains('testimonial-card')) return;
  gsap.to(el, {
    scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
    opacity: 1, y: 0,
    duration: 0.7, ease: 'power2.out',
    clearProps: 'transform'
  });
});

/* ── Card groups: um ST por grupo + stagger interno (sem dessincronizar) ── */
function staggerGroup(parentSel, itemSel, opts) {
  opts = opts || {};
  var parent = document.querySelector(parentSel);
  if (!parent) return;
  var items = parent.querySelectorAll(itemSel);
  if (!items.length) return;
  gsap.set(items, { opacity: 0, y: opts.y || 30 });
  ScrollTrigger.create({
    trigger: parent, start: opts.start || 'top 80%', once: true,
    onEnter: function () {
      gsap.to(items, {
        opacity: 1, y: 0,
        duration: opts.duration || 0.6,
        ease: opts.ease || 'power2.out',
        stagger: opts.stagger || 0.08,
        clearProps: 'transform,opacity'
      });
    }
  });
}

staggerGroup('.properties-grid',     '.property-card',     { y: 30, stagger: 0.10 });
staggerGroup('.regions-grid',        '.region-card',       { y: 28, stagger: 0.07, start: 'top 85%' });
staggerGroup('.testimonials-grid',   '.testimonial-card',  { y: 26, stagger: 0.10 });
/* Credentials — reveal sequencial (sincronizado com pódio: dispara quando #sobre tem 75% à mostra) */
(function () {
  var parent = document.querySelector('.about-credentials');
  if (!parent) return;
  var items = parent.querySelectorAll('.credential');
  if (!items.length) return;

  gsap.set(items, {
    opacity: 0,
    x: -20,
    clipPath: 'inset(0 100% 0 0)',
    webkitClipPath: 'inset(0 100% 0 0)'
  });

  var sobreSection = document.getElementById('sobre');
  var trigger = sobreSection || parent;
  ScrollTrigger.create({
    trigger: trigger,
    start: sobreSection ? 'top 25%' : 'top 80%',
    once: true,
    onEnter: function () {
      var tl = gsap.timeline({ defaults: { duration: 0.85, ease: 'power3.out' } });
      items.forEach(function (el, i) {
        tl.to(el, {
          opacity: 1,
          x: 0,
          clipPath: 'inset(0 0% 0 0)',
          webkitClipPath: 'inset(0 0% 0 0)'
        }, i === 0 ? 0 : '>0.08');  // gap curto entre cards
      });
    }
  });
})();

/* ── CTA glow reveal ── */
ScrollTrigger.create({
  trigger: '.cta-card', start: 'top 78%', once: true,
  onEnter: function () {
    gsap.fromTo('.cta-glow',
      { scale: 0.6, opacity: 0 },
      { scale: 1, opacity: 0.3, duration: 1.2, ease: 'power2.out' });
  }
});

/* ── Counter animation ── */
ScrollTrigger.create({
  trigger: '.hero-stats', start: 'top 80%', once: true,
  onEnter: function () {
    document.querySelectorAll('.stat-number').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-target'));
      var obj = { val: 0 };
      gsap.to(obj, {
        val: target, duration: 1.8, ease: 'power2.out',
        onUpdate: function () { el.textContent = Math.floor(obj.val); }
      });
    });
  }
});

/* ── Navbar com rAF throttle ── */
var navbar = document.getElementById('navbar');
var navTicking = false;
function navUpdate() {
  navbar.classList.toggle('navbar-scrolled', window.pageYOffset > 80);
  navTicking = false;
}
window.addEventListener('scroll', function () {
  if (!navTicking) {
    requestAnimationFrame(navUpdate);
    navTicking = true;
  }
}, { passive: true });

/* ── Mobile menu ── */
var menuBtn = document.getElementById('mobileMenuBtn');
var mobileMenu = document.getElementById('mobileMenu');
if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', function () {
    menuBtn.classList.toggle('active');
    mobileMenu.classList.toggle('open');
    document.body.classList.toggle('menu-open');
  });
  document.querySelectorAll('.mobile-link').forEach(function (link) {
    link.addEventListener('click', function () {
      menuBtn.classList.remove('active');
      mobileMenu.classList.remove('open');
      document.body.classList.remove('menu-open');
    });
  });
}

/* ── Smooth scroll para anchors do mesmo documento via Lenis ── */
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var href = a.getAttribute('href');
    if (!href || href === '#') return;
    var target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -40, duration: 1.2 });
  });
});

/* ── Refresh após carregamento total (fontes, imagens) ── */
window.addEventListener('load', function () { ScrollTrigger.refresh(); });
