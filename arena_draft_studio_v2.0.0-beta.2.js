(() => {
  const SCRIPT_NAME = "Arena Draft Studio";
  const SCRIPT_VERSION = "v2.0.0-beta.2";
  const GLOBAL_KEY = "__arenaDraftStudioApp__";
  const STORAGE_KEY = "__arenaDraftStudioStore__::arena.ai";
  const TOAST_ID = "__arena_draft_studio_toast__";
  const HOST_ID = "__arena_draft_studio_host__";
  const SUPPORTED_HOST_RE = /(^|\.)arena\.ai$/i;

  const DEFAULT_SETTINGS = {
    meLabel: "我",
    aiLabel: "AI",
    enableDedupe: true,
    captureTimestamp: true,
    persistStore: true,
    copySingleOnCapture: true
  };

  const existing = window[GLOBAL_KEY];

  if (existing && existing.version === SCRIPT_VERSION && existing.api) {
    const visible = existing.api.togglePanel();
    existing.api.toast(visible ? "面板已打开" : "面板已隐藏");
    return;
  }

  if (existing && existing.api && typeof existing.api.destroy === "function") {
    try {
      existing.api.destroy({ keepStore: true });
    } catch (err) {
      console.warn(`[${SCRIPT_NAME} ${SCRIPT_VERSION}] destroy old version failed`, err);
    }
  }

  const app = {
    name: SCRIPT_NAME,
    version: SCRIPT_VERSION,

    state: {
      installed: false,
      uiReady: false,
      listening: true,
      panelOpen: true,
      messages: [],
      settings: { ...DEFAULT_SETTINGS },
      supportedHost: SUPPORTED_HOST_RE.test(location.hostname)
    },

    refs: {
      host: null,
      shadow: null,
      fab: null,
      panel: null,
      btnListen: null,
      btnCopyDraft: null,
      btnDownloadDraft: null,
      btnCopyJSON: null,
      btnDownloadJSON: null,
      btnCopyYAML: null,
      btnDownloadYAML: null,
      btnSetLabels: null,
      btnAddNote: null,
      btnAddCustom: null,
      btnClear: null,
      closeBtn: null,
      status: null,
      substatus: null,
      previewMeta: null,
      preview: null,
      entriesMeta: null,
      entriesList: null,
      checkboxDedupe: null,
      checkboxTimestamp: null,
      checkboxPersist: null,
      checkboxCopySingle: null
    },

    boundOnDocumentClick: null,

    init() {
      this.loadStore();
      this.buildUI();
      this.installListener();
      this.updateUI();

      console.info(`[${this.name} ${this.version}] initialized`, {
        host: location.host,
        supportedHost: this.state.supportedHost,
        messageCount: this.state.messages.length
      });

      if (this.state.supportedHost) {
        if (this.state.messages.length > 0) {
          this.toast(`已加载并恢复 ${this.state.messages.length} 条缓冲记录\n监听状态：${this.state.listening ? "开启" : "关闭"}`);
        } else {
          this.toast(`已加载\n监听状态：${this.state.listening ? "开启" : "关闭"}`);
        }
      } else {
        this.toast("当前页面不是 arena.ai\n此版本针对 arena.ai DOM 编写");
      }

      this.state.installed = true;
      window[GLOBAL_KEY] = {
        name: this.name,
        version: this.version,
        api: this
      };
    },

    destroy({ keepStore = true } = {}) {
      if (this.boundOnDocumentClick) {
        document.removeEventListener("click", this.boundOnDocumentClick, true);
      }

      const oldToast = document.getElementById(TOAST_ID);
      if (oldToast) oldToast.remove();

      const oldHost = document.getElementById(HOST_ID);
      if (oldHost) oldHost.remove();

      if (!keepStore) {
        this.removeStore();
      }

      if (window[GLOBAL_KEY] && window[GLOBAL_KEY].version === this.version) {
        delete window[GLOBAL_KEY];
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
      }, 2200);
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

    normalizeText(text) {
      return (text || "")
        .replace(/\u00A0/g, " ")
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    },

    escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    yamlQuote(value) {
      return JSON.stringify(String(value), null, 0);
    },

    buildMessageId() {
      return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    },

    messageCharCount() {
      return this.state.messages.reduce((sum, msg) => sum + (msg.content || "").length, 0);
    },

    normalizeMessages(messages) {
      const result = [];
      for (const raw of Array.isArray(messages) ? messages : []) {
        const sender = typeof raw.sender === "string" ? raw.sender.trim() : "";
        const content = this.normalizeText(typeof raw.content === "string" ? raw.content : "");
        if (!sender || !content) continue;

        result.push({
          id: raw.id || this.buildMessageId(),
          index: result.length + 1,
          sender,
          senderKey: typeof raw.senderKey === "string" ? raw.senderKey : "",
          content,
          time: typeof raw.time === "string" && raw.time.trim() ? raw.time : null,
          capturedAtMs: Number.isFinite(raw.capturedAtMs) ? raw.capturedAtMs : Date.now()
        });
      }
      return result;
    },

    serializeStore() {
      return {
        tool: this.name,
        version: this.version,
        host: location.host,
        savedAt: new Date().toISOString(),
        listening: this.state.listening,
        settings: { ...this.state.settings },
        messages: this.state.messages.map((msg) => ({
          id: msg.id,
          index: msg.index,
          sender: msg.sender,
          senderKey: msg.senderKey,
          content: msg.content,
          time: msg.time,
          capturedAtMs: msg.capturedAtMs
        }))
      };
    },

    loadStore() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const data = JSON.parse(raw);
        if (!data || typeof data !== "object") return;

        this.state.settings = {
          ...DEFAULT_SETTINGS,
          ...(data.settings || {})
        };

        if (typeof data.listening === "boolean") {
          this.state.listening = data.listening;
        }

        this.state.messages = this.normalizeMessages(data.messages);
      } catch (err) {
        console.warn(`[${this.name} ${this.version}] loadStore failed`, err);
      }
    },

    saveStore() {
      try {
        if (!this.state.settings.persistStore) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serializeStore()));
      } catch (err) {
        console.warn(`[${this.name} ${this.version}] saveStore failed`, err);
      }
    },

    removeStore() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.warn(`[${this.name} ${this.version}] removeStore failed`, err);
      }
    },

    fallbackCopy(text) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    },

    async writeClipboard(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          this.fallbackCopy(text);
        }
      } catch (err) {
        this.fallbackCopy(text);
      }
    },

    stampForFile(date = new Date()) {
      const pad = (n) => String(n).padStart(2, "0");
      return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
      ].join("") + "_" + [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
      ].join("");
    },

    downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    formatTimeDisplay(isoString) {
      if (!isoString) return "";
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    },

    isArenaCopyButton(btn) {
      const COPY_ICON_HINT = "M19.4 20H9.6";
      if (!btn || btn.tagName !== "BUTTON") return false;
      return [...btn.querySelectorAll("path")].some((p) =>
        (p.getAttribute("d") || "").includes(COPY_ICON_HINT)
      );
    },

    findMessageRootFromButton(button) {
      const chain = this.walkAncestors(button, 8);

      for (const el of chain) {
        if (this.hasClassText(el, "bg-surface-primary")) {
          return el;
        }
      }

      for (const el of chain) {
        if (this.hasClassText(el, "group") && this.hasClassText(el, "self-end")) {
          return el;
        }
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
        if (el.querySelector && el.querySelector("div.prose")) {
          return el;
        }
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

    resolveSenderLabel(senderKey) {
      if (senderKey === "me") return this.state.settings.meLabel;
      if (senderKey === "ai") return this.state.settings.aiLabel;
      return "";
    },

    askCustomSenderLabel(defaultValue = this.state.settings.aiLabel) {
      const v = prompt("发言人标签：", defaultValue);
      return v && v.trim() ? v.trim() : null;
    },

    findTextContainer(root) {
      if (!root || !root.querySelector) return null;
      return root.querySelector("div.prose") || root.querySelector("p");
    },

    extractFromButton(button) {
      const root = this.findMessageRootFromButton(button);
      const senderKey = this.detectSenderKeyFromRoot(root);
      let sender = this.resolveSenderLabel(senderKey);

      if (!sender) {
        sender = this.askCustomSenderLabel(this.state.settings.aiLabel);
      }
      if (!sender) return null;

      const textContainer = this.findTextContainer(root);
      const text = this.normalizeText(textContainer ? textContainer.innerText : "");

      if (!text) {
        return null;
      }

      return {
        root,
        senderKey,
        sender,
        text
      };
    },

    buildEntry(sender, senderKey, text) {
      const now = Date.now();
      return {
        id: this.buildMessageId(),
        index: this.state.messages.length + 1,
        sender,
        senderKey,
        content: this.normalizeText(text),
        time: this.state.settings.captureTimestamp ? new Date(now).toISOString() : null,
        capturedAtMs: now
      };
    },

    isLikelyDuplicate(entry) {
      if (!this.state.settings.enableDedupe) return false;
      const last = this.state.messages[this.state.messages.length - 1];
      if (!last) return false;
      if (last.sender !== entry.sender) return false;
      if (last.content !== entry.content) return false;

      const t1 = Number(last.capturedAtMs || 0);
      const t2 = Number(entry.capturedAtMs || 0);

      if (!t1 || !t2) return true;
      return (t2 - t1) <= 15000;
    },

    addEntry(entry) {
      if (!entry || !entry.sender || !entry.content) {
        return { added: false, reason: "invalid" };
      }

      if (this.isLikelyDuplicate(entry)) {
        return { added: false, reason: "duplicate" };
      }

      this.state.messages.push(entry);
      this.reindexMessages();
      this.saveStore();
      this.updateUI();

      return { added: true, reason: "ok", entry };
    },

    reindexMessages() {
      this.state.messages = this.state.messages.map((msg, idx) => ({
        ...msg,
        index: idx + 1
      }));
    },

    exportDraft(messages = this.state.messages) {
      const list = this.normalizeMessages(messages);
      if (!list.length) return "";
      return list.map((msg) => `>>> ${msg.sender}\n${msg.content}`).join("\n\n");
    },

    exportJSON() {
      const data = {
        metadata: {
          tool: this.name,
          version: this.version,
          source: "arena.ai",
          exportedAt: new Date().toISOString(),
          messageCount: this.state.messages.length
        },
        messages: this.state.messages.map((msg) => {
          const item = {
            index: msg.index,
            sender: msg.sender,
            content: msg.content
          };
          if (msg.time) item.time = msg.time;
          return item;
        })
      };

      return JSON.stringify(data, null, 2);
    },

    exportYAML() {
      const lines = [
        "metadata:",
        `  tool: ${this.yamlQuote(this.name)}`,
        `  version: ${this.yamlQuote(this.version)}`,
        `  source: ${this.yamlQuote("arena.ai")}`,
        `  exportedAt: ${this.yamlQuote(new Date().toISOString())}`,
        `  messageCount: ${this.state.messages.length}`,
        "",
        "messages:"
      ];

      for (const msg of this.state.messages) {
        lines.push(`  - index: ${msg.index}`);
        lines.push(`    sender: ${this.yamlQuote(msg.sender)}`);
        if (msg.time) {
          lines.push(`    time: ${this.yamlQuote(msg.time)}`);
        }

        if (!msg.content) {
          lines.push(`    content: ""`);
        } else {
          lines.push("    content: |-");
          for (const line of msg.content.split("\n")) {
            lines.push(`      ${line}`);
          }
        }
        lines.push("");
      }

      if (lines[lines.length - 1] === "") {
        lines.pop();
      }

      return lines.join("\n") + "\n";
    },

    async copyCurrentEntry(entry) {
      if (!this.state.settings.copySingleOnCapture) {
        return false;
      }
      const singleDraft = this.exportDraft([entry]);
      await this.writeClipboard(singleDraft);
      return true;
    },

    async copyAllDraft() {
      const text = this.exportDraft();
      if (!text) {
        this.toast("缓冲区为空，无法复制 Draft");
        return;
      }
      await this.writeClipboard(text);
      this.toast(`已复制 Draft 全部内容\n共 ${this.state.messages.length} 条`);
    },

    async copyJSON() {
      const text = this.exportJSON();
      await this.writeClipboard(text);
      this.toast(`已复制 JSON\n共 ${this.state.messages.length} 条`);
    },

    async copyYAML() {
      const text = this.exportYAML();
      await this.writeClipboard(text);
      this.toast(`已复制 YAML\n共 ${this.state.messages.length} 条`);
    },

    downloadDraft() {
      const text = this.exportDraft();
      if (!text) {
        this.toast("缓冲区为空，无法下载 Draft");
        return;
      }
      const name = `${this.stampForFile()}_arena_draft_studio_draft.txt`;
      this.downloadTextFile(name, text, "text/plain;charset=utf-8");
      this.toast(`已下载 Draft 文件\n${name}`);
    },

    downloadJSON() {
      const text = this.exportJSON();
      const name = `${this.stampForFile()}_arena_draft_studio.json`;
      this.downloadTextFile(name, text, "application/json;charset=utf-8");
      this.toast(`已下载 JSON 文件\n${name}`);
    },

    downloadYAML() {
      const text = this.exportYAML();
      const name = `${this.stampForFile()}_arena_draft_studio.yaml`;
      this.downloadTextFile(name, text, "text/yaml;charset=utf-8");
      this.toast(`已下载 YAML 文件\n${name}`);
    },

    clearMessages() {
      const ok = confirm(`确定清空缓冲区吗？\n当前共有 ${this.state.messages.length} 条消息。`);
      if (!ok) return;

      this.state.messages = [];
      this.saveStore();
      this.updateUI();
      this.toast("缓冲区已清空");
    },

    setLabels() {
      const nextMe = prompt("“我”的标签：", this.state.settings.meLabel);
      if (nextMe === null) return;

      const trimmedMe = nextMe.trim();
      if (!trimmedMe) {
        this.toast("“我”的标签不能为空");
        return;
      }

      const nextAI = prompt("“AI”的标签：", this.state.settings.aiLabel);
      if (nextAI === null) return;

      const trimmedAI = nextAI.trim();
      if (!trimmedAI) {
        this.toast("“AI”的标签不能为空");
        return;
      }

      this.state.settings.meLabel = trimmedMe;
      this.state.settings.aiLabel = trimmedAI;
      this.saveStore();
      this.updateUI();
      this.toast(`标签已更新\n我=${trimmedMe}\nAI=${trimmedAI}`);
    },

    addManualNote() {
      const content = prompt("说明内容：", "");
      if (content === null) return;

      const normalized = this.normalizeText(content);
      if (!normalized) {
        this.toast("说明内容不能为空");
        return;
      }

      const entry = this.buildEntry("说明", "note", normalized);
      const result = this.addEntry(entry);

      if (result.added) {
        this.toast(`已添加说明消息\n缓冲区共 ${this.state.messages.length} 条`);
      } else if (result.reason === "duplicate") {
        this.toast("说明内容疑似重复，未加入缓冲区");
      } else {
        this.toast("说明消息添加失败");
      }
    },

    addManualCustom() {
      const sender = prompt("自定义发言人标签：", "朋友");
      if (sender === null) return;

      const senderText = sender.trim();
      if (!senderText) {
        this.toast("发言人标签不能为空");
        return;
      }

      const content = prompt("消息内容：", "");
      if (content === null) return;

      const normalized = this.normalizeText(content);
      if (!normalized) {
        this.toast("消息内容不能为空");
        return;
      }

      const entry = this.buildEntry(senderText, "custom", normalized);
      const result = this.addEntry(entry);

      if (result.added) {
        this.toast(`已添加自定义消息：${senderText}\n缓冲区共 ${this.state.messages.length} 条`);
      } else if (result.reason === "duplicate") {
        this.toast("内容疑似重复，未加入缓冲区");
      } else {
        this.toast("自定义消息添加失败");
      }
    },

    setListening(flag) {
      this.state.listening = !!flag;
      this.saveStore();
      this.updateUI();
      this.toast(`监听已${this.state.listening ? "开启" : "关闭"}`);
    },

    toggleListening() {
      this.setListening(!this.state.listening);
    },

    openPanel() {
      this.state.panelOpen = true;
      this.updateUI();
      return true;
    },

    closePanel() {
      this.state.panelOpen = false;
      this.updateUI();
      return false;
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

    findMessageById(id) {
      return this.state.messages.find((msg) => msg.id === id) || null;
    },

    async copyEntryById(id) {
      const msg = this.findMessageById(id);
      if (!msg) {
        this.toast("未找到该条目");
        return;
      }
      const text = this.exportDraft([msg]);
      await this.writeClipboard(text);
      this.toast(`已复制单条：#${msg.index} ${msg.sender}`);
    },

    removeEntryById(id) {
      const idx = this.state.messages.findIndex((msg) => msg.id === id);
      if (idx < 0) {
        this.toast("未找到该条目");
        return;
      }
      const removed = this.state.messages[idx];
      this.state.messages.splice(idx, 1);
      this.reindexMessages();
      this.saveStore();
      this.updateUI();
      this.toast(`已删除：#${removed.index} ${removed.sender}`);
    },

    moveEntry(id, direction) {
      const idx = this.state.messages.findIndex((msg) => msg.id === id);
      if (idx < 0) return;

      const nextIdx = direction === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= this.state.messages.length) return;

      const tmp = this.state.messages[idx];
      this.state.messages[idx] = this.state.messages[nextIdx];
      this.state.messages[nextIdx] = tmp;

      this.reindexMessages();
      this.saveStore();
      this.updateUI();
    },

    renderEntries() {
      if (!this.refs.entriesList) return;

      const list = this.state.messages;
      this.refs.entriesMeta.textContent = list.length ? `共 ${list.length} 条` : "空";

      if (!list.length) {
        this.refs.entriesList.innerHTML = `
          <div class="ads-empty">
            缓冲区为空。你可以点 arena.ai 的 copy 按钮，或者手动添加说明/自定义消息。
          </div>
        `;
        return;
      }

      const html = list
        .map((msg, idx) => {
          const preview = msg.content.length > 180
            ? `${msg.content.slice(0, 180)}…`
            : msg.content;

          const time = msg.time ? this.formatTimeDisplay(msg.time) : "";
          const isFirst = idx === 0;
          const isLast = idx === list.length - 1;

          return `
            <div class="ads-entry">
              <div class="ads-entry-head">
                <div class="ads-entry-title">
                  <span class="ads-entry-index">#${msg.index}</span>
                  <span class="ads-entry-sender">${this.escapeHtml(msg.sender)}</span>
                  ${time ? `<span class="ads-entry-time">${this.escapeHtml(time)}</span>` : ""}
                </div>

                <div class="ads-entry-actions">
                  <button class="ads-mini-btn" data-entry-action="copy" data-entry-id="${this.escapeHtml(msg.id)}" type="button">复制</button>
                  <button class="ads-mini-btn" data-entry-action="up" data-entry-id="${this.escapeHtml(msg.id)}" type="button" ${isFirst ? "disabled" : ""}>↑</button>
                  <button class="ads-mini-btn" data-entry-action="down" data-entry-id="${this.escapeHtml(msg.id)}" type="button" ${isLast ? "disabled" : ""}>↓</button>
                  <button class="ads-mini-btn danger" data-entry-action="delete" data-entry-id="${this.escapeHtml(msg.id)}" type="button">删</button>
                </div>
              </div>

              <div class="ads-entry-body">${this.escapeHtml(preview)}</div>
            </div>
          `;
        })
        .join("");

      this.refs.entriesList.innerHTML = html;
    },

    installListener() {
      if (this.boundOnDocumentClick) {
        document.removeEventListener("click", this.boundOnDocumentClick, true);
      }

      this.boundOnDocumentClick = async (event) => {
        if (!this.state.listening) return;
        if (!this.state.supportedHost) return;

        const target = event.target;
        const button = target && target.closest ? target.closest("button") : null;
        if (!this.isArenaCopyButton(button)) return;

        const info = this.extractFromButton(button);
        if (!info) {
          this.toast("未能解析消息内容或发言人");
          console.warn(`[${this.name} ${this.version}] extract failed`);
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }

        const entry = this.buildEntry(info.sender, info.senderKey, info.text);
        const result = this.addEntry(entry);
        const copied = await this.copyCurrentEntry(entry);

        if (result.added) {
          if (copied) {
            this.toast(`已捕获并复制当前条目：${entry.sender}\n缓冲区共 ${this.state.messages.length} 条`);
          } else {
            this.toast(`已捕获当前条目：${entry.sender}\n缓冲区共 ${this.state.messages.length} 条`);
          }
        } else if (result.reason === "duplicate") {
          if (copied) {
            this.toast(`已复制当前条目：${entry.sender}\n重复内容未加入缓冲区`);
          } else {
            this.toast(`检测到重复内容：${entry.sender}\n未加入缓冲区`);
          }
        } else {
          this.toast("捕获异常：未加入缓冲区");
        }

        console.log(`[${this.name} ${this.version}] captured`, {
          sender: entry.sender,
          senderKey: entry.senderKey,
          textPreview: entry.content.slice(0, 120),
          buffered: result.added,
          copied,
          messageCount: this.state.messages.length
        });
      };

      document.addEventListener("click", this.boundOnDocumentClick, true);
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
          .ads-wrap {
            position: fixed;
            right: 16px;
            bottom: 120px;
            z-index: 2147483646;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #111827;
          }

          .ads-fab {
            position: absolute;
            right: 0;
            bottom: 0;
            border: none;
            border-radius: 999px;
            background: #111827;
            color: #fff;
            padding: 10px 14px;
            font-size: 13px;
            font-weight: 700;
            box-shadow: 0 8px 24px rgba(0,0,0,.25);
            cursor: pointer;
          }

          .ads-panel {
            position: absolute;
            right: 0;
            bottom: 52px;
            width: min(380px, 90vw);
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

          .ads-hidden {
            display: none;
          }

          .ads-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
          }

          .ads-title {
            font-size: 14px;
            font-weight: 800;
            line-height: 1.3;
          }

          .ads-version {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .ads-close {
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

          .ads-status,
          .ads-substatus {
            font-size: 12px;
            line-height: 1.55;
            margin-bottom: 6px;
            white-space: pre-wrap;
          }

          .ads-status {
            font-weight: 700;
          }

          .ads-substatus {
            color: #4b5563;
          }

          .ads-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 10px 0 12px;
          }

          .ads-btn {
            border: none;
            border-radius: 10px;
            background: #111827;
            color: #fff;
            padding: 10px 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .ads-btn.secondary {
            background: #f3f4f6;
            color: #111827;
          }

          .ads-btn.warn {
            background: #b91c1c;
            color: #fff;
          }

          .ads-settings {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 12px;
            margin-bottom: 12px;
            font-size: 12px;
            color: #374151;
          }

          .ads-settings label {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .ads-section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin: 10px 0 6px;
            font-size: 12px;
            font-weight: 700;
          }

          .ads-section-meta {
            font-weight: 500;
            color: #6b7280;
          }

          .ads-entries {
            max-height: 220px;
            overflow: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 12px;
          }

          .ads-entry {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 8px;
            background: #fff;
          }

          .ads-entry-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 6px;
          }

          .ads-entry-title {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.4;
          }

          .ads-entry-index {
            color: #6b7280;
          }

          .ads-entry-sender {
            color: #111827;
          }

          .ads-entry-time {
            color: #6b7280;
            font-weight: 500;
          }

          .ads-entry-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            justify-content: flex-end;
          }

          .ads-mini-btn {
            border: none;
            border-radius: 8px;
            background: #f3f4f6;
            color: #111827;
            padding: 4px 7px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
          }

          .ads-mini-btn.danger {
            background: #fee2e2;
            color: #991b1b;
          }

          .ads-mini-btn:disabled {
            opacity: .5;
            cursor: default;
          }

          .ads-entry-body {
            font-size: 12px;
            line-height: 1.5;
            color: #374151;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .ads-empty {
            border: 1px dashed #d1d5db;
            border-radius: 10px;
            padding: 10px;
            font-size: 12px;
            color: #6b7280;
            background: #f9fafb;
            line-height: 1.6;
          }

          .ads-preview {
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

          .ads-note {
            margin-top: 8px;
            font-size: 11px;
            color: #6b7280;
            line-height: 1.5;
          }
        </style>

        <div class="ads-wrap">
          <button class="ads-fab" type="button">Draft</button>

          <section class="ads-panel">
            <div class="ads-header">
              <div>
                <div class="ads-title">${this.name}</div>
                <div class="ads-version">${this.version}</div>
              </div>
              <button class="ads-close" type="button" title="关闭">×</button>
            </div>

            <div class="ads-status"></div>
            <div class="ads-substatus"></div>

            <div class="ads-buttons">
              <button class="ads-btn" data-action="listen" type="button"></button>
              <button class="ads-btn secondary" data-action="set-labels" type="button">设置标签</button>

              <button class="ads-btn secondary" data-action="add-note" type="button">添加说明</button>
              <button class="ads-btn secondary" data-action="add-custom" type="button">添加自定义</button>

              <button class="ads-btn secondary" data-action="copy-draft" type="button">复制 Draft</button>
              <button class="ads-btn secondary" data-action="download-draft" type="button">下载 Draft</button>

              <button class="ads-btn secondary" data-action="copy-json" type="button">复制 JSON</button>
              <button class="ads-btn secondary" data-action="download-json" type="button">下载 JSON</button>

              <button class="ads-btn secondary" data-action="copy-yaml" type="button">复制 YAML</button>
              <button class="ads-btn secondary" data-action="download-yaml" type="button">下载 YAML</button>

              <button class="ads-btn warn" data-action="clear" type="button">清空缓冲区</button>
            </div>

            <div class="ads-settings">
              <label><input type="checkbox" data-setting="enableDedupe">去重</label>
              <label><input type="checkbox" data-setting="captureTimestamp">时间戳</label>
              <label><input type="checkbox" data-setting="persistStore">本地持久化</label>
              <label><input type="checkbox" data-setting="copySingleOnCapture">捕获时复制单条</label>
            </div>

            <div class="ads-section-head">
              <span>缓冲区条目</span>
              <span class="ads-section-meta ads-entries-meta"></span>
            </div>

            <div class="ads-entries"></div>

            <div class="ads-section-head">
              <span>Draft 预览</span>
              <span class="ads-section-meta ads-preview-meta"></span>
            </div>

            <textarea class="ads-preview" readonly placeholder="缓冲区为空"></textarea>

            <div class="ads-note">
              提示：再次点击同版本加载器书签，可快速显示/隐藏此面板。
            </div>
          </section>
        </div>
      `;

      this.refs.host = host;
      this.refs.shadow = shadow;
      this.refs.fab = shadow.querySelector(".ads-fab");
      this.refs.panel = shadow.querySelector(".ads-panel");
      this.refs.closeBtn = shadow.querySelector(".ads-close");
      this.refs.status = shadow.querySelector(".ads-status");
      this.refs.substatus = shadow.querySelector(".ads-substatus");
      this.refs.btnListen = shadow.querySelector('[data-action="listen"]');
      this.refs.btnCopyDraft = shadow.querySelector('[data-action="copy-draft"]');
      this.refs.btnDownloadDraft = shadow.querySelector('[data-action="download-draft"]');
      this.refs.btnCopyJSON = shadow.querySelector('[data-action="copy-json"]');
      this.refs.btnDownloadJSON = shadow.querySelector('[data-action="download-json"]');
      this.refs.btnCopyYAML = shadow.querySelector('[data-action="copy-yaml"]');
      this.refs.btnDownloadYAML = shadow.querySelector('[data-action="download-yaml"]');
      this.refs.btnSetLabels = shadow.querySelector('[data-action="set-labels"]');
      this.refs.btnAddNote = shadow.querySelector('[data-action="add-note"]');
      this.refs.btnAddCustom = shadow.querySelector('[data-action="add-custom"]');
      this.refs.btnClear = shadow.querySelector('[data-action="clear"]');
      this.refs.previewMeta = shadow.querySelector(".ads-preview-meta");
      this.refs.preview = shadow.querySelector(".ads-preview");
      this.refs.entriesMeta = shadow.querySelector(".ads-entries-meta");
      this.refs.entriesList = shadow.querySelector(".ads-entries");
      this.refs.checkboxDedupe = shadow.querySelector('[data-setting="enableDedupe"]');
      this.refs.checkboxTimestamp = shadow.querySelector('[data-setting="captureTimestamp"]');
      this.refs.checkboxPersist = shadow.querySelector('[data-setting="persistStore"]');
      this.refs.checkboxCopySingle = shadow.querySelector('[data-setting="copySingleOnCapture"]');

      this.refs.fab.addEventListener("click", () => {
        this.togglePanel();
      });

      this.refs.closeBtn.addEventListener("click", () => {
        this.closePanel();
      });

      this.refs.btnListen.addEventListener("click", () => {
        this.toggleListening();
      });

      this.refs.btnCopyDraft.addEventListener("click", async () => {
        await this.copyAllDraft();
      });

      this.refs.btnDownloadDraft.addEventListener("click", () => {
        this.downloadDraft();
      });

      this.refs.btnCopyJSON.addEventListener("click", async () => {
        await this.copyJSON();
      });

      this.refs.btnDownloadJSON.addEventListener("click", () => {
        this.downloadJSON();
      });

      this.refs.btnCopyYAML.addEventListener("click", async () => {
        await this.copyYAML();
      });

      this.refs.btnDownloadYAML.addEventListener("click", () => {
        this.downloadYAML();
      });

      this.refs.btnSetLabels.addEventListener("click", () => {
        this.setLabels();
      });

      this.refs.btnAddNote.addEventListener("click", () => {
        this.addManualNote();
      });

      this.refs.btnAddCustom.addEventListener("click", () => {
        this.addManualCustom();
      });

      this.refs.btnClear.addEventListener("click", () => {
        this.clearMessages();
      });

      this.refs.checkboxDedupe.addEventListener("change", (e) => {
        this.state.settings.enableDedupe = !!e.target.checked;
        this.saveStore();
        this.updateUI();
      });

      this.refs.checkboxTimestamp.addEventListener("change", (e) => {
        this.state.settings.captureTimestamp = !!e.target.checked;
        this.saveStore();
        this.updateUI();
      });

      this.refs.checkboxPersist.addEventListener("change", (e) => {
        this.state.settings.persistStore = !!e.target.checked;
        this.saveStore();
        this.updateUI();
        this.toast(this.state.settings.persistStore ? "已开启本地持久化" : "已关闭本地持久化");
      });

      this.refs.checkboxCopySingle.addEventListener("change", (e) => {
        this.state.settings.copySingleOnCapture = !!e.target.checked;
        this.saveStore();
        this.updateUI();
      });

      this.refs.entriesList.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-entry-action]");
        if (!btn) return;

        const action = btn.getAttribute("data-entry-action");
        const id = btn.getAttribute("data-entry-id");
        if (!action || !id) return;

        if (action === "copy") {
          await this.copyEntryById(id);
          return;
        }

        if (action === "delete") {
          this.removeEntryById(id);
          return;
        }

        if (action === "up") {
          this.moveEntry(id, "up");
          return;
        }

        if (action === "down") {
          this.moveEntry(id, "down");
        }
      });

      this.state.uiReady = true;
    },

    updateUI() {
      if (!this.state.uiReady) return;

      const count = this.state.messages.length;
      const chars = this.messageCharCount();

      this.refs.fab.textContent = count > 0 ? `Draft ${count}` : "Draft";
      this.refs.panel.classList.toggle("ads-hidden", !this.state.panelOpen);
      this.refs.btnListen.textContent = this.state.listening ? "监听：开启" : "监听：关闭";

      this.refs.status.textContent =
        `站点：${location.host}\n` +
        `监听：${this.state.listening ? "开启" : "关闭"} ｜ 条数：${count} ｜ 字数：${chars}`;

      this.refs.substatus.textContent =
        `标签：我=${this.state.settings.meLabel} ｜ AI=${this.state.settings.aiLabel}\n` +
        `去重：${this.state.settings.enableDedupe ? "开" : "关"} ｜ 时间戳：${this.state.settings.captureTimestamp ? "开" : "关"} ｜ 持久化：${this.state.settings.persistStore ? "开" : "关"} ｜ 单条复制：${this.state.settings.copySingleOnCapture ? "开" : "关"}`;

      this.refs.checkboxDedupe.checked = !!this.state.settings.enableDedupe;
      this.refs.checkboxTimestamp.checked = !!this.state.settings.captureTimestamp;
      this.refs.checkboxPersist.checked = !!this.state.settings.persistStore;
      this.refs.checkboxCopySingle.checked = !!this.state.settings.copySingleOnCapture;

      const draftText = this.exportDraft();
      this.refs.preview.value = draftText;
      this.refs.previewMeta.textContent = count > 0 ? `共 ${count} 条` : "空";

      this.renderEntries();
    }
  };

  app.init();
})();
