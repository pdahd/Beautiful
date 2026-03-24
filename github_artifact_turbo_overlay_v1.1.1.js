(() => {
  const SCRIPT_NAME = "GitHub Artifact Turbo Overlay";
  const SCRIPT_VERSION = "v1.1.1";
  const GLOBAL_KEY = "__githubArtifactTurboOverlayApp__";
  const HOST_ID = "__github_artifact_turbo_overlay_host__";
  const TOAST_ID = "__github_artifact_turbo_overlay_toast__";
  const STORAGE_KEY = "__githubArtifactTurboOverlayStore__::v1.1.1";
  const DEFAULT_WORKER_BASE = "https://xiazai.yswwsy.workers.dev";
  const DEFAULT_PANEL_PAGE = "https://pdahd.github.io/Beautiful/";
  const GITHUB_HOST_RE = /(^|\.)github\.com$/i;

  const existing = window[GLOBAL_KEY];
  if (existing && existing.version === SCRIPT_VERSION && existing.api) {
    const visible = existing.api.togglePanel();
    existing.api.toast(visible ? "面板已打开" : "面板已隐藏");
    return;
  }

  if (existing && existing.api && typeof existing.api.destroy === "function") {
    try {
      existing.api.destroy();
    } catch (err) {
      console.warn(`[${SCRIPT_NAME} ${SCRIPT_VERSION}] destroy old instance failed`, err);
    }
  }

  const app = {
    name: SCRIPT_NAME,
    version: SCRIPT_VERSION,

    state: {
      uiReady: false,
      panelOpen: true,
      loading: false,

      workerBase: DEFAULT_WORKER_BASE,
      panelPage: DEFAULT_PANEL_PAGE,

      workerAlive: false,
      mode: "account", // run | repo | account
      items: [],
      repos: [],
      syncStatus: null,
      lastError: "",

      currentContext: {
        owner: "",
        repo: "",
        runId: "",
        sourceUrl: location.href
      },

      activeContext: {
        owner: "",
        repo: "",
        runId: ""
      },

      selectedRepoFullName: "",

      filters: {
        query: "",
        includeExpired: false,
        sort: "created_at",
        order: "desc"
      },

      pagination: {
        page: 1,
        perPage: 20,
        totalCount: 0,
        totalPages: 1
      },

      selectedIds: new Set(),

      ui: {
        x: null,
        y: null,
        collapsed: false
      }
    },

    refs: {},
    boundResize: null,
    dragState: null,
    layoutRaf: 0,
    titleTapState: {
      lastTapAt: 0,
      lastTapX: 0,
      lastTapY: 0
    },

    init() {
      this.loadStore();
      this.parseCurrentContext();
      this.bootstrapModeFromContext();
      this.buildUI();
      this.installResizeHandler();
      this.updateUI();

      void this.pingWorker();
      void this.loadSyncStatus(true);
      void this.loadReposIndex(true);
      void this.refreshData(false);

      window[GLOBAL_KEY] = {
        name: this.name,
        version: this.version,
        api: this
      };

      this.toast("已加载悬浮面板");
    },

    destroy() {
      if (this.boundResize) {
        window.removeEventListener("resize", this.boundResize, false);
      }

      clearTimeout(this._toastTimer);
      clearTimeout(this._titleTapTimer);
      clearInterval(this._syncPollTimer);
      cancelAnimationFrame(this.layoutRaf);

      const toast = document.getElementById(TOAST_ID);
      if (toast) toast.remove();

      const host = document.getElementById(HOST_ID);
      if (host) host.remove();

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
        "top:18px",
        "transform:translateX(-50%)",
        "z-index:2147483647",
        "background:rgba(0,0,0,.88)",
        "color:#fff",
        "padding:10px 14px",
        "border-radius:12px",
        "font:14px/1.45 sans-serif",
        "max-width:88vw",
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

    loadStore() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object") return;

        if (typeof data.workerBase === "string" && data.workerBase.trim()) {
          this.state.workerBase = data.workerBase.trim();
        }

        if (typeof data.panelPage === "string" && data.panelPage.trim()) {
          this.state.panelPage = data.panelPage.trim();
        }

        if (data.filters && typeof data.filters === "object") {
          this.state.filters.query = String(data.filters.query || "");
          this.state.filters.includeExpired = !!data.filters.includeExpired;
          this.state.filters.sort = String(data.filters.sort || "created_at");
          this.state.filters.order = String(data.filters.order || "desc");
        }

        if (data.pagination && typeof data.pagination === "object") {
          this.state.pagination.perPage = Number(data.pagination.perPage) || 20;
        }

        if (typeof data.selectedRepoFullName === "string") {
          this.state.selectedRepoFullName = data.selectedRepoFullName;
        }

        if (data.ui && typeof data.ui === "object") {
          if (Number.isFinite(data.ui.x)) this.state.ui.x = data.ui.x;
          if (Number.isFinite(data.ui.y)) this.state.ui.y = data.ui.y;
          this.state.ui.collapsed = !!data.ui.collapsed;
        }
      } catch (err) {
        console.warn(`[${this.name}] loadStore failed`, err);
      }
    },

    saveStore() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          workerBase: this.state.workerBase,
          panelPage: this.state.panelPage,
          filters: { ...this.state.filters },
          pagination: { perPage: this.state.pagination.perPage },
          selectedRepoFullName: this.state.selectedRepoFullName,
          ui: {
            x: this.state.ui.x,
            y: this.state.ui.y,
            collapsed: this.state.ui.collapsed
          }
        }));
      } catch (err) {
        console.warn(`[${this.name}] saveStore failed`, err);
      }
    },

    parseCurrentContext() {
      const parts = location.pathname.split("/").filter(Boolean);
      let owner = "";
      let repo = "";
      let runId = "";

      if (GITHUB_HOST_RE.test(location.hostname) && parts.length >= 2) {
        owner = parts[0];
        repo = parts[1];
      }

      if (
        GITHUB_HOST_RE.test(location.hostname) &&
        parts.length >= 5 &&
        parts[2] === "actions" &&
        parts[3] === "runs" &&
        /^\d+$/.test(parts[4])
      ) {
        runId = parts[4];
      }

      this.state.currentContext = {
        owner,
        repo,
        runId,
        sourceUrl: location.href
      };
    },

    bootstrapModeFromContext() {
      const cur = this.state.currentContext;

      if (cur.owner && cur.repo && cur.runId) {
        this.state.mode = "run";
        this.state.activeContext = {
          owner: cur.owner,
          repo: cur.repo,
          runId: cur.runId
        };
        this.state.selectedRepoFullName = `${cur.owner}/${cur.repo}`;
        return;
      }

      if (cur.owner && cur.repo) {
        this.state.mode = "repo";
        this.state.activeContext = {
          owner: cur.owner,
          repo: cur.repo,
          runId: ""
        };
        this.state.selectedRepoFullName = `${cur.owner}/${cur.repo}`;
        return;
      }

      this.state.mode = "account";
      this.state.activeContext = {
        owner: "",
        repo: "",
        runId: ""
      };
    },

    modeLabel() {
      if (this.state.mode === "run") return "当前 Run";
      if (this.state.mode === "repo") return "当前仓库";
      return "全账户";
    },

    currentFullName() {
      const { owner, repo } = this.state.activeContext;
      return owner && repo ? `${owner}/${repo}` : "";
    },

    normalizeWorkerBase(value) {
      const s = String(value || "").trim();
      if (!s) throw new Error("Worker 地址不能为空");
      const u = new URL(s);
      return u.origin.replace(/\/+$/, "");
    },

    normalizeBaseUrl(value) {
      const s = String(value || "").trim();
      if (!s) throw new Error("页面地址不能为空");
      const u = new URL(s);
      return u.href.replace(/\/+$/, "/");
    },

    apiUrl(path, params = {}) {
      const base = this.normalizeWorkerBase(this.state.workerBase);
      const u = new URL(path, base);
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === "") continue;
        u.searchParams.set(k, String(v));
      }
      return u.toString();
    },

    async fetchJSON(path, params = {}, init = {}) {
      const res = await fetch(this.apiUrl(path, params), {
        method: init.method || "GET",
        headers: init.headers || {},
        body: init.body
      });

      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}

      if (!res.ok || (data && data.ok === false)) {
        throw new Error(data?.error || `请求失败：${res.status}${text ? ` ｜ ${text.slice(0, 200)}` : ""}`);
      }

      return data;
    },

    async pingWorker() {
      try {
        const data = await this.fetchJSON("/api/ping");
        this.state.workerAlive = !!data.ok;
        this.state.lastError = "";
        this.updateUI();
        return true;
      } catch (err) {
        this.state.workerAlive = false;
        this.state.lastError = err.message || String(err);
        this.updateUI();
        return false;
      }
    },

    async loadSyncStatus(silent = false) {
      try {
        const data = await this.fetchJSON("/api/sync/status");
        this.state.syncStatus = data;
        this.updateUI();
        if (!silent) this.toast("同步状态已刷新");
      } catch (err) {
        if (!silent) this.toast(`刷新同步状态失败\n${err.message || err}`);
      }
    },

    startSyncPolling() {
      clearInterval(this._syncPollTimer);
      let remain = 24;
      this._syncPollTimer = setInterval(async () => {
        remain -= 1;
        await this.loadSyncStatus(true);
        const latest = this.state.syncStatus?.latest_job;
        if (!latest || latest.status !== "running" || remain <= 0) {
          clearInterval(this._syncPollTimer);
          this._syncPollTimer = null;
        }
      }, 2500);
    },

    async loadReposIndex(silent = false) {
      try {
        const first = await this.fetchJSON("/api/repos", {
          page: 1,
          per_page: 200
        });

        let items = Array.isArray(first.items) ? [...first.items] : [];
        const totalPages = Number(first.total_pages || 1);

        for (let page = 2; page <= totalPages; page += 1) {
          const next = await this.fetchJSON("/api/repos", {
            page,
            per_page: 200
          });
          if (Array.isArray(next.items)) {
            items.push(...next.items);
          }
        }

        items.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
        this.state.repos = items;
        this.updateRepoSelectOptions();
        this.updateUI();

        if (!silent) this.toast(`已加载仓库索引\n共 ${items.length} 个仓库`);
      } catch (err) {
        if (!silent) this.toast(`加载仓库索引失败\n${err.message || err}`);
      }
    },

    updateRepoSelectOptions() {
      if (!this.refs.repoSelect) return;

      const items = this.state.repos;
      if (!items.length) {
        this.refs.repoSelect.innerHTML = `<option value="">（暂无仓库，请先加载仓库索引）</option>`;
        this.refs.repoSelect.disabled = true;
        return;
      }

      this.refs.repoSelect.innerHTML = items.map(r => {
        const full = String(r.full_name || "");
        return `<option value="${this.escapeHtml(full)}">${this.escapeHtml(full)}</option>`;
      }).join("");

      this.refs.repoSelect.disabled = false;

      const exists = items.some(r => r.full_name === this.state.selectedRepoFullName);
      if (!exists) {
        const preferred =
          (this.state.currentContext.owner && this.state.currentContext.repo && `${this.state.currentContext.owner}/${this.state.currentContext.repo}`) ||
          items[0].full_name ||
          "";
        this.state.selectedRepoFullName = preferred;
      }

      if (this.state.selectedRepoFullName) {
        this.refs.repoSelect.value = this.state.selectedRepoFullName;
      }
    },

    switchToCurrentRun() {
      const cur = this.state.currentContext;
      if (!(cur.owner && cur.repo && cur.runId)) {
        return this.toast("当前页面不是 GitHub Actions run 页面");
      }

      this.state.mode = "run";
      this.state.activeContext = {
        owner: cur.owner,
        repo: cur.repo,
        runId: cur.runId
      };
      this.state.selectedRepoFullName = `${cur.owner}/${cur.repo}`;
      this.state.pagination.page = 1;
      this.saveStore();
      this.updateUI();
      void this.refreshData(false);
    },

    switchToCurrentRepo() {
      const cur = this.state.currentContext;
      if (!(cur.owner && cur.repo)) {
        return this.toast("当前页面未识别到 owner/repo");
      }

      this.state.mode = "repo";
      this.state.activeContext = {
        owner: cur.owner,
        repo: cur.repo,
        runId: ""
      };
      this.state.selectedRepoFullName = `${cur.owner}/${cur.repo}`;
      this.state.pagination.page = 1;
      this.updateRepoSelectOptions();
      this.saveStore();
      this.updateUI();
      void this.refreshData(false);
    },

    switchToAccount() {
      this.state.mode = "account";
      this.state.activeContext = {
        owner: "",
        repo: "",
        runId: ""
      };
      this.state.pagination.page = 1;

      if (!this.state.repos.length) {
        void this.loadReposIndex(true);
      } else {
        this.updateRepoSelectOptions();
      }

      this.saveStore();
      this.updateUI();
      void this.refreshData(false);
    },

    switchToSelectedRepo() {
      const full = String(this.refs.repoSelect?.value || this.state.selectedRepoFullName || "").trim();
      if (!full || !full.includes("/")) {
        return this.toast("请先选择仓库");
      }

      const [owner, repo] = full.split("/").map(s => s.trim()).filter(Boolean);
      if (!owner || !repo) {
        return this.toast("仓库格式无效");
      }

      this.state.selectedRepoFullName = full;
      this.state.mode = "repo";
      this.state.activeContext = { owner, repo, runId: "" };
      this.state.pagination.page = 1;
      this.saveStore();
      this.updateUI();
      void this.refreshData(false);
    },

    async refreshData(forceRefreshRepo = false) {
      this.state.loading = true;
      this.state.lastError = "";
      this.updateUI();

      try {
        if (this.state.mode === "run") {
          await this.loadRunArtifacts();
        } else if (this.state.mode === "repo") {
          await this.loadRepoArtifacts(forceRefreshRepo);
        } else {
          await this.loadAccountArtifacts();
        }
      } catch (err) {
        this.state.lastError = err.message || String(err);
        this.toast(`加载失败\n${this.state.lastError}`);
      } finally {
        this.state.loading = false;
        this.updateUI();
      }
    },

    async loadRunArtifacts() {
      const ctx = this.state.activeContext;
      if (!(ctx.owner && ctx.repo && ctx.runId)) throw new Error("缺少 run 上下文");

      const data = await this.fetchJSON("/api/run-artifacts", {
        owner: ctx.owner,
        repo: ctx.repo,
        run_id: ctx.runId
      });

      this.state.items = Array.isArray(data.items) ? data.items : [];
      this.state.pagination.totalCount = this.state.items.length;
      this.state.pagination.totalPages = 1;
      this.state.pagination.page = 1;
      this.cleanupSelection();
    },

    async loadRepoArtifacts(forceRefreshRepo = false) {
      const ctx = this.state.activeContext;
      if (!(ctx.owner && ctx.repo)) throw new Error("缺少 repo 上下文");

      const data = await this.fetchJSON("/api/repo-artifacts", {
        owner: ctx.owner,
        repo: ctx.repo,
        page: this.state.pagination.page,
        per_page: this.state.pagination.perPage,
        query: this.state.filters.query,
        include_expired: this.state.filters.includeExpired ? 1 : 0,
        sort: this.state.filters.sort,
        order: this.state.filters.order,
        refresh: forceRefreshRepo ? 1 : 0
      });

      this.state.items = Array.isArray(data.items) ? data.items : [];
      this.state.pagination.totalCount = Number(data.total_count || 0);
      this.state.pagination.totalPages = Number(data.total_pages || 1);
      this.cleanupSelection();
    },

    async loadAccountArtifacts() {
      const data = await this.fetchJSON("/api/account-artifacts", {
        page: this.state.pagination.page,
        per_page: this.state.pagination.perPage,
        query: this.state.filters.query,
        include_expired: this.state.filters.includeExpired ? 1 : 0,
        sort: this.state.filters.sort,
        order: this.state.filters.order
      });

      this.state.items = Array.isArray(data.items) ? data.items : [];
      this.state.pagination.totalCount = Number(data.total_count || 0);
      this.state.pagination.totalPages = Number(data.total_pages || 1);
      this.cleanupSelection();
    },

    async syncCurrentRepo() {
      const ctx = this.state.activeContext;
      if (!(ctx.owner && ctx.repo)) {
        return this.toast("当前模式不是仓库模式");
      }

      try {
        const data = await this.fetchJSON("/api/sync/repo", {
          owner: ctx.owner,
          repo: ctx.repo
        }, { method: "POST" });

        this.toast(`已启动仓库同步\n${ctx.owner}/${ctx.repo}\nJob: ${data.job_id}`);
        this.startSyncPolling();
      } catch (err) {
        this.toast(`启动仓库同步失败\n${err.message || err}`);
      }
    },

    async syncAccount() {
      try {
        const data = await this.fetchJSON("/api/sync/account", {}, { method: "POST" });
        this.toast(`已启动全账户同步\nJob: ${data.job_id}`);
        this.startSyncPolling();
      } catch (err) {
        this.toast(`启动全账户同步失败\n${err.message || err}`);
      }
    },

    prevPage() {
      if (this.state.mode === "run") return;
      if (this.state.pagination.page <= 1) return;

      this.state.pagination.page -= 1;
      this.updateUI();
      void this.refreshData(false);
    },

    nextPage() {
      if (this.state.mode === "run") return;
      if (this.state.pagination.page >= this.state.pagination.totalPages) return;

      this.state.pagination.page += 1;
      this.updateUI();
      void this.refreshData(false);
    },

    cleanupSelection() {
      const valid = new Set(this.state.items.map(item => String(item.artifact_id)));
      const next = new Set();
      for (const id of this.state.selectedIds) {
        if (valid.has(id)) next.add(id);
      }
      this.state.selectedIds = next;
    },

    setSelected(id, checked) {
      const sid = String(id || "");
      if (!sid) return;
      if (checked) this.state.selectedIds.add(sid);
      else this.state.selectedIds.delete(sid);
      this.updateUI();
    },

    clearSelection() {
      this.state.selectedIds.clear();
      this.updateUI();
      this.toast("已清空选择");
    },

    getSelectedItems() {
      return this.state.items.filter(item => this.state.selectedIds.has(String(item.artifact_id)));
    },

    getItemById(id) {
      return this.state.items.find(item => String(item.artifact_id) === String(id)) || null;
    },

    async copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }

      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:0;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    },

    exportCurrentTXT(items = this.state.items) {
      return items.map(item => item.cf_download_url).join("\n");
    },

    exportCurrentJSON(items = this.state.items) {
      return JSON.stringify({
        metadata: {
          tool: this.name,
          version: this.version,
          exportedAt: new Date().toISOString(),
          mode: this.state.mode,
          count: items.length,
          source: this.state.currentContext.sourceUrl
        },
        items
      }, null, 2);
    },

    async copyCurrentLinks() {
      if (!this.state.items.length) return this.toast("当前没有结果");
      try {
        await this.copyText(this.exportCurrentTXT(this.state.items));
        this.toast(`已复制当前页链接\n共 ${this.state.items.length} 条`);
      } catch (err) {
        this.toast(`复制失败\n${err.message || err}`);
      }
    },

    async copySelectedLinks() {
      const items = this.getSelectedItems();
      if (!items.length) return this.toast("未选择任何工件");
      try {
        await this.copyText(this.exportCurrentTXT(items));
        this.toast(`已复制选中链接\n共 ${items.length} 条`);
      } catch (err) {
        this.toast(`复制失败\n${err.message || err}`);
      }
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

    exportTXT() {
      if (!this.state.items.length) return this.toast("当前没有结果");
      this.downloadTextFile(
        `github_artifacts_overlay_${Date.now()}.txt`,
        this.exportCurrentTXT(this.state.items)
      );
      this.toast("已导出 TXT");
    },

    exportJSON() {
      if (!this.state.items.length) return this.toast("当前没有结果");
      this.downloadTextFile(
        `github_artifacts_overlay_${Date.now()}.json`,
        this.exportCurrentJSON(this.state.items),
        "application/json;charset=utf-8"
      );
      this.toast("已导出 JSON");
    },

    openDownload(url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    humanBytes(bytes) {
      const n = Number(bytes || 0);
      if (!n) return "0 B";
      const units = ["B", "KB", "MB", "GB", "TB"];
      let i = 0;
      let v = n;
      while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
      }
      return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(2)} ${units[i]}`;
    },

    formatDate(s) {
      if (!s) return "-";
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return s;
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    renderItems() {
      if (!this.refs.list) return;

      const list = this.state.items;
      this.refs.entriesMeta.textContent =
        `共 ${this.state.pagination.totalCount} 条 ｜ 当前页 ${list.length} 条 ｜ 已选 ${this.state.selectedIds.size} 条`;

      if (!list.length) {
        this.refs.list.innerHTML = `
          <div class="gato-empty">
            当前没有结果。
            <br>可尝试：
            <br>1. 点击“当前 Run / 当前仓库 / 全账户”
            <br>2. 点击“刷新”
            <br>3. 点击“全账户同步”
            <br>4. 在“全账户”模式下先加载仓库索引，再切换到所选仓库
          </div>
        `;
        return;
      }

      this.refs.list.innerHTML = list.map(item => {
        const id = String(item.artifact_id);
        const checked = this.state.selectedIds.has(id);
        const currentRepoClass = item.full_name === this.state.selectedRepoFullName ? "is-current" : "";

        return `
          <div class="gato-item ${checked ? "is-selected" : ""}">
            <div class="gato-item-head">
              <div class="gato-item-title">
                <label class="gato-pill">
                  <input type="checkbox" data-pick-id="${this.escapeHtml(id)}" ${checked ? "checked" : ""}>
                </label>
                <span class="gato-pill">${this.escapeHtml(item.name)}</span>
                <span class="gato-pill">#${this.escapeHtml(id)}</span>
                <span class="gato-pill repo ${currentRepoClass}">${this.escapeHtml(item.full_name || `${item.owner}/${item.repo}`)}</span>
                ${item.expired ? `<span class="gato-pill err">已过期</span>` : `<span class="gato-pill ok">正常</span>`}
              </div>
              <div class="gato-item-actions">
                <button class="gato-mini" data-action="download" data-id="${this.escapeHtml(id)}" type="button">下载</button>
                <button class="gato-mini" data-action="copy-link" data-id="${this.escapeHtml(id)}" type="button">复制链接</button>
                <button class="gato-mini" data-action="open-run" data-id="${this.escapeHtml(id)}" type="button">打开 Run</button>
              </div>
            </div>

            <div class="gato-item-body">
              <div class="gato-kv"><b>Run ID</b>${item.workflow_run?.id ? this.escapeHtml(String(item.workflow_run.id)) : "-"}</div>
              <div class="gato-kv"><b>大小</b>${this.escapeHtml(this.humanBytes(item.size_in_bytes))}</div>
              <div class="gato-kv"><b>创建时间</b>${this.escapeHtml(this.formatDate(item.created_at))}</div>
              <div class="gato-kv"><b>过期时间</b>${this.escapeHtml(this.formatDate(item.expires_at))}</div>
              <div class="gato-urlbox">${this.escapeHtml(item.cf_download_url)}</div>
            </div>
          </div>
        `;
      }).join("");
    },

    buildUI() {
      const old = document.getElementById(HOST_ID);
      if (old) old.remove();

      const host = document.createElement("div");
      host.id = HOST_ID;
      host.style.cssText = "all: initial;";
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: "open" });

      shadow.innerHTML = `
        <style>
          .gato-wrap{
            position:fixed;left:0;top:0;z-index:2147483646;
            font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            color:#111827;
          }
          .gato-wrap.is-dragging .gato-titlebar{cursor:grabbing;}
          .gato-fab{
            display:inline-flex;align-items:center;justify-content:center;
            border:none;border-radius:999px;background:#111827;color:#fff;
            padding:10px 14px;font-size:13px;font-weight:900;cursor:pointer;
            box-shadow:0 8px 24px rgba(0,0,0,.25);
          }
          .gato-fab.hidden{display:none;}
          .gato-panel{
            width:min(640px,94vw);
            max-height:min(84vh,calc(100vh - 12px));
            display:flex;flex-direction:column;
            background:rgba(255,255,255,.98);
            border:1px solid rgba(0,0,0,.08);
            border-radius:16px;
            box-shadow:0 12px 36px rgba(0,0,0,.22);
            overflow:hidden;
            backdrop-filter:blur(8px);
          }
          .gato-panel.hidden{display:none;}
          .gato-panel.is-collapsed .gato-body{display:none;}
          .gato-titlebar{
            display:flex;justify-content:space-between;gap:12px;
            padding:10px 12px;background:linear-gradient(180deg,#f9fafb,#f3f4f6);
            border-bottom:1px solid rgba(0,0,0,.06);
            cursor:grab;user-select:none;touch-action:none;
          }
          .gato-titlebox{min-width:0;flex:1;}
          .gato-title{font-size:14px;font-weight:900;line-height:1.25;}
          .gato-version{font-size:12px;color:#6b7280;margin-top:2px;}
          .gato-title-summary{
            margin-top:4px;font-size:11px;line-height:1.45;color:#4b5563;
            white-space:pre-wrap;word-break:break-word;
          }
          .gato-head-actions{display:flex;gap:6px;align-items:center;}
          .gato-head-btn{
            width:30px;height:30px;border:none;border-radius:999px;
            background:#e5e7eb;color:#111827;font-size:14px;font-weight:900;cursor:pointer;
          }
          .gato-body{
            padding:12px;overflow:auto;
            max-height:calc(min(84vh,calc(100vh - 12px)) - 74px);
          }
          .gato-status,.gato-substatus{
            font-size:12px;line-height:1.55;white-space:pre-wrap;margin-bottom:6px;
          }
          .gato-status{font-weight:900;}
          .gato-substatus{color:#4b5563;}
          .gato-section{
            display:flex;justify-content:space-between;gap:8px;align-items:center;
            margin:10px 0 6px;font-size:12px;font-weight:900;
          }
          .gato-section-meta{font-size:11px;color:#6b7280;font-weight:700;}
          .gato-form-grid,.gato-grid{
            display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 12px;
          }
          .gato-form-grid{margin-bottom:12px;}
          .gato-field{display:flex;flex-direction:column;gap:4px;}
          .gato-field label{font-size:11px;color:#4b5563;font-weight:900;}
          .gato-field input,.gato-field select{
            width:100%;box-sizing:border-box;
            border:1px solid #d1d5db;border-radius:10px;background:#fff;color:#111827;
            padding:8px 10px;font-size:12px;
          }
          .gato-check{
            display:flex;align-items:center;gap:6px;font-size:12px;color:#374151;margin-top:22px;
          }
          .gato-grid{margin:10px 0 12px;}
          .gato-btn{
            border:none;border-radius:10px;background:#111827;color:#fff;
            padding:10px 12px;font-size:12px;font-weight:900;cursor:pointer;
          }
          .gato-btn.secondary{background:#f3f4f6;color:#111827;}
          .gato-btn.warn{background:#b91c1c;color:#fff;}
          .gato-btn:disabled{opacity:.5;cursor:default;}
          .gato-info{
            border:1px solid #e5e7eb;background:#f9fafb;border-radius:10px;
            padding:10px;font-size:12px;line-height:1.6;color:#374151;white-space:pre-wrap;
            word-break:break-word;margin-bottom:10px;
          }
          .gato-list{display:flex;flex-direction:column;gap:8px;}
          .gato-item{
            border:1px solid #e5e7eb;border-radius:12px;background:#fff;padding:8px;
          }
          .gato-item.is-selected{
            border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.10);
          }
          .gato-item-head{
            display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px;
          }
          .gato-item-title{
            display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;font-weight:900;
          }
          .gato-pill{
            display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;
            background:#e5e7eb;color:#111827;font-size:11px;font-weight:900;
          }
          .gato-pill.ok{background:#dcfce7;color:#166534;}
          .gato-pill.err{background:#fee2e2;color:#991b1b;}
          .gato-pill.repo{background:#dbeafe;color:#1d4ed8;}
          .gato-pill.repo.is-current{box-shadow:0 0 0 2px rgba(37,99,235,.20);}
          .gato-item-actions{
            display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;
          }
          .gato-mini{
            border:none;border-radius:8px;background:#f3f4f6;color:#111827;
            padding:4px 7px;font-size:11px;font-weight:900;cursor:pointer;
          }
          .gato-item-body{
            display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;
          }
          .gato-kv{
            border:1px solid #e5e7eb;background:#f9fafb;border-radius:10px;
            padding:8px 10px;font-size:12px;color:#374151;
          }
          .gato-kv b{
            display:block;font-size:11px;color:#6b7280;margin-bottom:4px;
          }
          .gato-urlbox{
            grid-column:1/-1;border:1px solid #e5e7eb;background:#fafafa;border-radius:10px;
            padding:8px 10px;font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;color:#374151;
            white-space:pre-wrap;word-break:break-all;
          }
          .gato-empty{
            border:1px dashed #d1d5db;border-radius:12px;padding:12px;background:#f9fafb;
            color:#6b7280;font-size:12px;line-height:1.7;
          }
          .gato-note{
            margin-top:8px;font-size:11px;color:#6b7280;line-height:1.55;
          }
        </style>

        <div class="gato-wrap">
          <button class="gato-fab">工件</button>

          <section class="gato-panel">
            <div class="gato-titlebar">
              <div class="gato-titlebox">
                <div class="gato-title">${this.name}</div>
                <div class="gato-version">${this.version}</div>
                <div class="gato-title-summary"></div>
              </div>
              <div class="gato-head-actions">
                <button class="gato-head-btn" data-action="open-full" title="打开完整面板">↗</button>
                <button class="gato-head-btn" data-action="reset-pos" title="重置位置">↺</button>
                <button class="gato-head-btn" data-action="close" title="隐藏">×</button>
              </div>
            </div>

            <div class="gato-body">
              <div class="gato-status"></div>
              <div class="gato-substatus"></div>

              <div class="gato-section">
                <span>当前网页上下文</span>
                <span class="gato-section-meta">非 GitHub 页面也可用</span>
              </div>
              <div class="gato-info" data-role="context-info"></div>

              <div class="gato-section">
                <span>模式与仓库</span>
                <span class="gato-section-meta">轻量悬浮版</span>
              </div>

              <div class="gato-form-grid">
                <div class="gato-field" style="grid-column:1/-1;">
                  <label>Worker Base URL</label>
                  <input type="text" data-role="worker-base" placeholder="https://xiazai.yswwsy.workers.dev">
                </div>

                <div class="gato-field" style="grid-column:1/-1;">
                  <label>仓库下拉菜单</label>
                  <select data-role="repo-select">
                    <option value="">（暂无仓库）</option>
                  </select>
                </div>

                <div class="gato-field">
                  <label>搜索 artifact 名称</label>
                  <input type="text" data-role="query" placeholder="例如 downloaded-videos">
                </div>

                <div class="gato-field">
                  <label>排序字段</label>
                  <select data-role="sort">
                    <option value="created_at">created_at</option>
                    <option value="expires_at">expires_at</option>
                    <option value="size_in_bytes">size_in_bytes</option>
                    <option value="name">name</option>
                    <option value="artifact_id">artifact_id</option>
                    <option value="full_name">full_name</option>
                  </select>
                </div>

                <div class="gato-field">
                  <label>排序方向</label>
                  <select data-role="order">
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                  </select>
                </div>

                <div class="gato-field">
                  <label>每页数量</label>
                  <select data-role="per-page">
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>

                <label class="gato-check">
                  <input type="checkbox" data-role="include-expired">
                  包含过期工件
                </label>
              </div>

              <div class="gato-grid">
                <button class="gato-btn secondary" data-action="save-worker" type="button">保存 Worker</button>
                <button class="gato-btn secondary" data-action="ping" type="button">检测 Worker</button>
                <button class="gato-btn secondary" data-action="load-repos" type="button">加载仓库索引</button>
                <button class="gato-btn" data-action="use-run" type="button">当前 Run</button>
                <button class="gato-btn" data-action="use-repo" type="button">当前仓库</button>
                <button class="gato-btn" data-action="use-account" type="button">全账户</button>
                <button class="gato-btn secondary" data-action="use-selected-repo" type="button">切换到所选仓库</button>
                <button class="gato-btn secondary" data-action="refresh" type="button">刷新</button>
                <button class="gato-btn secondary" data-action="sync-repo" type="button">同步当前仓库</button>
                <button class="gato-btn warn" data-action="sync-account" type="button">全账户同步</button>
                <button class="gato-btn secondary" data-action="copy-current" type="button">复制当前页链接</button>
                <button class="gato-btn secondary" data-action="copy-selected" type="button">复制选中链接</button>
                <button class="gato-btn secondary" data-action="export-txt" type="button">导出 TXT</button>
                <button class="gato-btn secondary" data-action="export-json" type="button">导出 JSON</button>
                <button class="gato-btn warn" data-action="clear-selection" type="button">清空选择</button>
              </div>

              <div class="gato-section">
                <span>结果列表</span>
                <span class="gato-section-meta" data-role="entries-meta"></span>
              </div>

              <div class="gato-info" data-role="page-info"></div>

              <div class="gato-grid">
                <button class="gato-btn secondary" data-action="prev-page" type="button">上一页</button>
                <button class="gato-btn secondary" data-action="next-page" type="button">下一页</button>
              </div>

              <div class="gato-list" data-role="list"></div>

              <div class="gato-note">
                说明：GitHub 页面建议使用完整 HTML 面板；其它网站优先使用本悬浮版。
                若目标站点拦截脚本，可自动回退打开完整面板页。
              </div>
            </div>
          </section>
        </div>
      `;

      this.refs.host = host;
      this.refs.shadow = shadow;
      this.refs.wrap = shadow.querySelector(".gato-wrap");
      this.refs.panel = shadow.querySelector(".gato-panel");
      this.refs.fab = shadow.querySelector(".gato-fab");
      this.refs.titlebar = shadow.querySelector(".gato-titlebar");
      this.refs.titleSummary = shadow.querySelector(".gato-title-summary");
      this.refs.status = shadow.querySelector(".gato-status");
      this.refs.substatus = shadow.querySelector(".gato-substatus");
      this.refs.contextInfo = shadow.querySelector('[data-role="context-info"]');
      this.refs.workerBase = shadow.querySelector('[data-role="worker-base"]');
      this.refs.repoSelect = shadow.querySelector('[data-role="repo-select"]');
      this.refs.query = shadow.querySelector('[data-role="query"]');
      this.refs.sort = shadow.querySelector('[data-role="sort"]');
      this.refs.order = shadow.querySelector('[data-role="order"]');
      this.refs.perPage = shadow.querySelector('[data-role="per-page"]');
      this.refs.includeExpired = shadow.querySelector('[data-role="include-expired"]');
      this.refs.entriesMeta = shadow.querySelector('[data-role="entries-meta"]');
      this.refs.pageInfo = shadow.querySelector('[data-role="page-info"]');
      this.refs.list = shadow.querySelector('[data-role="list"]');

      this.refs.workerBase.value = this.state.workerBase;
      this.refs.query.value = this.state.filters.query;
      this.refs.sort.value = this.state.filters.sort;
      this.refs.order.value = this.state.filters.order;
      this.refs.perPage.value = String(this.state.pagination.perPage);
      this.refs.includeExpired.checked = this.state.filters.includeExpired;

      this.refs.fab.addEventListener("click", () => this.openPanel());

      shadow.querySelector('[data-action="close"]').addEventListener("click", () => this.closePanel());
      shadow.querySelector('[data-action="reset-pos"]').addEventListener("click", (e) => {
        e.stopPropagation();
        this.resetPosition();
      });
      shadow.querySelector('[data-action="open-full"]').addEventListener("click", (e) => {
        e.stopPropagation();
        this.openFullPanel();
      });

      shadow.querySelector('[data-action="save-worker"]').addEventListener("click", async () => {
        try {
          this.state.workerBase = this.normalizeWorkerBase(this.refs.workerBase.value);
          this.saveStore();
          this.updateUI();
          const ok = await this.pingWorker();
          this.toast(ok ? "Worker 地址已保存" : "Worker 检测失败");
        } catch (err) {
          this.toast(`Worker 地址无效\n${err.message || err}`);
        }
      });

      shadow.querySelector('[data-action="ping"]').addEventListener("click", async () => {
        const ok = await this.pingWorker();
        this.toast(ok ? "Worker 联通成功" : "Worker 联通失败");
      });

      shadow.querySelector('[data-action="load-repos"]').addEventListener("click", () => void this.loadReposIndex(false));
      shadow.querySelector('[data-action="use-run"]').addEventListener("click", () => this.switchToCurrentRun());
      shadow.querySelector('[data-action="use-repo"]').addEventListener("click", () => this.switchToCurrentRepo());
      shadow.querySelector('[data-action="use-account"]').addEventListener("click", () => this.switchToAccount());
      shadow.querySelector('[data-action="use-selected-repo"]').addEventListener("click", () => this.switchToSelectedRepo());
      shadow.querySelector('[data-action="refresh"]').addEventListener("click", () => void this.refreshData(false));
      shadow.querySelector('[data-action="sync-repo"]').addEventListener("click", () => void this.syncCurrentRepo());
      shadow.querySelector('[data-action="sync-account"]').addEventListener("click", () => void this.syncAccount());
      shadow.querySelector('[data-action="copy-current"]').addEventListener("click", () => void this.copyCurrentLinks());
      shadow.querySelector('[data-action="copy-selected"]').addEventListener("click", () => void this.copySelectedLinks());
      shadow.querySelector('[data-action="export-txt"]').addEventListener("click", () => this.exportTXT());
      shadow.querySelector('[data-action="export-json"]').addEventListener("click", () => this.exportJSON());
      shadow.querySelector('[data-action="clear-selection"]').addEventListener("click", () => this.clearSelection());
      shadow.querySelector('[data-action="prev-page"]').addEventListener("click", () => this.prevPage());
      shadow.querySelector('[data-action="next-page"]').addEventListener("click", () => this.nextPage());

      this.refs.query.addEventListener("change", () => {
        this.state.filters.query = this.refs.query.value.trim();
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.query.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.state.filters.query = this.refs.query.value.trim();
          this.state.pagination.page = 1;
          this.saveStore();
          void this.refreshData(false);
        }
      });

      this.refs.sort.addEventListener("change", () => {
        this.state.filters.sort = this.refs.sort.value;
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.order.addEventListener("change", () => {
        this.state.filters.order = this.refs.order.value;
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.perPage.addEventListener("change", () => {
        this.state.pagination.perPage = Number(this.refs.perPage.value) || 20;
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.includeExpired.addEventListener("change", () => {
        this.state.filters.includeExpired = !!this.refs.includeExpired.checked;
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.repoSelect.addEventListener("change", () => {
        this.state.selectedRepoFullName = this.refs.repoSelect.value || "";
        this.saveStore();
        this.updateUI();
      });

      this.refs.list.addEventListener("change", (e) => {
        const input = e.target.closest("input[data-pick-id]");
        if (!input) return;
        this.setSelected(input.getAttribute("data-pick-id"), !!input.checked);
      });

      this.refs.list.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        const item = this.getItemById(id);
        if (!item) return;

        if (action === "download") {
          this.openDownload(item.cf_download_url);
          return;
        }

        if (action === "copy-link") {
          try {
            await this.copyText(item.cf_download_url);
            this.toast(`已复制链接\n${item.name}`);
          } catch (err) {
            this.toast(`复制失败\n${err.message || err}`);
          }
          return;
        }

        if (action === "open-run") {
          if (!item.github_run_url) return this.toast("该项没有 run 链接");
          window.open(item.github_run_url, "_blank", "noopener,noreferrer");
        }
      });

      this.refs.titlebar.addEventListener("pointerdown", (e) => this.onTitlebarPointerDown(e));
      this.refs.titlebar.addEventListener("pointermove", (e) => this.onTitlebarPointerMove(e));
      this.refs.titlebar.addEventListener("pointerup", (e) => this.onTitlebarPointerUp(e));
      this.refs.titlebar.addEventListener("pointercancel", (e) => this.onTitlebarPointerCancel(e));

      this.state.uiReady = true;
      this.updateRepoSelectOptions();
      this.applyFloatingLayout({ save: false });
    },

    installResizeHandler() {
      if (this.boundResize) {
        window.removeEventListener("resize", this.boundResize, false);
      }
      this.boundResize = () => this.applyFloatingLayout({ save: true });
      window.addEventListener("resize", this.boundResize, false);
    },

    getPreferredWidth() {
      return Math.min(640, Math.max(320, Math.floor(window.innerWidth * 0.94)));
    },

    getVisibleEl() {
      return this.state.panelOpen ? this.refs.panel : this.refs.fab;
    },

    applyFloatingLayout({ reset = false, save = false } = {}) {
      if (!this.state.uiReady) return;

      cancelAnimationFrame(this.layoutRaf);
      this.layoutRaf = requestAnimationFrame(() => {
        const wrap = this.refs.wrap;
        const panel = this.refs.panel;
        const fab = this.refs.fab;
        if (!wrap || !panel || !fab) return;

        panel.style.width = `${this.getPreferredWidth()}px`;

        const el = this.getVisibleEl();
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const width = rect.width || (this.state.panelOpen ? this.getPreferredWidth() : 96);
        const height = rect.height || 48;

        let x = Number.isFinite(this.state.ui.x) ? this.state.ui.x : null;
        let y = Number.isFinite(this.state.ui.y) ? this.state.ui.y : null;

        if (reset || x === null || y === null) {
          x = Math.max(8, window.innerWidth - width - 12);
          y = 72;
        }

        const minX = 6;
        const minY = 6;
        const maxX = Math.max(minX, window.innerWidth - width - 6);
        const maxY = Math.max(minY, window.innerHeight - height - 6);

        x = Math.min(Math.max(minX, x), maxX);
        y = Math.min(Math.max(minY, y), maxY);

        const changed = x !== this.state.ui.x || y !== this.state.ui.y;
        this.state.ui.x = x;
        this.state.ui.y = y;

        wrap.style.left = `${x}px`;
        wrap.style.top = `${y}px`;

        if (save && changed) this.saveStore();
      });
    },

    resetPosition() {
      this.state.ui.x = null;
      this.state.ui.y = null;
      this.applyFloatingLayout({ reset: true, save: true });
      this.toast("已重置位置");
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
      if (typeof force === "boolean") this.state.panelOpen = force;
      else this.state.panelOpen = !this.state.panelOpen;
      this.updateUI();
      return this.state.panelOpen;
    },

    toggleCollapse(force) {
      if (typeof force === "boolean") this.state.ui.collapsed = force;
      else this.state.ui.collapsed = !this.state.ui.collapsed;
      this.saveStore();
      this.updateUI();
      return this.state.ui.collapsed;
    },

    resetTitleTapState() {
      clearTimeout(this._titleTapTimer);
      this.titleTapState = { lastTapAt: 0, lastTapX: 0, lastTapY: 0 };
    },

    handleTitleTap(e) {
      if (e.target.closest("button")) return false;

      const now = Date.now();
      const prev = this.titleTapState;
      const dt = now - prev.lastTapAt;
      const dx = e.clientX - prev.lastTapX;
      const dy = e.clientY - prev.lastTapY;
      const distance = Math.hypot(dx, dy);

      const isDoubleTap = prev.lastTapAt > 0 && dt <= 360 && distance <= 24;
      if (isDoubleTap) {
        this.resetTitleTapState();
        this.toggleCollapse();
        return true;
      }

      this.titleTapState = {
        lastTapAt: now,
        lastTapX: e.clientX,
        lastTapY: e.clientY
      };

      clearTimeout(this._titleTapTimer);
      this._titleTapTimer = setTimeout(() => this.resetTitleTapState(), 420);
      return false;
    },

    onTitlebarPointerDown(e) {
      if (!this.state.panelOpen) return;
      if (e.target.closest("button")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      this.dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: Number.isFinite(this.state.ui.x) ? this.state.ui.x : 0,
        originY: Number.isFinite(this.state.ui.y) ? this.state.ui.y : 0,
        moved: false
      };

      try {
        this.refs.titlebar.setPointerCapture(e.pointerId);
      } catch {}
    },

    onTitlebarPointerMove(e) {
      if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;

      const wrap = this.refs.wrap;
      const el = this.getVisibleEl();
      if (!wrap || !el) return;

      const dx = e.clientX - this.dragState.startX;
      const dy = e.clientY - this.dragState.startY;
      const moveDistance = Math.hypot(dx, dy);

      if (!this.dragState.moved) {
        if (moveDistance < 8) return;
        this.dragState.moved = true;
        this.resetTitleTapState();
        wrap.classList.add("is-dragging");
      }

      const rect = el.getBoundingClientRect();
      const width = rect.width || this.getPreferredWidth();
      const height = rect.height || 48;

      const minX = 6;
      const minY = 6;
      const maxX = Math.max(minX, window.innerWidth - width - 6);
      const maxY = Math.max(minY, window.innerHeight - height - 6);

      const nextX = Math.min(Math.max(minX, this.dragState.originX + dx), maxX);
      const nextY = Math.min(Math.max(minY, this.dragState.originY + dy), maxY);

      this.state.ui.x = nextX;
      this.state.ui.y = nextY;

      wrap.style.left = `${nextX}px`;
      wrap.style.top = `${nextY}px`;

      e.preventDefault();
    },

    onTitlebarPointerUp(e) {
      if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;

      const dragState = this.dragState;
      const wrap = this.refs.wrap;
      if (wrap) wrap.classList.remove("is-dragging");

      try {
        if (this.refs.titlebar.hasPointerCapture(e.pointerId)) {
          this.refs.titlebar.releasePointerCapture(e.pointerId);
        }
      } catch {}

      this.dragState = null;

      if (dragState.moved) {
        this.saveStore();
        return;
      }

      this.handleTitleTap(e);
    },

    onTitlebarPointerCancel(e) {
      if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;

      const wrap = this.refs.wrap;
      if (wrap) wrap.classList.remove("is-dragging");

      try {
        if (this.refs.titlebar.hasPointerCapture(e.pointerId)) {
          this.refs.titlebar.releasePointerCapture(e.pointerId);
        }
      } catch {}

      this.dragState = null;
      this.resetTitleTapState();
    },

    openFullPanel() {
      try {
        const base = this.normalizeBaseUrl(this.state.panelPage);
        const isGitHubPage = GITHUB_HOST_RE.test(location.hostname);
        const target = isGitHubPage
          ? `${base}?source=${encodeURIComponent(location.href)}`
          : base;
        window.open(target, "_blank", "noopener,noreferrer");
      } catch (err) {
        this.toast(`打开完整面板失败\n${err.message || err}`);
      }
    }
  };

  app.init();
})();
