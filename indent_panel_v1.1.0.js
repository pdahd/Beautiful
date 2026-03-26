(() => {
  const KEY = '__indentPanelV110__';

  if (window[KEY] && typeof window[KEY].destroy === 'function') {
    window[KEY].destroy();
  }

  const state = {
    collapsed: false,
    drag: null,
    lastTap: 0,
    action: 'indent',          // indent | outdent
    indentMode: '2',           // 2 | 4 | custom
    outdentMode: 'flush'       // flush | custom
  };

  const root = document.createElement('div');
  root.id = '__indent-panel-v110';
  root.style.cssText = [
    'position:fixed',
    'left:16px',
    'top:72px',
    'width:min(96vw,640px)',
    'max-width:640px',
    'min-width:300px',
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
      gap:10px;
      padding:12px;
    ">
      <div style="font-size:12px;color:#666;">
        有选区时仅处理选中行；无选区时处理全文。双击标题栏可折叠/展开，拖动标题栏可移动面板。
      </div>

      <textarea data-role="textarea" spellcheck="false" placeholder="把文本粘贴到这里，再执行缩进或反缩进……" style="
        width:100%;
        min-height:320px;
        max-height:68vh;
        padding:12px;
        border:1px solid rgba(0,0,0,.12);
        border-radius:10px;
        background:#fff;
        color:#111;
        font:13px/1.65 monospace;
        resize:vertical;
        box-sizing:border-box;
        outline:none;
      "></textarea>

      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <button data-role="action-indent"></button>
        <button data-role="action-outdent"></button>
      </div>

      <div data-role="indent-box" style="
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:8px;
        padding:10px;
        border:1px solid rgba(0,0,0,.08);
        border-radius:10px;
        background:#fafafa;
      ">
        <span style="font-size:12px;color:#666;">缩进选项</span>
        <button data-role="indent-2"></button>
        <button data-role="indent-4"></button>
        <button data-role="indent-custom"></button>
        <input data-role="indent-custom-count" type="number" min="1" max="64" value="2" inputmode="numeric" style="
          width:86px;
          padding:7px 8px;
          border:1px solid rgba(0,0,0,.12);
          border-radius:8px;
          font:13px/1.4 sans-serif;
          box-sizing:border-box;
        ">
        <button data-role="run-indent"></button>
      </div>

      <div data-role="outdent-box" style="
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:8px;
        padding:10px;
        border:1px solid rgba(0,0,0,.08);
        border-radius:10px;
        background:#fafafa;
      ">
        <span style="font-size:12px;color:#666;">反缩进选项</span>
        <button data-role="outdent-flush"></button>
        <button data-role="outdent-custom"></button>
        <input data-role="outdent-custom-count" type="number" min="1" max="64" value="2" inputmode="numeric" style="
          width:86px;
          padding:7px 8px;
          border:1px solid rgba(0,0,0,.12);
          border-radius:8px;
          font:13px/1.4 sans-serif;
          box-sizing:border-box;
        ">
        <button data-role="run-outdent"></button>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <button data-role="copy"></button>
        <button data-role="select-all"></button>
        <button data-role="clear"></button>
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

  const actionIndent = root.querySelector('[data-role="action-indent"]');
  const actionOutdent = root.querySelector('[data-role="action-outdent"]');

  const indentBox = root.querySelector('[data-role="indent-box"]');
  const indent2 = root.querySelector('[data-role="indent-2"]');
  const indent4 = root.querySelector('[data-role="indent-4"]');
  const indentCustom = root.querySelector('[data-role="indent-custom"]');
  const indentCustomCount = root.querySelector('[data-role="indent-custom-count"]');
  const runIndent = root.querySelector('[data-role="run-indent"]');

  const outdentBox = root.querySelector('[data-role="outdent-box"]');
  const outdentFlush = root.querySelector('[data-role="outdent-flush"]');
  const outdentCustom = root.querySelector('[data-role="outdent-custom"]');
  const outdentCustomCount = root.querySelector('[data-role="outdent-custom-count']') || root.querySelector('[data-role="outdent-custom-count"]');
  const runOutdent = root.querySelector('[data-role="run-outdent"]');

  const copyBtn = root.querySelector('[data-role="copy"]');
  const selectAllBtn = root.querySelector('[data-role="select-all"]');
  const clearBtn = root.querySelector('[data-role="clear"]');
  const statusEl = root.querySelector('[data-role="status"]');

  function setStatus(msg) {
    statusEl.textContent = msg;
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

  function styleChip(btn, text, active, disabled) {
    btn.textContent = active ? `✅ ${text}` : text;
    btn.disabled = !!disabled;
    btn.style.cssText = [
      'padding:7px 10px',
      'border-radius:8px',
      'font:13px/1.4 sans-serif',
      'cursor:' + (disabled ? 'not-allowed' : 'pointer'),
      'border:1px solid ' + (active ? '#111' : 'rgba(0,0,0,.12)'),
      'background:' + (disabled ? '#f3f3f3' : active ? '#111' : '#fff'),
      'color:' + (disabled ? '#999' : active ? '#fff' : '#111'),
      'opacity:' + (disabled ? '.65' : '1')
    ].join(';');
  }

  function stylePrimary(btn, text, active, disabled) {
    btn.textContent = text;
    btn.disabled = !!disabled;
    btn.style.cssText = [
      'padding:8px 12px',
      'border-radius:10px',
      'font:13px/1.4 sans-serif',
      'cursor:' + (disabled ? 'not-allowed' : 'pointer'),
      'border:1px solid ' + (active ? '#111' : 'rgba(0,0,0,.12)'),
      'background:' + (disabled ? '#f3f3f3' : active ? '#111' : '#fff'),
      'color:' + (disabled ? '#999' : active ? '#fff' : '#111'),
      'opacity:' + (disabled ? '.7' : '1')
    ].join(';');
  }

  function styleMinor(btn, text) {
    btn.textContent = text;
    btn.style.cssText = [
      'padding:8px 12px',
      'border-radius:10px',
      'font:13px/1.4 sans-serif',
      'cursor:pointer',
      'border:1px solid rgba(0,0,0,.12)',
      'background:#fff',
      'color:#111'
    ].join(';');
  }

  function styleInput(input, enabled) {
    input.disabled = !enabled;
    input.style.background = enabled ? '#fff' : '#f3f3f3';
    input.style.color = enabled ? '#111' : '#999';
    input.style.opacity = enabled ? '1' : '.75';
  }

  function updateUI() {
    const indentActive = state.action === 'indent';
    const outdentActive = state.action === 'outdent';

    stylePrimary(actionIndent, '缩进模式', indentActive, false);
    stylePrimary(actionOutdent, '反缩进模式', outdentActive, false);

    indentBox.style.opacity = indentActive ? '1' : '.6';
    outdentBox.style.opacity = outdentActive ? '1' : '.6';

    styleChip(indent2, '缩进2格', state.indentMode === '2', !indentActive);
    styleChip(indent4, '缩进4格', state.indentMode === '4', !indentActive);
    styleChip(indentCustom, '自定义缩进', state.indentMode === 'custom', !indentActive);
    styleInput(indentCustomCount, indentActive && state.indentMode === 'custom');
    stylePrimary(runIndent, '执行缩进', indentActive, !indentActive);

    styleChip(outdentFlush, '顶格', state.outdentMode === 'flush', !outdentActive);
    styleChip(outdentCustom, '自定义减少', state.outdentMode === 'custom', !outdentActive);
    styleInput(outdentCustomCount, outdentActive && state.outdentMode === 'custom');
    stylePrimary(runOutdent, '执行反缩进', outdentActive, !outdentActive);

    styleMinor(copyBtn, '全部复制');
    styleMinor(selectAllBtn, '全部高亮');
    styleMinor(clearBtn, '全部清空');
  }

  function flashButton(btn) {
    const old = btn.style.background;
    const oldColor = btn.style.color;
    btn.style.background = '#111';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.style.background = old;
      btn.style.color = oldColor;
    }, 140);
  }

  function getIndentCount() {
    if (state.indentMode === '2') return 2;
    if (state.indentMode === '4') return 4;

    const n = parseInt(indentCustomCount.value, 10);
    if (!Number.isFinite(n) || n < 1) {
      setStatus('自定义缩进数量无效，请输入 1~64 的整数。');
      return null;
    }
    return Math.min(64, n);
  }

  function getOutdentCount() {
    if (state.outdentMode === 'flush') return 'flush';

    const n = parseInt(outdentCustomCount.value, 10);
    if (!Number.isFinite(n) || n < 1) {
      setStatus('自定义减少缩进数量无效，请输入 1~64 的整数。');
      return null;
    }
    return Math.min(64, n);
  }

  function transformLines(mapper, kindText) {
    const text = textarea.value;
    if (!text) {
      setStatus('输入框为空，没有可处理的内容。');
      return;
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const hasSel = start !== end;
    const scrollTop = textarea.scrollTop;

    let lineStart = 0;
    let lineEnd = text.length;

    if (hasSel) {
      lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      lineEnd = text.indexOf('\n', end);
      if (lineEnd === -1) lineEnd = text.length;
    }

    const before = text.slice(0, lineStart);
    const block = text.slice(lineStart, lineEnd);
    const after = text.slice(lineEnd);

    const newBlock = block.split('\n').map(mapper).join('\n');
    textarea.value = before + newBlock + after;
    textarea.focus();
    textarea.scrollTop = scrollTop;

    if (hasSel) {
      textarea.selectionStart = lineStart;
      textarea.selectionEnd = lineStart + newBlock.length;
      setStatus(`已对选中行执行${kindText}。`);
    } else {
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;
      setStatus(`已对全文执行${kindText}。`);
    }
  }

  function doIndent() {
    const count = getIndentCount();
    if (count == null) return;
    const pad = ' '.repeat(count);
    transformLines(line => pad + line, `${count}格缩进`);
  }

  function removeLeadingByCount(line, count) {
    let i = 0;
    while (i < line.length && i < count && (line[i] === ' ' || line[i] === '\t')) i++;
    return line.slice(i);
  }

  function doOutdent() {
    const mode = getOutdentCount();
    if (mode == null) return;

    if (mode === 'flush') {
      transformLines(line => line.replace(/^[ \t]+/, ''), '顶格反缩进');
    } else {
      transformLines(line => removeLeadingByCount(line, mode), `减少${mode}格缩进`);
    }
  }

  async function copyAll() {
    const text = textarea.value;
    flashButton(copyBtn);

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

  function selectAllText() {
    flashButton(selectAllBtn);
    textarea.focus();
    textarea.select();
    setStatus('已高亮全部内容。');
  }

  function clearAll() {
    flashButton(clearBtn);
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
      clampPosition();
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

  closeBtn.addEventListener('pointerdown', e => e.stopPropagation());
  closeBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    destroy();
  });

  actionIndent.addEventListener('click', () => {
    state.action = 'indent';
    updateUI();
    setStatus('已切换到缩进模式。');
  });

  actionOutdent.addEventListener('click', () => {
    state.action = 'outdent';
    updateUI();
    setStatus('已切换到反缩进模式。');
  });

  indent2.addEventListener('click', () => {
    if (state.action !== 'indent') return;
    state.indentMode = '2';
    updateUI();
    setStatus('已选择缩进2格。');
  });

  indent4.addEventListener('click', () => {
    if (state.action !== 'indent') return;
    state.indentMode = '4';
    updateUI();
    setStatus('已选择缩进4格。');
  });

  indentCustom.addEventListener('click', () => {
    if (state.action !== 'indent') return;
    state.indentMode = 'custom';
    updateUI();
    indentCustomCount.focus();
    indentCustomCount.select();
    setStatus('已选择自定义缩进。');
  });

  indentCustomCount.addEventListener('focus', () => {
    state.action = 'indent';
    state.indentMode = 'custom';
    updateUI();
  });

  outdentFlush.addEventListener('click', () => {
    if (state.action !== 'outdent') return;
    state.outdentMode = 'flush';
    updateUI();
    setStatus('已选择顶格反缩进。');
  });

  outdentCustom.addEventListener('click', () => {
    if (state.action !== 'outdent') return;
    state.outdentMode = 'custom';
    updateUI();
    outdentCustomCount.focus();
    outdentCustomCount.select();
    setStatus('已选择自定义减少缩进。');
  });

  outdentCustomCount.addEventListener('focus', () => {
    state.action = 'outdent';
    state.outdentMode = 'custom';
    updateUI();
  });

  runIndent.addEventListener('click', () => {
    if (state.action !== 'indent') return;
    flashButton(runIndent);
    doIndent();
  });

  runOutdent.addEventListener('click', () => {
    if (state.action !== 'outdent') return;
    flashButton(runOutdent);
    doOutdent();
  });

  copyBtn.addEventListener('click', copyAll);
  selectAllBtn.addEventListener('click', selectAllText);
  clearBtn.addEventListener('click', clearAll);

  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('pointerup', finishPointer, true);
  document.addEventListener('pointercancel', finishPointer, true);
  window.addEventListener('resize', onResize, true);

  updateUI();
  setCollapsed(false);
  clampPosition();
  textarea.focus();
  setStatus('就绪。');
  window[KEY] = { destroy, root };
})();
