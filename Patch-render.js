<!-- PATCH OVERRIDE: Unified Panel (colar antes do </body>) -->
<script type="module">
/*
  Patch override: unifiedPanel in-page module
  - Colar antes do </body>
  - Expõe: window.initUnifiedPanel, window.UNIFIED_PANEL_INSTANCE
  - Se já existir instância anterior, ela será destruída automaticamente
  - Para auto-init: defina window.UNIFIED_PANEL_OPTIONS antes de incluir este patch
*/

(function(){
  // safety: destroy previous instance if present
  if (window.UNIFIED_PANEL_INSTANCE && typeof window.UNIFIED_PANEL_INSTANCE.destroy === 'function') {
    try { window.UNIFIED_PANEL_INSTANCE.destroy(); } catch(e){ console.warn('old unified panel destroy failed', e); }
    window.UNIFIED_PANEL_INSTANCE = null;
  }
  // define initializer
  function initUnifiedPanel(userOptions = {}) {
    const defaults = {
      panelPosition: { right: '12px', top: '38%' },
      panelZIndex: 110000,
      symbols: ['Φ','꩜','◌','☼','◑','◘'],
      maxSymbols: 8,
      attachToSelector: 'body',
      inputSelectors: ['#inputContainer','.input-container','.composer','#composer','.input-area','.chat-input'],
      iframeSelectors: ['#mainFrame','iframe.main','iframe#content-frame','iframe'],
      lockBehavior: 'same', // 'iframe' | 'newtab' | 'same'
      lockTarget: 'about:blank',
      patchRenderResponseBlocks: true,
      asciiTokenPattern: /(?:(?:[:;=8][\-~]?[)DdpP\]])|(?::[a-zA-Z0-9_+-]+:))/g,
      emojiPattern: /(\p{Emoji_Presentation}|\p{Emoji})/gu,
      sendSelectors: ['#sendButton','.send-btn','.btn-send'],
      sendFunctionName: 'App.handleSend',
      autoHideOriginalSymbolBar: true,
    };
    const opts = Object.assign({}, defaults, userOptions);

    // -------------------------- CSS injection --------------------------
    const styleId = 'unified-panel-styles';
    if (!document.getElementById(styleId)) {
      const css = `
#unifiedPanel{
  position: fixed;
  right: ${opts.panelPosition.right};
  top: ${opts.panelPosition.top};
  transform: translateY(-50%);
  z-index: ${opts.panelZIndex};
  display:flex;
  flex-direction:column;
  gap:10px;
  align-items:center;
  padding:8px;
  background: rgba(0,0,0,0.28);
  border-radius:12px;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.04);
  box-shadow: 0 10px 30px rgba(0,0,0,0.6);
}
.unified-btn{
  width:36px; height:36px; border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; user-select:none; font-size:16px;
  background: rgba(255,255,255,0.02);
  color: var(--text, #d7d7d7);
  border:1px solid rgba(255,255,255,0.03);
  transition: transform .12s ease, background .12s ease, box-shadow .12s;
}
.unified-btn:hover{ transform: scale(1.08); background: rgba(255,255,255,0.05); box-shadow: 0 6px 18px rgba(0,0,0,0.6); }
.unified-group{ display:flex; flex-direction:column; gap:8px; align-items:center; }
.unified-symbol { width: auto; padding:4px 7px; border-radius:8px; font-size:14px; }
.footer-lock-wrapper{ display:flex; justify-content:center; padding:8px 6px; gap:8px; }
#footer-lock-button{ display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:8px 10px; border-radius:10px; cursor:pointer; user-select:none; font-size:14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); color: var(--text, #e6e6e6); transition: transform .12s ease, background .12s ease; }
#footer-lock-button:hover{ transform: translateY(-2px); background: rgba(255,255,255,0.04); }
.symbol-btn, .response-emoji-btn { cursor:pointer; border-radius:8px; padding:4px 6px; border: 1px solid rgba(255,255,255,0.03); margin:2px; background: rgba(255,255,255,0.01); }
`;
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = css;
      document.head.appendChild(s);
    }

    // -------------------------- DOM creation --------------------------
    const panel = document.createElement('div');
    panel.id = 'unifiedPanel';
    panel.setAttribute('role','complementary');
    panel.setAttribute('aria-label','Painel Unificado');

    const topGroup = document.createElement('div'); topGroup.className = 'unified-group'; topGroup.id = 'unified-top';
    const midGroup = document.createElement('div'); midGroup.className = 'unified-group'; midGroup.id = 'unified-middle';
    const bottomGroup = document.createElement('div'); bottomGroup.className = 'unified-group'; bottomGroup.id = 'unified-bottom';

    panel.appendChild(topGroup);
    panel.appendChild(midGroup);
    panel.appendChild(bottomGroup);

    function populateSymbols() {
      topGroup.innerHTML = '';
      const existingSymbols = document.querySelectorAll('.symbol-button, .symbol-btn');
      if(existingSymbols && existingSymbols.length) {
        let count = 0;
        existingSymbols.forEach((s) => {
          if(count >= opts.maxSymbols) return;
          const clone = s.cloneNode(true);
          clone.classList.remove('symbol-button');
          clone.classList.add('unified-btn','unified-symbol');
          topGroup.appendChild(clone);
          count++;
        });
      } else {
        opts.symbols.slice(0, opts.maxSymbols).forEach(sym => {
          const b = document.createElement('button');
          b.className = 'unified-btn unified-symbol';
          b.type = 'button';
          b.textContent = sym;
          b.dataset.pulse = sym;
          topGroup.appendChild(b);
        });
      }
    }
    populateSymbols();

    const uploadBtn = document.createElement('button'); uploadBtn.className='unified-btn'; uploadBtn.id='u-upload'; uploadBtn.title='Upload'; uploadBtn.type='button'; uploadBtn.textContent='⧉';
    const remoteBtn = document.createElement('button'); remoteBtn.className='unified-btn'; remoteBtn.id='u-remote'; remoteBtn.title='Remote'; remoteBtn.type='button'; remoteBtn.textContent='☍';
    const decoderBtn = document.createElement('button'); decoderBtn.className='unified-btn'; decoderBtn.id='u-decoder'; decoderBtn.title='Decoder'; decoderBtn.type='button'; decoderBtn.textContent='✦';
    midGroup.append(uploadBtn, remoteBtn, decoderBtn);

    const ritualBtn = document.createElement('button'); ritualBtn.className='unified-btn'; ritualBtn.id='u-ritual'; ritualBtn.type='button'; ritualBtn.title='Ritual/Expandir'; ritualBtn.textContent='◉';
    const uLockBtn = document.createElement('button'); uLockBtn.className='unified-btn'; uLockBtn.id='u-lock'; uLockBtn.type='button'; uLockBtn.title='Lock'; uLockBtn.textContent='⦿';
    bottomGroup.append(ritualBtn, uLockBtn);

    const attachRoot = document.querySelector(opts.attachToSelector) || document.body;
    attachRoot.appendChild(panel);

    // -------------------------- Footer lock button --------------------------
    function findInputContainer() {
      for (const sel of opts.inputSelectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return document.querySelector('footer') || document.body;
    }

    function ensureFooterLock() {
      const existing = document.querySelector('.lock-button, #footer-lock-button, .footer-lock-btn');
      if (existing) {
        if (!existing.id) existing.id = 'footer-lock-button';
        return existing;
      }

      const container = findInputContainer();
      const wrap = document.createElement('div');
      wrap.className = 'footer-lock-wrapper';
      if (container === document.body) document.body.appendChild(wrap);
      else container.insertAdjacentElement('afterend', wrap);

      const btn = document.createElement('button');
      btn.id = 'footer-lock-button';
      btn.className = 'unified-btn footer-lock-btn';
      btn.type = 'button';
      btn.title = 'Lock — carregar ' + opts.lockTarget;
      btn.innerHTML = '🔒 <span style="font-size:12px;opacity:0.9;margin-left:4px">blank</span>';
      wrap.appendChild(btn);
      return btn;
    }

    const footerLockBtn = ensureFooterLock();

    function loadAboutBlank() {
      try {
        if (opts.lockBehavior === 'newtab') {
          window.open(opts.lockTarget, '_blank');
          return;
        }
        for (const sel of opts.iframeSelectors) {
          const fr = document.querySelector(sel);
          if (fr && fr.tagName === 'IFRAME') {
            fr.src = opts.lockTarget;
            return;
          }
        }
        const webcomps = document.querySelectorAll('webview, embed, object');
        if (webcomps && webcomps.length) {
          webcomps[0].data = opts.lockTarget;
          return;
        }
        if (opts.lockBehavior === 'same') {
          window.location.href = opts.lockTarget;
        } else {
          window.open(opts.lockTarget, '_blank');
        }
      } catch (err) {
        console.error('unifiedPanel: loadAboutBlank error', err);
        window.open(opts.lockTarget, '_blank');
      }
    }

    footerLockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      footerLockBtn.style.transform = 'scale(0.98)';
      setTimeout(()=> footerLockBtn.style.transform = '', 120);
      loadAboutBlank();
    });

    uLockBtn.addEventListener('click', () => footerLockBtn.click());

    // -------------------------- Registrar pulso & send helper --------------------------
    function findInputElem() {
      for (const sel of opts.inputSelectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const candidate = el.querySelector('input[type="text"], textarea, [contenteditable="true"]') || el;
        if (candidate) return candidate;
      }
      return document.querySelector('input[type="text"], textarea, [contenteditable="true"]');
    }

    function findSendButton() {
      for (const sel of opts.sendSelectors) {
        const s = document.querySelector(sel);
        if (s) return s;
      }
      return null;
    }

    function executeSend() {
      try {
        const fParts = opts.sendFunctionName.split('.');
        let fn = window;
        for (const p of fParts) {
          fn = fn[p];
          if (!fn) break;
        }
        if (typeof fn === 'function') {
          fn();
          return true;
        }
      } catch(e){ /* ignore */ }

      if (typeof window.onSend === 'function') {
        window.onSend();
        return true;
      }

      const sendBtn = findSendButton();
      if (sendBtn) {
        sendBtn.click();
        return true;
      }

      const inp = findInputElem();
      if (inp) {
        const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' });
        inp.dispatchEvent(ev);
        return true;
      }
      return false;
    }

    function registrarPulsoEEnviar(pulseText) {
      try {
        const input = findInputElem();
        if (input) {
          if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
            input.value = pulseText;
            // dispatch input events to help reactive frameworks (best-effort)
            const evInput = new Event('input', { bubbles: true });
            input.dispatchEvent(evInput);
            const evChange = new Event('change', { bubbles: true });
            input.dispatchEvent(evChange);
          } else {
            input.textContent = pulseText;
            const evInput = new Event('input', { bubbles: true });
            input.dispatchEvent(evInput);
          }
        }
        const ok = executeSend();
        if (!ok) console.info('unifiedPanel: pulsado ->', pulseText);
      } catch (err) {
        console.error('unifiedPanel.registrarPulsoEEnviar erro', err);
      }
    }
    window.registrarPulsoEEnviar = registrarPulsoEEnviar;

    // -------------------------- Event delegation for panel --------------------------
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset && btn.dataset.pulse) {
        registrarPulsoEEnviar(btn.dataset.pulse);
        return;
      }
      if (btn.id === 'u-upload') {
        const input = document.querySelector('#fileUploadInput') || document.querySelector('input[type="file"]');
        if (input) input.click();
        else alert('Nenhum input de upload encontrado.');
        return;
      }
      if (btn.id === 'u-remote') {
        const url = prompt('URL do componente remoto:');
        if (url) {
          const frame = document.createElement('iframe');
          frame.src = url;
          frame.style.width = '100%'; frame.style.height = '320px';
          document.body.appendChild(frame);
        }
        return;
      }
      if (btn.id === 'u-decoder') {
        const decoderBox = document.getElementById('decoderBox');
        if (decoderBox) decoderBox.style.display = decoderBox.style.display === 'none' ? 'block' : 'none';
        else alert('Decoder não encontrado.');
        return;
      }
      if (btn.id === 'u-ritual') {
        const ritual = document.getElementById('btn-expandir-ritual');
        if (ritual) ritual.click();
        return;
      }
      if (btn.id === 'u-lock') {
        footerLockBtn.click();
        return;
      }
    });

    // -------------------------- Patch renderResponseBlocks OR observe DOM --------------------------
    let originalRender = null;
    let observer = null;
    function replaceTokensInHtml(html) {
      if (!html) return html;
      html = html.replace(opts.emojiPattern, (m) => {
        return `<button class="response-emoji-btn" data-pulse="${escapeHtmlAttr('Emoji: '+m)}" type="button">${m}</button>`;
      });
      html = html.replace(opts.asciiTokenPattern, (m) => {
        return `<button class="symbol-btn" data-pulse="${escapeHtmlAttr('ASCII: '+m)}" type="button">${m}</button>`;
      });
      return html;
    }
    function escapeHtmlAttr(s) {
      return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    if (opts.patchRenderResponseBlocks && typeof window.renderResponseBlocks === 'function') {
      originalRender = window.renderResponseBlocks;
      window.renderResponseBlocks = function(blocks = {}) {
        const wrapped = {};
        for (const k of Object.keys(blocks)) {
          const v = blocks[k];
          if (typeof v === 'string') wrapped[k] = replaceTokensInHtml(v);
          else wrapped[k] = v;
        }
        return originalRender.call(this, wrapped);
      };
    } else {
      const containerCandidates = [
        '.pages-wrapper', '.chat-window', '.responses', '#responses', '.conversation'
      ];
      let container = null;
      for (const c of containerCandidates) {
        const el = document.querySelector(c);
        if (el) { container = el; break; }
      }
      if (!container) container = document.body;

      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            transformNodeRecursively(node);
          }
        }
      });
      observer.observe(container, { childList: true, subtree: true });
    }

    function transformNodeRecursively(node) {
      const responseSelectors = ['.response-block','.reply','.assistant','.message'];
      let isResponse = false;
      for (const sel of responseSelectors) if (node.matches && node.matches(sel)) { isResponse = true; break; }
      if (!isResponse) {
        const textContent = node.textContent || '';
        if (!opts.asciiTokenPattern.test(textContent) && !opts.emojiPattern.test(textContent)) return;
      }
      if (node.children && node.children.length) {
        for (const child of Array.from(node.children)) transformNodeRecursively(child);
      } else {
        const raw = node.innerHTML || node.textContent || '';
        if (opts.asciiTokenPattern.test(raw) || opts.emojiPattern.test(raw)) {
          const replaced = replaceTokensInHtml(raw);
          node.innerHTML = replaced;
        }
      }
    }

    function docClickHandler(e) {
      const btn = e.target.closest('button[data-pulse]');
      if (!btn) return;
      e.preventDefault();
      const payload = btn.dataset.pulse || btn.getAttribute('data-pulse') || btn.textContent;
      registrarPulsoEEnviar(payload);
    }
    document.addEventListener('click', docClickHandler);

    if (opts.autoHideOriginalSymbolBar) {
      const old = document.querySelectorAll('.symbol-bar, .old-symbols, .symbol-button');
      old.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });
    }

    // -------------------------- Public API --------------------------
    function destroy() {
      try { panel.remove(); } catch(e){}
      const f = document.getElementById('footer-lock-button');
      if (f) {
        const wrapper = f.parentElement;
        if (wrapper && wrapper.classList.contains('footer-lock-wrapper')) wrapper.remove();
        else f.remove();
      }
      if (originalRender) window.renderResponseBlocks = originalRender;
      if (observer) observer.disconnect();
      document.removeEventListener('click', docClickHandler);
      if (window.registrarPulsoEEnviar === registrarPulsoEEnviar) delete window.registrarPulsoEEnviar;
      // keep style sheet (safe); if you want to remove, uncomment next lines
      // const s = document.getElementById(styleId); if (s) s.remove();
      window.UNIFIED_PANEL_INSTANCE = null;
    }

    function openPanel() { panel.style.display = 'flex'; }
    function closePanel() { panel.style.display = 'none'; }

    const api = {
      panel,
      footerLockBtn,
      registrarPulsoEEnviar,
      destroy,
      openPanel,
      closePanel,
      options: opts,
      refreshSymbols: populateSymbols
    };

    // expose instance globally for debug/interaction
    window.UNIFIED_PANEL_INSTANCE = api;
    return api;
  }

  // attach to window
  window.initUnifiedPanel = initUnifiedPanel;

  // auto-init if options present on window or if explicitly requested
  try {
    const autoOpts = (window.UNIFIED_PANEL_OPTIONS && typeof window.UNIFIED_PANEL_OPTIONS === 'object') ? window.UNIFIED_PANEL_OPTIONS : null;
    const shouldAuto = !!(autoOpts || window.UNIFIED_PANEL_AUTO_INIT);
    if (shouldAuto) {
      const instance = initUnifiedPanel(autoOpts || {});
      // if you want auto-closed at start, set instance.closePanel();
    }
  } catch(e){ console.warn('unifiedPanel auto-init failed', e); }

})(); // end IIFE
</script>
<!-- END PATCH OVERRIDE -->