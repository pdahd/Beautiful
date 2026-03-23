(() => {
  const SCRIPT_NAME = "Arena Draft Studio";
  const SCRIPT_VERSION = "v2.2.0-beta.2";
  const GLOBAL_KEY = "__arenaDraftStudioApp__";
  const STORAGE_KEY = "__arenaDraftStudioStore__::arena.ai";
  const TOAST_ID = "__arena_draft_studio_toast__";
  const HOST_ID = "__arena_draft_studio_host__";
  const SUPPORTED_HOST_RE = /(^|\.)arena\.ai$/i;
  const COPY_ICON_HINT = "M19.4 20H9.6";

  const DEFAULT_SETTINGS = {
    meLabel: "我",
    aiLabel: "AI",
    enableDedupe: true,
    captureTimestamp: true,
    persistStore: true,
    copySingleOnCapture: true,
    preferMarkdownCapture: false
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
      selectedIds: new Set(),
      settings: { ...DEFAULT_SETTINGS },
      supportedHost: SUPPORTED_HOST_RE.test(location.hostname),
      markdownPending: null,
      clipboardHookInstalled: false,
      copyEventInstalled: false,
      internalWrite: false,
      suppressedButton: null,
      batchJob: null
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
      btnCopyXML: null,
      btnDownloadXML: null,
      btnImportConversationAppend: null,
      btnImportConversationReplace: null,
      btnDownloadConversationJSON: null,
      btnDownloadConversationYAML: null,
      btnDownloadConversationXML: null,
      btnImportConversationMarkdownAppend: null,
      btnImportConversationMarkdownReplace: null,
      btnDownloadConversationMarkdownJSON: null,
      btnDownloadConversationMarkdownYAML: null,
      btnDownloadConversationMarkdownXML: null,
      btnCancelBatch: null,
      btnCopySelectedDraft: null,
      btnDeleteSelected: null,
      btnClearSelection: null,
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
      selectedMeta: null,
      entriesList: null,
      checkboxDedupe: null,
      checkboxTimestamp: null,
      checkboxPersist: null,
      checkboxCopySingle: null,
      checkboxMarkdown: null
    },

    originalClipboardWriteText: null,
    boundOnDocumentClick: null,
    boundOnCopyEvent: null,

    init() {
      this.loadStore();
      this.buildUI();
      this.installClipboardHook();
      this.installCopyEventHook();
      this.installListener();
      this.updateUI();

      console.info(`[${this.name} ${this.version}] initialized`, {
        host: location.host,
        supportedHost: this.state.supportedHost,
        messageCount: this.state.messages.length,
        markdownMode: this.state.settings.preferMarkdownCapture,
        clipboardHookInstalled: this.state.clipboardHookInstalled
      });

      if (this.state.supportedHost) {
        if (this.state.messages.length > 0) {
          this.toast(
            `已加载并恢复 ${this.state.messages.length} 条缓冲记录\n` +
            `监听状态：${this.state.listening ? "开启" : "关闭"} ｜ ` +
            `模式：${this.state.settings.preferMarkdownCapture ? "Markdown" : "Plain Text"}`
          );
        } else {
          this.toast(
            `已加载\n监听状态：${this.state.listening ? "开启" : "关闭"} ｜ ` +
            `模式：${this.state.settings.preferMarkdownCapture ? "Markdown" : "Plain Text"}`
          );
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

      if (this.boundOnCopyEvent) {
        document.removeEventListener("copy", this.boundOnCopyEvent, false);
      }

      this.restoreClipboardHook();

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
      }, 2600);
    },

    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
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

    normalizePlainText(text) {
      return (text || "")
        .replace(/\u00A0/g, " ")
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    },

    normalizeMarkdownText(text) {
      return String(text == null ? "" : text)
        .replace(/\u00A0/g, " ")
        .replace(/\r\n?/g, "\n")
        .trim();
    },

    preserveClipboardText(text) {
      return String(text == null ? "" : text).replace(/\r\n?/g, "\n");
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

    xmlAttrEscape(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    },

    xmlCdataSafe(text) {
      return String(text).replace(/]]>/g, "]]]]><![CDATA[>");
    },

    buildMessageId() {
      return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    },

    inferSenderKeyFromLabel(sender) {
      const s = (sender || "").trim();
      if (!s) return "";
      if (s === this.state.settings.meLabel) return "me";
      if (s === this.state.settings.aiLabel) return "ai";
      if (s === "说明") return "note";
      return "custom";
    },

    messageCharCount() {
      return this.state.messages.reduce((sum, msg) => sum + (msg.content || "").length, 0);
    },

    normalizeMessages(messages) {
      const result = [];
      for (const raw of Array.isArray(messages) ? messages : []) {
        const sender = typeof raw.sender === "string" ? raw.sender.trim() : "";
        const format = raw.format === "markdown" ? "markdown" : "text";
        const content = format === "markdown"
          ? this.normalizeMarkdownText(typeof raw.content === "string" ? raw.content : "")
          : this.normalizePlainText(typeof raw.content === "string" ? raw.content : "");

        if (!sender || !content) continue;

        result.push({
          id: raw.id || this.buildMessageId(),
          index: result.length + 1,
          sender,
          senderKey: typeof raw.senderKey === "string" && raw.senderKey
            ? raw.senderKey
            : this.inferSenderKeyFromLabel(sender),
          format,
          content,
          time: typeof raw.time === "string" && raw.time.trim() ? raw.time : null,
          capturedAtMs: Number.isFinite(raw.capturedAtMs) ? raw.capturedAtMs : Date.now()
        });
      }
      return result;
    },

    prepareExportMessages(messages) {
      const list = this.normalizeMessages(messages);
      return list.map((msg, idx) => ({
        ...msg,
        index: idx + 1
      }));
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
          format: msg.format,
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
      this.state.internalWrite = true;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          this.fallbackCopy(text);
        }
      } catch {
        this.fallbackCopy(text);
      } finally {
        this.state.internalWrite = false;
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

    findMessageRootFromContent(contentNode) {
      const chain = this.walkAncestors(contentNode, 10);

      for (const el of chain) {
        if (this.hasClassText(el, "group") && this.hasClassText(el, "self-end")) return el;
      }

      for (const el of chain) {
        if (this.hasClassText(el, "bg-surface-primary")) return el;
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

      return contentNode.parentElement || null;
    },

    detectSenderKeyFromRoot(root) {
      if (!root) return "";

      const c = this.getClass(root);

      if (c.includes("bg-surface-primary")) return "ai";

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
      const domText = this.normalizePlainText(textContainer ? textContainer.innerText : "");

      if (!domText) return null;

      return {
        root,
        senderKey,
        sender,
        domText
      };
    },

    buildEntry(sender, senderKey, text, format = "text") {
      const now = Date.now();
      const normalizedContent = format === "markdown"
        ? this.normalizeMarkdownText(text)
        : this.normalizePlainText(text);

      return {
        id: this.buildMessageId(),
        index: this.state.messages.length + 1,
        sender,
        senderKey: senderKey || this.inferSenderKeyFromLabel(sender),
        format: format === "markdown" ? "markdown" : "text",
        content: normalizedContent,
        time: this.state.settings.captureTimestamp ? new Date(now).toISOString() : null,
        capturedAtMs: now
      };
    },

    isLikelyDuplicate(entry) {
      if (!this.state.settings.enableDedupe) return false;
      const last = this.state.messages[this.state.messages.length - 1];
      if (!last) return false;
      if (last.sender !== entry.sender) return false;
      if (last.format !== entry.format) return false;
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

    addEntriesBatch(entries) {
      let added = 0;
      let skipped = 0;

      for (const raw of entries) {
        const format = raw.format === "markdown" ? "markdown" : "text";
        const entry = {
          id: raw.id || this.buildMessageId(),
          index: 0,
          sender: typeof raw.sender === "string" ? raw.sender.trim() : "",
          senderKey: typeof raw.senderKey === "string" && raw.senderKey
            ? raw.senderKey
            : this.inferSenderKeyFromLabel(raw.sender || ""),
          format,
          content: format === "markdown"
            ? this.normalizeMarkdownText(raw.content || "")
            : this.normalizePlainText(raw.content || ""),
          time: raw.time || null,
          capturedAtMs: Number.isFinite(raw.capturedAtMs) ? raw.capturedAtMs : Date.now()
        };

        if (!entry.sender || !entry.content) {
          skipped += 1;
          continue;
        }

        if (this.isLikelyDuplicate(entry)) {
          skipped += 1;
          continue;
        }

        this.state.messages.push(entry);
        added += 1;
      }

      this.reindexMessages();
      this.saveStore();
      this.updateUI();

      return { added, skipped };
    },

    replaceAllEntries(entries) {
      this.state.messages = this.normalizeMessages(entries);
      this.clearSelection(true);
      this.reindexMessages();
      this.saveStore();
      this.updateUI();
    },

    reindexMessages() {
      this.state.messages = this.state.messages.map((msg, idx) => ({
        ...msg,
        index: idx + 1
      }));
    },

    cleanupSelection() {
      if (!(this.state.selectedIds instanceof Set)) {
        this.state.selectedIds = new Set();
      }
      const validIds = new Set(this.state.messages.map((msg) => msg.id));
      const next = new Set();
      for (const id of this.state.selectedIds) {
        if (validIds.has(id)) next.add(id);
      }
      this.state.selectedIds = next;
    },

    selectedCount() {
      this.cleanupSelection();
      return this.state.selectedIds.size;
    },

    setEntrySelected(id, checked) {
      if (!id) return;
      if (!(this.state.selectedIds instanceof Set)) {
        this.state.selectedIds = new Set();
      }

      if (checked) this.state.selectedIds.add(id);
      else this.state.selectedIds.delete(id);

      this.updateUI();
    },

    clearSelection(silent = false) {
      if (!(this.state.selectedIds instanceof Set)) {
        this.state.selectedIds = new Set();
      }

      const had = this.state.selectedIds.size > 0;
      this.state.selectedIds.clear();
      this.updateUI();

      if (!silent && had) {
        this.toast("已清空选择");
      } else if (!silent && !had) {
        this.toast("当前没有已选条目");
      }
    },

    getSelectedMessages() {
      this.cleanupSelection();
      return this.state.messages.filter((msg) => this.state.selectedIds.has(msg.id));
    },

    exportDraft(messages = this.state.messages) {
      const list = this.prepareExportMessages(messages);
      if (!list.length) return "";
      return list.map((msg) => `>>> ${msg.sender}\n${msg.content}`).join("\n\n");
    },

    exportJSON(messages = this.state.messages, source = "arena.ai-buffer") {
      const list = this.prepareExportMessages(messages);
      const data = {
        metadata: {
          tool: this.name,
          version: this.version,
          source,
          exportedAt: new Date().toISOString(),
          messageCount: list.length
        },
        messages: list.map((msg) => {
          const item = {
            index: msg.index,
            sender: msg.sender,
            format: msg.format,
            content: msg.content
          };
          if (msg.time) item.time = msg.time;
          return item;
        })
      };

      return JSON.stringify(data, null, 2);
    },

    exportYAML(messages = this.state.messages, source = "arena.ai-buffer") {
      const list = this.prepareExportMessages(messages);

      const lines = [
        "metadata:",
        `  tool: ${this.yamlQuote(this.name)}`,
        `  version: ${this.yamlQuote(this.version)}`,
        `  source: ${this.yamlQuote(source)}`,
        `  exportedAt: ${this.yamlQuote(new Date().toISOString())}`,
        `  messageCount: ${list.length}`,
        "",
        "messages:"
      ];

      for (const msg of list) {
        lines.push(`  - index: ${msg.index}`);
        lines.push(`    sender: ${this.yamlQuote(msg.sender)}`);
        lines.push(`    format: ${this.yamlQuote(msg.format)}`);
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

    exportXML(messages = this.state.messages, source = "arena.ai-buffer") {
      const list = this.prepareExportMessages(messages);

      const rootAttrs = [
        `tool="${this.xmlAttrEscape(this.name)}"`,
        `version="${this.xmlAttrEscape(this.version)}"`,
        `source="${this.xmlAttrEscape(source)}"`,
        `exportedAt="${this.xmlAttrEscape(new Date().toISOString())}"`,
        `messageCount="${this.xmlAttrEscape(String(list.length))}"`
      ];

      const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<chat_record ${rootAttrs.join(" ")}>`
      ];

      for (const msg of list) {
        const msgAttrs = [
          `index="${this.xmlAttrEscape(String(msg.index))}"`,
          `sender="${this.xmlAttrEscape(msg.sender)}"`,
          `format="${this.xmlAttrEscape(msg.format)}"`
        ];

        if (msg.time) {
          msgAttrs.push(`time="${this.xmlAttrEscape(msg.time)}"`);
        }

        const content = this.xmlCdataSafe(msg.content || "");

        if (!content) {
          lines.push(`  <msg ${msgAttrs.join(" ")}><![CDATA[]]></msg>`);
        } else if (!content.includes("\n")) {
          lines.push(`  <msg ${msgAttrs.join(" ")}><![CDATA[${content}]]></msg>`);
        } else {
          const contentLines = content.split("\n");
          lines.push(`  <msg ${msgAttrs.join(" ")}><![CDATA[${contentLines[0]}`);
          for (const middleLine of contentLines.slice(1, -1)) {
            lines.push(middleLine);
          }
          lines.push(`${contentLines[contentLines.length - 1]}]]></msg>`);
        }
      }

      lines.push("</chat_record>");
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

    async copySelectedDraft() {
      const selected = this.getSelectedMessages();
      if (!selected.length) {
        this.toast("未选择任何条目");
        return;
      }
      const text = this.exportDraft(selected);
      await this.writeClipboard(text);
      this.toast(`已复制选中 Draft\n共 ${selected.length} 条`);
    },

    async copyJSON() {
      const text = this.exportJSON(this.state.messages, "arena.ai-buffer");
      await this.writeClipboard(text);
      this.toast(`已复制 JSON\n共 ${this.state.messages.length} 条`);
    },

    async copyYAML() {
      const text = this.exportYAML(this.state.messages, "arena.ai-buffer");
      await this.writeClipboard(text);
      this.toast(`已复制 YAML\n共 ${this.state.messages.length} 条`);
    },

    async copyXML() {
      const text = this.exportXML(this.state.messages, "arena.ai-buffer");
      await this.writeClipboard(text);
      this.toast(`已复制 XML\n共 ${this.state.messages.length} 条`);
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
      const text = this.exportJSON(this.state.messages, "arena.ai-buffer");
      const name = `${this.stampForFile()}_arena_draft_studio.json`;
      this.downloadTextFile(name, text, "application/json;charset=utf-8");
      this.toast(`已下载 JSON 文件\n${name}`);
    },

    downloadYAML() {
      const text = this.exportYAML(this.state.messages, "arena.ai-buffer");
      const name = `${this.stampForFile()}_arena_draft_studio.yaml`;
      this.downloadTextFile(name, text, "text/yaml;charset=utf-8");
      this.toast(`已下载 YAML 文件\n${name}`);
    },

    downloadXML() {
      const text = this.exportXML(this.state.messages, "arena.ai-buffer");
      const name = `${this.stampForFile()}_arena_draft_studio.xml`;
      this.downloadTextFile(name, text, "application/xml;charset=utf-8");
      this.toast(`已下载 XML 文件\n${name}`);
    },

    findConversationList() {
      const lists = [...document.querySelectorAll("ol")];
      let best = null;
      let bestCount = 0;

      for (const ol of lists) {
        const count = ol.querySelectorAll("div.prose").length;
        if (count > bestCount) {
          best = ol;
          bestCount = count;
        }
      }

      return bestCount > 0 ? best : null;
    },

    scrapeConversationMessages() {
      const listRoot = this.findConversationList();
      if (!listRoot) {
        return { ok: false, reason: "未找到当前对话列表", messages: [] };
      }

      const proseNodes = [...listRoot.querySelectorAll("div.prose")];
      if (!proseNodes.length) {
        return { ok: false, reason: "未找到消息正文容器", messages: [] };
      }

      const seenRoots = new Set();
      const items = [];

      for (const prose of proseNodes) {
        const root = this.findMessageRootFromContent(prose) || prose;
        if (seenRoots.has(root)) continue;

        const senderKey = this.detectSenderKeyFromRoot(root);
        const sender = this.resolveSenderLabel(senderKey);
        const content = this.normalizePlainText(prose.innerText || "");

        if (!sender || !content) continue;

        seenRoots.add(root);

        const rect = root.getBoundingClientRect();
        items.push({
          root,
          rectTop: rect.top,
          rectLeft: rect.left,
          message: {
            id: this.buildMessageId(),
            index: 0,
            sender,
            senderKey,
            format: "text",
            content,
            time: null,
            capturedAtMs: Date.now()
          }
        });
      }

      items.sort((a, b) => {
        const topDiff = a.rectTop - b.rectTop;
        if (Math.abs(topDiff) > 1) return topDiff;
        return a.rectLeft - b.rectLeft;
      });

      const messages = items.map((item, idx) => ({
        ...item.message,
        index: idx + 1
      }));

      if (!messages.length) {
        return { ok: false, reason: "未能识别任何有效消息", messages: [] };
      }

      return { ok: true, reason: "", messages };
    },

    buildImportedEntriesFromScrape(scrapedMessages) {
      const base = Date.now();
      return this.prepareExportMessages(scrapedMessages).map((msg, idx) => ({
        id: this.buildMessageId(),
        index: idx + 1,
        sender: msg.sender,
        senderKey: msg.senderKey || this.inferSenderKeyFromLabel(msg.sender),
        format: msg.format === "markdown" ? "markdown" : "text",
        content: msg.content,
        time: null,
        capturedAtMs: base + idx
      }));
    },

    importConversationAppend() {
      const result = this.scrapeConversationMessages();
      if (!result.ok) {
        this.toast(`全页抓取失败\n${result.reason}`);
        return;
      }

      const entries = this.buildImportedEntriesFromScrape(result.messages);
      const stats = this.addEntriesBatch(entries);

      if (stats.added === 0 && stats.skipped > 0) {
        this.toast(`全页追加导入完成\n新增 0 条，跳过 ${stats.skipped} 条`);
        return;
      }

      this.toast(`全页追加导入完成\n新增 ${stats.added} 条${stats.skipped ? `，跳过 ${stats.skipped} 条` : ""}`);
    },

    importConversationReplace() {
      const result = this.scrapeConversationMessages();
      if (!result.ok) {
        this.toast(`全页抓取失败\n${result.reason}`);
        return;
      }

      const ok = confirm(
        `确定用当前页面抓取到的 ${result.messages.length} 条消息覆盖缓冲区吗？\n当前缓冲区共有 ${this.state.messages.length} 条消息。`
      );
      if (!ok) return;

      const entries = this.buildImportedEntriesFromScrape(result.messages);
      this.replaceAllEntries(entries);
      this.toast(`已覆盖导入全页消息\n共 ${entries.length} 条`);
    },

    downloadConversationJSON() {
      const result = this.scrapeConversationMessages();
      if (!result.ok) {
        this.toast(`全页抓取失败\n${result.reason}`);
        return;
      }

      const text = this.exportJSON(result.messages, "arena.ai-page-scrape");
      const name = `${this.stampForFile()}_arena_conversation_full.json`;
      this.downloadTextFile(name, text, "application/json;charset=utf-8");
      this.toast(`已下载全页 JSON\n共 ${result.messages.length} 条\n${name}`);
    },

    downloadConversationYAML() {
      const result = this.scrapeConversationMessages();
      if (!result.ok) {
        this.toast(`全页抓取失败\n${result.reason}`);
        return;
      }

      const text = this.exportYAML(result.messages, "arena.ai-page-scrape");
      const name = `${this.stampForFile()}_arena_conversation_full.yaml`;
      this.downloadTextFile(name, text, "text/yaml;charset=utf-8");
      this.toast(`已下载全页 YAML\n共 ${result.messages.length} 条\n${name}`);
    },

    downloadConversationXML() {
      const result = this.scrapeConversationMessages();
      if (!result.ok) {
        this.toast(`全页抓取失败\n${result.reason}`);
        return;
      }

      const text = this.exportXML(result.messages, "arena.ai-page-scrape");
      const name = `${this.stampForFile()}_arena_conversation_full.xml`;
      this.downloadTextFile(name, text, "application/xml;charset=utf-8");
      this.toast(`已下载全页 XML\n共 ${result.messages.length} 条\n${name}`);
    },

    findMessageLevelCopyButton(root) {
      if (!root || !root.querySelectorAll) return null;

      const rootIsAI = this.hasClassText(root, "bg-surface-primary");
      const rootIsUser =
        (this.hasClassText(root, "group") && this.hasClassText(root, "self-end")) ||
        this.hasClassText(root, "justify-end") ||
        !!(root.querySelector && root.querySelector("div.bg-surface-raised"));

      const candidates = [...root.querySelectorAll("button")]
        .filter((btn) => this.isArenaCopyButton(btn))
        .filter((btn) => !btn.closest("div.prose"))
        .filter((btn) => !btn.closest("pre"))
        .filter((btn) => !btn.closest("code"));

      if (!candidates.length) return null;

      const scoreButton = (btn) => {
        let score = 0;
        const btnClass = this.getClass(btn);
        const chain = this.walkAncestors(btn, 6);

        if (rootIsAI) {
          if (btn.closest('div[class*="pb-2"]')) score += 90;
          if (btn.closest('div[class*="text-text-primary"]')) score += 40;
          if (btnClass.includes("size-3")) score += 10;
        }

        if (rootIsUser) {
          if (btnClass.includes("group-hover:opacity-100")) score += 90;
          if (btnClass.includes("opacity-0")) score += 20;
          if (btnClass.includes("size-6")) score += 12;
        }

        for (const el of chain) {
          const c = this.getClass(el);
          if (c.includes("prose")) score -= 1000;
          if (c.includes("pb-2")) score += 25;
          if (c.includes("justify-end")) score += 25;
          if (c.includes("items-center")) score += 8;
          if (c.includes("text-text-primary")) score += 10;
          if (c.includes("group") && c.includes("self-end")) score += 10;
          if (c.includes("bg-surface-primary")) score += 8;
        }

        return score;
      };

      candidates.sort((a, b) => scoreButton(b) - scoreButton(a));
      return candidates[0] || null;
    },

    collectConversationMessageDescriptors() {
      const listRoot = this.findConversationList();
      if (!listRoot) {
        return { ok: false, reason: "未找到当前对话列表", items: [] };
      }

      const proseNodes = [...listRoot.querySelectorAll("div.prose")];
      if (!proseNodes.length) {
        return { ok: false, reason: "未找到消息正文容器", items: [] };
      }

      const seenRoots = new Set();
      const items = [];

      for (const prose of proseNodes) {
        const root = this.findMessageRootFromContent(prose) || prose;
        if (seenRoots.has(root)) continue;

        const senderKey = this.detectSenderKeyFromRoot(root);
        const sender = this.resolveSenderLabel(senderKey);
        const domText = this.normalizePlainText(prose.innerText || "");

        if (!sender || !domText) continue;

        const copyButton = this.findMessageLevelCopyButton(root);

        seenRoots.add(root);

        const rect = root.getBoundingClientRect();
        items.push({
          root,
          sender,
          senderKey,
          domText,
          copyButton,
          rectTop: rect.top,
          rectLeft: rect.left
        });
      }

      items.sort((a, b) => {
        const topDiff = a.rectTop - b.rectTop;
        if (Math.abs(topDiff) > 1) return topDiff;
        return a.rectLeft - b.rectLeft;
      });

      if (!items.length) {
        return { ok: false, reason: "未识别到可处理的消息条目", items: [] };
      }

      return { ok: true, reason: "", items };
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
            this.observeNativeClipboardText(text, "writeText");
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
        const shouldProbe =
          this.state.settings.preferMarkdownCapture ||
          (this.state.batchJob && this.state.batchJob.active && this.state.batchJob.useMarkdown);

        if (!shouldProbe) return;

        const pending = this.state.markdownPending;
        if (!this.isPendingFresh(pending)) return;

        try {
          const text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
          if (text) {
            this.observeNativeClipboardText(text, "copy-event");
          }
        } catch (err) {
          console.warn(`[${this.name} ${this.version}] copy-event observe failed`, err);
        }
      };

      document.addEventListener("copy", this.boundOnCopyEvent, false);
      this.state.copyEventInstalled = true;
    },

    isPendingFresh(pending = this.state.markdownPending) {
      if (!pending) return false;
      return (Date.now() - pending.startedAt) <= 4000;
    },

    beginMarkdownCapture(info, options = {}) {
      const { kind = "single", silent = false } = options;

      const old = this.state.markdownPending;
      if (this.isPendingFresh(old)) {
        void this.resolvePendingCapture(old, old.domText, "dom-fallback-preempt");
      }

      const pending = {
        id: this.buildMessageId(),
        sender: info.sender,
        senderKey: info.senderKey,
        domText: info.domText,
        startedAt: Date.now(),
        kind,
        silent,
        resolve: null
      };

      let promise = null;
      if (kind === "batch") {
        promise = new Promise((resolve) => {
          pending.resolve = resolve;
        });
      }

      this.state.markdownPending = pending;
      this.updateUI();

      if (!silent) {
        this.toast(`已侦测 copy 点击：${info.sender}\n等待原生 Markdown...`);
      }

      this.scheduleMarkdownFallback(pending.id);
      return { pending, promise };
    },

    observeNativeClipboardText(rawText, method) {
      if (this.state.internalWrite) return;

      const pending = this.state.markdownPending;
      if (!this.isPendingFresh(pending)) return;

      const nativeText = this.preserveClipboardText(rawText);
      if (!nativeText) return;

      void this.resolvePendingCapture(pending, nativeText, method);
    },

    scheduleMarkdownFallback(pendingId) {
      const delays = [150, 450, 900];

      for (const delay of delays) {
        setTimeout(async () => {
          const pending = this.state.markdownPending;
          if (!pending || pending.id !== pendingId) return;
          if (!this.isPendingFresh(pending)) return;

          try {
            if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
              return;
            }

            const text = await navigator.clipboard.readText();
            if (!text) return;

            if (this.state.markdownPending && this.state.markdownPending.id === pendingId) {
              this.observeNativeClipboardText(text, "readText");
            }
          } catch {
            // ignore
          }
        }, delay);
      }

      setTimeout(() => {
        const pending = this.state.markdownPending;
        if (!pending || pending.id !== pendingId) return;
        if (!this.isPendingFresh(pending)) return;

        void this.resolvePendingCapture(pending, pending.domText, "dom-fallback");
      }, 1300);
    },

    async resolvePendingCapture(pending, rawText, method) {
      if (!pending) return null;
      if (!this.state.markdownPending || this.state.markdownPending.id !== pending.id) {
        return null;
      }

      this.state.markdownPending = null;

      let format = "markdown";
      let content = this.normalizeMarkdownText(rawText);

      if (method === "dom-fallback" || method === "dom-fallback-preempt") {
        format = "text";
        content = this.normalizePlainText(pending.domText);
      }

      if (!content) {
        format = "text";
        content = this.normalizePlainText(pending.domText);
        method = "dom-fallback-empty";
      }

      const resultPayload = {
        sender: pending.sender,
        senderKey: pending.senderKey,
        format,
        content,
        method,
        fallback: format !== "markdown",
        domText: this.normalizePlainText(pending.domText)
      };

      if (pending.kind === "batch") {
        if (typeof pending.resolve === "function") {
          pending.resolve(resultPayload);
        }
        this.updateUI();
        return resultPayload;
      }

      const entry = this.buildEntry(
        pending.sender,
        pending.senderKey,
        content,
        format
      );

      const result = this.addEntry(entry);
      const copied = await this.copyCurrentEntry(entry);

      const modeLabel = format === "markdown" ? "Markdown" : "Plain Text";
      const fallback = resultPayload.fallback;

      if (result.added) {
        if (copied) {
          this.toast(
            `已捕获并复制当前条目：${entry.sender}\n` +
            `模式：${modeLabel} ｜ 方式：${method}`
          );
        } else {
          this.toast(
            `已捕获当前条目：${entry.sender}\n` +
            `模式：${modeLabel} ｜ 方式：${method}`
          );
        }
      } else if (result.reason === "duplicate") {
        this.toast(
          `${fallback ? "回退捕获" : "原生捕获"}完成：${entry.sender}\n` +
          `重复内容未加入缓冲区`
        );
      } else {
        this.toast("捕获异常：未加入缓冲区");
      }

      console.log(`[${this.name} ${this.version}] markdown capture`, {
        sender: entry.sender,
        senderKey: entry.senderKey,
        format,
        method,
        fallback,
        buffered: result.added,
        copied,
        textPreview: entry.content.slice(0, 160)
      });

      this.updateUI();
      return resultPayload;
    },

    triggerSuppressedButtonClick(button) {
      if (!button) return;
      this.state.suppressedButton = button;
      try {
        button.click();
      } finally {
        setTimeout(() => {
          if (this.state.suppressedButton === button) {
            this.state.suppressedButton = null;
          }
        }, 250);
      }
    },

    buildMarkdownBatchFallbackItem(desc, reason = "dom-fallback-no-button") {
      return {
        id: this.buildMessageId(),
        sender: desc.sender,
        senderKey: desc.senderKey,
        format: "text",
        content: this.normalizePlainText(desc.domText),
        time: null,
        capturedAtMs: Date.now(),
        _captureMethod: reason
      };
    },

    async captureMarkdownForDescriptor(desc, timeoutMs = 2800) {
      if (!desc.copyButton) {
        return this.buildMarkdownBatchFallbackItem(desc, "dom-fallback-no-button");
      }

      const { pending, promise } = this.beginMarkdownCapture(
        {
          sender: desc.sender,
          senderKey: desc.senderKey,
          domText: desc.domText
        },
        { kind: "batch", silent: true }
      );

      this.triggerSuppressedButtonClick(desc.copyButton);

      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          const current = this.state.markdownPending;
          if (current && current.id === pending.id) {
            this.state.markdownPending = null;
            this.updateUI();
            resolve({
              sender: pending.sender,
              senderKey: pending.senderKey,
              format: "text",
              content: this.normalizePlainText(pending.domText),
              method: "timeout-dom-fallback",
              fallback: true,
              domText: this.normalizePlainText(pending.domText)
            });
          }
        }, timeoutMs);
      });

      const result = await Promise.race([promise, timeoutPromise]);

      if (!result || !result.content) {
        return this.buildMarkdownBatchFallbackItem(desc, "dom-fallback-empty");
      }

      return {
        id: this.buildMessageId(),
        sender: result.sender,
        senderKey: result.senderKey,
        format: result.format === "markdown" ? "markdown" : "text",
        content: result.content,
        time: null,
        capturedAtMs: Date.now(),
        _captureMethod: result.method
      };
    },

    updateBatchState(patch) {
      if (!this.state.batchJob) return;
      this.state.batchJob = {
        ...this.state.batchJob,
        ...patch
      };
      this.updateUI();
    },

    cancelBatchJob() {
      if (!this.state.batchJob || !this.state.batchJob.active) {
        this.toast("当前没有正在执行的批量任务");
        return;
      }

      if (this.state.batchJob.cancelRequested) {
        this.toast("已请求取消，请等待当前条目结束");
        return;
      }

      this.state.batchJob.cancelRequested = true;
      this.updateUI();
      this.toast("已请求取消批量任务\n将在当前条目结束后停止");
    },

    async runConversationMarkdownBatch(mode) {
      if (!this.state.supportedHost) {
        this.toast("当前页面不是 arena.ai");
        return;
      }

      if (this.state.batchJob && this.state.batchJob.active) {
        this.toast("已有批量任务正在处理中");
        return;
      }

      const collectedResult = this.collectConversationMessageDescriptors();
      if (!collectedResult.ok) {
        this.toast(`全页 Markdown 任务失败\n${collectedResult.reason}`);
        return;
      }

      const items = collectedResult.items;
      if (!items.length) {
        this.toast("未识别到可处理的消息");
        return;
      }

      if (mode === "import-replace-markdown") {
        const ok = confirm(
          `确定用当前页面自动采集到的 ${items.length} 条 Markdown/文本消息覆盖缓冲区吗？\n` +
          `当前缓冲区共有 ${this.state.messages.length} 条消息。`
        );
        if (!ok) return;
      }

      this.state.batchJob = {
        active: true,
        useMarkdown: true,
        mode,
        current: 0,
        total: items.length,
        cancelRequested: false
      };
      this.updateUI();

      const collected = [];
      let markdownCount = 0;
      let fallbackCount = 0;
      let timeoutCount = 0;
      let missingButtonCount = 0;
      let canceled = false;

      try {
        for (let i = 0; i < items.length; i += 1) {
          if (this.state.batchJob && this.state.batchJob.cancelRequested) {
            canceled = true;
            break;
          }

          this.updateBatchState({ current: i + 1 });

          const desc = items[i];
          const item = await this.captureMarkdownForDescriptor(desc, 2800);

          collected.push(item);

          if (item.format === "markdown") {
            markdownCount += 1;
          } else {
            fallbackCount += 1;
          }

          if (item._captureMethod === "dom-fallback-no-button") {
            missingButtonCount += 1;
          }
          if (item._captureMethod === "timeout-dom-fallback") {
            timeoutCount += 1;
          }

          if (this.state.batchJob && this.state.batchJob.cancelRequested) {
            canceled = true;
            break;
          }

          await this.sleep(110);
        }
      } catch (err) {
        console.error(`[${this.name} ${this.version}] markdown batch failed`, err);
        this.state.markdownPending = null;
        this.state.suppressedButton = null;
        this.state.batchJob = null;
        this.updateUI();
        this.toast(`全页 Markdown 批量任务失败\n${err && err.message ? err.message : "未知错误"}`);
        return;
      } finally {
        this.state.markdownPending = null;
        this.state.suppressedButton = null;
      }

      this.state.batchJob = null;
      this.updateUI();

      if (!collected.length) {
        this.toast(canceled ? "批量任务已取消，未产生任何结果" : "批量任务未产生有效结果");
        return;
      }

      const entries = this.buildImportedEntriesFromScrape(collected);
      const partialSuffix = canceled ? "_partial" : "";

      if (mode === "import-append-markdown") {
        const stats = this.addEntriesBatch(entries);
        this.toast(
          `${canceled ? "全页 Markdown 追加导入已取消，已导入部分结果" : "全页 Markdown 追加导入完成"}\n` +
          `新增 ${stats.added} 条${stats.skipped ? `，跳过 ${stats.skipped} 条` : ""}\n` +
          `Markdown ${markdownCount} 条 ｜ 回退文本 ${fallbackCount} 条` +
          `${missingButtonCount ? ` ｜ 无按钮 ${missingButtonCount} 条` : ""}` +
          `${timeoutCount ? ` ｜ 超时 ${timeoutCount} 条` : ""}`
        );
        return;
      }

      if (mode === "import-replace-markdown") {
        if (canceled) {
          this.toast(
            `全页 Markdown 覆盖任务已取消\n` +
            `为避免数据不完整，未覆盖缓冲区。\n` +
            `已采集 ${entries.length} 条（Markdown ${markdownCount} / 回退 ${fallbackCount}）`
          );
          return;
        }

        this.replaceAllEntries(entries);
        this.toast(
          `全页 Markdown 覆盖导入完成\n` +
          `共 ${entries.length} 条\n` +
          `Markdown ${markdownCount} 条 ｜ 回退文本 ${fallbackCount} 条` +
          `${missingButtonCount ? ` ｜ 无按钮 ${missingButtonCount} 条` : ""}` +
          `${timeoutCount ? ` ｜ 超时 ${timeoutCount} 条` : ""}`
        );
        return;
      }

      if (mode === "download-markdown-json") {
        const text = this.exportJSON(entries, "arena.ai-page-markdown-queue");
        const name = `${this.stampForFile()}_arena_conversation_full_markdown${partialSuffix}.json`;
        this.downloadTextFile(name, text, "application/json;charset=utf-8");
        this.toast(
          `${canceled ? "已下载部分结果 Markdown JSON" : "已下载全页 Markdown JSON"}\n` +
          `共 ${entries.length} 条\n` +
          `Markdown ${markdownCount} 条 ｜ 回退文本 ${fallbackCount} 条`
        );
        return;
      }

      if (mode === "download-markdown-yaml") {
        const text = this.exportYAML(entries, "arena.ai-page-markdown-queue");
        const name = `${this.stampForFile()}_arena_conversation_full_markdown${partialSuffix}.yaml`;
        this.downloadTextFile(name, text, "text/yaml;charset=utf-8");
        this.toast(
          `${canceled ? "已下载部分结果 Markdown YAML" : "已下载全页 Markdown YAML"}\n` +
          `共 ${entries.length} 条\n` +
          `Markdown ${markdownCount} 条 ｜ 回退文本 ${fallbackCount} 条`
        );
        return;
      }

      if (mode === "download-markdown-xml") {
        const text = this.exportXML(entries, "arena.ai-page-markdown-queue");
        const name = `${this.stampForFile()}_arena_conversation_full_markdown${partialSuffix}.xml`;
        this.downloadTextFile(name, text, "application/xml;charset=utf-8");
        this.toast(
          `${canceled ? "已下载部分结果 Markdown XML" : "已下载全页 Markdown XML"}\n` +
          `共 ${entries.length} 条\n` +
          `Markdown ${markdownCount} 条 ｜ 回退文本 ${fallbackCount} 条`
        );
      }
    },

    clearMessages() {
      const ok = confirm(`确定清空缓冲区吗？\n当前共有 ${this.state.messages.length} 条消息。`);
      if (!ok) return;

      this.state.messages = [];
      this.state.markdownPending = null;
      this.clearSelection(true);
      this.saveStore();
      this.updateUI();
      this.toast("缓冲区已清空");
    },

    deleteSelectedEntries() {
      const selected = this.getSelectedMessages();
      if (!selected.length) {
        this.toast("未选择任何条目");
        return;
      }

      const ok = confirm(`确定删除已选中的 ${selected.length} 条消息吗？`);
      if (!ok) return;

      const ids = new Set(selected.map((msg) => msg.id));
      this.state.messages = this.state.messages.filter((msg) => !ids.has(msg.id));
      this.clearSelection(true);
      this.reindexMessages();
      this.saveStore();
      this.updateUI();
      this.toast(`已删除选中条目\n共 ${selected.length} 条`);
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

      const normalized = this.normalizePlainText(content);
      if (!normalized) {
        this.toast("说明内容不能为空");
        return;
      }

      const entry = this.buildEntry("说明", "note", normalized, "text");
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

      const normalized = this.normalizePlainText(content);
      if (!normalized) {
        this.toast("消息内容不能为空");
        return;
      }

      const entry = this.buildEntry(senderText, "custom", normalized, "text");
      const result = this.addEntry(entry);

      if (result.added) {
        this.toast(`已添加自定义消息：${senderText}\n缓冲区共 ${this.state.messages.length} 条`);
      } else if (result.reason === "duplicate") {
        this.toast("内容疑似重复，未加入缓冲区");
      } else {
        this.toast("自定义消息添加失败");
      }
    },

    editEntryById(id) {
      const msg = this.findMessageById(id);
      if (!msg) {
        this.toast("未找到该条目");
        return;
      }

      const nextSender = prompt("发言人标签：", msg.sender);
      if (nextSender === null) return;

      const sender = nextSender.trim();
      if (!sender) {
        this.toast("发言人标签不能为空");
        return;
      }

      const nextContent = prompt("消息内容：", msg.content);
      if (nextContent === null) return;

      const content = msg.format === "markdown"
        ? this.normalizeMarkdownText(nextContent)
        : this.normalizePlainText(nextContent);

      if (!content) {
        this.toast("消息内容不能为空");
        return;
      }

      msg.sender = sender;
      msg.senderKey = this.inferSenderKeyFromLabel(sender);
      msg.content = content;

      this.saveStore();
      this.updateUI();
      this.toast(`已编辑条目：#${msg.index} ${msg.sender}`);
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
      this.state.selectedIds.delete(id);
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
      const selectedCount = this.selectedCount();
      this.refs.entriesMeta.textContent = list.length ? `共 ${list.length} 条` : "空";
      this.refs.selectedMeta.textContent = selectedCount > 0 ? `已选 ${selectedCount} 条` : "未选";

      if (!list.length) {
        this.refs.entriesList.innerHTML = `
          <div class="ads-empty">
            缓冲区为空。你可以点 arena.ai 的 copy 按钮，或者手动添加说明/自定义消息，也可以直接导入全页对话。
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
          const checked = this.state.selectedIds.has(msg.id);
          const fmt = msg.format === "markdown" ? "MD" : "TXT";

          return `
            <div class="ads-entry ${checked ? "is-selected" : ""}">
              <div class="ads-entry-head">
                <div class="ads-entry-title">
                  <label class="ads-entry-pick">
                    <input type="checkbox" data-entry-select="${this.escapeHtml(msg.id)}" ${checked ? "checked" : ""}>
                  </label>
                  <span class="ads-entry-index">#${msg.index}</span>
                  <span class="ads-entry-sender">${this.escapeHtml(msg.sender)}</span>
                  <span class="ads-entry-format ${msg.format === "markdown" ? "is-md" : "is-txt"}">${fmt}</span>
                  ${time ? `<span class="ads-entry-time">${this.escapeHtml(time)}</span>` : ""}
                </div>

                <div class="ads-entry-actions">
                  <button class="ads-mini-btn" data-entry-action="edit" data-entry-id="${this.escapeHtml(msg.id)}" type="button">编辑</button>
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
        if (!this.state.supportedHost) return;

        const target = event.target;
        const button = target && target.closest ? target.closest("button") : null;
        if (!this.isArenaCopyButton(button)) return;

        if (this.state.batchJob && this.state.batchJob.active) {
          if (this.state.suppressedButton && button === this.state.suppressedButton) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
          }
          this.toast("全页 Markdown 批量任务进行中，请稍候");
          return;
        }

        if (this.state.suppressedButton && button === this.state.suppressedButton) {
          return;
        }

        if (!this.state.listening) return;

        const info = this.extractFromButton(button);
        if (!info) {
          this.toast("未能解析消息内容或发言人");
          console.warn(`[${this.name} ${this.version}] extract failed`);
          return;
        }

        if (this.state.settings.preferMarkdownCapture) {
          this.beginMarkdownCapture(info, { kind: "single", silent: false });
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }

        const entry = this.buildEntry(info.sender, info.senderKey, info.domText, "text");
        const result = this.addEntry(entry);
        const copied = await this.copyCurrentEntry(entry);

        if (result.added) {
          if (copied) {
            this.toast(`已捕获并复制当前条目：${entry.sender}\n模式：Plain Text`);
          } else {
            this.toast(`已捕获当前条目：${entry.sender}\n模式：Plain Text`);
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

        console.log(`[${this.name} ${this.version}] plain capture`, {
          sender: entry.sender,
          senderKey: entry.senderKey,
          format: entry.format,
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
            width: min(440px, 97vw);
            max-height: 80vh;
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
            max-height: 240px;
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

          .ads-entry.is-selected {
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37,99,235,.10);
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
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.4;
          }

          .ads-entry-pick {
            display: inline-flex;
            align-items: center;
          }

          .ads-entry-index {
            color: #6b7280;
          }

          .ads-entry-sender {
            color: #111827;
          }

          .ads-entry-format {
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 11px;
          }

          .ads-entry-format.is-md {
            background: #dbeafe;
            color: #1d4ed8;
          }

          .ads-entry-format.is-txt {
            background: #e5e7eb;
            color: #374151;
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
              <button class="ads-close" type="button">×</button>
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

              <button class="ads-btn secondary" data-action="copy-xml" type="button">复制 XML</button>
              <button class="ads-btn secondary" data-action="download-xml" type="button">下载 XML</button>

              <button class="ads-btn warn" data-action="clear" type="button">清空缓冲区</button>
            </div>

            <div class="ads-settings">
              <label><input type="checkbox" data-setting="enableDedupe">去重</label>
              <label><input type="checkbox" data-setting="captureTimestamp">时间戳</label>
              <label><input type="checkbox" data-setting="persistStore">本地持久化</label>
              <label><input type="checkbox" data-setting="copySingleOnCapture">捕获时复制单条</label>
              <label><input type="checkbox" data-setting="preferMarkdownCapture">Markdown 捕获</label>
            </div>

            <div class="ads-section-head">
              <span>全页对话抓取 / 导入</span>
              <span class="ads-section-meta">当前 DOM（Plain Text）</span>
            </div>

            <div class="ads-buttons">
              <button class="ads-btn secondary" data-action="import-conversation-append" type="button">追加导入全页</button>
              <button class="ads-btn secondary" data-action="import-conversation-replace" type="button">覆盖导入全页</button>

              <button class="ads-btn secondary" data-action="download-conversation-json" type="button">下载全页 JSON</button>
              <button class="ads-btn secondary" data-action="download-conversation-yaml" type="button">下载全页 YAML</button>
              <button class="ads-btn secondary" data-action="download-conversation-xml" type="button">下载全页 XML</button>
            </div>

            <div class="ads-section-head">
              <span>全页 Markdown 自动队列</span>
              <span class="ads-section-meta">消息级 copy 按钮</span>
            </div>

            <div class="ads-buttons">
              <button class="ads-btn secondary" data-action="import-conversation-markdown-append" type="button">追加导入全页 Markdown</button>
              <button class="ads-btn secondary" data-action="import-conversation-markdown-replace" type="button">覆盖导入全页 Markdown</button>

              <button class="ads-btn secondary" data-action="download-conversation-markdown-json" type="button">下载全页 Markdown JSON</button>
              <button class="ads-btn secondary" data-action="download-conversation-markdown-yaml" type="button">下载全页 Markdown YAML</button>
              <button class="ads-btn secondary" data-action="download-conversation-markdown-xml" type="button">下载全页 Markdown XML</button>

              <button class="ads-btn warn" data-action="cancel-batch" type="button">取消批任务</button>
            </div>

            <div class="ads-section-head">
              <span>选中条目操作</span>
              <span class="ads-section-meta ads-selected-meta"></span>
            </div>

            <div class="ads-buttons">
              <button class="ads-btn secondary" data-action="copy-selected-draft" type="button">复制选中 Draft</button>
              <button class="ads-btn secondary" data-action="clear-selection" type="button">清空选择</button>
              <button class="ads-btn warn" data-action="delete-selected" type="button">删除选中条目</button>
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
              本版修复重点：批量 Markdown 任务增加硬超时、可取消、自动清理锁，并继续排除 prose / pre / code 内部按钮，以避免混淆代码块 copy 按钮。
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
      this.refs.btnCopyXML = shadow.querySelector('[data-action="copy-xml"]');
      this.refs.btnDownloadXML = shadow.querySelector('[data-action="download-xml"]');
      this.refs.btnImportConversationAppend = shadow.querySelector('[data-action="import-conversation-append"]');
      this.refs.btnImportConversationReplace = shadow.querySelector('[data-action="import-conversation-replace"]');
      this.refs.btnDownloadConversationJSON = shadow.querySelector('[data-action="download-conversation-json"]');
      this.refs.btnDownloadConversationYAML = shadow.querySelector('[data-action="download-conversation-yaml"]');
      this.refs.btnDownloadConversationXML = shadow.querySelector('[data-action="download-conversation-xml"]');
      this.refs.btnImportConversationMarkdownAppend = shadow.querySelector('[data-action="import-conversation-markdown-append"]');
      this.refs.btnImportConversationMarkdownReplace = shadow.querySelector('[data-action="import-conversation-markdown-replace"]');
      this.refs.btnDownloadConversationMarkdownJSON = shadow.querySelector('[data-action="download-conversation-markdown-json"]');
      this.refs.btnDownloadConversationMarkdownYAML = shadow.querySelector('[data-action="download-conversation-markdown-yaml"]');
      this.refs.btnDownloadConversationMarkdownXML = shadow.querySelector('[data-action="download-conversation-markdown-xml"]');
      this.refs.btnCancelBatch = shadow.querySelector('[data-action="cancel-batch"]');
      this.refs.btnCopySelectedDraft = shadow.querySelector('[data-action="copy-selected-draft"]');
      this.refs.btnDeleteSelected = shadow.querySelector('[data-action="delete-selected"]');
      this.refs.btnClearSelection = shadow.querySelector('[data-action="clear-selection"]');
      this.refs.btnSetLabels = shadow.querySelector('[data-action="set-labels"]');
      this.refs.btnAddNote = shadow.querySelector('[data-action="add-note"]');
      this.refs.btnAddCustom = shadow.querySelector('[data-action="add-custom"]');
      this.refs.btnClear = shadow.querySelector('[data-action="clear"]');
      this.refs.previewMeta = shadow.querySelector(".ads-preview-meta");
      this.refs.preview = shadow.querySelector(".ads-preview");
      this.refs.entriesMeta = shadow.querySelector(".ads-entries-meta");
      this.refs.selectedMeta = shadow.querySelector(".ads-selected-meta");
      this.refs.entriesList = shadow.querySelector(".ads-entries");
      this.refs.checkboxDedupe = shadow.querySelector('[data-setting="enableDedupe"]');
      this.refs.checkboxTimestamp = shadow.querySelector('[data-setting="captureTimestamp"]');
      this.refs.checkboxPersist = shadow.querySelector('[data-setting="persistStore"]');
      this.refs.checkboxCopySingle = shadow.querySelector('[data-setting="copySingleOnCapture"]');
      this.refs.checkboxMarkdown = shadow.querySelector('[data-setting="preferMarkdownCapture"]');

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

      this.refs.btnCopyXML.addEventListener("click", async () => {
        await this.copyXML();
      });

      this.refs.btnDownloadXML.addEventListener("click", () => {
        this.downloadXML();
      });

      this.refs.btnImportConversationAppend.addEventListener("click", () => {
        this.importConversationAppend();
      });

      this.refs.btnImportConversationReplace.addEventListener("click", () => {
        this.importConversationReplace();
      });

      this.refs.btnDownloadConversationJSON.addEventListener("click", () => {
        this.downloadConversationJSON();
      });

      this.refs.btnDownloadConversationYAML.addEventListener("click", () => {
        this.downloadConversationYAML();
      });

      this.refs.btnDownloadConversationXML.addEventListener("click", () => {
        this.downloadConversationXML();
      });

      this.refs.btnImportConversationMarkdownAppend.addEventListener("click", async () => {
        await this.runConversationMarkdownBatch("import-append-markdown");
      });

      this.refs.btnImportConversationMarkdownReplace.addEventListener("click", async () => {
        await this.runConversationMarkdownBatch("import-replace-markdown");
      });

      this.refs.btnDownloadConversationMarkdownJSON.addEventListener("click", async () => {
        await this.runConversationMarkdownBatch("download-markdown-json");
      });

      this.refs.btnDownloadConversationMarkdownYAML.addEventListener("click", async () => {
        await this.runConversationMarkdownBatch("download-markdown-yaml");
      });

      this.refs.btnDownloadConversationMarkdownXML.addEventListener("click", async () => {
        await this.runConversationMarkdownBatch("download-markdown-xml");
      });

      this.refs.btnCancelBatch.addEventListener("click", () => {
        this.cancelBatchJob();
      });

      this.refs.btnCopySelectedDraft.addEventListener("click", async () => {
        await this.copySelectedDraft();
      });

      this.refs.btnDeleteSelected.addEventListener("click", () => {
        this.deleteSelectedEntries();
      });

      this.refs.btnClearSelection.addEventListener("click", () => {
        this.clearSelection();
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

      this.refs.checkboxMarkdown.addEventListener("change", (e) => {
        this.state.settings.preferMarkdownCapture = !!e.target.checked;
        this.state.markdownPending = null;
        this.saveStore();
        this.updateUI();
        this.toast(
          this.state.settings.preferMarkdownCapture
            ? "已开启 Markdown 捕获\n单条 copy 优先使用平台原生 Markdown"
            : "已关闭 Markdown 捕获\n单条 copy 使用 DOM 纯文本"
        );
      });

      this.refs.entriesList.addEventListener("change", (e) => {
        const input = e.target && e.target.closest
          ? e.target.closest("input[data-entry-select]")
          : null;
        if (!input) return;

        const id = input.getAttribute("data-entry-select");
        this.setEntrySelected(id, !!input.checked);
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

        if (action === "edit") {
          this.editEntryById(id);
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

      this.cleanupSelection();

      const count = this.state.messages.length;
      const chars = this.messageCharCount();
      const selected = this.selectedCount();
      const mode = this.state.settings.preferMarkdownCapture ? "Markdown" : "Plain Text";
      const pending = this.state.markdownPending;
      const batch = this.state.batchJob;

      this.refs.fab.textContent = count > 0 ? `Draft ${count}` : "Draft";
      this.refs.panel.classList.toggle("ads-hidden", !this.state.panelOpen);
      this.refs.btnListen.textContent = this.state.listening ? "监听：开启" : "监听：关闭";

      this.refs.status.textContent =
        `站点：${location.host}\n` +
        `监听：${this.state.listening ? "开启" : "关闭"} ｜ 条数：${count} ｜ 字数：${chars}`;

      let sub =
        `模式：${mode} ｜ Markdown Hook：${this.state.clipboardHookInstalled ? "已装" : "失败/不可写"}\n` +
        `标签：我=${this.state.settings.meLabel} ｜ AI=${this.state.settings.aiLabel}\n` +
        `去重：${this.state.settings.enableDedupe ? "开" : "关"} ｜ 时间戳：${this.state.settings.captureTimestamp ? "开" : "关"} ｜ 持久化：${this.state.settings.persistStore ? "开" : "关"} ｜ 单条复制：${this.state.settings.copySingleOnCapture ? "开" : "关"}`;

      if (pending) {
        sub += `\n当前等待原生捕获：${pending.sender}`;
      }

      if (batch && batch.active) {
        sub += `\n批量任务：${batch.mode} ｜ 进度 ${batch.current}/${batch.total}${batch.cancelRequested ? " ｜ 已请求取消" : ""}`;
      }

      this.refs.substatus.textContent = sub;

      this.refs.checkboxDedupe.checked = !!this.state.settings.enableDedupe;
      this.refs.checkboxTimestamp.checked = !!this.state.settings.captureTimestamp;
      this.refs.checkboxPersist.checked = !!this.state.settings.persistStore;
      this.refs.checkboxCopySingle.checked = !!this.state.settings.copySingleOnCapture;
      this.refs.checkboxMarkdown.checked = !!this.state.settings.preferMarkdownCapture;

      const draftText = this.exportDraft();
      this.refs.preview.value = draftText;
      this.refs.previewMeta.textContent = count > 0 ? `共 ${count} 条` : "空";
      this.refs.selectedMeta.textContent = selected > 0 ? `已选 ${selected} 条` : "未选";

      this.renderEntries();
    }
  };

  app.init();
})();
