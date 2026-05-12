import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

THREE.Cache.enabled = true;

const container = document.getElementById('podiumCanvas');
if (!container) throw new Error('podiumCanvas not found');

const W = () => container.clientWidth;
const H = () => container.clientHeight;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 50);
camera.position.set(0, -0.65, 6.4);
camera.lookAt(0, -0.95, 0);

/* Cap pixel ratio agressivo para perf */
const isMobile3D = window.matchMedia('(max-width: 767px)').matches;
const isTablet3D = !isMobile3D && window.matchMedia('(max-width: 1024px)').matches;
const dpr = isMobile3D ? 1 : isTablet3D ? 1.25 : Math.min(window.devicePixelRatio, 1.5);
const renderer = new THREE.WebGLRenderer({ antialias: dpr < 1.5, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(W(), H());
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// Luzes (espelho do setup Blender)
scene.add(new THREE.AmbientLight(0x18130a, 1.2));
const key = new THREE.DirectionalLight(0xffe8b0, 4.0);
key.position.set(3, 5, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0x6688ff, 2.5);
rim.position.set(-4, 3, -4); scene.add(rim);
const goldLight = new THREE.PointLight(0xd4921a, 10, 14);
goldLight.position.set(0, -2, 3); scene.add(goldLight);
const front = new THREE.DirectionalLight(0xffddb0, 1.5);
front.position.set(0, 1, 6); scene.add(front);

// Master group — rotaciona tudo junto com drag
const masterGroup = new THREE.Group();
scene.add(masterGroup);

// Pódio — posicionado mais baixo
const podiumGroup = new THREE.Group();
podiumGroup.position.y = -1.8;
masterGroup.add(podiumGroup);

let floatingCoin = null;

// Carrega o GLB exportado do Blender
const loader = new GLTFLoader();
loader.load('assets/3d/podium.glb', (gltf) => {
  podiumGroup.add(gltf.scene);

  // Moeda — interior preto, anéis dourados
  const coinGroup = new THREE.Group();
  coinGroup.position.set(0, 1.2, 0);
  floatingCoin = coinGroup;

  // Foto de perfil na face da moeda (MeshBasicMaterial e toneMapped: false para manter cor natural)
  const coinFaceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  coinGroup.add(new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 64),
    coinFaceMat
  ));
  new THREE.TextureLoader().load('assets/img/elements/01_foto.png', (photoTex) => {
    photoTex.colorSpace = THREE.SRGBColorSpace;

    // Melhorar nitidez extrema
    photoTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    photoTex.generateMipmaps = false;
    photoTex.minFilter = THREE.LinearFilter;
    photoTex.magFilter = THREE.LinearFilter;

    // Corrigir distorção e dar um zoom para alinhar/esconder a borda interna da imagem
    const aspect = photoTex.image.width / photoTex.image.height;
    const zoom = 0.75; // Zoom in 25% para expandir a imagem até a borda 3D
    if (aspect > 1) {
      photoTex.repeat.set((1 / aspect) * zoom, zoom);
      photoTex.offset.set((1 - (1 / aspect) * zoom) / 2, (1 - zoom) / 2);
    } else {
      photoTex.repeat.set(zoom, aspect * zoom);
      photoTex.offset.set((1 - zoom) / 2, (1 - aspect * zoom) / 2);
    }

    coinFaceMat.map = photoTex;
    coinFaceMat.needsUpdate = true;
  });

  // Anel dourado grosso (borda)
  coinGroup.add(new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.07, 24, 80),
    new THREE.MeshStandardMaterial({ color: 0xD4A21A, metalness: 1.0, roughness: 0.10 })
  ));

  // Anel fino decorativo externo
  coinGroup.add(new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.02, 16, 80),
    new THREE.MeshStandardMaterial({ color: 0xC8A96E, metalness: 1.0, roughness: 0.18 })
  ));

  masterGroup.add(coinGroup);

  // Monograma HS real (logo_hs_mono.png) na frente do pódio
  // AdditiveBlending: fundo preto = invisível, letras douradas aparecem
  new THREE.TextureLoader().load('assets/img/elements/logo_hs_mono.png', (logoTex) => {
    logoTex.colorSpace = THREE.SRGBColorSpace;
    // Imagem 1536×1024 → ratio 1.5:1
    const hsMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 0.70),
      new THREE.MeshBasicMaterial({
        map: logoTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    hsMesh.position.set(0, 0.04, 1.502);
    podiumGroup.add(hsMesh);
  });
}, undefined, (err) => console.error('GLB não carregou:', err));

// Interação mouse e toque com Raycaster (clicar apenas no pódio)
let targetRotY = 0, isDragging = false, lastMX = 0;
let isTouchDragging = false, lastTX = 0;
let normMouseX = 0, normMouseY = 0;
let coinFlipTarget = 0, coinFlipCurrent = 0;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getIntersects(clientX, clientY) {
  const r = container.getBoundingClientRect();
  mouse.x = ((clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const objects = [...podiumGroup.children];
  if (floatingCoin) objects.push(floatingCoin);
  return raycaster.intersectObjects(objects, true);
}

container.addEventListener('mousedown', (e) => {
  const intersects = getIntersects(e.clientX, e.clientY);
  if (intersects.length > 0) {
    // Check if the clicked object is part of the coin
    let clickedCoin = false;
    intersects[0].object.traverseAncestors(a => { if (a === floatingCoin) clickedCoin = true; });

    if (intersects[0].object === floatingCoin || clickedCoin) {
      coinFlipTarget += Math.PI * 2; // Trigger a full 360 flip on coin
    } else {
      // Trigger dragging ONLY if the podium was clicked
      isDragging = true;
      lastMX = e.clientX;
      container.style.cursor = 'grabbing';
    }
  }
});
window.addEventListener('mouseup', () => { isDragging = false; container.style.cursor = 'default'; });

container.addEventListener('mousemove', (e) => {
  normMouseX = (e.clientX / window.innerWidth) * 2 - 1;
  normMouseY = -(e.clientY / window.innerHeight) * 2 + 1;

  if (isDragging) {
    targetRotY += (e.clientX - lastMX) * 0.009;
    lastMX = e.clientX;
  } else {
    container.style.cursor = getIntersects(e.clientX, e.clientY).length > 0 ? 'grab' : 'default';
  }
});
container.addEventListener('mouseleave', () => { isDragging = false; container.style.cursor = 'default'; });

// Touch
container.addEventListener('touchstart', (e) => {
  const intersects = getIntersects(e.touches[0].clientX, e.touches[0].clientY);
  if (intersects.length > 0) {
    let clickedCoin = false;
    intersects[0].object.traverseAncestors(a => { if (a === floatingCoin) clickedCoin = true; });

    if (intersects[0].object === floatingCoin || clickedCoin) {
      coinFlipTarget += Math.PI * 2;
    } else {
      isTouchDragging = true;
      lastTX = e.touches[0].clientX;
    }
  }
}, { passive: true });
container.addEventListener('touchmove', (e) => {
  if (isTouchDragging) {
    targetRotY += (e.touches[0].clientX - lastTX) * 0.009;
    lastTX = e.touches[0].clientX;
  }
}, { passive: true });
window.addEventListener('touchend', () => { isTouchDragging = false; });

// Intro Animation Setup
let hasAnimatedIn = false;
let animStartTime = 0;
let isContainerVisible = false;

// Visibilidade contínua (pra pausar render quando fora de tela) — sem disparar animação aqui
const visibilityObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => { isContainerVisible = entry.isIntersecting; });
}, { threshold: 0 });
visibilityObserver.observe(container);

// Disparo da animação de entrada: quando 75% da seção #sobre estiver visível.
// start: 'top 25%' = topo da seção chega a 25% do topo da viewport
// -> nesse momento 75% da viewport está preenchida pela seção
const sobreSection = document.getElementById('sobre');
if (sobreSection && window.ScrollTrigger) {
  ScrollTrigger.create({
    trigger: sobreSection,
    start: 'top 75%',
    once: true,
    onEnter: () => {
      if (hasAnimatedIn) return;
      hasAnimatedIn = true;
      animStartTime = clock.getElapsedTime();
    }
  });
} else {
  // Fallback (sem ScrollTrigger por algum motivo) — dispara no primeiro intersect
  const fallback = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasAnimatedIn) {
        hasAnimatedIn = true;
        animStartTime = clock.getElapsedTime();
        fallback.disconnect();
      }
    });
  }, { threshold: 0.75 });
  fallback.observe(container);
}

const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
const easeOutBounce = x => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  else if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  else if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  else return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

// Loop
const clock = new THREE.Clock();
let currentMouseRotY = 0;
let currentMouseRotX = 0;

function animate() {
  requestAnimationFrame(animate);
  if (!isContainerVisible && hasAnimatedIn) return;
  const t = clock.getElapsedTime();

  currentMouseRotY += (targetRotY - currentMouseRotY) * 0.06;

  let introRotY = -Math.PI * 14;
  let podiumX = -28;

  if (hasAnimatedIn) {
    const elapsed = t - animStartTime;

    // Podium rolls in (0 to 1.5s)
    if (elapsed < 1.5) {
      const p = easeOutCubic(Math.min(elapsed / 1.5, 1));
      podiumX = -28 * (1 - p);
      introRotY = -Math.PI * 14 * (1 - p);
    } else {
      podiumX = 0;
      introRotY = 0;
    }

    // Coin rises from inside the podium smoothly AFTER podium stops
    if (floatingCoin) {
      if (elapsed < 1.8) {
        floatingCoin.position.y = -1.5;
        floatingCoin.scale.setScalar(0.001);
      } else if (elapsed < 4.3) {
        const p = Math.min((elapsed - 1.8) / 2.5, 1);
        // EaseOutQuart for a very smooth, long deceleration
        const ease = 1 - Math.pow(1 - p, 4);
        // Interpolate from deep y (-1.5) up to resting float position
        const restingY = 0.0 + Math.sin(t * 1.3) * 0.12;
        floatingCoin.position.y = -1.5 * (1 - ease) + restingY * ease;
        floatingCoin.scale.setScalar(ease);
      } else {
        floatingCoin.position.y = 0.0 + Math.sin(t * 1.3) * 0.12;
        floatingCoin.scale.setScalar(1);
      }

      // Apply Magnetic Tilt + Click Flip Rotation
      coinFlipCurrent += (coinFlipTarget - coinFlipCurrent) * 0.08;
      let targetCoinRotX = -normMouseY * 0.15; // Magnetic tilt
      let targetCoinRotY = normMouseX * 0.20 + coinFlipCurrent; // Magnetic tilt + flip

      floatingCoin.rotation.x += (targetCoinRotX - floatingCoin.rotation.x) * 0.1;
      floatingCoin.rotation.y += (targetCoinRotY - floatingCoin.rotation.y) * 0.1;
    }
  } else {
    // Initial hidden state before intersection
    if (floatingCoin) {
      floatingCoin.position.y = 5;
      floatingCoin.scale.setScalar(0.001);
    }
  }

  podiumGroup.position.x = podiumX;
  podiumGroup.rotation.y = currentMouseRotY + introRotY;
  podiumGroup.rotation.x = 0;

  camera.lookAt(0, -0.95, 0);
  renderer.render(scene, camera);
}
animate();

new ResizeObserver(() => {
  if (!W() || !H()) return;
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
  renderer.setSize(W(), H());
}).observe(container);
