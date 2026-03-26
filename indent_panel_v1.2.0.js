(() => {
  const KEY = '__indentPanelV120__';
  const PREV_KEYS = [
    '__indentPanelV120__',
    '__indentPanelV111__',
    '__indentPanelV110__',
    '__indentPanelV100__'
  ];

  function showError(msg) {
    try {
      const old = document.getElementById('__indent-panel-error-v120');
      if (old) old.remove();

      const box = document.createElement('div');
      box.id = '__indent-panel-error-v120';
      box.textContent = msg;
      box.style.cssText = [
        'position:fixed',
        'left:12px',
        'right:12px',
        'top:12px',
        'z-index:2147483647',
        'padding:10px 12px',
        'border-radius:10px',
        'background:#b00020',
        'color:#fff',
        'font:13px/1.5 sans-serif',
        'box-shadow:0 6px 20px rgba(0,0,0,.18)'
      ].join(';');
      (document.body || document.documentElement).appendChild(box);
      setTimeout(() => box.remove(), 5000);
    } catch (_) {}
  }

  try {
    PREV_KEYS.forEach(k => {
      try {
        if (window[k] && typeof window[k].destroy === 'function') {
          window[k].destroy();
        }
      } catch (_) {}
    });

    const THEME = {
      indent: {
        strong: '#2563eb',
        soft: '#dbeafe',
        border: '#93c5fd',
        text: '#1d4ed8'
      },
      outdent: {
        strong: '#d97706',
        soft: '#fef3c7',
        border: '#fbbf24',
        text: '#92400e'
      },
      muted: {
        bg: '#f3f4f6',
        border: 'rgba(0,0,0,.08)',
        text: '#6b7280'
      }
    };

    const ACCEPT = [
      'text/*',
      'application/json',
      'application/xml',
      '.txt','.text','.md','.markdown','.js','.mjs','.cjs',
      '.ts','.tsx','.jsx','.json','.json5',
      '.yaml','.yml','.xml','.html','.htm','.css','.scss','.less',
      '.py','.sh','.bash','.zsh','.ini','.conf','.cfg','.toml','.properties',
      '.log','.csv','.tsv','.sql','.java','.kt','.kts','.gradle',
      '.rb','.php','.go','.rs','.c','.cc','.cpp','.h','.hpp',
      '.srt','.vtt','.lrc','.bat','.ps1'
    ].join(',');

    const state = {
      collapsed: false,
      drag: null,
      lastTap: 0,
      action: 'indent',
      indentMode: '2',
      outdentMode: 'flush',
      fileMeta: null
    };

    const root = document.createElement('div');
    root.id = '__indent-panel-v120';
    root.style.cssText = [
      'position:fixed',
      'left:16px',
      'top:72px',
      'width:min(96vw,700px)',
      'max-width:700px',
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

        <textarea data-role="textarea" spellcheck="false" placeholder="把文本粘贴到这里，或导入本地文本文件……" style="
          width:100%;
          min-height:360px;
          max-height:70vh;
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
          border-radius:10px;
          border:1px solid rgba(0,0,0,.08);
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
          border-radius:10px;
          border:1px solid rgba(0,0,0,.08);
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
          <button data-role="import"></button>
          <button data-role="export"></button>
          <button data-role="copy"></button>
          <button data-role="select-all"></button>
          <button data-role="clear"></button>
          <input data-role="file-input" type="file" accept="${ACCEPT}" style="display:none">
        </div>

        <div data-role="meta" style="
          min-height:18px;
          font-size:12px;
          color:#666;
        "></div>

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
    const outdentCustomCount = root.querySelector('[data-role="outdent-custom-count"]');
    const runOutdent = root.querySelector('[data-role="run-outdent"]');

    const importBtn = root.querySelector('[data-role="import"]');
    const exportBtn = root.querySelector('[data-role="export"]');
    const copyBtn = root.querySelector('[data-role="copy"]');
    const selectAllBtn = root.querySelector('[data-role="select-all"]');
    const clearBtn = root.querySelector('[data-role="clear"]');
    const fileInput = root.querySelector('[data-role="file-input"]');

    const metaEl = root.querySelector('[data-role="meta"]');
    const statusEl = root.querySelector('[data-role="status"]');

    function setStatus(msg) {
      statusEl.textContent = msg;
    }

    function updateMeta() {
      if (state.fileMeta) {
        metaEl.textContent = `当前来源：已导入文件 ${state.fileMeta.name}（导出保持 .${state.fileMeta.ext}）`;
      } else {
        metaEl.textContent = '当前来源：散文本 / 手动粘贴（导出默认 .txt）';
      }
    }

    function currentTheme(action) {
      return action === 'outdent' ? THEME.outdent : THEME.indent;
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

    function styleModeButton(btn, text, selected, theme) {
      btn.textContent = text;
      btn.disabled = false;
      btn.style.cssText = [
        'padding:8px 12px',
        'border-radius:10px',
        'font:13px/1.4 sans-serif',
        'cursor:pointer',
        'border:1px solid ' + (selected ? theme.strong : 'rgba(0,0,0,.12)'),
        'background:' + (selected ? theme.strong : '#fff'),
        'color:' + (selected ? '#fff' : '#111')
      ].join(';');
    }

    function styleSection(box, active, theme) {
      box.style.background = active ? theme.soft : THEME.muted.bg;
      box.style.border = '1px solid ' + (active ? theme.border : THEME.muted.border);
      box.style.opacity = '1';
    }

    function styleChip(btn, text, selected, enabled, theme) {
      btn.textContent = selected ? `✅ ${text}` : text;
      btn.disabled = !enabled;
      btn.style.cssText = [
        'padding:7px 10px',
        'border-radius:8px',
        'font:13px/1.4 sans-serif',
        'cursor:' + (enabled ? 'pointer' : 'not-allowed'),
        'border:1px solid ' + (
          enabled
            ? (selected ? theme.strong : theme.border)
            : 'rgba(0,0,0,.12)'
        ),
        'background:' + (
          enabled
            ? (selected ? theme.strong : '#fff')
            : '#f3f4f6'
        ),
        'color:' + (
          enabled
            ? (selected ? '#fff' : theme.text)
            : '#999'
        ),
        'opacity:' + (enabled ? '1' : '.7')
      ].join(';');
    }

    function styleActionButton(btn, text, enabled, theme) {
      btn.textContent = text;
      btn.disabled = !enabled;
      btn.style.cssText = [
        'padding:8px 12px',
        'border-radius:10px',
        'font:13px/1.4 sans-serif',
        'cursor:' + (enabled ? 'pointer' : 'not-allowed'),
        'border:1px solid ' + (enabled ? theme.strong : 'rgba(0,0,0,.12)'),
        'background:' + (enabled ? theme.strong : '#f3f4f6'),
        'color:' + (enabled ? '#fff' : '#999'),
        'opacity:' + (enabled ? '1' : '.7')
      ].join(';');
    }

    function styleToolButton(btn, text) {
      btn.textContent = text;
      btn.disabled = false;
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

    function styleInput(input, enabled, theme) {
      input.disabled = !enabled;
      input.style.background = enabled ? '#fff' : '#f3f4f6';
      input.style.color = enabled ? '#111' : '#999';
      input.style.opacity = enabled ? '1' : '.75';
      input.style.borderColor = enabled ? theme.border : 'rgba(0,0,0,.12)';
    }

    function updateUI() {
      styleModeButton(actionIndent, '缩进模式', state.action === 'indent', THEME.indent);
      styleModeButton(actionOutdent, '反缩进模式', state.action === 'outdent', THEME.outdent);

      styleSection(indentBox, state.action === 'indent', THEME.indent);
      styleSection(outdentBox, state.action === 'outdent', THEME.outdent);

      styleChip(indent2, '缩进2格', state.indentMode === '2', state.action === 'indent', THEME.indent);
      styleChip(indent4, '缩进4格', state.indentMode === '4', state.action === 'indent', THEME.indent);
      styleChip(indentCustom, '自定义缩进', state.indentMode === 'custom', state.action === 'indent', THEME.indent);
      styleInput(indentCustomCount, state.action === 'indent' && state.indentMode === 'custom', THEME.indent);
      styleActionButton(runIndent, '执行缩进', state.action === 'indent', THEME.indent);

      styleChip(outdentFlush, '顶格', state.outdentMode === 'flush', state.action === 'outdent', THEME.outdent);
      styleChip(outdentCustom, '自定义减少', state.outdentMode === 'custom', state.action === 'outdent', THEME.outdent);
      styleInput(outdentCustomCount, state.action === 'outdent' && state.outdentMode === 'custom', THEME.outdent);
      styleActionButton(runOutdent, '执行反缩进', state.action === 'outdent', THEME.outdent);

      styleToolButton(importBtn, '导入文件');
      styleToolButton(exportBtn, '导出文件');
      styleToolButton(copyBtn, '全部复制');
      styleToolButton(selectAllBtn, '全部高亮');
      styleToolButton(clearBtn, '全部清空');
    }

    function flashButton(btn) {
      const oldBg = btn.style.background;
      const oldColor = btn.style.color;
      btn.style.background = '#111';
      btn.style.color = '#fff';
      setTimeout(() => {
        btn.style.background = oldBg;
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

    function transformLines(mapper, label) {
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
        setStatus(`已对选中行执行${label}。`);
      } else {
        textarea.selectionStart = 0;
        textarea.selectionEnd = 0;
        setStatus(`已对全文执行${label}。`);
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
      flashButton(copyBtn);
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

    function selectAllText() {
      flashButton(selectAllBtn);
      textarea.focus();
      textarea.select();
      setStatus('已高亮全部内容。');
    }

    function clearAll() {
      flashButton(clearBtn);
      textarea.value = '';
      state.fileMeta = null;
      updateMeta();
      textarea.focus();
      setStatus('已清空全部内容。');
    }

    function parseFileMeta(file) {
      const name = file && file.name ? file.name : 'imported.txt';
      const idx = name.lastIndexOf('.');
      const base = idx > 0 ? name.slice(0, idx) : name;
      const ext = idx > 0 ? name.slice(idx + 1).toLowerCase() : 'txt';
      return { name, base, ext };
    }

    function sanitizeBaseName(name) {
      return (name || 'text')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim() || 'text';
    }

    function makeTimestamp() {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    }

    function guessMime(ext) {
      const map = {
        txt: 'text/plain;charset=utf-8',
        md: 'text/markdown;charset=utf-8',
        markdown: 'text/markdown;charset=utf-8',
        js: 'application/javascript;charset=utf-8',
        mjs: 'application/javascript;charset=utf-8',
        cjs: 'application/javascript;charset=utf-8',
        ts: 'application/typescript;charset=utf-8',
        json: 'application/json;charset=utf-8',
        yaml: 'text/yaml;charset=utf-8',
        yml: 'text/yaml;charset=utf-8',
        xml: 'application/xml;charset=utf-8',
        html: 'text/html;charset=utf-8',
        htm: 'text/html;charset=utf-8',
        css: 'text/css;charset=utf-8',
        py: 'text/plain;charset=utf-8',
        srt: 'text/plain;charset=utf-8'
      };
      return map[ext] || 'text/plain;charset=utf-8';
    }

    function importFile(file) {
      if (!file) return;

      const meta = parseFileMeta(file);
      if (meta.ext === 'pdf') {
        setStatus('PDF 不属于纯文本导入范围，暂不支持。');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        textarea.value = typeof reader.result === 'string' ? reader.result : '';
        state.fileMeta = meta;
        updateMeta();
        setStatus(`已导入文件：${meta.name}`);
      };
      reader.onerror = () => {
        setStatus('文件导入失败，请确认它是可读取的文本文件。');
      };

      try {
        reader.readAsText(file, 'utf-8');
      } catch (_) {
        setStatus('文件导入失败，可能不是文本文件或编码不受支持。');
      }
    }

    function exportFile() {
      flashButton(exportBtn);

      const text = textarea.value;
      if (!text) {
        setStatus('输入框为空，没有可导出的内容。');
        return;
      }

      const ext = state.fileMeta ? state.fileMeta.ext : 'txt';
      const base = state.fileMeta ? state.fileMeta.base : 'text';
      const fileName = `${makeTimestamp()}_${sanitizeBaseName(base)}.${ext}`;
      const blob = new Blob([text], { type: guessMime(ext) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`已导出文件：${fileName}`);
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

    importBtn.addEventListener('click', () => {
      flashButton(importBtn);
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) importFile(file);
    });

    exportBtn.addEventListener('click', exportFile);
    copyBtn.addEventListener('click', copyAll);
    selectAllBtn.addEventListener('click', selectAllText);
    clearBtn.addEventListener('click', clearAll);

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', finishPointer, true);
    document.addEventListener('pointercancel', finishPointer, true);
    window.addEventListener('resize', onResize, true);

    updateUI();
    updateMeta();
    setCollapsed(false);
    clampPosition();
    setStatus('就绪。');
    window[KEY] = { destroy, root };
  } catch (err) {
    console.error('[indent_panel_v1.2.0]', err);
    showError('缩进面板加载失败：' + (err && err.message ? err.message : String(err)));
  }
})();
