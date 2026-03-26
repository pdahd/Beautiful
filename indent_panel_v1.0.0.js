(() => {
  const KEY = '__indentPanelV100__';

  if (window[KEY] && typeof window[KEY].destroy === 'function') {
    window[KEY].destroy();
  }

  const state = {
    mode: '2',
    collapsed: false,
    drag: null,
    lastTap: 0
  };

  const root = document.createElement('div');
  root.id = '__indent-panel-v100';
  root.style.cssText = [
    'position:fixed',
    'left:16px',
    'top:72px',
    'width:min(92vw,520px)',
    'max-width:520px',
    'min-width:280px',
    'background:#fff',
    'color:#111',
    'border:1px solid rgba(0,0,0,.12)',
    'border-radius:12px',
    'box-shadow:0 8px 30px rgba(0,0,0,.18)',
    'z-index:2147483647',
    'font:14px/1.5 sans-serif',
    'overflow:hidden'
  ].join(';');

  root.innerHTML = `
    <div data-role="title" style="
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:10px 12px;
      background:#f6f7f9;
      border-bottom:1px solid rgba(0,0,0,.08);
      cursor:move;
      user-select:none;
      -webkit-user-select:none;
      touch-action:none;
    ">
      <div data-role="title-text" style="
        font-weight:600;
        font-size:14px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      ">缩进处理面板</div>

      <button data-role="close" style="
        flex:none;
        width:28px;
        height:28px;
        border:1px solid rgba(0,0,0,.12);
        border-radius:8px;
        background:#fff;
        color:#111;
        font:16px/1 sans-serif;
        cursor:pointer;
      ">×</button>
    </div>

    <div data-role="body" style="
      display:flex;
      flex-direction:column;
      gap:8px;
      padding:10px;
    ">
      <div style="
        font-size:12px;
        color:#666;
      ">有选区时仅处理选中行；无选区时处理全文。双击标题栏可折叠/展开，拖动标题栏可移动面板。</div>

      <textarea data-role="textarea" spellcheck="false" placeholder="把文本粘贴到这里，再执行缩进……" style="
        width:100%;
        min-height:240px;
        max-height:55vh;
        padding:10px;
        border:1px solid rgba(0,0,0,.12);
        border-radius:10px;
        background:#fff;
        color:#111;
        font:13px/1.6 monospace;
        resize:vertical;
        box-sizing:border-box;
        outline:none;
      "></textarea>

      <div style="
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      ">
        <button data-role="indent" style="
          padding:8px 12px;
          border:1px solid rgba(0,0,0,.12);
          border-radius:10px;
          background:#111;
          color:#fff;
          font:13px/1.4 sans-serif;
          cursor:pointer;
        ">执行缩进</button>

        <button data-role="copy" style="
          padding:8px 12px;
          border:1px solid rgba(0,0,0,.12);
          border-radius:10px;
          background:#fff;
          color:#111;
          font:13px/1.4 sans-serif;
          cursor:pointer;
        ">全部复制</button>

        <button data-role="clear" style="
          padding:8px 12px;
          border:1px solid rgba(0,0,0,.12);
          border-radius:10px;
          background:#fff;
          color:#111;
          font:13px/1.4 sans-serif;
          cursor:pointer;
        ">全部清空</button>
      </div>

      <div style="
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:12px;
        padding-top:2px;
      ">
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
          <input data-role="mode-2" type="checkbox">
          <span>缩进2格</span>
        </label>

        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
          <input data-role="mode-4" type="checkbox">
          <span>缩进4格</span>
        </label>

        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
          <input data-role="mode-custom" type="checkbox">
          <span>自定义缩进</span>
        </label>

        <input data-role="custom-count" type="number" min="1" max="64" value="2" inputmode="numeric" style="
          width:78px;
          padding:6px 8px;
          border:1px solid rgba(0,0,0,.12);
          border-radius:8px;
          background:#f3f3f3;
          color:#666;
          font:13px/1.4 sans-serif;
          box-sizing:border-box;
        ">
      </div>

      <div data-role="status" style="
        min-height:18px;
        font-size:12px;
        color:#666;
      ">就绪</div>
    </div>
  `;

  (document.body || document.documentElement).appendChild(root);

  const title = root.querySelector('[data-role="title"]');
  const titleText = root.querySelector('[data-role="title-text"]');
  const closeBtn = root.querySelector('[data-role="close"]');
  const body = root.querySelector('[data-role="body"]');
  const textarea = root.querySelector('[data-role="textarea"]');
  const indentBtn = root.querySelector('[data-role="indent"]');
  const copyBtn = root.querySelector('[data-role="copy"]');
  const clearBtn = root.querySelector('[data-role="clear"]');
  const mode2 = root.querySelector('[data-role="mode-2"]');
  const mode4 = root.querySelector('[data-role="mode-4"]');
  const modeCustom = root.querySelector('[data-role="mode-custom"]');
  const customCount = root.querySelector('[data-role="custom-count"]');
  const statusEl = root.querySelector('[data-role="status"]');

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function selectMode(mode) {
    state.mode = mode;
    mode2.checked = mode === '2';
    mode4.checked = mode === '4';
    modeCustom.checked = mode === 'custom';

    const enabled = mode === 'custom';
    customCount.disabled = !enabled;
    customCount.style.background = enabled ? '#fff' : '#f3f3f3';
    customCount.style.color = enabled ? '#111' : '#666';
    customCount.style.opacity = enabled ? '1' : '.75';
  }

  function getIndentCount() {
    if (state.mode === '2') return 2;
    if (state.mode === '4') return 4;

    const n = parseInt(customCount.value, 10);
    if (!Number.isFinite(n) || n < 1) {
      setStatus('自定义缩进数量无效，请输入 1~64 的整数。');
      return null;
    }
    return Math.min(64, n);
  }

  function setCollapsed(flag) {
    state.collapsed = !!flag;
    body.style.display = state.collapsed ? 'none' : 'flex';
    titleText.textContent = state.collapsed ? '缩进处理面板（已折叠）' : '缩进处理面板';
  }

  function clampPosition() {
    const rect = root.getBoundingClientRect();
    let left = parseFloat(root.style.left) || rect.left;
    let top = parseFloat(root.style.top) || rect.top;

    const maxLeft = Math.max(0, window.innerWidth - rect.width - 4);
    const maxTop = Math.max(0, window.innerHeight - rect.height - 4);

    if (left < 0) left = 0;
    if (top < 0) top = 0;
    if (left > maxLeft) left = maxLeft;
    if (top > maxTop) top = maxTop;

    root.style.left = left + 'px';
    root.style.top = top + 'px';
  }

  function applyIndentToSelection(text, start, end, count) {
    const pad = ' '.repeat(count);
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = text.length;

    const before = text.slice(0, lineStart);
    const block = text.slice(lineStart, lineEnd);
    const after = text.slice(lineEnd);

    const lines = block.split('\n');
    const newBlock = lines.map(line => pad + line).join('\n');

    return {
      value: before + newBlock + after,
      start: start + count,
      end: end + count * lines.length,
      scope: 'selected'
    };
  }

  function applyIndentToAll(text, caret, count) {
    const pad = ' '.repeat(count);
    const lines = text.split('\n');
    const newText = lines.map(line => pad + line).join('\n');
    const lineCountBeforeCaret = text.slice(0, caret).split('\n').length;
    const newCaret = caret + count * lineCountBeforeCaret;

    return {
      value: newText,
      start: newCaret,
      end: newCaret,
      scope: 'all'
    };
  }

  function doIndent() {
    const count = getIndentCount();
    if (count == null) return;

    const text = textarea.value;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const scrollTop = textarea.scrollTop;

    if (!text) {
      setStatus('输入框为空，没有可处理的内容。');
      return;
    }

    const result = start !== end
      ? applyIndentToSelection(text, start, end, count)
      : applyIndentToAll(text, start, count);

    textarea.value = result.value;
    textarea.focus();
    textarea.selectionStart = result.start;
    textarea.selectionEnd = result.end;
    textarea.scrollTop = scrollTop;

    setStatus(result.scope === 'selected'
      ? `已对选中行执行 ${count} 格缩进。`
      : `已对全文执行 ${count} 格缩进。`);
  }

  async function copyAll() {
    const text = textarea.value;
    if (!text) {
      setStatus('输入框为空，没有可复制的内容。');
      return;
    }

    const oldStart = textarea.selectionStart;
    const oldEnd = textarea.selectionEnd;
    const oldScroll = textarea.scrollTop;

    try {
      await navigator.clipboard.writeText(text);
      setStatus('已复制全部内容。');
    } catch (_) {
      textarea.focus();
      textarea.select();
      let ok = false;
      try {
        ok = document.execCommand && document.execCommand('copy');
      } catch (_) {}
      textarea.selectionStart = oldStart;
      textarea.selectionEnd = oldEnd;
      textarea.scrollTop = oldScroll;
      setStatus(ok ? '已复制全部内容。' : '复制失败，请手动复制。');
    }
  }

  function clearAll() {
    textarea.value = '';
    textarea.focus();
    setStatus('已清空全部内容。');
  }

  function onPointerMove(e) {
    const d = state.drag;
    if (!d || e.pointerId !== d.id) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      d.moved = true;
    }

    if (!d.moved) return;

    const maxLeft = Math.max(0, window.innerWidth - root.offsetWidth - 4);
    const maxTop = Math.max(0, window.innerHeight - root.offsetHeight - 4);

    let left = d.left + dx;
    let top = d.top + dy;

    if (left < 0) left = 0;
    if (top < 0) top = 0;
    if (left > maxLeft) left = maxLeft;
    if (top > maxTop) top = maxTop;

    root.style.left = left + 'px';
    root.style.top = top + 'px';
  }

  function finishPointer(e) {
    const d = state.drag;
    if (!d || e.pointerId !== d.id) return;

    try {
      title.releasePointerCapture && title.releasePointerCapture(e.pointerId);
    } catch (_) {}

    const moved = d.moved;
    state.drag = null;

    if (moved) return;

    const now = Date.now();
    if (now - state.lastTap < 280) {
      state.lastTap = 0;
      setCollapsed(!state.collapsed);
    } else {
      state.lastTap = now;
    }
  }

  function onResize() {
    clampPosition();
  }

  function destroy() {
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', finishPointer, true);
    document.removeEventListener('pointercancel', finishPointer, true);
    window.removeEventListener('resize', onResize, true);
    root.remove();
    delete window[KEY];
  }

  title.addEventListener('pointerdown', e => {
    if (e.target === closeBtn || closeBtn.contains(e.target)) return;

    state.drag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      left: root.offsetLeft,
      top: root.offsetTop,
      moved: false
    };

    try {
      title.setPointerCapture && title.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  closeBtn.addEventListener('pointerdown', e => {
    e.stopPropagation();
  });

  closeBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    destroy();
  });

  indentBtn.addEventListener('click', doIndent);
  copyBtn.addEventListener('click', copyAll);
  clearBtn.addEventListener('click', clearAll);

  mode2.addEventListener('click', e => {
    e.preventDefault();
    selectMode('2');
  });

  mode4.addEventListener('click', e => {
    e.preventDefault();
    selectMode('4');
  });

  modeCustom.addEventListener('click', e => {
    e.preventDefault();
    selectMode('custom');
    customCount.focus();
    customCount.select();
  });

  customCount.addEventListener('focus', () => {
    selectMode('custom');
  });

  customCount.addEventListener('input', () => {
    if (state.mode !== 'custom') selectMode('custom');
  });

  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('pointerup', finishPointer, true);
  document.addEventListener('pointercancel', finishPointer, true);
  window.addEventListener('resize', onResize, true);

  selectMode('2');
  setCollapsed(false);
  clampPosition();
  textarea.focus();
  setStatus('就绪。');
  window[KEY] = { destroy, root };
})();
