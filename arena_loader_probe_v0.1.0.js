(() => {
  const NAME = "Arena Loader Probe";
  const VERSION = "v0.1.0";
  const KEY = "__arenaLoaderProbe__";

  if (window[KEY]) {
    console.log(`[${NAME} ${VERSION}] already loaded`);
    return;
  }

  window[KEY] = true;

  const showToast = (message) => {
    const old = document.getElementById("__arena_loader_probe_toast__");
    if (old) old.remove();

    const el = document.createElement("div");
    el.id = "__arena_loader_probe_toast__";
    el.textContent = message;
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

    setTimeout(() => {
      el.remove();
    }, 2200);
  };

  console.log(`[${NAME} ${VERSION}] loaded from GitHub Pages`, location.href);
  showToast(`${NAME} ${VERSION}\nGitHub Pages 脚本已成功执行`);
})();
