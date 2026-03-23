(() => {
  const SCRIPT_NAME = "GitHub Artifact Turbo Panel";
  const SCRIPT_VERSION = "v1.0.0";
  const GLOBAL_KEY = "__githubArtifactTurboPanelApp__";
  const HOST_ID = "__github_artifact_turbo_panel_host__";
  const TOAST_ID = "__github_artifact_turbo_panel_toast__";
  const STORAGE_KEY = "__githubArtifactTurboPanelStore__";
  const DEFAULT_WORKER_BASE = "https://xiazai.yswwsy.workers.dev";

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
      installed: false,
      uiReady: false,
      loading: false,

      workerBase: DEFAULT_WORKER_BASE,
      workerAlive: false,

      mode: "account", // run | repo | account
      items: [],
      repos: [],
      selectedIds: new Set(),

      pagination: {
        page: 1,
        perPage: 50,
        totalCount: 0,
        totalPages: 1
      },

      filters: {
        query: "",
        includeExpired: false,
        sort: "created_at",
        order: "desc"
      },

      currentContext: {
        owner: "",
        repo: "",
        runId: ""
      },

      activeContext: {
        owner: "",
        repo: "",
        runId: ""
      },

      syncStatus: null,
      lastError: "",

      panelOpen: true,

      ui: {
        x: null,
        y: null,
        collapsed: false
      }
    },

    refs: {
      host: null,
      shadow: null,
      wrap: null,
      panel: null,
      fab: null,
      titlebar: null,
      titleSummary: null,

      status: null,
      substatus: null,

      inputWorkerBase: null,
      btnSaveWorker: null,
      btnPing: null,

      btnUseRun: null,
      btnUseRepo: null,
      btnUseAccount: null,
      btnUseRepoInput: null,
      btnRefresh: null,
      btnSyncRepo: null,
      btnSyncAccount: null,
      btnLoadRepos: null,

      inputRepoPicker: null,
      reposDatalist: null,

      inputQuery: null,
      checkboxExpired: null,
      selectSort: null,
      selectOrder: null,
      selectPerPage: null,

      btnPrevPage: null,
      btnNextPage: null,
      pageMeta: null,

      btnCopyCurrentLinks: null,
      btnCopySelectedLinks: null,
      btnExportTXT: null,
      btnExportJSON: null,
      btnClearSelection: null,

      entriesMeta: null,
      entriesList: null,

      btnResetPos: null,
      btnClose: null
    },

    boundResize: null,
    dragState: null,
    layoutRaf: 0,

    titlebarTapState: {
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
      void this.loadSyncStatus();
      void this.loadReposIndex(true);
      void this.refreshData(false);

      this.state.installed = true;
      window[GLOBAL_KEY] = {
        name: this.name,
        version: this.version,
        api: this
      };

      this.toast("已加载");
    },

    destroy() {
      if (this.boundResize) {
        window.removeEventListener("resize", this.boundResize, false);
      }

      clearTimeout(this._toastTimer);
      clearTimeout(this._titleTapTimer);
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
        "top:20px",
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

        if (data.filters && typeof data.filters === "object") {
          this.state.filters.query = String(data.filters.query || "");
          this.state.filters.includeExpired = !!data.filters.includeExpired;
          this.state.filters.sort = String(data.filters.sort || "created_at");
          this.state.filters.order = String(data.filters.order || "desc");
        }

        if (data.pagination && typeof data.pagination === "object") {
          this.state.pagination.perPage = Number(data.pagination.perPage) || 50;
        }

        if (data.activeContext && typeof data.activeContext === "object") {
          this.state.activeContext.owner = String(data.activeContext.owner || "");
          this.state.activeContext.repo = String(data.activeContext.repo || "");
          this.state.activeContext.runId = String(data.activeContext.runId || "");
        }

        if (data.ui && typeof data.ui === "object") {
          if (Number.isFinite(data.ui.x)) this.state.ui.x = data.ui.x;
          if (Number.isFinite(data.ui.y)) this.state.ui.y = data.ui.y;
          this.state.ui.collapsed = !!data.ui.collapsed;
        }
      } catch (err) {
        console.warn(`[${this.name} ${this.version}] loadStore failed`, err);
      }
    },

    saveStore() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          workerBase: this.state.workerBase,
          filters: { ...this.state.filters },
          pagination: {
            perPage: this.state.pagination.perPage
          },
          activeContext: { ...this.state.activeContext },
          ui: {
            x: this.state.ui.x,
            y: this.state.ui.y,
            collapsed: this.state.ui.collapsed
          }
        }));
      } catch (err) {
        console.warn(`[${this.name} ${this.version}] saveStore failed`, err);
      }
    },

    parseCurrentContext() {
      const parts = location.pathname.split("/").filter(Boolean);
      let owner = "";
      let repo = "";
      let runId = "";

      if (parts.length >= 2) {
        owner = parts[0];
        repo = parts[1];
      }

      if (parts.length >= 5 && parts[2] === "actions" && parts[3] === "runs" && /^\d+$/.test(parts[4])) {
        runId = parts[4];
      }

      this.state.currentContext = { owner, repo, runId };
    },

    bootstrapModeFromContext() {
      const cur = this.state.currentContext;

      if (cur.owner && cur.repo && cur.runId) {
        this.state.mode = "run";
        this.state.activeContext = { ...cur };
        return;
      }

      if (cur.owner && cur.repo) {
        this.state.mode = "repo";
        this.state.activeContext.owner = cur.owner;
        this.state.activeContext.repo = cur.repo;
        this.state.activeContext.runId = "";
        return;
      }

      if (this.state.activeContext.owner && this.state.activeContext.repo) {
        this.state.mode = this.state.activeContext.runId ? "run" : "repo";
        return;
      }

      this.state.mode = "account";
      this.state.activeContext = {
        owner: "",
        repo: "",
        runId: ""
      };
    },

    normalizeWorkerBase(value) {
      const raw = String(value || "").trim();
      if (!raw) throw new Error("Worker 地址不能为空");
      const u = new URL(raw);
      return u.origin.replace(/\/+$/, "");
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
      const url = this.apiUrl(path, params);
      const res = await fetch(url, {
        method: init.method || "GET",
        headers: {
          "content-type": "application/json",
          ...(init.headers || {})
        },
        body: init.body,
        credentials: "omit"
      });

      const text = await res.text();
      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok || (data && data.ok === false)) {
        throw new Error(
          data?.error ||
          `请求失败：${res.status}${text ? ` ｜ ${text.slice(0, 200)}` : ""}`
        );
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
        this.state.lastError = err.message || "Ping 失败";
        this.updateUI();
        return false;
      }
    },

    async loadSyncStatus() {
      try {
        const data = await this.fetchJSON("/api/sync/status");
        this.state.syncStatus = data;
        this.updateUI();
      } catch (err) {
        console.warn(`[${this.name}] loadSyncStatus failed`, err);
      }
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

        items.sort((a, b) => a.full_name.localeCompare(b.full_name));
        this.state.repos = items;
        this.renderRepoDatalist();
        this.updateUI();

        if (!silent) {
          this.toast(`已加载仓库索引\n共 ${items.length} 个仓库`);
        }
      } catch (err) {
        if (!silent) this.toast(`加载仓库索引失败\n${err.message || err}`);
      }
    },

    currentFullName() {
      const { owner, repo } = this.state.activeContext;
      return owner && repo ? `${owner}/${repo}` : "";
    },

    switchToCurrentRun() {
      const cur = this.state.currentContext;
      if (!(cur.owner && cur.repo && cur.runId)) {
        this.toast("当前页面不是 GitHub Actions run 页面");
        return;
      }

      this.state.mode = "run";
      this.state.activeContext = { ...cur };
      this.state.pagination.page = 1;
      this.saveStore();
      this.updateUI();
      void this.refreshData(false);
    },

    switchToCurrentRepo() {
      const cur = this.state.currentContext;
      if (!(cur.owner && cur.repo)) {
        this.toast("当前页面未识别到 owner/repo");
        return;
      }

      this.state.mode = "repo";
      this.state.activeContext = {
        owner: cur.owner,
        repo: cur.repo,
        runId: ""
      };
      this.state.pagination.page = 1;
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
      this.saveStore();
      this.updateUI();
      void this.refreshData(false);
    },

    switchToRepoInput() {
      const raw = String(this.refs.inputRepoPicker.value || "").trim();
      if (!raw || !raw.includes("/")) {
        this.toast("请输入 owner/repo");
        return;
      }
      const [owner, repo] = raw.split("/").map(s => s.trim()).filter(Boolean);
      if (!owner || !repo) {
        this.toast("仓库格式应为 owner/repo");
        return;
      }

      this.state.mode = "repo";
      this.state.activeContext = {
        owner,
        repo,
        runId: ""
      };
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
      if (!(ctx.owner && ctx.repo && ctx.runId)) {
        throw new Error("缺少 run 上下文");
      }

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
      if (!(ctx.owner && ctx.repo)) {
        throw new Error("缺少 repo 上下文");
      }

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
        this.toast("当前没有可同步的仓库");
        return;
      }

      try {
        const data = await this.fetchJSON("/api/sync/repo", {
          owner: ctx.owner,
          repo: ctx.repo
        }, { method: "POST" });

        this.toast(`已启动仓库同步\n${ctx.owner}/${ctx.repo}\nJob: ${data.job_id}`);
        setTimeout(() => void this.loadSyncStatus(), 1200);
      } catch (err) {
        this.toast(`启动仓库同步失败\n${err.message || err}`);
      }
    },

    async syncAccount() {
      try {
        const data = await this.fetchJSON("/api/sync/account", {}, { method: "POST" });
        this.toast(`已启动全账户同步\nJob: ${data.job_id}`);
        setTimeout(() => void this.loadSyncStatus(), 1200);
      } catch (err) {
        this.toast(`启动全账户同步失败\n${err.message || err}`);
      }
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
      if (!id) return;
      if (checked) this.state.selectedIds.add(String(id));
      else this.state.selectedIds.delete(String(id));
      this.updateUI();
    },

    clearSelection() {
      this.state.selectedIds.clear();
      this.updateUI();
      this.toast("已清空选择");
    },

    getSelectedItems() {
      const ids = this.state.selectedIds;
      return this.state.items.filter(item => ids.has(String(item.artifact_id)));
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
      if (!s) return "";
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

    async copyText(text, okMsg) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;left:-9999px;top:0;";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        if (okMsg) this.toast(okMsg);
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
          count: items.length
        },
        items
      }, null, 2);
    },

    async copyCurrentLinks() {
      if (!this.state.items.length) {
        this.toast("当前没有任何结果");
        return;
      }
      await this.copyText(
        this.exportCurrentTXT(this.state.items),
        `已复制当前页全部链接\n共 ${this.state.items.length} 条`
      );
    },

    async copySelectedLinks() {
      const items = this.getSelectedItems();
      if (!items.length) {
        this.toast("未选择任何工件");
        return;
      }
      await this.copyText(
        this.exportCurrentTXT(items),
        `已复制选中链接\n共 ${items.length} 条`
      );
    },

    exportTXT() {
      if (!this.state.items.length) {
        this.toast("当前没有任何结果");
        return;
      }
      const name = `github_artifacts_${Date.now()}.txt`;
      this.downloadTextFile(name, this.exportCurrentTXT(this.state.items));
      this.toast(`已导出 TXT\n${name}`);
    },

    exportJSON() {
      if (!this.state.items.length) {
        this.toast("当前没有任何结果");
        return;
      }
      const name = `github_artifacts_${Date.now()}.json`;
      this.downloadTextFile(name, this.exportCurrentJSON(this.state.items), "application/json;charset=utf-8");
      this.toast(`已导出 JSON\n${name}`);
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

    openRun(url) {
      if (!url) {
        this.toast("该工件没有 run 链接");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    },

    nextPage() {
      if (this.state.pagination.page >= this.state.pagination.totalPages) return;
      this.state.pagination.page += 1;
      this.updateUI();
      void this.refreshData(false);
    },

    prevPage() {
      if (this.state.pagination.page <= 1) return;
      this.state.pagination.page -= 1;
      this.updateUI();
      void this.refreshData(false);
    },

    renderRepoDatalist() {
      if (!this.refs.reposDatalist) return;
      this.refs.reposDatalist.innerHTML = this.state.repos
        .map(r => `<option value="${this.escapeHtml(r.full_name)}"></option>`)
        .join("");
    },

    renderItems() {
      const list = this.state.items;
      const entriesMeta = this.refs.entriesMeta;
      if (entriesMeta) {
        entriesMeta.textContent =
          `共 ${this.state.pagination.totalCount} 条 ｜ 当前页 ${list.length} 条 ｜ 已选 ${this.state.selectedIds.size} 条`;
      }

      if (!this.refs.entriesList) return;

      if (!list.length) {
        this.refs.entriesList.innerHTML = `
          <div class="gatp-empty">
            当前没有可显示的工件结果。你可以尝试：
            <br>1. 切换到当前 Run / 当前 Repo / 全账户模式
            <br>2. 点击“刷新”
            <br>3. 点击“全账户同步”后稍等再查
          </div>
        `;
        return;
      }

      const html = list.map(item => {
        const id = String(item.artifact_id);
        const checked = this.state.selectedIds.has(id);
        return `
          <div class="gatp-item ${checked ? "is-selected" : ""}">
            <div class="gatp-item-head">
              <div class="gatp-item-title">
                <label class="gatp-pick">
                  <input type="checkbox" data-pick-id="${this.escapeHtml(id)}" ${checked ? "checked" : ""}>
                </label>
                <span class="gatp-badge">${this.escapeHtml(item.name)}</span>
                <span class="gatp-meta-id">#${this.escapeHtml(id)}</span>
                ${item.expired ? `<span class="gatp-flag expired">已过期</span>` : `<span class="gatp-flag ok">正常</span>`}
              </div>
              <div class="gatp-item-actions">
                <button class="gatp-mini" data-action="download" data-id="${this.escapeHtml(id)}" type="button">下载</button>
                <button class="gatp-mini" data-action="copy-link" data-id="${this.escapeHtml(id)}" type="button">复制链接</button>
                <button class="gatp-mini" data-action="open-run" data-id="${this.escapeHtml(id)}" type="button">打开 Run</button>
              </div>
            </div>
            <div class="gatp-item-body">
              <div><strong>仓库：</strong>${this.escapeHtml(item.full_name || `${item.owner}/${item.repo}`)}</div>
              <div><strong>Run：</strong>${item.workflow_run?.id ? this.escapeHtml(String(item.workflow_run.id)) : "-"}</div>
              <div><strong>大小：</strong>${this.escapeHtml(this.humanBytes(item.size_in_bytes))}</div>
              <div><strong>创建：</strong>${this.escapeHtml(this.formatDate(item.created_at)) || "-"}</div>
              <div><strong>过期：</strong>${this.escapeHtml(this.formatDate(item.expires_at)) || "-"}</div>
              <div class="gatp-url">${this.escapeHtml(item.cf_download_url)}</div>
            </div>
          </div>
        `;
      }).join("");

      this.refs.entriesList.innerHTML = html;
    },

    getItemById(id) {
      return this.state.items.find(item => String(item.artifact_id) === String(id)) || null;
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
          .gatp-wrap{
            position:fixed;left:0;top:0;z-index:2147483646;
            font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            color:#111827;
          }
          .gatp-wrap.is-dragging .gatp-titlebar{cursor:grabbing;}
          .gatp-fab{
            display:inline-flex;align-items:center;justify-content:center;
            border:none;border-radius:999px;background:#111827;color:#fff;
            padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer;
            box-shadow:0 8px 24px rgba(0,0,0,.25);
          }
          .gatp-fab.hidden{display:none;}
          .gatp-panel{
            width:min(680px,94vw);
            max-height:min(84vh,calc(100vh - 12px));
            display:flex;flex-direction:column;
            background:rgba(255,255,255,.98);
            border:1px solid rgba(0,0,0,.08);
            border-radius:16px;overflow:hidden;
            box-shadow:0 12px 36px rgba(0,0,0,.22);
            backdrop-filter:blur(8px);
          }
          .gatp-panel.hidden{display:none;}
          .gatp-panel.is-collapsed .gatp-body{display:none;}
          .gatp-titlebar{
            display:flex;justify-content:space-between;gap:12px;
            padding:10px 12px;cursor:grab;user-select:none;touch-action:none;
            background:linear-gradient(180deg,#f9fafb,#f3f4f6);
            border-bottom:1px solid rgba(0,0,0,.06);
          }
          .gatp-titlebox{min-width:0;flex:1;}
          .gatp-title{font-size:14px;font-weight:800;line-height:1.25;}
          .gatp-version{font-size:12px;color:#6b7280;margin-top:2px;}
          .gatp-title-summary{
            margin-top:4px;font-size:11px;color:#4b5563;line-height:1.45;
            white-space:pre-wrap;word-break:break-word;
          }
          .gatp-head-actions{display:flex;align-items:center;gap:6px;}
          .gatp-head-btn{
            width:30px;height:30px;border:none;border-radius:999px;
            background:#e5e7eb;color:#111827;font-size:14px;font-weight:700;
            cursor:pointer;
          }
          .gatp-body{
            padding:12px;overflow:auto;
            max-height:calc(min(84vh,calc(100vh - 12px)) - 74px);
          }
          .gatp-status,.gatp-substatus{
            font-size:12px;line-height:1.55;white-space:pre-wrap;margin-bottom:6px;
          }
          .gatp-status{font-weight:700;}
          .gatp-substatus{color:#4b5563;}
          .gatp-grid{
            display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
            gap:8px;margin:10px 0 12px;
          }
          .gatp-btn{
            border:none;border-radius:10px;background:#111827;color:#fff;
            padding:10px 12px;font-size:12px;font-weight:700;cursor:pointer;
          }
          .gatp-btn.secondary{background:#f3f4f6;color:#111827;}
          .gatp-btn.warn{background:#b91c1c;color:#fff;}
          .gatp-form-grid{
            display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
            gap:8px 12px;margin-bottom:12px;
          }
          .gatp-field{display:flex;flex-direction:column;gap:4px;}
          .gatp-field label{font-size:11px;color:#4b5563;font-weight:700;}
          .gatp-field input,.gatp-field select{
            box-sizing:border-box;width:100%;
            border:1px solid #d1d5db;border-radius:10px;
            background:#fff;color:#111827;padding:8px 10px;font-size:12px;
          }
          .gatp-check{
            display:flex;align-items:center;gap:6px;
            font-size:12px;color:#374151;margin-top:22px;
          }
          .gatp-section{
            display:flex;align-items:center;justify-content:space-between;
            gap:8px;margin:10px 0 6px;font-size:12px;font-weight:800;
          }
          .gatp-section-meta{font-size:11px;color:#6b7280;font-weight:600;}
          .gatp-list{
            display:flex;flex-direction:column;gap:8px;
            max-height:320px;overflow:auto;
          }
          .gatp-item{
            border:1px solid #e5e7eb;border-radius:12px;
            background:#fff;padding:8px;
          }
          .gatp-item.is-selected{
            border-color:#2563eb;
            box-shadow:0 0 0 2px rgba(37,99,235,.10);
          }
          .gatp-item-head{
            display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;
          }
          .gatp-item-title{
            display:flex;flex-wrap:wrap;gap:6px;align-items:center;
            font-size:12px;font-weight:700;
          }
          .gatp-badge{
            padding:2px 8px;border-radius:999px;background:#e5e7eb;color:#111827;
          }
          .gatp-meta-id{color:#6b7280;}
          .gatp-flag{
            padding:2px 8px;border-radius:999px;font-size:11px;
          }
          .gatp-flag.ok{background:#dcfce7;color:#166534;}
          .gatp-flag.expired{background:#fee2e2;color:#991b1b;}
          .gatp-item-actions{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;}
          .gatp-mini{
            border:none;border-radius:8px;background:#f3f4f6;color:#111827;
            padding:4px 7px;font-size:11px;font-weight:700;cursor:pointer;
          }
          .gatp-item-body{
            font-size:12px;line-height:1.55;color:#374151;
          }
          .gatp-url{
            margin-top:6px;padding:6px 8px;border-radius:8px;
            background:#f9fafb;border:1px solid #e5e7eb;
            white-space:pre-wrap;word-break:break-all;
            font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
            font-size:11px;color:#374151;
          }
          .gatp-empty{
            border:1px dashed #d1d5db;border-radius:12px;padding:12px;
            background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.7;
          }
          .gatp-note{
            margin-top:8px;font-size:11px;color:#6b7280;line-height:1.55;
          }
        </style>

        <div class="gatp-wrap">
          <button class="gatp-fab">Artifacts</button>

          <section class="gatp-panel">
            <div class="gatp-titlebar">
              <div class="gatp-titlebox">
                <div class="gatp-title">${this.name}</div>
                <div class="gatp-version">${this.version}</div>
                <div class="gatp-title-summary"></div>
              </div>
              <div class="gatp-head-actions">
                <button class="gatp-head-btn" data-action="reset-pos" title="重置位置">↺</button>
                <button class="gatp-head-btn" data-action="close" title="隐藏">×</button>
              </div>
            </div>

            <div class="gatp-body">
              <div class="gatp-status"></div>
              <div class="gatp-substatus"></div>

              <div class="gatp-section">
                <span>Worker</span>
                <span class="gatp-section-meta">Cloudflare API 中间层</span>
              </div>

              <div class="gatp-form-grid">
                <div class="gatp-field" style="grid-column:1/-1;">
                  <label>Worker Base URL</label>
                  <input type="text" data-role="worker-base" placeholder="https://your-worker.workers.dev">
                </div>
              </div>

              <div class="gatp-grid">
                <button class="gatp-btn secondary" data-action="save-worker" type="button">保存 Worker 地址</button>
                <button class="gatp-btn secondary" data-action="ping" type="button">Ping Worker</button>
                <button class="gatp-btn secondary" data-action="load-repos" type="button">加载仓库索引</button>
              </div>

              <div class="gatp-section">
                <span>模式与上下文</span>
                <span class="gatp-section-meta">URL 自动识别 + 手动切换</span>
              </div>

              <div class="gatp-form-grid">
                <div class="gatp-field" style="grid-column:1/-1;">
                  <label>仓库选择器（owner/repo）</label>
                  <input type="text" data-role="repo-picker" list="gatp-repos-list" placeholder="owner/repo">
                  <datalist id="gatp-repos-list"></datalist>
                </div>
              </div>

              <div class="gatp-grid">
                <button class="gatp-btn" data-action="use-run" type="button">当前 Run</button>
                <button class="gatp-btn" data-action="use-repo" type="button">当前 Repo</button>
                <button class="gatp-btn" data-action="use-account" type="button">全账户</button>
                <button class="gatp-btn secondary" data-action="use-repo-input" type="button">使用仓库选择器</button>
                <button class="gatp-btn secondary" data-action="refresh" type="button">刷新当前模式</button>
                <button class="gatp-btn secondary" data-action="sync-repo" type="button">同步当前仓库</button>
                <button class="gatp-btn warn" data-action="sync-account" type="button">全账户同步</button>
              </div>

              <div class="gatp-section">
                <span>筛选与分页</span>
                <span class="gatp-section-meta">Repo / Account 模式有效</span>
              </div>

              <div class="gatp-form-grid">
                <div class="gatp-field">
                  <label>搜索 artifact 名称</label>
                  <input type="text" data-role="query" placeholder="例如 downloaded-videos">
                </div>

                <div class="gatp-field">
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

                <div class="gatp-field">
                  <label>排序方向</label>
                  <select data-role="order">
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                  </select>
                </div>

                <div class="gatp-field">
                  <label>每页数量</label>
                  <select data-role="per-page">
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </select>
                </div>

                <label class="gatp-check">
                  <input type="checkbox" data-role="include-expired">
                  包含过期工件
                </label>
              </div>

              <div class="gatp-grid">
                <button class="gatp-btn secondary" data-action="prev-page" type="button">上一页</button>
                <button class="gatp-btn secondary" data-action="next-page" type="button">下一页</button>
                <button class="gatp-btn secondary" data-action="copy-current" type="button">复制当前页链接</button>
                <button class="gatp-btn secondary" data-action="copy-selected" type="button">复制选中链接</button>
                <button class="gatp-btn secondary" data-action="export-txt" type="button">导出 TXT</button>
                <button class="gatp-btn secondary" data-action="export-json" type="button">导出 JSON</button>
                <button class="gatp-btn warn" data-action="clear-selection" type="button">清空选择</button>
              </div>

              <div class="gatp-section">
                <span>结果列表</span>
                <span class="gatp-section-meta" data-role="page-meta"></span>
              </div>

              <div class="gatp-section-meta" data-role="entries-meta" style="margin-bottom:8px;"></div>
              <div class="gatp-list"></div>

              <div class="gatp-note">
                说明：当前 Run 模式走 Worker 的实时 GitHub 查询；
                当前 Repo / 全账户模式走 Worker + D1 索引。
                所有下载均使用 Worker 统一生成的 Cloudflare 下载链接。
              </div>
            </div>
          </section>
        </div>
      `;

      this.refs.host = host;
      this.refs.shadow = shadow;
      this.refs.wrap = shadow.querySelector(".gatp-wrap");
      this.refs.panel = shadow.querySelector(".gatp-panel");
      this.refs.fab = shadow.querySelector(".gatp-fab");
      this.refs.titlebar = shadow.querySelector(".gatp-titlebar");
      this.refs.titleSummary = shadow.querySelector(".gatp-title-summary");
      this.refs.status = shadow.querySelector(".gatp-status");
      this.refs.substatus = shadow.querySelector(".gatp-substatus");

      this.refs.inputWorkerBase = shadow.querySelector('[data-role="worker-base"]');
      this.refs.inputRepoPicker = shadow.querySelector('[data-role="repo-picker"]');
      this.refs.reposDatalist = shadow.querySelector("#gatp-repos-list");
      this.refs.inputQuery = shadow.querySelector('[data-role="query"]');
      this.refs.checkboxExpired = shadow.querySelector('[data-role="include-expired"]');
      this.refs.selectSort = shadow.querySelector('[data-role="sort"]');
      this.refs.selectOrder = shadow.querySelector('[data-role="order"]');
      this.refs.selectPerPage = shadow.querySelector('[data-role="per-page"]');
      this.refs.pageMeta = shadow.querySelector('[data-role="page-meta"]');
      this.refs.entriesMeta = shadow.querySelector('[data-role="entries-meta"]');
      this.refs.entriesList = shadow.querySelector(".gatp-list");

      this.refs.btnSaveWorker = shadow.querySelector('[data-action="save-worker"]');
      this.refs.btnPing = shadow.querySelector('[data-action="ping"]');
      this.refs.btnLoadRepos = shadow.querySelector('[data-action="load-repos"]');
      this.refs.btnUseRun = shadow.querySelector('[data-action="use-run"]');
      this.refs.btnUseRepo = shadow.querySelector('[data-action="use-repo"]');
      this.refs.btnUseAccount = shadow.querySelector('[data-action="use-account"]');
      this.refs.btnUseRepoInput = shadow.querySelector('[data-action="use-repo-input"]');
      this.refs.btnRefresh = shadow.querySelector('[data-action="refresh"]');
      this.refs.btnSyncRepo = shadow.querySelector('[data-action="sync-repo"]');
      this.refs.btnSyncAccount = shadow.querySelector('[data-action="sync-account"]');
      this.refs.btnPrevPage = shadow.querySelector('[data-action="prev-page"]');
      this.refs.btnNextPage = shadow.querySelector('[data-action="next-page"]');
      this.refs.btnCopyCurrentLinks = shadow.querySelector('[data-action="copy-current"]');
      this.refs.btnCopySelectedLinks = shadow.querySelector('[data-action="copy-selected"]');
      this.refs.btnExportTXT = shadow.querySelector('[data-action="export-txt"]');
      this.refs.btnExportJSON = shadow.querySelector('[data-action="export-json"]');
      this.refs.btnClearSelection = shadow.querySelector('[data-action="clear-selection"]');
      this.refs.btnResetPos = shadow.querySelector('[data-action="reset-pos"]');
      this.refs.btnClose = shadow.querySelector('[data-action="close"]');

      this.refs.inputWorkerBase.value = this.state.workerBase;
      this.refs.inputQuery.value = this.state.filters.query;
      this.refs.checkboxExpired.checked = this.state.filters.includeExpired;
      this.refs.selectSort.value = this.state.filters.sort;
      this.refs.selectOrder.value = this.state.filters.order;
      this.refs.selectPerPage.value = String(this.state.pagination.perPage);
      this.refs.inputRepoPicker.value = this.currentFullName();

      this.refs.fab.addEventListener("click", () => this.openPanel());
      this.refs.btnClose.addEventListener("click", () => this.closePanel());

      this.refs.btnResetPos.addEventListener("click", (e) => {
        e.stopPropagation();
        this.resetPosition();
      });

      this.refs.titlebar.addEventListener("pointerdown", (e) => this.onTitlebarPointerDown(e));
      this.refs.titlebar.addEventListener("pointermove", (e) => this.onTitlebarPointerMove(e));
      this.refs.titlebar.addEventListener("pointerup", (e) => this.onTitlebarPointerUp(e));
      this.refs.titlebar.addEventListener("pointercancel", (e) => this.onTitlebarPointerCancel(e));

      this.refs.btnSaveWorker.addEventListener("click", async () => {
        try {
          this.state.workerBase = this.normalizeWorkerBase(this.refs.inputWorkerBase.value);
          this.saveStore();
          this.updateUI();
          const ok = await this.pingWorker();
          if (ok) this.toast("Worker 地址已保存并联通成功");
        } catch (err) {
          this.toast(`Worker 地址无效\n${err.message || err}`);
        }
      });

      this.refs.btnPing.addEventListener("click", async () => {
        const ok = await this.pingWorker();
        this.toast(ok ? "Worker 联通成功" : "Worker 联通失败");
      });

      this.refs.btnLoadRepos.addEventListener("click", () => {
        void this.loadReposIndex(false);
      });

      this.refs.btnUseRun.addEventListener("click", () => this.switchToCurrentRun());
      this.refs.btnUseRepo.addEventListener("click", () => this.switchToCurrentRepo());
      this.refs.btnUseAccount.addEventListener("click", () => this.switchToAccount());
      this.refs.btnUseRepoInput.addEventListener("click", () => this.switchToRepoInput());
      this.refs.btnRefresh.addEventListener("click", () => void this.refreshData(false));
      this.refs.btnSyncRepo.addEventListener("click", () => void this.syncCurrentRepo());
      this.refs.btnSyncAccount.addEventListener("click", () => void this.syncAccount());

      this.refs.inputQuery.addEventListener("change", () => {
        this.state.filters.query = this.refs.inputQuery.value.trim();
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.checkboxExpired.addEventListener("change", () => {
        this.state.filters.includeExpired = !!this.refs.checkboxExpired.checked;
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.selectSort.addEventListener("change", () => {
        this.state.filters.sort = this.refs.selectSort.value;
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.selectOrder.addEventListener("change", () => {
        this.state.filters.order = this.refs.selectOrder.value;
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.selectPerPage.addEventListener("change", () => {
        this.state.pagination.perPage = Number(this.refs.selectPerPage.value) || 50;
        this.state.pagination.page = 1;
        this.saveStore();
        void this.refreshData(false);
      });

      this.refs.btnPrevPage.addEventListener("click", () => this.prevPage());
      this.refs.btnNextPage.addEventListener("click", () => this.nextPage());

      this.refs.btnCopyCurrentLinks.addEventListener("click", () => void this.copyCurrentLinks());
      this.refs.btnCopySelectedLinks.addEventListener("click", () => void this.copySelectedLinks());
      this.refs.btnExportTXT.addEventListener("click", () => this.exportTXT());
      this.refs.btnExportJSON.addEventListener("click", () => this.exportJSON());
      this.refs.btnClearSelection.addEventListener("click", () => this.clearSelection());

      this.refs.entriesList.addEventListener("change", (e) => {
        const input = e.target.closest('input[data-pick-id]');
        if (!input) return;
        this.setSelected(input.getAttribute("data-pick-id"), !!input.checked);
      });

      this.refs.entriesList.addEventListener("click", async (e) => {
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
          await this.copyText(item.cf_download_url, `已复制链接\n${item.name}`);
          return;
        }
        if (action === "open-run") {
          this.openRun(item.github_run_url);
        }
      });

      this.state.uiReady = true;
      this.applyFloatingLayout({ save: false });
    },

    updateUI() {
      if (!this.state.uiReady) return;

      this.cleanupSelection();

      const cur = this.state.currentContext;
      const act = this.state.activeContext;
      const page = this.state.pagination.page;
      const totalPages = this.state.pagination.totalPages;
      const totalCount = this.state.pagination.totalCount;
      const modeLabel = this.state.mode === "run"
        ? "当前 Run"
        : this.state.mode === "repo"
          ? "当前/指定 Repo"
          : "全账户";

      const titleLines = [
        `${modeLabel} ｜ ${this.state.items.length}/${totalCount} 条`,
        `Worker ${this.state.workerAlive ? "在线" : "离线"}`
      ];

      if (act.owner && act.repo) {
        titleLines.push(`${act.owner}/${act.repo}${act.runId ? ` ｜ run ${act.runId}` : ""}`);
      }

      if (this.state.loading) {
        titleLines.push("加载中...");
      }

      this.refs.titleSummary.textContent = titleLines.join("\n");

      this.refs.panel.classList.toggle("hidden", !this.state.panelOpen);
      this.refs.fab.classList.toggle("hidden", this.state.panelOpen);
      this.refs.panel.classList.toggle("is-collapsed", !!this.state.ui.collapsed);
      this.refs.fab.textContent = totalCount > 0 ? `Artifacts ${totalCount}` : "Artifacts";

      this.refs.status.textContent =
        `当前模式：${modeLabel}\n` +
        `当前页面：${location.host}${location.pathname}\n` +
        `Worker：${this.state.workerBase}`;

      const sync = this.state.syncStatus;
      let sub =
        `URL识别：${cur.owner && cur.repo ? `${cur.owner}/${cur.repo}` : "无仓库"}${cur.runId ? ` ｜ run ${cur.runId}` : ""}\n` +
        `活动上下文：${act.owner && act.repo ? `${act.owner}/${act.repo}` : "全账户"}${act.runId ? ` ｜ run ${act.runId}` : ""}\n` +
        `筛选：query=${this.state.filters.query || "(空)"} ｜ expired=${this.state.filters.includeExpired ? "含" : "不含"} ｜ sort=${this.state.filters.sort} ${this.state.filters.order}`;

      if (sync) {
        const latest = sync.latest_job;
        sub += `\n索引：仓库 ${sync.repo_count} ｜ 工件 ${sync.artifact_count}`;
        if (sync.state?.last_full_artifact_scan_at?.value) {
          sub += ` ｜ 最近全量 ${sync.state.last_full_artifact_scan_at.value}`;
        }
        if (latest) {
          sub += `\n最新同步任务：${latest.scope} ｜ ${latest.status} ｜ ${latest.started_at || "-"}`;
        }
      }

      if (this.state.lastError) {
        sub += `\n错误：${this.state.lastError}`;
      }

      if (this.state.loading) {
        sub += `\n状态：正在加载...`;
      }

      this.refs.substatus.textContent = sub;

      this.refs.inputWorkerBase.value = this.state.workerBase;
      this.refs.inputQuery.value = this.state.filters.query;
      this.refs.checkboxExpired.checked = this.state.filters.includeExpired;
      this.refs.selectSort.value = this.state.filters.sort;
      this.refs.selectOrder.value = this.state.filters.order;
      this.refs.selectPerPage.value = String(this.state.pagination.perPage);
      this.refs.inputRepoPicker.value = this.currentFullName();

      this.refs.pageMeta.textContent = `第 ${page} / ${totalPages} 页`;
      this.refs.btnPrevPage.disabled = page <= 1 || this.state.loading || this.state.mode === "run";
      this.refs.btnNextPage.disabled = page >= totalPages || this.state.loading || this.state.mode === "run";
      this.refs.btnSyncRepo.disabled = !(act.owner && act.repo);
      this.refs.btnUseRun.disabled = !(cur.owner && cur.repo && cur.runId);
      this.refs.btnUseRepo.disabled = !(cur.owner && cur.repo);

      this.renderItems();
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
      return Math.min(680, Math.max(320, Math.floor(window.innerWidth * 0.94)));
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

        if (save && changed) {
          this.saveStore();
        }
      });
    },

    resetPosition() {
      this.state.ui.x = null;
      this.state.ui.y = null;
      this.applyFloatingLayout({ reset: true, save: true });
      this.toast("已重置面板位置");
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
      this.titlebarTapState = { lastTapAt: 0, lastTapX: 0, lastTapY: 0 };
    },

    handleTitleTap(e) {
      if (e.target.closest("button")) return false;

      const now = Date.now();
      const prev = this.titlebarTapState;
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

      this.titlebarTapState = {
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
    }
  };

  app.init();
})();
