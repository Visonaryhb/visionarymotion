const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
(async ()=>{
  try {
    // locate workspace files
    const workspace = '/workspaces/visionarymotion';
    const indexPath = path.join(workspace, 'index.html');
    const scriptPath = path.join(workspace, 'assets', 'script.js');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const scriptJs = fs.readFileSync(scriptPath, 'utf8');

    // create JSDOM with the index HTML
    const dom = new JSDOM(indexHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost:8000' });
    const { window } = dom;
    // inject the script content directly
    const s = window.document.createElement('script');
    s.textContent = scriptJs;
    window.document.body.appendChild(s);

    // wait a tick for DOMContentLoaded handlers
    await new Promise(r => setTimeout(r, 200));

    // find first video card and click it
    const card = window.document.querySelector('.video-card');
    if (!card) {
      console.error('NO_CARD_FOUND'); process.exit(2);
    }
    // emulate click
    const ev = new window.Event('click', { bubbles: true, cancelable: true });
    card.dispatchEvent(ev);

    // wait for the script to process and insert player
    await new Promise(r => setTimeout(r, 200));
    const modalFrame = window.document.getElementById('modal-frame');
    if (!modalFrame) {
      console.error('NO_MODAL_FRAME'); process.exit(3);
    }
    const src = modalFrame.getAttribute('data-player-src');
    const type = modalFrame.getAttribute('data-player-type');
    const ready = modalFrame.dataset.ytReady || '';
    const last = modalFrame.dataset.lastMessage || '';
    console.log('data-player-src:', src);
    console.log('data-player-type:', type);
    console.log('data-yt-ready:', ready);
    console.log('data-last-message:', last.slice(0,200));
    // basic checks
    const checks = ['enablejsapi=1','playsinline=1','autoplay=1','mute=1','origin='];
    for (const c of checks) console.log(c+':', src ? src.includes(c) : false);
    process.exit(0);
  } catch (e) {
    console.error('TEST_EXCEPTION', e.stack || e);
    process.exit(4);
  }
})();
