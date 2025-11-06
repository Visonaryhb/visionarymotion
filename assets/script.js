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

// Modal handling
const closeButtons = document.querySelectorAll('[data-close]');
let currentVideo = null;

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

function closeModal() {
  if (currentVideo) {
    currentVideo.pause();
    currentVideo = null;
  }
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('is-active');
  modal.classList.remove('is-loading');
  modalFrame.innerHTML = '';
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