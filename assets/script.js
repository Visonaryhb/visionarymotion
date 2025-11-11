// Kontakt Popup
const contactTrigger = document.querySelector('.contact-trigger');
const contactPopup = document.querySelector('.contact-popup');
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
  console.log('generateThumbnails called');
  // query the cards at runtime to ensure any DOM reordering is respected
  const videoCards = document.querySelectorAll('.video-card');
  console.log('Found video cards:', videoCards.length);
  
  videoCards.forEach(card => {
    const thumbEl = card.querySelector('.video-thumb');
    if (!thumbEl) return;

    // Add loading state
    thumbEl.classList.add('loading');

    // If a data-thumb attribute is present, attempt to load it first (local or remote image).
    // If loading fails, fall back to YouTube thumbnail (if available).
    const explicitThumb = (card.dataset && card.dataset.thumb) ? card.dataset.thumb.trim() : null;
    if (explicitThumb) {
      // ensure play icon exists (early, so it's visible during load)
      // Ensure a visible <img> fallback exists inside the thumb (more robust than only
      // relying on background-image). This helps when inline styles are stripped or
      // background-image loading is blocked/cached.
      let imgEl = thumbEl.querySelector('img.thumb-img');
      if (!imgEl) {
        imgEl = document.createElement('img');
        imgEl.className = 'thumb-img';
        imgEl.alt = card.getAttribute('aria-label') || '';
        imgEl.setAttribute('aria-hidden', 'true');
        // ensure the image fills the container but doesn't block the play icon
        imgEl.style.width = '100%';
        imgEl.style.height = '100%';
        imgEl.style.objectFit = 'cover';
        imgEl.style.display = 'block';
        imgEl.style.pointerEvents = 'none';
        thumbEl.appendChild(imgEl);
      }

      // ensure play icon exists (early, so it's visible during load)
      if (!card.querySelector('.play-icon')) {
        const play = document.createElement('div');
        play.className = 'play-icon';
        play.setAttribute('aria-hidden', 'true');
        // inline defensive styles so it stays above the image
        play.style.position = 'absolute';
        play.style.zIndex = '6';
        play.style.pointerEvents = 'none';
        play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
        thumbEl.appendChild(play);
      }

      // Try to preload the explicit thumb so we can detect loading errors and also
      // set the <img> fallback src. If loading fails, fall back to YouTube thumbnail
      // or a local placeholder.
      try {
        const testImg = new Image();
        testImg.onload = () => {
          // set both background-image and the <img> fallback for maximal compatibility
          thumbEl.style.backgroundImage = `url('${explicitThumb}')`;
          imgEl.src = explicitThumb;
          thumbEl.classList.remove('loading');
        };
        testImg.onerror = () => {
          const ytIdFb = extractYouTubeID(card.dataset.video);
          if (ytIdFb) {
            const ytUrl = `https://img.youtube.com/vi/${ytIdFb}/hqdefault.jpg`;
            thumbEl.style.backgroundImage = `url('${ytUrl}')`;
            imgEl.src = ytUrl;
          } else {
            // final fallback to a local tiny placeholder thumbnail if available
            imgEl.src = 'assets/thumbs/screenshot_thumb.jpg';
            thumbEl.style.backgroundImage = `url('assets/thumbs/screenshot_thumb.jpg')`;
          }
          thumbEl.classList.remove('loading');
        };
        // start loading (may be cached)
        testImg.src = explicitThumb;
      } catch (e) {
        const ytIdFb = extractYouTubeID(card.dataset.video);
        if (ytIdFb) {
          const ytUrl = `https://img.youtube.com/vi/${ytIdFb}/hqdefault.jpg`;
          thumbEl.style.backgroundImage = `url('${ytUrl}')`;
          if (imgEl) imgEl.src = ytUrl;
        } else if (imgEl) {
          imgEl.src = 'assets/thumbs/screenshot_thumb.jpg';
          thumbEl.style.backgroundImage = `url('assets/thumbs/screenshot_thumb.jpg')`;
        }
        thumbEl.classList.remove('loading');
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
      const ytUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      thumbEl.style.backgroundImage = `url('${ytUrl}')`;
      // ensure <img> fallback exists and is set
      const imgEl = thumbEl.querySelector('img.thumb-img') || (() => {
        const i = document.createElement('img');
        i.className = 'thumb-img';
        i.setAttribute('aria-hidden', 'true');
        i.style.width = '100%'; i.style.height = '100%'; i.style.objectFit = 'cover'; i.style.pointerEvents = 'none';
        thumbEl.appendChild(i);
        return i;
      })();
      imgEl.src = ytUrl;
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
            // also set fallback image element if present or create one
            const existingImg = thumbEl.querySelector('img.thumb-img') || (() => {
              const i = document.createElement('img');
              i.className = 'thumb-img';
              i.setAttribute('aria-hidden', 'true');
              i.style.width = '100%'; i.style.height = '100%'; i.style.objectFit = 'cover'; i.style.pointerEvents = 'none';
              thumbEl.appendChild(i);
              return i;
            })();
            existingImg.src = dataURL;
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
  console.log('DOM loaded, initializing...');
  buildCategoryFilters();
  setupVideoCardListeners();
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

// Create a YouTube iframe with Error 153 detection
function createYouTubeIframe(ytId) {
  const iframe = document.createElement('iframe');
  iframe.width = '100%';
  iframe.height = '100%';
  iframe.style.border = '0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  
  // Standard YouTube embed URL
  iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;
  
  console.log('Creating YouTube iframe with URL:', iframe.src);
  
  // Error 153 Detection und automatischer Fallback
  let errorDetected = false;
  
  // Timeout für Error 153 Detection (YouTube lädt normalerweise unter 3 Sekunden)
  const errorTimeout = setTimeout(() => {
    if (!errorDetected) {
      console.log('Possible Error 153 detected, switching to fallback player');
      errorDetected = true;
      showEmbeddedFallbackPlayer(ytId);
    }
  }, 4000);
  
  // Erfolgreiche Ladung
  iframe.addEventListener('load', () => {
    console.log('YouTube iframe loaded successfully');
    clearTimeout(errorTimeout);
  });
  
  // Direkter Error Handler
  iframe.addEventListener('error', () => {
    console.log('YouTube iframe error detected');
    clearTimeout(errorTimeout);
    if (!errorDetected) {
      errorDetected = true;
      showEmbeddedFallbackPlayer(ytId);
    }
  });
  
  return iframe;
}

// Embedded Fallback Player (bleibt auf der Website)
function showEmbeddedFallbackPlayer(ytId) {
  const fallbackContainer = document.createElement('div');
  fallbackContainer.className = 'embedded-fallback-player';
  fallbackContainer.innerHTML = `
    <div style="
      width: 100%;
      height: 100%;
      position: relative;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <!-- Video Thumbnail -->
      <div style="
        position: absolute;
        inset: 0;
        background: url('https://img.youtube.com/vi/${ytId}/maxresdefault.jpg') center/cover;
        filter: brightness(0.6);
      "></div>
      
      <!-- Content Overlay -->
      <div style="
        position: relative;
        z-index: 10;
        text-align: center;
        color: white;
        padding: 2rem;
      ">
        <!-- Play Button -->
        <button onclick="openYouTubeVideo('${ytId}')" style="
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #B48A57 0%, #D4A853 100%);
          border: 3px solid rgba(255,255,255,0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          box-shadow: 0 8px 25px rgba(180,138,87,0.5);
          margin: 0 auto 1.5rem auto;
        " onmouseenter="this.style.transform='scale(1.1)'" 
           onmouseleave="this.style.transform='scale(1)'">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" style="margin-left: 3px;">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        
        <!-- Info Text -->
        <div style="max-width: 400px; margin: 0 auto;">
          <h3 style="
            margin: 0 0 0.5rem 0;
            font-size: 1.3rem;
            color: #B48A57;
            text-shadow: 0 2px 4px rgba(0,0,0,0.8);
          ">
            Eingebettete Wiedergabe nicht verfügbar
          </h3>
          <p style="
            margin: 0 0 1rem 0;
            font-size: 1rem;
            color: rgba(255,255,255,0.9);
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            line-height: 1.4;
          ">
            Dieses Video kann aufgrund von YouTube-Richtlinien nicht direkt eingebettet werden.
          </p>
          <p style="
            margin: 0;
            font-size: 0.9rem;
            color: rgba(255,255,255,0.7);
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          ">
            Klicken Sie den Play-Button, um es auf YouTube anzusehen.
          </p>
        </div>
      </div>
      
      <!-- YouTube Logo -->
      <div style="
        position: absolute;
        bottom: 15px;
        right: 15px;
        color: rgba(255,255,255,0.6);
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        gap: 5px;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        <span>YouTube</span>
      </div>
    </div>
  `;
  
  // Ersetze das iframe im Modal
  setTimeout(() => {
    const modalFrame = document.getElementById('modal-frame');
    if (modalFrame) {
      modalFrame.innerHTML = '';
      modalFrame.appendChild(fallbackContainer);
      console.log('Fallback player displayed due to YouTube Error 153');
    }
  }, 100);
  
  return fallbackContainer;
}

// YouTube Video öffnen
function openYouTubeVideo(ytId) {
  window.open(`https://www.youtube.com/watch?v=${ytId}`, '_blank', 'noopener,noreferrer');
}

// Create an embedded YouTube player using iframe (back to working version)
async function createEmbeddedYouTubePlayer(ytId) {
  console.log('Creating embedded YouTube iframe for:', ytId);
  return createYouTubeIframe(ytId);
}

// YouTube Video in neuem Tab öffnen (als Fallback)
function playYouTubeVideo(ytId) {
  window.open(`https://www.youtube.com/watch?v=${ytId}`, '_blank', 'noopener,noreferrer');
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
// Attach handlers to all video cards (query at runtime so DOM order doesn't matter)
function setupVideoCardListeners() {
  console.log('Setting up video card listeners...');
  const videoCards = document.querySelectorAll('.video-card');
  console.log('Found video cards:', videoCards.length);
  
  videoCards.forEach((card, index) => {
    console.log(`Setting up card ${index}:`, card.dataset.video);
    
    card.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Card clicked!', card.dataset.video);
      
      const videoSrc = card.dataset.video;
      
      try {
        // Show loading state and modal
        modal.classList.add('is-loading');
        modal.classList.add('is-active');
        modal.setAttribute('aria-hidden', 'false');
        modalFrame.innerHTML = '<div class="modal-loader"></div>';
        
        // Load and setup video player
        const player = await setupVideoPlayer(videoSrc);
        currentVideo = player;
        
        // Add to modal
        modalFrame.innerHTML = '';
        modalFrame.appendChild(player);
        modal.classList.remove('is-loading');
        
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
}

function closeModal() {
  if (currentVideo) {
    try {
      if (currentVideo.tagName === 'VIDEO') {
        currentVideo.pause();
      } else if (currentVideo.tagName === 'IFRAME') {
        // Stop iframe playback by clearing src
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

// Make closeModal globally available
window.closeModal = closeModal;

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

// --- Hide header on mobile scroll: hide on scroll down, show on scroll up ---
(function() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  let lastY = window.scrollY || window.pageYOffset || 0;
  let ticking = false;
  const THRESHOLD = 8;
  const MIN_SCROLL_TO_HIDE = 60;

  header.classList.add('hide-on-scroll');

  // Cache header height and expose via CSS variable. Compute only on load/resize.
  function computeHeaderHeight() {
    try {
      const h = header.getBoundingClientRect().height || 0;
      document.documentElement.style.setProperty('--header-height', h + 'px');
    } catch (e) {
      // fallback
      document.documentElement.style.setProperty('--header-height', '120px');
    }
  }

  // Compact header: toggle classes only (avoid layout reads/writes here)
  function compactHeader() {
    header.classList.add('compact');
    header.classList.remove('is-hidden');
    header.classList.remove('is-shown');
  }

  function showHeader() {
    header.classList.remove('compact');
    header.classList.remove('is-hidden');
    header.classList.add('is-shown');
    // do not measure layout here — computeHeaderHeight() runs on resize/load
    document.documentElement.classList.remove('mobile-header-hidden');
  }

  function hideHeader() {
    header.classList.add('is-hidden');
    header.classList.remove('is-shown');
  }

  function update() {
    const y = window.scrollY || window.pageYOffset || 0;
    if (y <= 20) {
      showHeader();
      lastY = y;
      ticking = false;
      return;
    }

    const delta = y - lastY;
    if (Math.abs(delta) > THRESHOLD) {
      if (delta > 0 && y > MIN_SCROLL_TO_HIDE) {
        // scrolling down -> compact the header but keep slogan visible
        compactHeader();
      } else {
        // scrolling up -> restore full header
        showHeader();
      }
      lastY = y;
    }
    ticking = false;
  }

  function onScroll() {
    if (!isMobile()) return;
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  // Touch fallback for webviews — keep minimal and avoid layout changes
  let touchStartY = null;
  function onTouchStart(e) { if (!isMobile()) return; touchStartY = (e.touches && e.touches[0] && e.touches[0].clientY) || null; }
  function onTouchMove(e) {
    if (!isMobile() || touchStartY === null) return;
    const y = (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    const dy = y - touchStartY;
    if (dy < -10) hideHeader();
    if (dy > 10) showHeader();
  }
  function onTouchEnd() { touchStartY = null; }

  function handleResize() {
    computeHeaderHeight();
    if (isMobile()) {
      window.addEventListener('scroll', onScroll, { passive: true });
    } else {
      window.removeEventListener('scroll', onScroll);
      header.classList.remove('is-hidden');
      header.classList.remove('is-shown');
      header.classList.remove('hide-on-scroll');
      document.documentElement.style.removeProperty('--header-height');
    }
  }

  // Initial setup
  computeHeaderHeight();
  if (isMobile()) window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', handleResize);
  window.addEventListener('load', () => { computeHeaderHeight(); showHeader(); });

  window.addEventListener('resize', () => { computeHeaderHeight(); });

  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });

})();

// Nav toggle (mobile) - toggle header-nav collapse
document.addEventListener('DOMContentLoaded', () => {
  try {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.header-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const isOpen = toggle.classList.toggle('open');
      nav.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  } catch (e) {
    // ignore
  }
});

// Make closeModal and openYouTubeVideo globally available
window.closeModal = closeModal;
window.openYouTubeVideo = openYouTubeVideo;