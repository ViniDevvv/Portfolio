(() => {
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const preloader = document.getElementById('preloader');
  const hidePreloader = () => {
    if (!preloader) return;
    preloader.setAttribute('aria-busy', 'false');
    document.body.classList.add('is-loaded');
  };
  window.addEventListener('load', hidePreloader, { once: true });

  const markReady = () => {
    document.body.classList.add('is-ready');
    document.body.classList.remove('is-exiting');
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    requestAnimationFrame(markReady);
  } else {
    window.addEventListener('DOMContentLoaded', markReady, { once: true });
  }
  window.addEventListener('pageshow', () => {
    document.body.classList.add('is-ready');
    document.body.classList.remove('is-exiting');
  });

  const addBackButton = () => {
    if (document.querySelector('.back-button')) return;
    const button = document.createElement('a');
    button.className = 'back-button';
    button.href = '#';
    button.setAttribute('aria-label', 'Retour à la page précédente');
    button.innerHTML = '<span aria-hidden="true">←</span> Retour';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const lastInternal = sessionStorage.getItem('lastInternalPage');
      if (lastInternal && lastInternal !== window.location.href) {
        window.location.href = lastInternal;
        return;
      }
      window.location.href = 'index.html';
    });
    document.body.appendChild(button);
  };

  const addMenuHint = () => {
    if (document.querySelector('.menu-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'menu-hint';
    hint.textContent = 'Menu ↑ (survoler en haut)';
    document.body.appendChild(hint);
  };
  const progress = document.createElement('div');
  progress.id = 'scroll-progress';
  document.body.appendChild(progress);

  const progressGlow = document.createElement('div');
  progressGlow.id = 'scroll-progress-glow';
  document.body.appendChild(progressGlow);

  const updateProgress = () => {
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop || document.body.scrollTop;
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    const ratio = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    const width = `${Math.min(Math.max(ratio, 0), 1) * 100}%`;
    progress.style.width = width;
    progressGlow.style.width = width;
  };

  const sections = Array.from(
    document.querySelectorAll('main section, main2 section, main3 section, main4 section')
  );
  const images = Array.from(document.querySelectorAll('main img, main2 img, main3 img, main4 img'));

  const header = document.querySelector('header');
  const navLinks = Array.from(document.querySelectorAll('nav a[href^="#"]'));
  const tocLinks = Array.from(document.querySelectorAll('.toc-floating a[href^="#"]'));

  const markVisible = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top < vh * 0.9 && rect.bottom > 0) {
        section.classList.add('is-visible');
      }
    });
    images.forEach((img) => {
      const rect = img.getBoundingClientRect();
      if (rect.top < vh * 0.9 && rect.bottom > 0) {
        img.classList.add('is-visible');
      }
    });
  };

  const updateHeaderState = () => {
    if (!header) return;
    document.body.classList.toggle('scrolled', window.scrollY > 10);
  };


  const updateActiveNav = (activeId) => {
    [...navLinks, ...tocLinks].forEach((link) => {
      const target = link.getAttribute('href')?.slice(1);
      link.classList.toggle('is-active', target === activeId);
    });
  };

  if (sections.length || images.length) {
    markVisible();
    document.body.classList.add('reveal-enabled');

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2 }
      );

      sections.forEach((section) => observer.observe(section));
      images.forEach((img) => observer.observe(img));
    }

    if (sections.length && 'IntersectionObserver' in window && (navLinks.length || tocLinks.length)) {
      const navObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible && visible.target.id) {
            updateActiveNav(visible.target.id);
          }
        },
        { threshold: 0.35 }
      );

      sections
        .filter((section) => section.id)
        .forEach((section) => navObserver.observe(section));
    }
  }

  const onScroll = () => {
    updateProgress();
    updateHeaderState();
  };

  updateProgress();
  updateHeaderState();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    updateProgress();
  });

  const setupPageTransitions = () => {
    if (prefersReducedMotion) return;
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      const isExternal = link.target === '_blank' || link.hasAttribute('download') || href?.startsWith('mailto:') || href?.startsWith('tel:');
      if (!href || href.startsWith('#') || isExternal) return;

      const targetUrl = new URL(href, window.location.href);
      if (targetUrl.origin === window.location.origin) {
        sessionStorage.setItem('lastInternalPage', window.location.href);
      }

      event.preventDefault();
      document.body.classList.add('is-exiting');
      setTimeout(() => {
        window.location.href = href;
      }, 280);
    });
  };

  const setupBeforeAfter = () => {
    const slider = document.querySelector('.ba-slider');
    if (!slider) return;
    const range = slider.querySelector('.ba-range');
    const update = (value) => {
      slider.style.setProperty('--ba-position', `${value}%`);
    };

    update(range?.value || 55);
    range?.addEventListener('input', (event) => {
      update(event.target.value);
    });
  };

  const setupCountersAndProgress = () => {
    const counters = Array.from(document.querySelectorAll('.kpi-value[data-target]'));
    const bars = Array.from(document.querySelectorAll('.progress-bar[data-progress]'));
    if (!counters.length && !bars.length) return;

    const animateCounters = () => {
      counters.forEach((counter) => {
        const target = Number(counter.dataset.target || 0);
        const duration = 1200;
        const start = performance.now();

        const step = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const value = Math.floor(progress * target);
          counter.textContent = value.toString();
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            counter.textContent = target.toString();
          }
        };

        requestAnimationFrame(step);
      });
    };

    const fillBars = () => {
      bars.forEach((bar) => {
        const fill = bar.querySelector('.progress-fill');
        if (!fill) return;
        const value = Math.min(Math.max(Number(bar.dataset.progress || 0), 0), 100);
        fill.style.width = `${value}%`;
      });
    };

    const trigger = () => {
      animateCounters();
      fillBars();
    };

    if ('IntersectionObserver' in window) {
      const observed = new Set();
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !observed.has(entry.target)) {
              observed.add(entry.target);
              trigger();
            }
          });
        },
        { threshold: 0.3 }
      );
      counters.concat(bars).forEach((el) => observer.observe(el));
    } else {
      trigger();
    }
  };

  const storeReferrer = () => {
    const referrer = document.referrer;
    if (!referrer) return;
    const refUrl = new URL(referrer, window.location.href);
    if (refUrl.origin === window.location.origin) {
      sessionStorage.setItem('lastInternalPage', referrer);
    }
  };

  setupPageTransitions();
  setupBeforeAfter();
  setupCountersAndProgress();
  storeReferrer();
  addBackButton();
  addMenuHint();
})();
