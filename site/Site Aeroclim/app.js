document.documentElement.classList.add('enhanced');

const header = document.querySelector('header');
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelectorAll('header nav a');

if (navToggle && header) {
  navToggle.addEventListener('click', () => {
    header.classList.toggle('nav-open');
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('nav-open');
    });
  });
}

const progressBar = document.querySelector('.scroll-progress span');
const updateProgress = () => {
  if (!progressBar) return;
  const scrollTop = window.scrollY;
  const docHeight = document.body.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? scrollTop / docHeight : 0;
  progressBar.style.setProperty('--progress', progress);
};

let progressTicking = false;
const scheduleProgressUpdate = () => {
  if (progressTicking) return;
  progressTicking = true;
  requestAnimationFrame(() => {
    progressTicking = false;
    updateProgress();
  });
};

window.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
window.addEventListener('resize', updateProgress);
updateProgress();

const prefersReducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
if (!prefersReducedMotion) {
  const revealTargets = document.querySelectorAll(
    '.hero, .stat, .card, .pricing-card, .zone-card, .timeline-item, .contact-card, .pricing-grid, .gallery-grid img'
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    },
    { threshold: 0.2 }
  );

  revealTargets.forEach((el) => {
    el.classList.add('will-reveal');
    observer.observe(el);
  });
}

const floatingLinks = document.querySelectorAll('.floating-contact a');
floatingLinks.forEach((link) => {
  link.addEventListener('mouseenter', () => {
    link.classList.add('pulse');
  });
  link.addEventListener('animationend', () => {
    link.classList.remove('pulse');
  });
});

const canvas = document.getElementById('stellar-canvas');
if (canvas && window.innerWidth > 768) {
  const ctx = canvas.getContext('2d');
  let stars = [];
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  const parallax = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };

  const createStars = () => {
    const count = prefersReducedMotion ? 40 : 120;
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * viewportWidth,
      y: Math.random() * viewportHeight,
      size: Math.random() * 1.5 + 0.2,
      speed: prefersReducedMotion ? 0 : Math.random() * 0.2 + 0.02
    }));
  };

  const resizeCanvas = () => {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewportWidth * dpr;
    canvas.height = viewportHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    createStars();
  };

  const drawFrame = () => {
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    stars.forEach((star) => {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(160, 215, 255, 0.65)';
      const x = star.x + parallax.currentX * star.size;
      const y = star.y + parallax.currentY * star.size;
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fill();

      if (!prefersReducedMotion) {
        star.y += star.speed;
        if (star.y > viewportHeight) {
          star.y = -2;
          star.x = Math.random() * viewportWidth;
        }
      }
    });

    parallax.currentX += (parallax.targetX - parallax.currentX) * 0.02;
    parallax.currentY += (parallax.targetY - parallax.currentY) * 0.02;
  };

  const render = () => {
    drawFrame();
    if (!prefersReducedMotion) {
      requestAnimationFrame(render);
    }
  };

  resizeCanvas();
  drawFrame();
  if (!prefersReducedMotion) {
    render();
  }

  if (!prefersReducedMotion) {
    window.addEventListener('mousemove', (event) => {
      parallax.targetX = (event.clientX / viewportWidth - 0.5) * 10;
      parallax.targetY = (event.clientY / viewportHeight - 0.5) * 10;
    }, { passive: true });
  }

  window.addEventListener('resize', resizeCanvas);
}

/* ── Back-to-top button ───────────────────────────────── */
const backToTop = document.querySelector('.back-to-top');
if (backToTop) {
  const toggleBackToTop = () => {
    backToTop.classList.toggle('is-visible', window.scrollY > 400);
  };
  window.addEventListener('scroll', toggleBackToTop, { passive: true });
  toggleBackToTop();
  backToTop.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ── Close mobile nav on click outside ────────────────── */
if (navToggle && header) {
  document.addEventListener('click', (e) => {
    if (header.classList.contains('nav-open') && !header.contains(e.target)) {
      header.classList.remove('nav-open');
    }
  });
}

/* ── Gallery lightbox ─────────────────────────────────── */
const galleryImages = document.querySelectorAll('.gallery-grid img');
if (galleryImages.length) {
  let lastFocused = null;
  const overlay = document.createElement('div');
  overlay.classList.add('lightbox-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image agrandie');
  overlay.innerHTML = '<button class="lightbox-close" aria-label="Fermer">&times;</button><img alt="">';
  document.body.appendChild(overlay);
  const lbImg = overlay.querySelector('img');
  const lbClose = overlay.querySelector('.lightbox-close');

  const openLightbox = (src, alt) => {
    lastFocused = document.activeElement;
    lbImg.src = src;
    lbImg.alt = alt;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  };
  const closeLightbox = () => {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  };

  galleryImages.forEach((img) => {
    img.style.cursor = 'zoom-in';
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(img.src, img.alt);
      }
    });
  });
  lbClose.addEventListener('click', closeLightbox);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeLightbox();
  });
}

const testimonialSlider = document.querySelector('.testimonial-slider');
if (testimonialSlider) {
  const track = testimonialSlider.querySelector('.testimonial-track');
  const slides = testimonialSlider.querySelectorAll('.testimonial');
  if (track && slides.length) {
    const prevBtn = testimonialSlider.querySelector('[data-slide="prev"]');
    const nextBtn = testimonialSlider.querySelector('[data-slide="next"]');
    let currentIndex = 0;
    let autoSlide;

    const goTo = (index) => {
      currentIndex = (index + slides.length) % slides.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
    };

    const play = () => {
      if (slides.length < 2) return;
      autoSlide = setInterval(() => {
        goTo(currentIndex + 1);
      }, 7000);
    };

    const stop = () => {
      if (autoSlide) {
        clearInterval(autoSlide);
        autoSlide = null;
      }
    };

    prevBtn?.addEventListener('click', () => {
      stop();
      goTo(currentIndex - 1);
      play();
    });

    nextBtn?.addEventListener('click', () => {
      stop();
      goTo(currentIndex + 1);
      play();
    });

    testimonialSlider.addEventListener('mouseenter', stop);
    testimonialSlider.addEventListener('mouseleave', play);

    goTo(0);
    play();
  }
}
