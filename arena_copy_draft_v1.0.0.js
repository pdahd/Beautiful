(() => {
  const SCRIPT_NAME = "Arena Copy Draft Script";
  const SCRIPT_VERSION = "v1.0.0";

  const KEY = "__arenaCopyWatcher__";
  const ME = "我";
  const AI = "AI";
  const PROSE_SELECTOR = "div.prose";
  const COPY_ICON_HINT = "M19.4 20H9.6";

  const state = window[KEY] || (window[KEY] = {
    installed: false,
    enabled: false,
    toastEl: null,
    toastTimer: 0
  });

  const getClass = (el) =>
    el && typeof el.className === "string" ? el.className : "";

  const hasClassText = (el, text) => getClass(el).includes(text);

  const walkAncestors = (node, max = 10) => {
    const list = [];
    let n = node;
    for (let i = 0; n && i < max; i += 1, n = n.parentElement) {
      list.push(n);
    }
    return list;
  };

  const normalizeText = (text) =>
    (text || "")
      .replace(/\u00A0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const showToast = (message) => {
    clearTimeout(state.toastTimer);

    if (!state.toastEl) {
      const el = document.createElement("div");
      el.style.cssText = [
        "position:fixed",
        "left:50%",
        "top:20px",
        "transform:translateX(-50%)",
        "z-index:2147483647",
        "background:rgba(0,0,0,.85)",
        "color:#fff",
        "padding:8px 12px",
        "border-radius:10px",
        "font:14px/1.45 sans-serif",
        "max-width:82vw",
        "white-space:pre-wrap",
        "box-shadow:0 4px 16px rgba(0,0,0,.3)"
      ].join(";");
      document.body.appendChild(el);
      state.toastEl = el;
    }

    state.toastEl.textContent = `${SCRIPT_NAME} ${SCRIPT_VERSION}\n${message}`;
    state.toastEl.style.display = "block";

    state.toastTimer = setTimeout(() => {
      if (state.toastEl) state.toastEl.style.display = "none";
    }, 2000);
  };

  const fallbackCopy = (text) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText =
      "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  };

  const writeClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
    } catch {
      fallbackCopy(text);
    }
  };

  const isArenaCopyButton = (btn) => {
    if (!btn || btn.tagName !== "BUTTON") return false;
    return [...btn.querySelectorAll("path")].some((p) =>
      (p.getAttribute("d") || "").includes(COPY_ICON_HINT)
    );
  };

  const findMessageRootFromButton = (button) => {
    const chain = walkAncestors(button, 8);

    for (const el of chain) {
      if (hasClassText(el, "bg-surface-primary")) {
        return el;
      }
    }

    for (const el of chain) {
      if (hasClassText(el, "group") && hasClassText(el, "self-end")) {
        return el;
      }
    }

    for (const el of chain) {
      if (
        hasClassText(el, "justify-end") &&
        el.querySelector &&
        el.querySelector("div.bg-surface-raised")
      ) {
        return el;
      }
    }

    for (const el of chain) {
      if (el.querySelector && el.querySelector(PROSE_SELECTOR)) {
        return el;
      }
    }

    return null;
  };

  const detectSenderFromRoot = (root) => {
    if (!root) return "";

    const c = getClass(root);

    if (c.includes("bg-surface-primary")) {
      return AI;
    }

    if (
      (c.includes("group") && c.includes("self-end")) ||
      c.includes("justify-end") ||
      (root.querySelector && root.querySelector("div.bg-surface-raised"))
    ) {
      return ME;
    }

    return "";
  };

  const findTextContainer = (root) => {
    if (!root || !root.querySelector) return null;
    return root.querySelector(PROSE_SELECTOR) || root.querySelector("p");
  };

  const askSenderLabel = (guess = AI) => {
    const v = prompt("发言人标签：", guess);
    return v && v.trim() ? v.trim() : null;
  };

  const packDraftBlock = (sender, text) => `>>> ${sender}\n${text}`;

  const onClick = async (event) => {
    if (!state.enabled) return;

    const button =
      event.target && event.target.closest
        ? event.target.closest("button")
        : null;

    if (!isArenaCopyButton(button)) return;

    const root = findMessageRootFromButton(button);
    const sender = detectSenderFromRoot(root) || askSenderLabel(AI);
    if (!sender) return;

    const textContainer = findTextContainer(root);
    const text = normalizeText(textContainer ? textContainer.innerText : "");

    if (!text) {
      showToast("未找到消息正文");
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) {
      event.stopImmediatePropagation();
    }

    const finalText = packDraftBlock(sender, text);
    await writeClipboard(finalText);

    console.log(`[${SCRIPT_NAME} ${SCRIPT_VERSION}]`, {
      sender,
      rootClass: root ? root.className : "",
      textPreview: text.slice(0, 120)
    });

    showToast(`已复制：${sender}`);
  };

  if (!state.installed) {
    document.addEventListener("click", onClick, true);
    state.installed = true;
  }

  state.enabled = !state.enabled;

  showToast(
    state.enabled
      ? "已开启 arena.ai copy 按钮监听\n现在去点页面里的复制按钮"
      : "已关闭 arena.ai copy 按钮监听"
  );
})();
