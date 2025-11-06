// Kontakt Popup
const contactTrigger = document.querySelector('.contact-trigger');
const contactPopup = document.querySelector('.contact-popup');
const videoCards = document.querySelectorAll('.video-card');
const modal = document.createElement('div');
modal.id = 'video-modal';
modal.className = 'modal';
modal.setAttribute('aria-hidden', 'true');
modal.innerHTML = `
  <div class="modal-content">
    <button class="modal-close" data-close aria-label="Video schließen">
      <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
    <div id="modal-frame"></div>
  </div>
`;
document.body.appendChild(modal);

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

// Generate thumbnail images from videos when no poster provided
async function generateThumbnails() {
  videoCards.forEach(async card => {
    const thumbEl = card.querySelector('.video-thumb');
    
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
    if (!videoSrc || !thumbEl) {
      thumbEl?.classList.remove('loading');
      return;
    }

    try {
      // create a temporary video to capture a frame
      const v = document.createElement('video');
      v.src = videoSrc;
      v.crossOrigin = 'anonymous';
      v.muted = true;
      v.playsInline = true;

      // Set timeout to avoid hanging
      const timeout = setTimeout(() => {
        thumbEl.classList.remove('loading');
        console.warn('Thumbnail generation timeout for', videoSrc);
        v.src = '';
      }, 10000);

      // try to grab a frame after metadata loads
      v.addEventListener('loadeddata', () => {
        try {
          // seek to 25% of the video for a representative frame
          v.currentTime = Math.min(v.duration * 0.25, Math.max(0.1, v.duration * 0.05));
        } catch (err) {
          clearTimeout(timeout);
          thumbEl.classList.remove('loading');
          console.warn('Seek failed:', err);
        }
      });

    v.addEventListener('seeked', () => {
      try {
        // Create canvas with device pixel ratio for better quality
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = (v.videoWidth || 1280) * dpr;
        canvas.height = (v.videoHeight || 720) * dpr;
        const ctx = canvas.getContext('2d', { alpha: false });
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }
        
        // Scale context for device pixel ratio
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw and optimize
        ctx.drawImage(v, 0, 0, canvas.width / dpr, canvas.height / dpr);
        const dataURL = canvas.toDataURL('image/jpeg', 0.92);
        thumbEl.style.backgroundImage = `url('${dataURL}')`;
        
        // Clean up
        clearTimeout(timeout);
        v.src = '';
        thumbEl.classList.remove('loading');
      } catch (e) {
        console.warn('Thumbnail generation failed for', videoSrc, e);
        thumbEl.classList.remove('loading');
      }
    });

    // load and trigger seek
    v.load();
    } catch (e) {
      console.error('Video creation failed:', e);
      thumbEl.classList.remove('loading');
    }
  });
}

// run generation on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  generateThumbnails();
});

// Modal handling
const modal = document.getElementById('video-modal');
const modalFrame = document.getElementById('modal-frame');
const closeButtons = document.querySelectorAll('[data-close]');
let currentVideo = null;

// Optimierte Video-Wiedergabe
async function loadAndPlayVideo(videoSrc) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    
    video.addEventListener('loadedmetadata', () => {
      resolve(video);
    });

    video.addEventListener('error', (e) => {
      reject(new Error(`Video loading failed: ${e.message}`));
    });

    // Optimale Video-Einstellungen
    Object.assign(video, {
      src: videoSrc,
      controls: true,
      playsInline: true,
      preload: 'auto',
      controlsList: 'nodownload',
      disablePictureInPicture: true,
      style: 'width: 100%; height: 100%; background: #000;'
    });

    // Force browser to start loading
    video.load();
  });
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
  // Preload video when hovering over card
  card.addEventListener('mouseenter', () => {
    const video = new Audio(card.dataset.video);
    video.preload = 'auto';
  });

  card.addEventListener('click', async () => {
    const videoSrc = card.dataset.video;
    
    try {
      // Show loading state and modal
      modal.classList.add('is-loading');
      modal.classList.add('is-active');
      modal.setAttribute('aria-hidden', 'false');
      modalFrame.innerHTML = '<div class="modal-loader"></div>';
      
      // Load and setup video
      const video = await setupVideoPlayer(videoSrc);
      currentVideo = video;
      
      // Add to modal
      modalFrame.innerHTML = '';
      modalFrame.appendChild(video);
      modal.classList.remove('is-loading');
      
      try {
        await video.play();
      } catch (playError) {
        console.log('Autoplay prevented, showing play button');
        const playButton = document.createElement('button');
        playButton.className = 'modal-play-button';
        playButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        playButton.onclick = () => {
          video.play().catch(console.error);
          playButton.remove();
        };
        modalFrame.appendChild(playButton);
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