(() => {
  const SCRIPT_NAME = "Arena Draft Studio Markdown Probe";
  const SCRIPT_VERSION = "v0.1.0";
  const PROBE_KEY = "__arenaDraftStudioMarkdownProbe__";
  const MAINLINE_KEY = "__arenaDraftStudioApp__";
  const HOST_ID = "__arena_draft_studio_markdown_probe_host__";
  const TOAST_ID = "__arena_draft_studio_markdown_probe_toast__";
  const SUPPORTED_HOST_RE = /(^|\.)arena\.ai$/i;
  const COPY_ICON_HINT = "M19.4 20H9.6";
  const MAX_HISTORY = 30;

  const existing = window[PROBE_KEY];

  if (existing && existing.version === SCRIPT_VERSION && existing.api) {
    const visible = existing.api.togglePanel();
    existing.api.toast(visible ? "面板已打开" : "面板已隐藏");
    return;
  }

  if (existing && existing.api && typeof existing.api.destroy === "function") {
    try {
      existing.api.destroy();
    } catch (err) {
      console.warn(`[${SCRIPT_NAME} ${SCRIPT_VERSION}] destroy old probe failed`, err);
    }
  }

  const app = {
    name: SCRIPT_NAME,
    version: SCRIPT_VERSION,

    state: {
      supportedHost: SUPPORTED_HOST_RE.test(location.hostname),
      panelOpen: true,
      probing: true,
      captures: [],
      pending: null,
      mainlinePaused: false,
      clipboardHookInstalled: false,
      copyEventInstalled: false,
      clickListenerInstalled: false,
      readFallbackEnabled: true,
      internalWrite: false
    },

    refs: {
      host: null,
      shadow: null,
      fab: null,
      panel: null,
      status: null,
      substatus: null,
      latestMeta: null,
      latestPreview: null,
      historyMeta: null,
      historyList: null,
      btnProbe: null,
      btnCopyLatestRaw: null,
      btnCopyLatestWrapped: null,
      btnClearHistory: null,
      closeBtn: null
    },

    originalClipboardWriteText: null,
    boundOnDocumentClick: null,
    boundOnCopyEvent: null,

    init() {
      this.pauseMainlineIfNeeded();
      this.buildUI();
      this.installClipboardHook();
      this.installCopyEventHook();
      this.installClickListener();
      this.updateUI();

      console.info(`[${this.name} ${this.version}] initialized`, {
        host: location.host,
        supportedHost: this.state.supportedHost,
        clipboardHookInstalled: this.state.clipboardHookInstalled
      });

      if (!this.state.supportedHost) {
        this.toast("当前页面不是 arena.ai\n此 Probe 针对 arena.ai 编写");
      } else if (this.state.mainlinePaused) {
        this.toast("已加载 Probe\n并自动暂停主线监听");
      } else {
        this.toast("已加载 Markdown Probe\n现在去点 arena.ai 的 copy 按钮");
      }

      window[PROBE_KEY] = {
        name: this.name,
        version: this.version,
        api: this
      };
    },

    destroy() {
      if (this.boundOnDocumentClick) {
        document.removeEventListener("click", this.boundOnDocumentClick, true);
      }

      if (this.boundOnCopyEvent) {
        document.removeEventListener("copy", this.boundOnCopyEvent, false);
      }

      this.restoreClipboardHook();

      const oldToast = document.getElementById(TOAST_ID);
      if (oldToast) oldToast.remove();

      const oldHost = document.getElementById(HOST_ID);
      if (oldHost) oldHost.remove();

      if (window[PROBE_KEY] && window[PROBE_KEY].version === this.version) {
        delete window[PROBE_KEY];
      }
    },

    toast(message) {
      let el = document.getElementById(TOAST_ID);
      if (el) el.remove();

      el = document.createElement("div");
      el.id = TOAST_ID;
      el.textContent = `${this.name} ${this.version}\n${message}`;
      el.style.cssText = [
        "position:fixed",
        "left:50%",
        "top:20px",
        "transform:translateX(-50%)",
        "z-index:2147483647",
        "background:rgba(0,0,0,.88)",
        "color:#fff",
        "padding:10px 14px",
        "border-radius:12px",
        "font:14px/1.45 sans-serif",
        "max-width:85vw",
        "white-space:pre-wrap",
        "box-shadow:0 4px 16px rgba(0,0,0,.3)"
      ].join(";");

      document.body.appendChild(el);

      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        const node = document.getElementById(TOAST_ID);
        if (node) node.remove();
      }, 2400);
    },

    getClass(el) {
      return el && typeof el.className === "string" ? el.className : "";
    },

    hasClassText(el, text) {
      return this.getClass(el).includes(text);
    },

    walkAncestors(node, max = 10) {
      const list = [];
      let n = node;
      for (let i = 0; n && i < max; i += 1, n = n.parentElement) {
        list.push(n);
      }
      return list;
    },

    normalizeDomText(text) {
      return (text || "")
        .replace(/\u00A0/g, " ")
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    },

    preserveNativeText(text) {
      return String(text == null ? "" : text).replace(/\r\n?/g, "\n");
    },

    compareText(text) {
      return String(text == null ? "" : text).replace(/\r\n?/g, "\n").trim();
    },

    buildCaptureId() {
      return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    },

    resolveSenderLabel(senderKey) {
      const mainline = window[MAINLINE_KEY];
      const state = mainline && mainline.api && mainline.api.state ? mainline.api.state : null;

      const meLabel = state && state.settings ? state.settings.meLabel : "我";
      const aiLabel = state && state.settings ? state.settings.aiLabel : "AI";

      if (senderKey === "me") return meLabel;
      if (senderKey === "ai") return aiLabel;
      return "";
    },

    isArenaCopyButton(btn) {
      if (!btn || btn.tagName !== "BUTTON") return false;
      return [...btn.querySelectorAll("path")].some((p) =>
        (p.getAttribute("d") || "").includes(COPY_ICON_HINT)
      );
    },

    findMessageRootFromButton(button) {
      const chain = this.walkAncestors(button, 8);

      for (const el of chain) {
        if (this.hasClassText(el, "bg-surface-primary")) return el;
      }

      for (const el of chain) {
        if (this.hasClassText(el, "group") && this.hasClassText(el, "self-end")) return el;
      }

      for (const el of chain) {
        if (
          this.hasClassText(el, "justify-end") &&
          el.querySelector &&
          el.querySelector("div.bg-surface-raised")
        ) {
          return el;
        }
      }

      for (const el of chain) {
        if (el.querySelector && el.querySelector("div.prose")) return el;
      }

      return null;
    },

    detectSenderKeyFromRoot(root) {
      if (!root) return "";

      const c = this.getClass(root);

      if (c.includes("bg-surface-primary")) {
        return "ai";
      }

      if (
        (c.includes("group") && c.includes("self-end")) ||
        c.includes("justify-end") ||
        (root.querySelector && root.querySelector("div.bg-surface-raised"))
      ) {
        return "me";
      }

      return "";
    },

    findTextContainer(root) {
      if (!root || !root.querySelector) return null;
      return root.querySelector("div.prose") || root.querySelector("p");
    },

    extractFromButton(button) {
      const root = this.findMessageRootFromButton(button);
      const senderKey = this.detectSenderKeyFromRoot(root);
      const sender = this.resolveSenderLabel(senderKey);

      const textContainer = this.findTextContainer(root);
      const domText = this.normalizeDomText(textContainer ? textContainer.innerText : "");

      if (!sender || !domText) return null;

      return {
        root,
        senderKey,
        sender,
        domText
      };
    },

    pauseMainlineIfNeeded() {
      const mainline = window[MAINLINE_KEY];
      if (!mainline || !mainline.api) return;

      try {
        const wasListening = !!(mainline.api.state && mainline.api.state.listening);
        if (wasListening && typeof mainline.api.setListening === "function") {
          mainline.api.setListening(false);
          this.state.mainlinePaused = true;
        }
      } catch (err) {
        console.warn(`[${this.name} ${this.version}] pause mainline failed`, err);
      }
    },

    isPendingFresh(pending = this.state.pending) {
      if (!pending) return false;
      return (Date.now() - pending.startedAt) <= 4000;
    },

    beginPendingCapture(info) {
      this.state.pending = {
        id: this.buildCaptureId(),
        sender: info.sender,
        senderKey: info.senderKey,
        domText: info.domText,
        startedAt: Date.now()
      };

      this.updateUI();
      this.toast(`已侦测 copy 点击：${info.sender}\n等待原生复制结果...`);

      this.scheduleReadFallback(this.state.pending.id);
    },

    observeNativeText(rawText, method) {
      if (this.state.internalWrite) return;
      if (!this.isPendingFresh()) return;

      const nativeText = this.preserveNativeText(rawText);
      if (!nativeText) return;

      const pending = this.state.pending;
      if (!pending) return;

      this.commitCapture(pending, nativeText, method);
    },

    commitCapture(pending, nativeText, method) {
      if (!pending) return;
      if (!this.state.pending || this.state.pending.id !== pending.id) return;

      const capture = {
        id: this.buildCaptureId(),
        sender: pending.sender,
        senderKey: pending.senderKey,
        domText: pending.domText,
        nativeText,
        method,
        capturedAt: new Date().toISOString(),
        changed: this.compareText(nativeText) !== this.compareText(pending.domText),
        charCount: nativeText.length
      };

      this.state.captures.unshift(capture);
      if (this.state.captures.length > MAX_HISTORY) {
        this.state.captures = this.state.captures.slice(0, MAX_HISTORY);
      }

      this.state.pending = null;
      this.updateUI();

      console.log(`[${this.name} ${this.version}] capture`, capture);

      this.toast(
        `已捕获原生文本：${capture.sender}\n` +
        `方式：${capture.method}\n` +
        `与 DOM 文本${capture.changed ? "不同" : "相同"}`
      );
    },

    scheduleReadFallback(pendingId) {
      if (!this.state.readFallbackEnabled) return;

      const delays = [150, 450, 900];
      for (const delay of delays) {
        setTimeout(async () => {
          const pending = this.state.pending;
          if (!pending || pending.id !== pendingId) return;
          if (!this.isPendingFresh(pending)) return;

          try {
            if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
              return;
            }
            const text = await navigator.clipboard.readText();
            if (!text) return;

            if (this.state.pending && this.state.pending.id === pendingId) {
              this.observeNativeText(text, "readText");
            }
          } catch (err) {
            // 静默失败即可，说明当前环境不允许 readText
          }
        }, delay);
      }
    },

    installClipboardHook() {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== "function") {
        this.state.clipboardHookInstalled = false;
        return;
      }

      try {
        const original = clipboard.writeText.bind(clipboard);
        this.originalClipboardWriteText = original;

        clipboard.writeText = async (text) => {
          try {
            this.observeNativeText(text, "writeText");
          } catch (err) {
            console.warn(`[${this.name} ${this.version}] observe writeText failed`, err);
          }
          return original(text);
        };

        this.state.clipboardHookInstalled = true;
      } catch (err) {
        console.warn(`[${this.name} ${this.version}] install clipboard hook failed`, err);
        this.state.clipboardHookInstalled = false;
      }
    },

    restoreClipboardHook() {
      const clipboard = navigator.clipboard;
      if (!clipboard || !this.originalClipboardWriteText) return;

      try {
        clipboard.writeText = this.originalClipboardWriteText;
      } catch (err) {
        console.warn(`[${this.name} ${this.version}] restore clipboard hook failed`, err);
      }
    },

    installCopyEventHook() {
      if (this.boundOnCopyEvent) {
        document.removeEventListener("copy", this.boundOnCopyEvent, false);
      }

      this.boundOnCopyEvent = (event) => {
        if (!this.state.probing) return;
        if (!this.isPendingFresh()) return;

        try {
          const cd = event.clipboardData;
          const text = cd ? cd.getData("text/plain") : "";
          if (text) {
            this.observeNativeText(text, "copy-event");
          }
        } catch (err) {
          console.warn(`[${this.name} ${this.version}] copy-event probe failed`, err);
        }
      };

      document.addEventListener("copy", this.boundOnCopyEvent, false);
      this.state.copyEventInstalled = true;
    },

    installClickListener() {
      if (this.boundOnDocumentClick) {
        document.removeEventListener("click", this.boundOnDocumentClick, true);
      }

      this.boundOnDocumentClick = (event) => {
        if (!this.state.probing) return;
        if (!this.state.supportedHost) return;

        const button = event.target && event.target.closest
          ? event.target.closest("button")
          : null;

        if (!this.isArenaCopyButton(button)) return;

        const info = this.extractFromButton(button);
        if (!info) {
          this.toast("未能解析当前按钮对应的消息");
          return;
        }

        this.beginPendingCapture(info);
      };

      document.addEventListener("click", this.boundOnDocumentClick, true);
      this.state.clickListenerInstalled = true;
    },

    togglePanel(force) {
      if (typeof force === "boolean") {
        this.state.panelOpen = force;
      } else {
        this.state.panelOpen = !this.state.panelOpen;
      }
      this.updateUI();
      return this.state.panelOpen;
    },

    toggleProbing() {
      this.state.probing = !this.state.probing;
      this.state.pending = null;
      this.updateUI();
      this.toast(this.state.probing ? "Probe 已开启" : "Probe 已关闭");
    },

    latestCapture() {
      return this.state.captures[0] || null;
    },

    async writeClipboard(text) {
      this.state.internalWrite = true;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
      } finally {
        this.state.internalWrite = false;
      }
    },

    wrapCapture(capture) {
      if (!capture) return "";
      return `>>> ${capture.sender}\n${capture.nativeText}`;
    },

    async copyLatestRaw() {
      const latest = this.latestCapture();
      if (!latest) {
        this.toast("暂无捕获记录");
        return;
      }
      await this.writeClipboard(latest.nativeText);
      this.toast(`已复制最近原生文本\n方式：${latest.method}`);
    },

    async copyLatestWrapped() {
      const latest = this.latestCapture();
      if (!latest) {
        this.toast("暂无捕获记录");
        return;
      }
      await this.writeClipboard(this.wrapCapture(latest));
      this.toast(`已复制最近包装块\n发言人：${latest.sender}`);
    },

    findCaptureById(id) {
      return this.state.captures.find((item) => item.id === id) || null;
    },

    async copyCaptureRaw(id) {
      const item = this.findCaptureById(id);
      if (!item) {
        this.toast("未找到该记录");
        return;
      }
      await this.writeClipboard(item.nativeText);
      this.toast(`已复制记录原文\n${item.sender} / ${item.method}`);
    },

    async copyCaptureWrapped(id) {
      const item = this.findCaptureById(id);
      if (!item) {
        this.toast("未找到该记录");
        return;
      }
      await this.writeClipboard(this.wrapCapture(item));
      this.toast(`已复制记录包装块\n${item.sender}`);
    },

    clearHistory() {
      if (!this.state.captures.length) {
        this.toast("历史为空");
        return;
      }
      const ok = confirm(`确定清空 Probe 历史吗？\n当前共有 ${this.state.captures.length} 条记录。`);
      if (!ok) return;

      this.state.captures = [];
      this.state.pending = null;
      this.updateUI();
      this.toast("历史已清空");
    },

    renderHistory() {
      const list = this.state.captures;
      this.refs.historyMeta.textContent = list.length ? `共 ${list.length} 条` : "空";

      if (!list.length) {
        this.refs.historyList.innerHTML = `
          <div class="mdp-empty">
            暂无捕获记录。请开启 Probe 后，点击 arena.ai 页面中的 copy 按钮。
          </div>
        `;
        return;
      }

      const html = list.slice(0, 12).map((item) => {
        const preview = item.nativeText.length > 180
          ? `${item.nativeText.slice(0, 180)}…`
          : item.nativeText;

        return `
          <div class="mdp-item">
            <div class="mdp-item-head">
              <div class="mdp-item-title">
                <span class="mdp-tag">${this.escapeHtml(item.sender)}</span>
                <span class="mdp-method">${this.escapeHtml(item.method)}</span>
                <span class="mdp-diff ${item.changed ? "is-diff" : "is-same"}">
                  ${item.changed ? "不同" : "相同"}
                </span>
              </div>
              <div class="mdp-item-actions">
                <button class="mdp-mini" data-action="copy-raw" data-id="${this.escapeHtml(item.id)}" type="button">原文</button>
                <button class="mdp-mini" data-action="copy-wrap" data-id="${this.escapeHtml(item.id)}" type="button">包装</button>
              </div>
            </div>
            <div class="mdp-item-body">${this.escapeHtml(preview)}</div>
          </div>
        `;
      }).join("");

      this.refs.historyList.innerHTML = html;
    },

    buildUI() {
      const oldHost = document.getElementById(HOST_ID);
      if (oldHost) oldHost.remove();

      const host = document.createElement("div");
      host.id = HOST_ID;
      host.style.cssText = "all: initial;";
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: "open" });

      shadow.innerHTML = `
        <style>
          .mdp-wrap {
            position: fixed;
            right: 16px;
            bottom: 120px;
            z-index: 2147483646;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #111827;
          }

          .mdp-fab {
            position: absolute;
            right: 0;
            bottom: 0;
            border: none;
            border-radius: 999px;
            background: #1f2937;
            color: #fff;
            padding: 10px 14px;
            font-size: 13px;
            font-weight: 700;
            box-shadow: 0 8px 24px rgba(0,0,0,.25);
            cursor: pointer;
          }

          .mdp-panel {
            position: absolute;
            right: 0;
            bottom: 52px;
            width: min(400px, 94vw);
            max-height: 78vh;
            overflow: auto;
            background: rgba(255,255,255,.98);
            color: #111827;
            border: 1px solid rgba(0,0,0,.08);
            border-radius: 16px;
            box-shadow: 0 12px 36px rgba(0,0,0,.22);
            padding: 12px;
            backdrop-filter: blur(8px);
          }

          .mdp-hidden {
            display: none;
          }

          .mdp-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
          }

          .mdp-title {
            font-size: 14px;
            font-weight: 800;
            line-height: 1.3;
          }

          .mdp-version {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .mdp-close {
            border: none;
            background: #f3f4f6;
            color: #111827;
            width: 28px;
            height: 28px;
            border-radius: 999px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
          }

          .mdp-status,
          .mdp-substatus {
            font-size: 12px;
            line-height: 1.55;
            margin-bottom: 6px;
            white-space: pre-wrap;
          }

          .mdp-status {
            font-weight: 700;
          }

          .mdp-substatus {
            color: #4b5563;
          }

          .mdp-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 10px 0 12px;
          }

          .mdp-btn {
            border: none;
            border-radius: 10px;
            background: #111827;
            color: #fff;
            padding: 10px 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .mdp-btn.secondary {
            background: #f3f4f6;
            color: #111827;
          }

          .mdp-btn.warn {
            background: #b91c1c;
            color: #fff;
          }

          .mdp-section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin: 10px 0 6px;
            font-size: 12px;
            font-weight: 700;
          }

          .mdp-section-meta {
            font-weight: 500;
            color: #6b7280;
          }

          .mdp-preview {
            width: 100%;
            min-height: 120px;
            resize: vertical;
            box-sizing: border-box;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 10px;
            background: #f9fafb;
            color: #111827;
            font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }

          .mdp-history {
            max-height: 240px;
            overflow: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 8px;
          }

          .mdp-item {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 8px;
            background: #fff;
          }

          .mdp-item-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 6px;
          }

          .mdp-item-title {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
            font-size: 12px;
            font-weight: 700;
          }

          .mdp-tag {
            background: #e5e7eb;
            color: #111827;
            border-radius: 999px;
            padding: 2px 8px;
          }

          .mdp-method {
            color: #6b7280;
          }

          .mdp-diff {
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 11px;
          }

          .mdp-diff.is-diff {
            background: #dbeafe;
            color: #1d4ed8;
          }

          .mdp-diff.is-same {
            background: #e5e7eb;
            color: #374151;
          }

          .mdp-item-actions {
            display: flex;
            gap: 4px;
          }

          .mdp-mini {
            border: none;
            border-radius: 8px;
            background: #f3f4f6;
            color: #111827;
            padding: 4px 7px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
          }

          .mdp-item-body {
            font-size: 12px;
            line-height: 1.5;
            color: #374151;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .mdp-empty {
            border: 1px dashed #d1d5db;
            border-radius: 10px;
            padding: 10px;
            font-size: 12px;
            color: #6b7280;
            background: #f9fafb;
            line-height: 1.6;
          }

          .mdp-note {
            margin-top: 8px;
            font-size: 11px;
            color: #6b7280;
            line-height: 1.5;
          }
        </style>

        <div class="mdp-wrap">
          <button class="mdp-fab" type="button">MD Probe</button>

          <section class="mdp-panel">
            <div class="mdp-header">
              <div>
                <div class="mdp-title">${this.name}</div>
                <div class="mdp-version">${this.version}</div>
              </div>
              <button class="mdp-close" type="button">×</button>
            </div>

            <div class="mdp-status"></div>
            <div class="mdp-substatus"></div>

            <div class="mdp-buttons">
              <button class="mdp-btn" data-action="toggle-probe" type="button"></button>
              <button class="mdp-btn secondary" data-action="copy-latest-raw" type="button">复制最近原文</button>
              <button class="mdp-btn secondary" data-action="copy-latest-wrap" type="button">复制最近包装块</button>
              <button class="mdp-btn warn" data-action="clear-history" type="button">清空历史</button>
            </div>

            <div class="mdp-section-head">
              <span>最近一次捕获</span>
              <span class="mdp-section-meta mdp-latest-meta"></span>
            </div>

            <textarea class="mdp-preview" readonly placeholder="暂无捕获记录"></textarea>

            <div class="mdp-section-head">
              <span>捕获历史</span>
              <span class="mdp-section-meta mdp-history-meta"></span>
            </div>

            <div class="mdp-history"></div>

            <div class="mdp-note">
              目标：验证 arena.ai 平台 copy 的原生输出是否可稳定捕获。
              若稳定成功且内容明显优于 DOM 纯文本，则下一步可在主线中加入 Markdown 开关。
            </div>
          </section>
        </div>
      `;

      this.refs.host = host;
      this.refs.shadow = shadow;
      this.refs.fab = shadow.querySelector(".mdp-fab");
      this.refs.panel = shadow.querySelector(".mdp-panel");
      this.refs.status = shadow.querySelector(".mdp-status");
      this.refs.substatus = shadow.querySelector(".mdp-substatus");
      this.refs.latestMeta = shadow.querySelector(".mdp-latest-meta");
      this.refs.latestPreview = shadow.querySelector(".mdp-preview");
      this.refs.historyMeta = shadow.querySelector(".mdp-history-meta");
      this.refs.historyList = shadow.querySelector(".mdp-history");
      this.refs.btnProbe = shadow.querySelector('[data-action="toggle-probe"]');
      this.refs.btnCopyLatestRaw = shadow.querySelector('[data-action="copy-latest-raw"]');
      this.refs.btnCopyLatestWrapped = shadow.querySelector('[data-action="copy-latest-wrap"]');
      this.refs.btnClearHistory = shadow.querySelector('[data-action="clear-history"]');
      this.refs.closeBtn = shadow.querySelector(".mdp-close");

      this.refs.fab.addEventListener("click", () => {
        this.togglePanel();
      });

      this.refs.closeBtn.addEventListener("click", () => {
        this.togglePanel(false);
      });

      this.refs.btnProbe.addEventListener("click", () => {
        this.toggleProbing();
      });

      this.refs.btnCopyLatestRaw.addEventListener("click", async () => {
        await this.copyLatestRaw();
      });

      this.refs.btnCopyLatestWrapped.addEventListener("click", async () => {
        await this.copyLatestWrapped();
      });

      this.refs.btnClearHistory.addEventListener("click", () => {
        this.clearHistory();
      });

      this.refs.historyList.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        if (!action || !id) return;

        if (action === "copy-raw") {
          await this.copyCaptureRaw(id);
          return;
        }

        if (action === "copy-wrap") {
          await this.copyCaptureWrapped(id);
        }
      });
    },

    updateUI() {
      const latest = this.latestCapture();
      const historyCount = this.state.captures.length;
      const pending = this.state.pending;

      this.refs.panel.classList.toggle("mdp-hidden", !this.state.panelOpen);
      this.refs.btnProbe.textContent = this.state.probing ? "Probe：开启" : "Probe：关闭";

      this.refs.status.textContent =
        `站点：${location.host}\n` +
        `Probe：${this.state.probing ? "开启" : "关闭"} ｜ 历史：${historyCount} ｜ writeText Hook：${this.state.clipboardHookInstalled ? "已装" : "失败/不可写"}`;

      this.refs.substatus.textContent =
        `主线监听：${this.state.mainlinePaused ? "已自动暂停" : "未检测到或未暂停"}\n` +
        `当前等待：${pending ? `${pending.sender} / ${Math.max(0, 4 - Math.floor((Date.now() - pending.startedAt) / 1000))}s窗口` : "无"} ｜ readText回退：${this.state.readFallbackEnabled ? "开" : "关"}`;

      if (!latest) {
        this.refs.latestMeta.textContent = "空";
        this.refs.latestPreview.value = "";
      } else {
        this.refs.latestMeta.textContent =
          `${latest.sender} ｜ ${latest.method} ｜ ${latest.changed ? "不同" : "相同"} ｜ ${latest.charCount} 字符`;
        this.refs.latestPreview.value = latest.nativeText;
      }

      this.renderHistory();
    }
  };

  app.init();
})();
