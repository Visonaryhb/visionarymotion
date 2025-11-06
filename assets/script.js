// Kontakt Popup
const contactTrigger = document.querySelector('.contact-trigger');
const contactPopup = document.querySelector('.contact-popup');
const videoCards = document.querySelectorAll('.video-card');
// use the modal element that exists in the DOM (declared in index.html)
const modal = document.getElementById('video-modal');
const modalFrame = modal ? modal.querySelector('#modal-frame') : null;

// Listen for postMessage events from YouTube iframe player API and other messages
window.addEventListener('message', (ev) => {
  try {
    const data = typeof ev.data === 'string' ? (() => {
      try { return JSON.parse(ev.data); } catch (e) { return ev.data; }
    })() : ev.data;
    // attach debug info to modalFrame if present
    if (modalFrame) {
      modalFrame.dataset.lastMessage = typeof data === 'string' ? data : JSON.stringify(data).slice(0, 200);
    }
    // For YouTube iframe API, we expect messages with event:'onReady' or event:'infoDelivery' etc.
    if (data && typeof data === 'object' && data.event && modalFrame) {
      if (data.event === 'onReady') modalFrame.dataset.ytReady = 'ready';
      if (data.event === 'infoDelivery') modalFrame.dataset.ytReady = 'info';
    }
  } catch (e) {
    // ignore
  }
});

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
  // allow autoplay & picture-in-picture where possible; fullscreen allowed via allowFullscreen
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  // include playsinline and enablejsapi to allow programmatic control; autoplay muted to maximize cross-browser start
  // we include an origin param to satisfy YouTube API requirements. In some proxied/dev environments the visible
  // window.location.origin may differ from the referrer/forwarded host that YouTube sees; try to pick the most
  // appropriate origin so YouTube initializes the iframe API correctly.
  let originCandidate = window.location.origin;
  try {
    if (document && document.referrer) {
      const refOrigin = new URL(document.referrer).origin;
      // prefer the referrer origin when it differs from location.origin (covers some Codespaces/preview proxies)
      if (refOrigin && refOrigin !== originCandidate) originCandidate = refOrigin;
    }
  } catch (e) {
    // ignore malformed referrer
  }
  // If we're running inside a preview/forwarding host (codespaces / github.dev / app.github.dev), these
  // origins are often rewritten by the preview proxy and using them as the iframe 'origin' can break
  // the YouTube embedded player API. Detect common preview hosts and omit the origin param in that case.
  try {
    const previewHosts = ['github.dev', 'app.github.dev', 'githubpreview.dev', 'preview.app.github.dev'];
    for (const ph of previewHosts) {
      if (originCandidate && originCandidate.indexOf(ph) !== -1) {
        originCandidate = '';
        break;
      }
    }
  } catch (e) {
    // ignore
  }
  const params = new URLSearchParams({ rel: '0', showinfo: '0', modestbranding: '1', playsinline: '1', enablejsapi: '1', autoplay: '1', mute: '1' });
  if (originCandidate) params.set('origin', originCandidate);
  // keep the chosen origin on the iframe for debugging
  iframe.dataset.embedOrigin = originCandidate;
  // set an id so we can postMessage commands to this iframe
  iframe.id = `yt-player-${Math.random().toString(36).slice(2,9)}`;
  iframe.src = `https://www.youtube.com/embed/${ytId}?${params.toString()}`;
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
      // expose the player src for easier debugging/inspection
      try {
        if (player.tagName === 'IFRAME') {
          modalFrame.setAttribute('data-player-src', player.src || '');
          modalFrame.setAttribute('data-player-type', 'iframe');
        } else {
          modalFrame.setAttribute('data-player-src', player.currentSrc || player.src || '');
          modalFrame.setAttribute('data-player-type', 'video');
        }
      } catch (e) {
        // ignore
      }
      // If it's an iframe (YouTube), add an unmute button overlay so user can enable sound
      if (player.tagName === 'IFRAME') {
        // add a small status indicator element
        const status = document.createElement('div');
        status.className = 'modal-player-status';
        status.style.position = 'absolute';
        status.style.left = '1rem';
        status.style.top = '1rem';
        status.style.zIndex = '1001';
        status.style.padding = '0.25rem 0.5rem';
        status.style.background = 'rgba(0,0,0,0.6)';
        status.style.color = '#fff';
        status.style.borderRadius = '6px';
        status.innerText = 'Player: lädt...';
        modalFrame.appendChild(status);
        // set tracking attrs
        modalFrame.dataset.ytReady = 'pending';
        // on iframe load, set a timeout to check for API readiness
        // give the embed more time on slow networks and allow YouTube a chance to initialize
        const checkTimeout = setTimeout(() => {
          if (modalFrame.dataset.ytReady !== 'ready' && modalFrame.dataset.ytReady !== 'info') {
            modalFrame.dataset.ytReady = 'failed';
            console.warn('YouTube embed did not signal ready; attempting a privacy-friendly retry then showing fallback.');
            status.innerText = 'Player: nicht bereit (Versuch: privacy-mode...)';
            status.style.background = 'rgba(200,120,0,0.9)';

            // Try swapping to the privacy-enhanced youtube-nocookie domain once (some blockers behave differently)
            try {
              const src = player && player.src ? player.src : modalFrame.getAttribute('data-player-src') || '';
              const ytMatch = src.match(/embed\/([a-zA-Z0-9_-]{8,})/);
              const ytIdForFallback = ytMatch ? ytMatch[1] : null;
              if (ytIdForFallback) {
                console.info('Retrying embed with youtube-nocookie.com for video', ytIdForFallback);
                    // swap src to youtube-nocookie and give it extra time
                    player.src = src.replace('www.youtube.com/embed/', 'www.youtube-nocookie.com/embed/');
                    modalFrame.setAttribute('data-player-src', player.src);
                    modalFrame.dataset.retryStage = 'nocookie';
                    // one more grace period; if this fails we try removing the origin param entirely
                    setTimeout(() => {
                      if (modalFrame.dataset.ytReady !== 'ready' && modalFrame.dataset.ytReady !== 'info') {
                        // try removing origin parameter as a last-resort retry (some proxies/forwards rewrite origin)
                        try {
                          const current = player && player.src ? player.src : modalFrame.getAttribute('data-player-src') || '';
                          const urlObj = new URL(current);
                          if (urlObj.searchParams.has('origin')) {
                            urlObj.searchParams.delete('origin');
                            player.src = urlObj.toString();
                            modalFrame.setAttribute('data-player-src', player.src);
                            modalFrame.dataset.retryStage = 'no-origin';
                            console.info('Retrying embed with origin param removed for video', ytIdForFallback);
                            // give it a short extra grace period
                            setTimeout(() => {
                              if (modalFrame.dataset.ytReady !== 'ready' && modalFrame.dataset.ytReady !== 'info') {
                                modalFrame.dataset.ytReady = 'failed';
                                status.innerText = 'Player: nicht bereit (Embedding blockiert?)';
                                status.style.background = 'rgba(160,40,40,0.9)';
                                const existing = modalFrame.querySelector('.modal-fallback');
                                if (!existing) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'modal-fallback';
                                  fallback.style.marginTop = '1rem';
                                  fallback.innerHTML = `<p style="color:#fff;">Einbetten scheint blockiert. <a href="https://www.youtube.com/watch?v=${ytIdForFallback}" target="_blank" rel="noopener" style="color:#fff; text-decoration:underline;">Auf YouTube ansehen</a></p><p style="color:#fff; font-size:0.9rem; margin-top:0.5rem;">Hinweis: Prüfe in YouTube Studio → Video → "Einbetten erlauben" und die Sichtbarkeit (nicht privat).</p>`;
                                  modalFrame.appendChild(fallback);
                                }
                              }
                            }, 5000);
                            return;
                          }
                        } catch (e) {
                          console.warn('Removing origin retry failed', e);
                        }
                        // if we couldn't retry, show fallback now
                        modalFrame.dataset.ytReady = 'failed';
                        status.innerText = 'Player: nicht bereit (Embedding blockiert?)';
                        status.style.background = 'rgba(160,40,40,0.9)';
                        const existing = modalFrame.querySelector('.modal-fallback');
                        if (!existing) {
                          // Try a last-resort simple iframe (no enablejsapi, no origin) which may work when the
                          // JS API handshake is blocked by proxies or extensions. This sacrifices programmatic
                          // control (unmute/stop via postMessage) but may allow inline playback.
                          try {
                            if (ytIdForFallback) {
                              const simpleIframe = document.createElement('iframe');
                              simpleIframe.width = '100%';
                              simpleIframe.height = '100%';
                              simpleIframe.style.border = '0';
                              simpleIframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                              simpleIframe.allowFullscreen = true;
                              // build simple src without enablejsapi/origin
                              simpleIframe.src = `https://www.youtube-nocookie.com/embed/${ytIdForFallback}?rel=0&modestbranding=1&playsinline=1&autoplay=1&mute=1`;
                              simpleIframe.dataset.simpleFallback = 'true';
                              modalFrame.appendChild(simpleIframe);
                              modalFrame.setAttribute('data-player-src', simpleIframe.src);
                              modalFrame.setAttribute('data-player-type', 'iframe-simple');
                              modalFrame.dataset.fallback = 'simple-iframe';
                              // show fallback note beneath
                              const fallback = document.createElement('div');
                              fallback.className = 'modal-fallback';
                              fallback.style.marginTop = '0.5rem';
                              fallback.innerHTML = `<p style="color:#fff;">Automatischer Fallback: vereinfachtes Einbetten (kein Player-API). Wenn Ton benötigt wird, klicke "Auf YouTube ansehen".</p><p style="color:#fff; font-size:0.9rem; margin-top:0.25rem;"><a href="https://www.youtube.com/watch?v=${ytIdForFallback}" target="_blank" rel="noopener" style="color:#fff; text-decoration:underline;">Auf YouTube ansehen</a></p>`;
                              modalFrame.appendChild(fallback);
                            }
                          } catch (e) {
                            const fallback = document.createElement('div');
                            fallback.className = 'modal-fallback';
                            fallback.style.marginTop = '1rem';
                            fallback.innerHTML = `<p style="color:#fff;">Einbetten scheint blockiert. <a href="https://www.youtube.com/watch?v=${ytIdForFallback}" target="_blank" rel="noopener" style="color:#fff; text-decoration:underline;">Auf YouTube ansehen</a></p><p style="color:#fff; font-size:0.9rem; margin-top:0.5rem;">Hinweis: Prüfe in YouTube Studio → Video → "Einbetten erlauben" und die Sichtbarkeit (nicht privat).</p>`;
                            modalFrame.appendChild(fallback);
                          }
                        }
                      }
                    }, 7000);
                return;
              }
            } catch (e) {
              console.warn('Retry with nocookie failed', e);
            }

            // add a fallback link to open the video directly on YouTube
            try {
              const existing = modalFrame.querySelector('.modal-fallback');
              if (!existing) {
                const src = player && player.src ? player.src : modalFrame.getAttribute('data-player-src') || '';
                const m = src.match(/embed\/([a-zA-Z0-9_-]{8,})/);
                const ytIdForFallback = m ? m[1] : null;
                const fallback = document.createElement('div');
                fallback.className = 'modal-fallback';
                fallback.style.marginTop = '1rem';
                if (ytIdForFallback) {
                  fallback.innerHTML = `<p style="color:#fff;">Einbetten scheint blockiert. <a href="https://www.youtube.com/watch?v=${ytIdForFallback}" target="_blank" rel="noopener" style="color:#fff; text-decoration:underline;">Auf YouTube ansehen</a></p><p style="color:#fff; font-size:0.9rem; margin-top:0.5rem;">Hinweis: Prüfe in YouTube Studio → Video → "Einbetten erlauben" und die Sichtbarkeit (nicht privat).</p>`;
                } else {
                  fallback.innerHTML = `<p style="color:#fff;">Einbetten scheint blockiert. <a href="https://www.youtube.com/" target="_blank" rel="noopener" style="color:#fff; text-decoration:underline;">Auf YouTube ansehen</a></p>`;
                }
                modalFrame.appendChild(fallback);
              }
            } catch (e) {
              // ignore
            }
          }
        }, 15000);
        // small polling to update status if messages arrive
        const poll = setInterval(() => {
          if (modalFrame.dataset.ytReady === 'ready' || modalFrame.dataset.ytReady === 'info') {
            status.innerText = 'Player: bereit';
            status.style.background = 'rgba(0,120,0,0.7)';
            // remove fallback if present
            const fb = modalFrame.querySelector('.modal-fallback'); if (fb) fb.remove();
            clearInterval(poll); clearTimeout(checkTimeout);
          }
        }, 500);

        const unmuteBtn = document.createElement('button');
        unmuteBtn.className = 'modal-unmute-button';
  unmuteBtn.innerText = 'Ton einschalten';
        unmuteBtn.style.position = 'absolute';
        unmuteBtn.style.right = '1rem';
        unmuteBtn.style.bottom = '1rem';
        unmuteBtn.style.zIndex = '1001';
        unmuteBtn.style.padding = '0.5rem 0.75rem';
        unmuteBtn.style.background = 'rgba(0,0,0,0.7)';
        unmuteBtn.style.color = '#fff';
        unmuteBtn.style.border = 'none';
        unmuteBtn.style.borderRadius = '6px';
        // clicking will send postMessage commands to unmute and play
        unmuteBtn.addEventListener('click', () => {
          try {
            // request unmute and play via postMessage command format used by YouTube iframe API
            const win = player.contentWindow;
            if (win) {
              win.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
              win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
            }
            unmuteBtn.remove();
          } catch (e) {
            console.error('Unmute failed', e);
          }
        });
        // position parent (modal-frame) relative so button positions correctly
        modalFrame.style.position = 'relative';
        modalFrame.appendChild(unmuteBtn);

        // Debug button: collect useful diagnostics and copy to clipboard
        const debugBtn = document.createElement('button');
        debugBtn.className = 'modal-debug-button';
        debugBtn.innerText = 'Debug-Info kopieren';
        debugBtn.style.position = 'absolute';
        debugBtn.style.right = '1rem';
        debugBtn.style.top = '1rem';
        debugBtn.style.zIndex = '1001';
        debugBtn.style.padding = '0.35rem 0.5rem';
        debugBtn.style.background = 'rgba(0,0,0,0.6)';
        debugBtn.style.color = '#fff';
        debugBtn.style.border = 'none';
        debugBtn.style.borderRadius = '6px';
        debugBtn.style.fontSize = '0.85rem';
        debugBtn.addEventListener('click', async () => {
          try {
            const info = {
              timestamp: new Date().toISOString(),
              pageOrigin: window.location.origin,
              pageHref: window.location.href,
              userAgent: navigator.userAgent,
              playerSrc: player && (player.src || (player.currentSrc || null)) || modalFrame.getAttribute('data-player-src') || null,
              playerType: modalFrame.getAttribute('data-player-type') || null,
              ytReady: modalFrame.getAttribute('data-yt-ready') || null,
              lastMessage: modalFrame.getAttribute('data-last-message') || null,
              documentReferrer: document.referrer || null
            };

            // Try a lightweight fetch to the embed URL to detect network-level blocks (best-effort):
            if (info.playerSrc && info.playerSrc.indexOf('youtube') !== -1) {
              try {
                // Use mode 'no-cors' so this won't be blocked by CORS, but note result will be opaque in many browsers
                const f = await fetch(info.playerSrc, { mode: 'no-cors' });
                info.embedFetch = { ok: f && (f.type || 'opaque'), status: f && f.status };
              } catch (fe) {
                info.embedFetch = { error: String(fe) };
              }
            }

            const blob = JSON.stringify(info, null, 2);
            // show the debug data in a small overlay element
            let overlay = modalFrame.querySelector('.modal-debug-output');
            if (!overlay) {
              overlay = document.createElement('pre');
              overlay.className = 'modal-debug-output';
              overlay.style.position = 'absolute';
              overlay.style.left = '1rem';
              overlay.style.bottom = '3.5rem';
              overlay.style.zIndex = '1001';
              overlay.style.maxHeight = '40%';
              overlay.style.overflow = 'auto';
              overlay.style.background = 'rgba(0,0,0,0.75)';
              overlay.style.color = '#fff';
              overlay.style.padding = '0.5rem';
              overlay.style.fontSize = '0.75rem';
              overlay.style.borderRadius = '6px';
              overlay.style.whiteSpace = 'pre-wrap';
              modalFrame.appendChild(overlay);
            }
            overlay.innerText = blob;

            // Copy to clipboard if available
            if (navigator.clipboard && navigator.clipboard.writeText) {
              try { await navigator.clipboard.writeText(blob); status.innerText = 'Debug: kopiert'; } catch (ce) { status.innerText = 'Debug: kopieren fehlgeschlagen'; }
            } else {
              status.innerText = 'Debug: kopieren nicht unterstützt';
            }
          } catch (err) {
            console.warn('Collect debug failed', err);
          }
        });
        modalFrame.appendChild(debugBtn);
      }
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
    try {
      // if iframe, send stop command via postMessage
      if (currentVideo.tagName === 'IFRAME') {
        const win = currentVideo.contentWindow;
        if (win) win.postMessage(JSON.stringify({ event: 'command', func: 'stopVideo', args: [] }), '*');
      } else if (currentVideo.pause) {
        currentVideo.pause();
      }
    } catch (e) {
      console.error('Error stopping video on close', e);
    }
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