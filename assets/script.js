// Kontakt Popup
const contactTrigger = document.querySelector('.contact-trigger');
const contactPopup = document.querySelector('.contact-popup');
const videoCards = document.querySelectorAll('.video-card');
// use the modal element that exists in the DOM (declared in index.html)
const modal = document.getElementById('video-modal');
const modalFrame = modal ? modal.querySelector('#modal-frame') : null;

// Ensure contact trigger exists
if (contactTrigger) {
  contactTrigger.addEventListener('click', () => {
    contactPopup.classList.toggle('is-active');
    const isHidden = contactPopup.getAttribute('aria-hidden') === 'true';
    contactPopup.setAttribute('aria-hidden', !isHidden);
  });
}

// Schließe Popup wenn außerhalb geklickt wird
document.addEventListener('click', (e) => {
  if (contactPopup && contactTrigger && !contactPopup.contains(e.target) && !contactTrigger.contains(e.target)) {
    contactPopup.classList.remove('is-active');
    contactPopup.setAttribute('aria-hidden', 'true');
  }
});

// helper: extract YouTube ID from many URL formats
function extractYouTubeID(url) {
  if (!url) return null;
  // accept plain IDs
  const plainIdMatch = url.match(/^[a-zA-Z0-9_-]{8,}$/);
  if (plainIdMatch) return url;

  const ytMatch = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([a-zA-Z0-9_-]{8,})/);
  return ytMatch ? ytMatch[1] : null;
}

// Generate thumbnail images from videos when no poster provided
async function generateThumbnails() {
  videoCards.forEach(card => {
    const thumbEl = card.querySelector('.video-thumb');
    if (!thumbEl) return;

    // Add loading state
    thumbEl.classList.add('loading');

    // If a data-thumb attribute is present, use it immediately (local or remote image)
    const explicitThumb = (card.dataset && card.dataset.thumb) ? card.dataset.thumb.trim() : null;
    if (explicitThumb) {
      // prefer the provided thumbnail and skip generation
      try {
        thumbEl.style.backgroundImage = `url('${explicitThumb}')`;
      } catch (e) {
        // ignore invalid URLs
      }
      thumbEl.classList.remove('loading');
      // ensure play icon exists
      if (!card.querySelector('.play-icon')) {
        const play = document.createElement('div');
        play.className = 'play-icon';
        play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
        thumbEl.appendChild(play);
      }
      return;
    }

    // insert play icon
    if (!card.querySelector('.play-icon')) {
      const play = document.createElement('div');
      play.className = 'play-icon';
      play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
      thumbEl.appendChild(play);
    }

    const videoSrc = card.dataset.video;
    if (!videoSrc) {
      thumbEl.classList.remove('loading');
      return;
    }

    const ytId = extractYouTubeID(videoSrc);
    if (ytId) {
      // Use YouTube thumbnail
      thumbEl.style.backgroundImage = `url('https://img.youtube.com/vi/${ytId}/hqdefault.jpg')`;
      thumbEl.classList.remove('loading');
      return;
    }

    // For local MP4s try to capture a frame (best-effort)
    (async () => {
      try {
        const v = document.createElement('video');
        v.src = videoSrc;
        v.crossOrigin = 'anonymous';
        v.muted = true;
        v.playsInline = true;

        const timeout = setTimeout(() => {
          thumbEl.classList.remove('loading');
          v.src = '';
        }, 10000);

        v.addEventListener('loadeddata', () => {
          try { v.currentTime = Math.min(v.duration * 0.25, Math.max(0.1, v.duration * 0.05)); } catch (e) { clearTimeout(timeout); thumbEl.classList.remove('loading'); }
        });

        v.addEventListener('seeked', () => {
          try {
            const dpr = window.devicePixelRatio || 1;
            const canvas = document.createElement('canvas');
            canvas.width = (v.videoWidth || 1280) * dpr;
            canvas.height = (v.videoHeight || 720) * dpr;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('Could not get canvas context');
            ctx.scale(dpr, dpr);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(v, 0, 0, canvas.width / dpr, canvas.height / dpr);
            const dataURL = canvas.toDataURL('image/jpeg', 0.92);
            thumbEl.style.backgroundImage = `url('${dataURL}')`;
            clearTimeout(timeout);
            v.src = '';
            thumbEl.classList.remove('loading');
          } catch (e) {
            clearTimeout(timeout);
            thumbEl.classList.remove('loading');
          }
        });

        v.load();
      } catch (e) {
        thumbEl.classList.remove('loading');
      }
    })();
  });
}

// run generation on DOM ready
document.addEventListener('DOMContentLoaded', () => generateThumbnails());

// --- Video category filters ---
function buildCategoryFilters() {
  try {
    const grid = document.getElementById('video-grid') || document.querySelector('.video-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.video-card'));
    const categories = Array.from(new Set(cards.map(c => (c.dataset.category || '').trim()).filter(Boolean)));

    const filtersContainer = document.getElementById('video-filters');
    if (!filtersContainer) return;
    filtersContainer.innerHTML = '';

    // create 'Alle' button
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.type = 'button';
    allBtn.setAttribute('aria-pressed', 'true');
    allBtn.innerText = 'Alle';
    allBtn.addEventListener('click', () => applyFilter(null, allBtn));
    filtersContainer.appendChild(allBtn);

    categories.forEach(cat => {
      const b = document.createElement('button');
      b.className = 'filter-btn';
      b.type = 'button';
      b.setAttribute('data-cat', cat);
      b.setAttribute('aria-pressed', 'false');
      b.innerText = cat;
      b.addEventListener('click', () => applyFilter(cat, b));
      filtersContainer.appendChild(b);
    });
  } catch (e) {
    console.warn('buildCategoryFilters failed', e);
  }
}

function applyFilter(category, btn) {
  const grid = document.getElementById('video-grid') || document.querySelector('.video-grid');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('.video-card'));
  // update active button states
  const allBtns = Array.from(document.querySelectorAll('#video-filters .filter-btn'));
  allBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); } else if (allBtns[0]) { allBtns[0].classList.add('active'); allBtns[0].setAttribute('aria-pressed','true'); }

  cards.forEach(card => {
    const cat = (card.dataset.category || '').trim();
    if (!category || category === null) {
      card.style.display = '';
    } else {
      card.style.display = (cat === category) ? '' : 'none';
    }
  });
}

// initialize filters on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  buildCategoryFilters();
});

// Entrance animation: staggered reveal of video cards using IntersectionObserver
document.addEventListener('DOMContentLoaded', () => {
  try {
    const cards = Array.from(document.querySelectorAll('.video-card'));
    if (!('IntersectionObserver' in window) || cards.length === 0) {
      // fallback: just reveal all
      cards.forEach(c => c.classList.add('in-view'));
      return;
    }

    const obs = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          // compute stagger based on index among siblings
          const idx = cards.indexOf(el);
          const delay = Math.min(300, idx * 70); // cap delay
          el.style.setProperty('--d', `${delay}ms`);
          el.classList.add('in-view');
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.12 });

    cards.forEach(c => obs.observe(c));
  } catch (e) {
    // fail silently
  }
});

// Modal handling
const closeButtons = document.querySelectorAll('[data-close]');
let currentVideo = null;
let lastFocusedElement = null;
let _trapKeyHandler = null;

function _getFocusableElements(container) {
  return Array.from(container.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length);
}

function enableModalFocusTrap() {
  try {
    lastFocusedElement = document.activeElement;
    const closeBtn = modal.querySelector('#modal-close-btn') || modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();

    _trapKeyHandler = function (e) {
      if (e.key !== 'Tab') return;
      const focusable = _getFocusableElements(modal);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', _trapKeyHandler);
  } catch (e) {
    // ignore
  }
}

function disableModalFocusTrap() {
  try {
    if (_trapKeyHandler) document.removeEventListener('keydown', _trapKeyHandler);
    _trapKeyHandler = null;
    if (lastFocusedElement && lastFocusedElement.focus) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  } catch (e) {
    // ignore
  }
}

// Create an HTML5 video element and return it (ready to insert)
async function createHtml5Video(videoSrc) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.addEventListener('loadedmetadata', () => resolve(video));
    video.addEventListener('error', (e) => reject(new Error('Video loading failed')));
    Object.assign(video, {
      src: videoSrc,
      controls: true,
      playsInline: true,
      preload: 'auto',
      controlsList: 'nodownload',
      disablePictureInPicture: true,
      style: 'width: 100%; height: 100%; background: #000;'
    });
    video.load();
  });
}

// Create a YouTube iframe (autoplay disabled by default; we set autoplay when inserting)
function createYouTubeIframe(ytId) {
  const iframe = document.createElement('iframe');
  iframe.width = '100%';
  iframe.height = '100%';
  iframe.style.border = '0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.src = `https://www.youtube.com/embed/${ytId}?rel=0&showinfo=0&modestbranding=1`;
  return iframe;
}

// Setup the appropriate player depending on source (YouTube or MP4)
async function setupVideoPlayer(videoSrc) {
  const ytId = extractYouTubeID(videoSrc);
  if (ytId) {
    return createYouTubeIframe(ytId);
  }
  return await createHtml5Video(videoSrc);
}

// Video error handler
function handleVideoError(video, error) {
  console.error('Video error:', error);
  if (modalFrame) {
    modalFrame.innerHTML = '<div class="modal-error">Video konnte nicht geladen werden</div>';
  }
  modal.classList.remove('is-loading');
}

// Play video function
function playVideo(video) {
  return video.play().catch(error => {
    console.log('Playback failed:', error);
    const playButton = document.createElement('button');
    playButton.className = 'modal-play-button';
    playButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    playButton.onclick = () => {
      video.play().catch(e => handleVideoError(video, e));
      playButton.remove();
    };
    modalFrame.appendChild(playButton);
  });
}

// Open modal and play video
videoCards.forEach(card => {
  // Preload video when hovering over card (only for MP4s)
  card.addEventListener('mouseenter', () => {
    const ytId = extractYouTubeID(card.dataset.video);
    if (!ytId) {
      const v = document.createElement('video');
      v.src = card.dataset.video;
      v.preload = 'auto';
    }
    // start hover preview after a short delay
    if (card._previewTimeout) clearTimeout(card._previewTimeout);
    card._previewTimeout = setTimeout(() => startPreview(card), 220);
  });

  card.addEventListener('mouseleave', () => {
    if (card._previewTimeout) { clearTimeout(card._previewTimeout); card._previewTimeout = null; }
    stopPreview(card);
  });

  card.addEventListener('focusin', () => {
    // keyboard focus also triggers a preview
    if (card._previewTimeout) clearTimeout(card._previewTimeout);
    card._previewTimeout = setTimeout(() => startPreview(card), 220);
  });

  card.addEventListener('focusout', () => {
    if (card._previewTimeout) { clearTimeout(card._previewTimeout); card._previewTimeout = null; }
    stopPreview(card);
  });

  card.addEventListener('click', async () => {
    const videoSrc = card.dataset.video;
    
    try {
      // Show loading state and modal
      modal.classList.add('is-loading');
      modal.classList.add('is-active');
      modal.setAttribute('aria-hidden', 'false');
      modalFrame.innerHTML = '<div class="modal-loader"></div>';
      
      // Load and setup video or iframe
      const player = await setupVideoPlayer(videoSrc);
      currentVideo = player;
      
      // Add to modal (iframe or video)
      modalFrame.innerHTML = '';
      modalFrame.appendChild(player);
      modal.classList.remove('is-loading');
  // enable keyboard focus trapping when modal is active
  try { enableModalFocusTrap(); } catch (e) { /* ignore */ }
      // Try autoplay if HTML5 video (iframes won't autoplay reliably)
      if (player.tagName === 'VIDEO') {
        try {
          await player.play();
        } catch (playError) {
          const playButton = document.createElement('button');
          playButton.className = 'modal-play-button';
          playButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
          playButton.onclick = () => { player.play().catch(console.error); playButton.remove(); };
          modalFrame.appendChild(playButton);
        }
      }
    } catch (error) {
      console.error('Video setup failed:', error);
      modal.classList.remove('is-loading');
      modalFrame.innerHTML = '<div class="modal-error">Video konnte nicht geladen werden</div>';
    }
    
  });
});

// Hover preview helpers
function startPreview(card) {
  try {
    if (!card || card._previewActive) return;
    const videoSrc = card.dataset.video;
    const thumbEl = card.querySelector('.video-thumb');
    if (!videoSrc || !thumbEl) return;

    const ytId = extractYouTubeID(videoSrc);
    if (ytId) {
      const iframe = document.createElement('iframe');
      iframe.className = 'preview-layer';
      iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
      iframe.setAttribute('frameborder', '0');
      // autoplay muted loop via playlist param
      iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=${ytId}`;
      thumbEl.appendChild(iframe);
      card._previewEl = iframe;
      card._previewActive = true;
      return;
    }

    // local MP4 preview
    const v = document.createElement('video');
    v.className = 'preview-layer';
    v.src = videoSrc;
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.style.width = '100%';
    v.style.height = '100%';
    v.style.objectFit = 'cover';
    thumbEl.appendChild(v);
    // attempt to play (may be blocked if not muted, but we set muted)
    v.play().catch(() => {});
    card._previewEl = v;
    card._previewActive = true;
  } catch (e) {
    // fail quietly
  }
}

function stopPreview(card) {
  try {
    if (!card) return;
    const el = card._previewEl;
    if (!el) return;
    // pause video if it's a video element
    try { if (el.tagName && el.tagName.toLowerCase() === 'video') el.pause(); } catch (e) {}
    if (el.remove) el.remove();
    card._previewEl = null;
    card._previewActive = false;
  } catch (e) {
    // ignore
  }
}

function closeModal() {
  if (currentVideo) {
    try {
      const tag = (currentVideo.tagName || '').toUpperCase();
      if (tag === 'VIDEO') {
        currentVideo.pause();
      } else if (tag === 'IFRAME') {
        // defensively stop iframe playback (YouTube) by clearing src
        try { currentVideo.src = ''; } catch (e) { /* ignore */ }
      }
    } catch (e) {
      // ignore
    }
    currentVideo = null;
  }
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('is-active');
  modal.classList.remove('is-loading');
  modalFrame.innerHTML = '';
  // disable focus trap and restore last focus
  try { disableModalFocusTrap(); } catch (e) { /* ignore */ }
}

// Close modal on button click
closeButtons.forEach(button => {
  button.addEventListener('click', closeModal);
});

// Close on escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('is-active')) {
    closeModal();
  }
});

// Close on backdrop click
modal.addEventListener('click', e => {
  if (e.target === modal) {
    closeModal();
  }
});