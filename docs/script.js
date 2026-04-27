/* ============================================
   Hero: Snow Particles - Minecraft Style
   ============================================ */
const snow = document.getElementById('snow');
const particleCount = 150;

for (let i = 0; i < particleCount; i++) {
    const s = document.createElement('div');
    s.className = 'snow';

    const size = Math.random() > 0.5 ? 5 : 7;
    const drift = (Math.random() - 0.5) * 40;
    const duration = Math.random() * 3 + 10;
    const delay = Math.random() * 8;
    const opacity = Math.random() * 0.3 + 0.5;

    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.left = (Math.random() * 100) + 'vw';
    s.style.top = '-10px';
    s.style.setProperty('--drift', drift + 'px');
    s.style.animationDelay = delay + 's';
    s.style.animationDuration = duration + 's';
    s.style.opacity = opacity;

    snow.appendChild(s);
}

/* ============================================
   Scroll Logic: Background Interpolation
   Linear interpolation from pure black to ice blue
   ============================================ */
const BG_START = { r: 0, g: 0, b: 0 };
const BG_END = { r: 14, g: 26, b: 46 };

const gradientEl = document.querySelector('.gradient');

let maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

window.addEventListener('resize', () => {
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}, { passive: true });

let isScrolling = false;

function updateBackground() {
    const scrollY = window.scrollY;

    const raw = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;
    const t = raw < 0.5
        ? 2 * raw * raw
        : 1 - Math.pow(-2 * raw + 2, 2) / 2;

    const r = Math.round(BG_START.r + (BG_END.r - BG_START.r) * t);
    const g = Math.round(BG_START.g + (BG_END.g - BG_START.g) * t);
    const b = Math.round(BG_START.b + (BG_END.b - BG_START.b) * t);

    gradientEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    isScrolling = false;
}

window.addEventListener('scroll', () => {
    if (!isScrolling) {
        window.requestAnimationFrame(updateBackground);
        isScrolling = true;
    }
}, { passive: true });
updateBackground();

/* ============================================
   Scroll Fade-in Animation
   ============================================ */
const fadeElements = document.querySelectorAll('.fade-in');

const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
});

fadeElements.forEach(el => fadeObserver.observe(el));

/* ============================================
   Card Mouse Tracking (Glow Effect)
   ============================================ */
const cards = document.querySelectorAll('.feature-card, .download-card');

cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', x + '%');
        card.style.setProperty('--mouse-y', y + '%');
    });

    card.addEventListener('mouseleave', () => {
        card.style.setProperty('--mouse-x', '50%');
        card.style.setProperty('--mouse-y', '50%');
    });
});

/* ============================================
   Cursor Interactions: Parallax Snow + Vignette Lantern
   ============================================ */
const vignette = document.querySelector('.vignette');

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let targetMouseX = window.innerWidth / 2;
let targetMouseY = window.innerHeight / 2;

function handleMouseMove(e) {
    targetMouseX = e.clientX;
    targetMouseY = e.clientY;
}

window.addEventListener('mousemove', handleMouseMove, { passive: true });

function animateCursor() {
    // Optimisation: only calculate if mouse has moved significantly
    if (Math.abs(targetMouseX - mouseX) > 0.1 || Math.abs(targetMouseY - mouseY) > 0.1) {
        mouseX += (targetMouseX - mouseX) * 0.06;
        mouseY += (targetMouseY - mouseY) * 0.06;

        const screenCX = window.innerWidth / 2;
        const screenCY = window.innerHeight / 2;
        const normX = (mouseX - screenCX) / screenCX;
        const normY = (mouseY - screenCY) / screenCY;

        document.documentElement.style.setProperty('--cursor-x', `${normX * 15}px`);
        document.documentElement.style.setProperty('--cursor-y', `${normY * 10}px`);

        const edgeX = Math.max(5, Math.min(95, 50 + normX * 25));
        const edgeY = Math.max(5, Math.min(95, 50 + normY * 25));
        
        vignette.style.setProperty('--vx', `${edgeX}%`);
        vignette.style.setProperty('--vy', `${edgeY}%`);
    }

    requestAnimationFrame(animateCursor);
}

animateCursor();