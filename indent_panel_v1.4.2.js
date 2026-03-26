(() => {
  const KEY = '__indentPanelV142__';
  const PREV_KEYS = [
    '__indentPanelV142__',
    '__indentPanelV141__',
    '__indentPanelV140__',
    '__indentPanelV130__',
    '__indentPanelV120__',
    '__indentPanelV111__',
    '__indentPanelV110__',
    '__indentPanelV100__'
  ];

  function showError(msg) {
    try {
      const old = document.getElementById('__indent-panel-error-v142');
      if (old) old.remove();
      const box = document.createElement('div');
      box.id = '__indent-panel-error-v142';
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
      indent: { strong:'#2563eb', soft:'#dbeafe', border:'#93c5fd', text:'#1d4ed8' },
      outdent: { strong:'#d97706', soft:'#fef3c7', border:'#fbbf24', text:'#92400e' },
      exec: { strong:'#16a34a', border:'#15803d', text:'#fff', mutedBg:'#b8cbbd', mutedBorder:'#91a796', mutedText:'#fff' },
      purple: { strong:'#7e22ce', soft:'#faf5ff', border:'#d8b4fe', text:'#6b21a8', line:'rgba(147,51,234,.7)' },
      muted: { bg:'#f3f4f6', border:'rgba(0,0,0,.08)', text:'#6b7280' }
    };

    const SUPPORTED_EXT = new Set([
      'txt','text','md','markdown','js','mjs','cjs','ts','tsx','jsx',
      'json','json5','yaml','yml','xml','html','htm','css','scss','less',
      'py','sh','bash','zsh','ini','conf','cfg','toml','properties',
      'log','csv','tsv','sql','java','kt','kts','gradle','rb','php','go',
      'rs','c','cc','cpp','h','hpp','srt','vtt','lrc','bat','ps1'
    ]);

    const ACCEPT = [
      'text/*',
      'application/json',
      'application/xml',
      '.txt','.text','.md','.markdown','.js','.mjs','.cjs','.ts','.tsx','.jsx',
      '.json','.json5','.yaml','.yml','.xml','.html','.htm','.css','.scss','.less',
      '.py','.sh','.bash','.zsh','.ini','.conf','.cfg','.toml','.properties',
      '.log','.csv','.tsv','.sql','.java','.kt','.kts','.gradle','.rb','.php','.go',
      '.rs','.c','.cc','.cpp','.h','.hpp','.srt','.vtt','.lrc','.bat','.ps1'
    ].join(',');

    const state = {
      collapsed: false,
      drag: null,
      lastTap: 0,
      action: 'indent',
      indentMode: '2',
      outdentMode: 'flush',
      source: { type: 'plain', files: [], primary: null },
      importOpt: {
        addLabel: true,
        wrapMode: 'none',
        addSeparator: true,
        gapMode: 'blank'
      },
      displayOpt: {
        showGuide: false,
        showLines: false
      }
    };

    const PANEL_W = 860;
    const PANEL_H = 1150;
    const EDITOR_H = 590;
    const GUTTER_W = 58;

    const root = document.createElement('div');
    root.id = '__indent-panel-v142';
    root.style.cssText = [
      'position:fixed',
      'left:16px',
      'top:28px',
      `width:${PANEL_W}px`,
      `height:${PANEL_H}px`,
      'max-width:calc(100vw - 24px)',
      'max-height:calc(100vh - 24px)',
      'background:#fff',
      'color:#111',
      'border:1px solid rgba(0,0,0,.12)',
      'border-radius:12px',
      'box-shadow:0 8px 30px rgba(0,0,0,.18)',
      'z-index:2147483647',
      'font:14px/1.5 sans-serif',
      'overflow:hidden',
      'display:flex',
      'flex-direction:column'
    ].join(';');

    root.innerHTML = `
      <div data-role="title" style="
        display:flex;align-items:center;justify-content:space-between;gap:10px;
        padding:10px 12px;background:#f6f7f9;border-bottom:1px solid rgba(0,0,0,.08);
        cursor:move;user-select:none;-webkit-user-select:none;touch-action:none;flex:none;
      ">
        <div data-role="title-text" style="
          font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        ">缩进处理面板</div>
        <button data-role="close" style="
          flex:none;width:28px;height:28px;border:1px solid rgba(0,0,0,.12);
          border-radius:8px;background:#fff;color:#111;font:16px/1 sans-serif;cursor:pointer;
        ">×</button>
      </div>

      <div data-role="body" style="
        display:flex;flex-direction:column;gap:10px;padding:12px;
        flex:1 1 auto;min-height:0;overflow:auto;
      ">
        <div style="font-size:12px;color:#666;flex:none;">
          有选区时仅处理选中行；无选区时处理全文。双击标题栏可折叠/展开，拖动标题栏可移动面板。
        </div>

        <div data-role="editor-wrap" style="
          position:relative;display:flex;align-items:stretch;flex:none;
          border:1px solid rgba(0,0,0,.12);border-radius:10px;overflow:hidden;background:#fff;
          height:${EDITOR_H}px;
        ">
          <div data-role="gutter-wrap" style="
            display:none;flex:none;width:${GUTTER_W}px;background:#faf5ff;
            border-right:1px solid rgba(0,0,0,.08);overflow:hidden;
          ">
            <div data-role="gutter" style="
              padding:12px 8px;font:13px/1.65 monospace;color:#7e22ce;
              text-align:right;white-space:pre;transform:translateY(0);
            "></div>
          </div>

          <div data-role="text-wrap" style="position:relative;flex:1;min-width:0;background:#fff;">
            <textarea data-role="textarea" wrap="off" spellcheck="false" placeholder="把文本粘贴到这里，或导入本地文本文件……" style="
              width:100%;height:${EDITOR_H}px;min-height:${EDITOR_H}px;max-height:${EDITOR_H}px;
              padding:12px;border:0;border-radius:0;background:#fff;color:#111;
              font:13px/1.65 monospace;resize:none;box-sizing:border-box;outline:none;
              overflow:auto;
            "></textarea>

            <div data-role="guide" style="
              position:absolute;top:0;bottom:0;width:1px;background:rgba(147,51,234,.7);
              pointer-events:none;display:none;
            "></div>

            <div data-role="mirror" style="
              position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;
              white-space:pre;box-sizing:border-box;
            "></div>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:8px;flex:none;">
          <button data-role="action-indent"></button>
          <button data-role="action-outdent"></button>
        </div>

        <div data-role="indent-box" style="
          display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex:none;
          padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);
        ">
          <span style="font-size:12px;color:#666;">缩进选项</span>
          <button data-role="indent-2"></button>
          <button data-role="indent-4"></button>
          <button data-role="indent-custom"></button>
          <input data-role="indent-custom-count" type="number" min="1" max="64" value="2" inputmode="numeric" style="
            width:92px;padding:7px 8px;border:1px solid rgba(0,0,0,.12);
            border-radius:8px;font:13px/1.4 sans-serif;box-sizing:border-box;
          ">
          <button data-role="run-indent"></button>
        </div>

        <div data-role="outdent-box" style="
          display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex:none;
          padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);
        ">
          <span style="font-size:12px;color:#666;">反缩进选项</span>
          <button data-role="outdent-flush"></button>
          <button data-role="outdent-custom"></button>
          <input data-role="outdent-custom-count" type="number" min="1" max="64" value="2" inputmode="numeric" style="
            width:92px;padding:7px 8px;border:1px solid rgba(0,0,0,.12);
            border-radius:8px;font:13px/1.4 sans-serif;box-sizing:border-box;
          ">
          <button data-role="run-outdent"></button>
        </div>

        <div data-role="import-box" style="
          display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex:none;
          padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fafafa;
        ">
          <span style="font-size:12px;color:#666;">导入包装选项</span>
          <button data-role="add-label"></button>
          <button data-role="wrap-none"></button>
          <button data-role="wrap-content"></button>
          <button data-role="wrap-startend"></button>
          <button data-role="add-separator"></button>
          <button data-role="gap-blank"></button>
          <button data-role="gap-tight"></button>
        </div>

        <div data-role="display-box" style="
          display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex:none;
          padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fafafa;
        ">
          <span style="font-size:12px;color:#666;">显示选项</span>
          <button data-role="show-guide"></button>
          <button data-role="show-lines"></button>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:8px;flex:none;">
          <button data-role="import"></button>
          <button data-role="export"></button>
          <button data-role="copy"></button>
          <button data-role="select-all"></button>
          <button data-role="clear"></button>
          <input data-role="file-input" type="file" multiple accept="${ACCEPT}" style="display:none">
        </div>

        <div data-role="meta" style="min-height:18px;font-size:12px;color:#666;flex:none;"></div>
        <div data-role="status" style="min-height:18px;font-size:12px;color:#666;flex:none;">就绪</div>
      </div>
    `;

    (document.body || document.documentElement).appendChild(root);

    const title = root.querySelector('[data-role="title"]');
    const titleText = root.querySelector('[data-role="title-text"]');
    const closeBtn = root.querySelector('[data-role="close"]');
    const body = root.querySelector('[data-role="body"]');

    const gutterWrap = root.querySelector('[data-role="gutter-wrap"]');
    const gutter = root.querySelector('[data-role="gutter"]');
    const textarea = root.querySelector('[data-role="textarea"]');
    const guide = root.querySelector('[data-role="guide"]');
    const mirror = root.querySelector('[data-role="mirror"]');

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

    const importBox = root.querySelector('[data-role="import-box"]');
    const addLabelBtn = root.querySelector('[data-role="add-label"]');
    const wrapNoneBtn = root.querySelector('[data-role="wrap-none"]');
    const wrapContentBtn = root.querySelector('[data-role="wrap-content"]');
    const wrapStartendBtn = root.querySelector('[data-role="wrap-startend"]');
    const addSeparatorBtn = root.querySelector('[data-role="add-separator"]');
    const gapBlankBtn = root.querySelector('[data-role="gap-blank"]');
    const gapTightBtn = root.querySelector('[data-role="gap-tight"]');

    const displayBox = root.querySelector('[data-role="display-box"]');
    const showGuideBtn = root.querySelector('[data-role="show-guide"]');
    const showLinesBtn = root.querySelector('[data-role="show-lines"]');

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

    function sanitizeBaseName(name) {
      return (name || 'text').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'text';
    }

    function makeTimestamp() {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    }

    function parseFileMeta(file) {
      const name = file && file.name ? file.name : 'imported.txt';
      const idx = name.lastIndexOf('.');
      const base = idx > 0 ? name.slice(0, idx) : name;
      const ext = idx > 0 ? name.slice(idx + 1).toLowerCase() : 'txt';
      return { name, base, ext };
    }

    function isSupportedTextFile(file) {
      const meta = parseFileMeta(file);
      if (meta.ext === 'pdf') return false;
      if (file.type && file.type.startsWith('text/')) return true;
      if (file.type === 'application/json' || file.type === 'application/xml') return true;
      return SUPPORTED_EXT.has(meta.ext);
    }

    function readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error((file && file.name) || 'unknown'));
        try {
          reader.readAsText(file, 'utf-8');
        } catch (e) {
          reject(e);
        }
      });
    }

    function guessMime(ext) {
      const map = {
        txt:'text/plain;charset=utf-8',
        md:'text/markdown;charset=utf-8',
        markdown:'text/markdown;charset=utf-8',
        js:'application/javascript;charset=utf-8',
        mjs:'application/javascript;charset=utf-8',
        cjs:'application/javascript;charset=utf-8',
        ts:'application/typescript;charset=utf-8',
        json:'application/json;charset=utf-8',
        yaml:'text/yaml;charset=utf-8',
        yml:'text/yaml;charset=utf-8',
        xml:'application/xml;charset=utf-8',
        html:'text/html;charset=utf-8',
        htm:'text/html;charset=utf-8',
        css:'text/css;charset=utf-8',
        py:'text/plain;charset=utf-8',
        srt:'text/plain;charset=utf-8'
      };
      return map[ext] || 'text/plain;charset=utf-8';
    }

    function stripLeadingNewlines(text) {
      return String(text).replace(/^[\r\n]+/, '');
    }

    function stripTrailingNewlines(text) {
      return String(text).replace(/[\r\n]+$/, '');
    }

    function stripEdgeNewlines(text) {
      return stripTrailingNewlines(stripLeadingNewlines(text));
    }

    function makeJoiner() {
      if (state.importOpt.addSeparator) return '\n\n----------\n\n';
      return state.importOpt.gapMode === 'blank' ? '\n\n' : '\n';
    }

    function buildWrappedPiece(meta, text) {
      const content = stripEdgeNewlines(text);
      const lines = [];

      if (state.importOpt.addLabel) lines.push(`【${meta.name}】`);

      if (state.importOpt.wrapMode === 'content') {
        lines.push('<content>');
        lines.push(content);
        lines.push('</content>');
      } else if (state.importOpt.wrapMode === 'startend') {
        lines.push('START >>>');
        lines.push(content);
        lines.push('<<< END');
      } else {
        lines.push(content);
      }

      return lines.join('\n');
    }

    function joinTextBlocks(left, right) {
      const a = stripTrailingNewlines(left || '');
      const b = stripLeadingNewlines(right || '');
      if (!a) return b;
      if (!b) return a;
      return a + makeJoiner() + b;
    }

    function mergePiecesSequentially(pieces) {
      if (!pieces.length) return '';
      let out = stripEdgeNewlines(pieces[0]);
      for (let i = 1; i < pieces.length; i++) out = joinTextBlocks(out, pieces[i]);
      return out;
    }

    function updateMeta() {
      const s = state.source;
      if (s.type === 'plain') {
        metaEl.textContent = '当前来源：散文本 / 手动粘贴（导出默认 .txt）';
      } else if (s.type === 'single') {
        metaEl.textContent = `当前来源：单文件导入 ${s.primary.name}（当前可保持原扩展名 .${s.primary.ext} 导出）`;
      } else if (s.type === 'multi') {
        metaEl.textContent = `当前来源：多文件追加导入，共 ${s.files.length} 个文件（导出固定为 timestamp_merged_files.txt）`;
      } else {
        metaEl.textContent = `当前来源：散文本 + 导入文件的混合内容（导出固定为 timestamp_merged_files.txt）`;
      }
    }

    function setCollapsed(flag) {
      state.collapsed = !!flag;
      if (state.collapsed) {
        body.style.display = 'none';
        root.style.height = Math.ceil(title.getBoundingClientRect().height + 2) + 'px';
        titleText.textContent = '缩进处理面板（已折叠）';
      } else {
        body.style.display = 'flex';
        root.style.height = PANEL_H + 'px';
        titleText.textContent = '缩进处理面板';
      }
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
      btn.style.cssText = [
        'padding:8px 12px','border-radius:10px','font:13px/1.4 sans-serif','cursor:pointer',
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
        'padding:7px 10px','border-radius:8px','font:13px/1.4 sans-serif',
        'cursor:' + (enabled ? 'pointer' : 'not-allowed'),
        'border:1px solid ' + (enabled ? (selected ? theme.strong : theme.border) : 'rgba(0,0,0,.12)'),
        'background:' + (enabled ? (selected ? theme.strong : '#fff') : '#f3f4f6'),
        'color:' + (enabled ? (selected ? '#fff' : theme.text) : '#999'),
        'opacity:' + (enabled ? '1' : '.7')
      ].join(';');
    }

    function styleExecButton(btn, text, active) {
      btn.textContent = text;
      btn.disabled = !active;
      btn.style.cssText = [
        'padding:8px 12px','border-radius:10px','font:13px/1.4 sans-serif',
        'cursor:' + (active ? 'pointer' : 'not-allowed'),
        'border:1px solid ' + (active ? THEME.exec.border : THEME.exec.mutedBorder),
        'background:' + (active ? THEME.exec.strong : THEME.exec.mutedBg),
        'color:' + (active ? THEME.exec.text : THEME.exec.mutedText),
        'opacity:1'
      ].join(';');
    }

    function styleToolButton(btn, text) {
      btn.textContent = text;
      btn.style.cssText = [
        'padding:8px 12px','border-radius:10px','font:13px/1.4 sans-serif',
        'cursor:pointer','border:1px solid rgba(0,0,0,.12)','background:#fff','color:#111'
      ].join(';');
    }

    function styleInput(input, enabled, theme) {
      input.disabled = !enabled;
      input.style.background = enabled ? '#fff' : '#f3f4f6';
      input.style.color = enabled ? '#111' : '#999';
      input.style.opacity = enabled ? '1' : '.75';
      input.style.borderColor = enabled ? theme.border : 'rgba(0,0,0,.12)';
    }

    function updateLineNumbers() {
      if (!state.displayOpt.showLines) {
        gutterWrap.style.display = 'none';
        return;
      }
      gutterWrap.style.display = 'block';
      const count = Math.max(1, textarea.value.split('\n').length);
      const lines = [];
      for (let i = 1; i <= count; i++) lines.push(String(i));
      gutter.textContent = lines.join('\n');
      gutter.style.transform = `translateY(${-textarea.scrollTop}px)`;
    }

    function syncMirrorStyle() {
      const cs = getComputedStyle(textarea);
      mirror.style.width = textarea.scrollWidth + 'px';
      mirror.style.paddingTop = cs.paddingTop;
      mirror.style.paddingRight = cs.paddingRight;
      mirror.style.paddingBottom = cs.paddingBottom;
      mirror.style.paddingLeft = cs.paddingLeft;
      mirror.style.font = cs.font;
      mirror.style.lineHeight = cs.lineHeight;
      mirror.style.letterSpacing = cs.letterSpacing;
      mirror.style.tabSize = cs.tabSize || '8';
      mirror.style.textTransform = cs.textTransform;
      mirror.style.textIndent = cs.textIndent;
    }

    function updateGuide() {
      if (!state.displayOpt.showGuide || document.activeElement !== textarea) {
        guide.style.display = 'none';
        return;
      }

      syncMirrorStyle();
      const pos = textarea.selectionStart || 0;
      const before = textarea.value.slice(0, pos);

      mirror.innerHTML = '';
      mirror.appendChild(document.createTextNode(before));
      const marker = document.createElement('span');
      marker.textContent = '\u200b';
      mirror.appendChild(marker);

      const x = marker.offsetLeft - textarea.scrollLeft;
      if (x < 0 || x > textarea.clientWidth) {
        guide.style.display = 'none';
        return;
      }

      guide.style.display = 'block';
      guide.style.left = x + 'px';
      guide.style.height = textarea.clientHeight + 'px';
      guide.style.top = '0';
    }

    function updateDisplayLayer() {
      updateLineNumbers();
      updateGuide();
    }

    function updateUI() {
      styleModeButton(actionIndent, '缩进模式', state.action === 'indent', THEME.indent);
      styleModeButton(actionOutdent, '反缩进模式', state.action === 'outdent', THEME.outdent);

      styleSection(indentBox, state.action === 'indent', THEME.indent);
      styleSection(outdentBox, state.action === 'outdent', THEME.outdent);
      styleSection(importBox, true, { soft:'#f8fafc', border:'#dbe3ea' });
      styleSection(displayBox, true, THEME.purple);

      styleChip(indent2, '缩进2格', state.indentMode === '2', state.action === 'indent', THEME.indent);
      styleChip(indent4, '缩进4格', state.indentMode === '4', state.action === 'indent', THEME.indent);
      styleChip(indentCustom, '自定义增加', state.indentMode === 'custom', state.action === 'indent', THEME.indent);
      styleInput(indentCustomCount, state.action === 'indent' && state.indentMode === 'custom', THEME.indent);
      styleExecButton(runIndent, '执行缩进', state.action === 'indent');

      styleChip(outdentFlush, '顶格', state.outdentMode === 'flush', state.action === 'outdent', THEME.outdent);
      styleChip(outdentCustom, '自定义减少', state.outdentMode === 'custom', state.action === 'outdent', THEME.outdent);
      styleInput(outdentCustomCount, state.action === 'outdent' && state.outdentMode === 'custom', THEME.outdent);
      styleExecButton(runOutdent, '执行反缩进', state.action === 'outdent');

      styleChip(addLabelBtn, '添加文件名标签', state.importOpt.addLabel, true, { strong:'#334155', border:'#94a3b8', text:'#334155' });
      styleChip(wrapNoneBtn, '无内容标签', state.importOpt.wrapMode === 'none', true, { strong:'#334155', border:'#94a3b8', text:'#334155' });
      styleChip(wrapContentBtn, '<content>', state.importOpt.wrapMode === 'content', true, { strong:'#334155', border:'#94a3b8', text:'#334155' });
      styleChip(wrapStartendBtn, 'START >>>', state.importOpt.wrapMode === 'startend', true, { strong:'#334155', border:'#94a3b8', text:'#334155' });
      styleChip(addSeparatorBtn, '添加分隔线', state.importOpt.addSeparator, true, { strong:'#334155', border:'#94a3b8', text:'#334155' });
      styleChip(gapBlankBtn, '默认留空行', state.importOpt.gapMode === 'blank', !state.importOpt.addSeparator, { strong:'#475569', border:'#94a3b8', text:'#475569' });
      styleChip(gapTightBtn, '不留空行', state.importOpt.gapMode === 'tight', !state.importOpt.addSeparator, { strong:'#475569', border:'#94a3b8', text:'#475569' });

      styleChip(showGuideBtn, '显示参考线', state.displayOpt.showGuide, true, THEME.purple);
      styleChip(showLinesBtn, '显示行号', state.displayOpt.showLines, true, THEME.purple);

      styleToolButton(importBtn, '导入文件');
      styleToolButton(exportBtn, '导出文件');
      styleToolButton(copyBtn, '全部复制');
      styleToolButton(selectAllBtn, '全部高亮');
      styleToolButton(clearBtn, '全部清空');

      updateDisplayLayer();
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
        setStatus('自��义增加数量无效，请输入 1~64 的整数。');
        return null;
      }
      return Math.min(64, n);
    }

    function getOutdentCount() {
      if (state.outdentMode === 'flush') return 'flush';
      const n = parseInt(outdentCustomCount.value, 10);
      if (!Number.isFinite(n) || n < 1) {
        setStatus('自定义减少数量无效，请输入 1~64 的整数。');
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
      const scrollLeft = textarea.scrollLeft;

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
      textarea.scrollLeft = scrollLeft;

      if (hasSel) {
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = lineStart + newBlock.length;
        setStatus(`已对选中行执行${label}。`);
      } else {
        textarea.selectionStart = 0;
        textarea.selectionEnd = 0;
        setStatus(`已对全文执行${label}。`);
      }
      updateDisplayLayer();
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
      const oldScrollTop = textarea.scrollTop;
      const oldScrollLeft = textarea.scrollLeft;

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
        textarea.scrollTop = oldScrollTop;
        textarea.scrollLeft = oldScrollLeft;
        setStatus(ok ? '已复制全部内容。' : '复制失败，请手动复制。');
      }
    }

    function selectAllText() {
      flashButton(selectAllBtn);
      textarea.focus();
      textarea.select();
      setStatus('已高亮全部内容。');
      updateGuide();
    }

    function clearAll() {
      flashButton(clearBtn);
      textarea.value = '';
      state.source = { type: 'plain', files: [], primary: null };
      updateMeta();
      textarea.focus();
      setStatus('已清空全部内容。');
      updateDisplayLayer();
    }

    async function importFiles(files) {
      if (!files || !files.length) return;

      const supported = [];
      const skipped = [];

      for (const f of files) {
        if (isSupportedTextFile(f)) supported.push(f);
        else skipped.push(f.name || 'unknown');
      }

      if (!supported.length) {
        setStatus('未导入任何文件：所选文件均不属于支持的文本类型。');
        return;
      }

      const items = [];
      const failed = [];

      for (const f of supported) {
        const meta = parseFileMeta(f);
        try {
          const text = await readFileAsText(f);
          items.push({ meta, text });
        } catch (_) {
          failed.push(meta.name);
        }
      }

      if (!items.length) {
        setStatus('导入失败：没有成功读取任何文本文件。');
        return;
      }

      const pieces = items.map(item => buildWrappedPiece(item.meta, item.text));
      const bundle = mergePiecesSequentially(pieces);
      const hadExistingText = textarea.value.length > 0;
      const prev = state.source;

      if (!hadExistingText && prev.type === 'plain') {
        textarea.value = bundle;
        if (items.length === 1) {
          state.source = { type: 'single', files: [items[0].meta], primary: items[0].meta };
        } else {
          state.source = { type: 'multi', files: items.map(x => x.meta), primary: null };
        }
      } else {
        textarea.value = joinTextBlocks(textarea.value, bundle);

        if (prev.type === 'plain') {
          state.source = { type: 'mixed', files: items.map(x => x.meta), primary: null };
        } else if (prev.type === 'single') {
          state.source = { type: 'multi', files: [...prev.files, ...items.map(x => x.meta)], primary: null };
        } else if (prev.type === 'multi') {
          state.source = { type: 'multi', files: [...prev.files, ...items.map(x => x.meta)], primary: null };
        } else {
          state.source = { type: 'mixed', files: [...prev.files, ...items.map(x => x.meta)], primary: null };
        }
      }

      updateMeta();
      updateDisplayLayer();

      const msg = [`已导入 ${items.length} 个文件`];
      if (skipped.length) msg.push(`跳过不支持文件 ${skipped.length} 个`);
      if (failed.length) msg.push(`读取失败 ${failed.length} 个`);
      setStatus(msg.join('；') + '。');
    }

    function exportFile() {
      flashButton(exportBtn);
      const text = textarea.value;
      if (!text) {
        setStatus('输入框为空，没有可导出的内容。');
        return;
      }

      let ext = 'txt';
      let base = 'text';

      if (state.source.type === 'single' && state.source.primary) {
        ext = state.source.primary.ext || 'txt';
        base = state.source.primary.base || 'text';
      } else if (state.source.type === 'multi' || state.source.type === 'mixed') {
        ext = 'txt';
        base = 'merged_files';
      }

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

      if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) d.moved = true;
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
      if (state.collapsed) {
        root.style.height = Math.ceil(title.getBoundingClientRect().height + 2) + 'px';
      } else {
        root.style.height = PANEL_H + 'px';
      }
      clampPosition();
      updateDisplayLayer();
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
      setStatus('已选择自定义增加。');
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
      setStatus('已选择自定义减少。');
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

    addLabelBtn.addEventListener('click', () => {
      state.importOpt.addLabel = !state.importOpt.addLabel;
      updateUI();
      setStatus(state.importOpt.addLabel ? '已开启文件名标签。' : '已关闭文件名标签。');
    });

    wrapNoneBtn.addEventListener('click', () => {
      state.importOpt.wrapMode = 'none';
      updateUI();
      setStatus('已选择：不添加内容首尾标签。');
    });

    wrapContentBtn.addEventListener('click', () => {
      state.importOpt.wrapMode = 'content';
      updateUI();
      setStatus('已选择：<content> 标签。');
    });

    wrapStartendBtn.addEventListener('click', () => {
      state.importOpt.wrapMode = 'startend';
      updateUI();
      setStatus('已选择：START >>> 标签。');
    });

    addSeparatorBtn.addEventListener('click', () => {
      state.importOpt.addSeparator = !state.importOpt.addSeparator;
      updateUI();
      setStatus(state.importOpt.addSeparator ? '已开启分隔线。' : '已关闭分隔线。');
    });

    gapBlankBtn.addEventListener('click', () => {
      if (state.importOpt.addSeparator) return;
      state.importOpt.gapMode = 'blank';
      updateUI();
      setStatus('无分隔线时，边界默认留空行。');
    });

    gapTightBtn.addEventListener('click', () => {
      if (state.importOpt.addSeparator) return;
      state.importOpt.gapMode = 'tight';
      updateUI();
      setStatus('无分隔线时，边界不留空行。');
    });

    showGuideBtn.addEventListener('click', () => {
      state.displayOpt.showGuide = !state.displayOpt.showGuide;
      updateUI();
      setStatus(state.displayOpt.showGuide ? '已开启紫色参考线。' : '已关闭紫色参考线。');
    });

    showLinesBtn.addEventListener('click', () => {
      state.displayOpt.showLines = !state.displayOpt.showLines;
      updateUI();
      setStatus(state.displayOpt.showLines ? '已开启彩色行号。' : '已关闭彩色行号。');
    });

    importBtn.addEventListener('click', () => {
      flashButton(importBtn);
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;
      await importFiles(files);
      textarea.focus();
      updateDisplayLayer();
    });

    exportBtn.addEventListener('click', exportFile);
    copyBtn.addEventListener('click', copyAll);
    selectAllBtn.addEventListener('click', selectAllText);
    clearBtn.addEventListener('click', clearAll);

    textarea.addEventListener('input', updateDisplayLayer);
    textarea.addEventListener('scroll', updateDisplayLayer);
    textarea.addEventListener('click', updateGuide);
    textarea.addEventListener('keyup', updateGuide);
    textarea.addEventListener('focus', updateGuide);
    textarea.addEventListener('blur', updateGuide);
    textarea.addEventListener('select', updateGuide);

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
    console.error('[indent_panel_v1.4.2]', err);
    showError('缩进面板加载失败：' + (err && err.message ? err.message : String(err)));
  }
})();
