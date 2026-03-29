// toolbox.js v1.0 — 网页阅读器+资源提取+本地存储+动画暂停
(function(){

const TOOL_ID="tb_tool_987";
const old=document.getElementById(TOOL_ID);
if(old){old.remove();return;}

// ════════════════════════════════════════════════
// 主题
// ════════════════════════════════════════════════
let isDark=true;
const THEMES={
  dark:{
    bg:"#1e1e1e",bg2:"#252526",bg3:"#2d2d2d",bg4:"#333",
    border:"#3a3a3a",border2:"#444",
    text:"#ccc",text2:"#888",text3:"#4fc3f7",
    accent:"#0078ff",
    handleBg:"#2a2a2a",handleActive:"#3a3a3a",
    rowHover:"#2a2a2a",cardBg:"#252526",cardBorder:"#3a3a3a",
    inputBg:"#2d2d2d",tagBg:"#37474f"
  },
  light:{
    bg:"#fff",bg2:"#f5f7fa",bg3:"#eef1f6",bg4:"#e0e4ec",
    border:"#dde3ed",border2:"#c8d0de",
    text:"#333",text2:"#888",text3:"#0078ff",
    accent:"#0078ff",
    handleBg:"#eef1f6",handleActive:"#dde3ed",
    rowHover:"#f0f4ff",cardBg:"#fff",cardBorder:"#dde3ed",
    inputBg:"#fff",tagBg:"#e3f2fd"
  }
};
let T=THEMES[isDark?"dark":"light"];

function toggleTheme(){
  isDark=!isDark;T=THEMES[isDark?"dark":"light"];
  themeBtn.textContent=isDark?"☀️":"🌙";
  applyTheme();
}

const themeCallbacks=[];
function onT(fn){themeCallbacks.push(fn);fn();}
function applyTheme(){themeCallbacks.forEach(fn=>fn());}

// ════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════
function getTimestamp(){
  const d=new Date(),p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+
    "_"+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
}

function copyText(str){
  const ta=document.createElement("textarea");
  ta.value=str;ta.style.cssText="position:fixed;opacity:0;";
  document.body.appendChild(ta);ta.select();
  document.execCommand("copy");ta.remove();
}

function showToast(msg,isErr){
  const old=document.getElementById("tb_toast");
  if(old)old.remove();
  const t=document.createElement("div");
  t.id="tb_toast";
  t.style.cssText=
    "position:fixed;top:60px;left:50%;transform:translateX(-50%);"+
    "background:"+(isErr?"#e53935":"#323232")+";color:#fff;"+
    "padding:8px 20px;border-radius:20px;font-size:13px;"+
    "z-index:2147483649;pointer-events:none;white-space:nowrap;"+
    "box-shadow:0 2px 8px rgba(0,0,0,.3);";
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2500);
}

function downloadText(content,filename,mime){
  const b=new Blob([content],{type:mime||"text/plain"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=u;a.download=filename;a.style.display="none";
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},500);
}

function mkBtn(t,bg,fn,extra){
  const b=document.createElement("button");
  b.textContent=t;
  b.style.cssText=
    "padding:7px 14px;background:"+bg+";color:#fff;border:none;"+
    "border-radius:6px;font-size:13px;cursor:pointer;"+
    "white-space:nowrap;flex-shrink:0;"+(extra||"");
  b.onclick=fn;return b;
}

// ════════════════════════════════════════════════
// 主面板
// ════════════════════════════════════════════════
const VH=window.innerHeight;
const MIN_H=140,MAX_H=Math.round(VH*0.95);
let panelH=Math.round(VH*0.65);

const root=document.createElement("div");
root.id=TOOL_ID;
root.style.cssText="position:fixed;z-index:2147483647;";

const panel=document.createElement("div");
panel.style.cssText=
  "position:fixed;bottom:0;left:0;width:100%;"+
  "display:flex;flex-direction:column;"+
  "z-index:2147483647;height:"+panelH+"px;"+
  "box-shadow:0 -4px 24px rgba(0,0,0,.4);";
onT(()=>{
  panel.style.background=T.bg;
  panel.style.borderTop="2px solid "+T.text3;
});

// ── 拖动手柄 ──────────────────────────────────
const dragHandle=document.createElement("div");
dragHandle.style.cssText=
  "height:44px;display:flex;align-items:center;"+
  "justify-content:center;cursor:ns-resize;flex-shrink:0;"+
  "user-select:none;touch-action:none;position:relative;";
onT(()=>{
  dragHandle.style.background=T.handleBg;
  dragHandle.style.borderBottom="1px solid "+T.border;
});

const dragIcon=document.createElement("div");
dragIcon.style.cssText=
  "display:flex;flex-direction:column;gap:5px;pointer-events:none;";
[32,22,32].forEach(w=>{
  const bar=document.createElement("div");
  bar.style.cssText="height:3px;border-radius:2px;width:"+w+"px;";
  onT(()=>bar.style.background=T.text2);
  dragIcon.appendChild(bar);
});

const heightTip=document.createElement("span");
heightTip.style.cssText=
  "position:absolute;right:12px;font-size:11px;"+
  "pointer-events:none;opacity:0;transition:opacity .2s;";
onT(()=>heightTip.style.color=T.text2);
dragHandle.appendChild(dragIcon);
dragHandle.appendChild(heightTip);

let pDrag=false,pStartY=0,pStartH=0,lastTap=0;
function setPanelH(h){
  panelH=Math.max(MIN_H,Math.min(MAX_H,h));
  panel.style.height=panelH+"px";
  heightTip.textContent=panelH+"px";
}
dragHandle.addEventListener("mousedown",e=>{
  pDrag=true;pStartY=e.clientY;pStartH=panelH;
  heightTip.style.opacity="1";
  onT(()=>dragHandle.style.background=T.handleActive);
  e.preventDefault();e.stopPropagation();
});
dragHandle.addEventListener("touchstart",e=>{
  const now=Date.now();
  if(now-lastTap<300){
    setPanelH(panelH<MAX_H-20?MAX_H:Math.round(VH*0.5));
    lastTap=0;
  } else {
    lastTap=now;
    pDrag=true;pStartY=e.touches[0].clientY;pStartH=panelH;
    heightTip.style.opacity="1";
  }
  e.stopPropagation();
},{passive:true});
dragHandle.addEventListener("dblclick",e=>{
  setPanelH(panelH<MAX_H-20?MAX_H:Math.round(VH*0.5));
  e.stopPropagation();
});
document.addEventListener("mousemove",e=>{
  if(pDrag){setPanelH(pStartH+(pStartY-e.clientY));e.preventDefault();}
});
document.addEventListener("mouseup",()=>{
  if(pDrag){
    pDrag=false;heightTip.style.opacity="0";
    onT(()=>dragHandle.style.background=T.handleBg);
  }
});
document.addEventListener("touchmove",e=>{
  if(pDrag){setPanelH(pStartH+(pStartY-e.touches[0].clientY));e.preventDefault();}
},{passive:false});
document.addEventListener("touchend",()=>{
  if(pDrag){
    pDrag=false;heightTip.style.opacity="0";
    onT(()=>dragHandle.style.background=T.handleBg);
  }
});

// ── 顶部栏 ────────────────────────────────────
const topBar=document.createElement("div");
topBar.style.cssText=
  "display:flex;align-items:center;gap:10px;padding:8px 14px;"+
  "flex-shrink:0;";
onT(()=>{
  topBar.style.background=T.bg2;
  topBar.style.borderBottom="1px solid "+T.border;
});

const titleEl=document.createElement("span");
titleEl.textContent="🧰 工具箱";
titleEl.style.cssText="font-weight:bold;font-size:15px;flex:1;";
onT(()=>titleEl.style.color=T.text3);

const themeBtn=document.createElement("button");
themeBtn.textContent="☀️";
themeBtn.style.cssText=
  "padding:4px 10px;border:none;border-radius:8px;"+
  "font-size:13px;cursor:pointer;";
themeBtn.onclick=toggleTheme;
onT(()=>{
  themeBtn.style.background=T.bg3;
  themeBtn.style.color=T.text;
});

const closeBtn2=document.createElement("button");
closeBtn2.textContent="✕";
closeBtn2.style.cssText=
  "padding:4px 12px;border:none;border-radius:8px;"+
  "font-size:14px;cursor:pointer;";
closeBtn2.onclick=()=>{root.remove();};
onT(()=>{
  closeBtn2.style.background=T.bg3;
  closeBtn2.style.color=T.text;
});

topBar.appendChild(titleEl);
topBar.appendChild(themeBtn);
topBar.appendChild(closeBtn2);

// ── 工具选择栏 ────────────────────────────────
const toolBar=document.createElement("div");
toolBar.style.cssText=
  "display:flex;gap:8px;padding:10px 14px;"+
  "flex-shrink:0;flex-wrap:wrap;";
onT(()=>{
  toolBar.style.background=T.bg2;
  toolBar.style.borderBottom="1px solid "+T.border;
});

const TOOLS=[
  {id:"reader",icon:"📖",label:"阅读器"},
  {id:"resource",icon:"📦",label:"资源"},
  {id:"storage",icon:"💾",label:"存储"},
  {id:"animation",icon:"⏸",label:"动画"}
];

let currentTool="reader";
const toolBtns={};

TOOLS.forEach(({id,icon,label})=>{
  const btn=document.createElement("button");
  btn.style.cssText=
    "padding:8px 16px;border:2px solid;border-radius:8px;"+
    "font-size:13px;cursor:pointer;display:flex;"+
    "align-items:center;gap:6px;font-weight:bold;";
  btn.innerHTML=icon+" "+label;
  btn.onclick=()=>switchTool(id);
  toolBtns[id]=btn;
  toolBar.appendChild(btn);
  onT(()=>{
    const active=currentTool===id;
    btn.style.background=active?T.accent:T.bg3;
    btn.style.color=active?"#fff":T.text;
    btn.style.borderColor=active?T.accent:T.border;
  });
});

function switchTool(id){
  currentTool=id;
  applyTheme();
  if(id==="animation"){
    toggleAnimation();
  } else {
    contentArea.style.display="flex";
    renderTool(id);
  }
}

// ── 内容区 ────────────────────────────────────
const contentArea=document.createElement("div");
contentArea.style.cssText=
  "flex:1;display:flex;flex-direction:column;"+
  "overflow:hidden;min-height:0;";

panel.appendChild(dragHandle);
panel.appendChild(topBar);
panel.appendChild(toolBar);
panel.appendChild(contentArea);
root.appendChild(panel);
document.body.appendChild(root);

// ════════════════════════════════════════════════
// 工具① 网页阅读器
// ════════════════════════════════════════════════
let readerFontSize=16;
let readerContent=null;

function buildReader(){
  const wrap=document.createElement("div");
  wrap.style.cssText=
    "display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;";

  // 工具栏
  const bar=document.createElement("div");
  bar.style.cssText=
    "display:flex;gap:8px;padding:8px 14px;flex-shrink:0;"+
    "align-items:center;flex-wrap:wrap;";
  onT(()=>{
    bar.style.background=T.bg2;
    bar.style.borderBottom="1px solid "+T.border;
  });

  const extractBtn=mkBtn("📖 提取正文",T.accent,()=>{
    readerContent=extractArticle();
    renderReaderContent(contentEl);
    showToast(readerContent?"提取成功":"未找到主要内容",!readerContent);
  });

  const fontDecBtn=mkBtn("A-","#555",()=>{
    readerFontSize=Math.max(12,readerFontSize-2);
    contentEl.style.fontSize=readerFontSize+"px";
  });
  const fontIncBtn=mkBtn("A+","#555",()=>{
    readerFontSize=Math.min(28,readerFontSize+2);
    contentEl.style.fontSize=readerFontSize+"px";
  });

  const exportTxtBtn=mkBtn("导出TXT","#28a745",()=>{
    if(!readerContent){showToast("请先提取正文",true);return;}
    downloadText(readerContent.text,
      getTimestamp()+"_article.txt","text/plain");
    showToast("已导出TXT");
  });
  const exportMdBtn=mkBtn("导出MD","#7e57c2",()=>{
    if(!readerContent){showToast("请先提取正文",true);return;}
    downloadText(readerContent.markdown,
      getTimestamp()+"_article.md","text/markdown");
    showToast("已导出Markdown");
  });

  [extractBtn,fontDecBtn,fontIncBtn,exportTxtBtn,exportMdBtn]
    .forEach(b=>bar.appendChild(b));

  // 阅读内容区
  const contentEl=document.createElement("div");
  contentEl.style.cssText=
    "flex:1;overflow-y:auto;padding:20px 24px;"+
    "font-size:"+readerFontSize+"px;line-height:1.9;"+
    "max-width:720px;margin:0 auto;width:100%;"+
    "box-sizing:border-box;";
  onT(()=>{
    contentEl.style.color=T.text;
    contentEl.style.background=T.bg;
  });

  // 初始提示
  const hint=document.createElement("div");
  hint.style.cssText="text-align:center;padding:40px 20px;";
  onT(()=>hint.style.color=T.text2);
  hint.innerHTML=
    "<div style='font-size:48px;margin-bottom:12px'>📖</div>"+
    "<div style='font-size:15px;margin-bottom:8px'>点击「提取正文」自动提取页面主要内容</div>"+
    "<div style='font-size:13px'>去除导航栏、广告、侧边栏，专注阅读</div>";
  contentEl.appendChild(hint);

  wrap.appendChild(bar);
  wrap.appendChild(contentEl);
  return wrap;
}

function extractArticle(){
  // 优先级：article > main > [role=main] > 内容评分
  const candidates=[
    document.querySelector("article"),
    document.querySelector("main"),
    document.querySelector("[role=main]"),
    document.querySelector(".article"),
    document.querySelector(".post-content"),
    document.querySelector(".entry-content"),
    document.querySelector("#content"),
    document.querySelector(".content")
  ].filter(Boolean);

  let target=candidates[0];

  // 内容评分：找文字最多的块
  if(!target){
    let best=null,bestScore=0;
    document.querySelectorAll(
      "div,section,article,main"
    ).forEach(el=>{
      if(el.closest("#"+TOOL_ID))return;
      const text=el.innerText||"";
      const score=text.length-(el.querySelectorAll(
        "nav,header,footer,aside,script,style").length*200);
      if(score>bestScore){bestScore=score;best=el;}
    });
    target=best;
  }

  if(!target)return null;

  // 克隆并清理
  const clone=target.cloneNode(true);
  ["script","style","nav","header","footer",
   "aside","iframe","button","input","form",
   ".ad","[class*=ad]","[id*=ad]","[class*=banner]"
  ].forEach(sel=>{
    try{clone.querySelectorAll(sel)
      .forEach(el=>el.remove());}catch(e){}
  });

  const title=document.title||"";
  const rawText=(clone.innerText||clone.textContent||"").trim();
  if(!rawText)return null;

  // 生成Markdown
  let md="# "+title+"\n\n";
  md+="> 来源："+location.href+"\n\n";

  function nodeToMd(node,depth){
    if(node.nodeType===3){
      const t=node.textContent.trim();
      return t?t+"\n":"";
    }
    if(node.nodeType!==1)return "";
    const tag=node.tagName.toLowerCase();
    const children=Array.from(node.childNodes)
      .map(c=>nodeToMd(c,depth+1)).join("");
    if(!children.trim())return "";
    if(tag.match(/^h[1-6]$/)){
      const level=parseInt(tag[1]);
      return "\n"+"#".repeat(level)+" "+children.trim()+"\n\n";
    }
    if(tag==="p")return "\n"+children.trim()+"\n\n";
    if(tag==="li")return "- "+children.trim()+"\n";
    if(tag==="a"){
      const href=node.href;
      return href?"["+children.trim()+"]("+href+")":children;
    }
    if(tag==="strong"||tag==="b")return "**"+children.trim()+"**";
    if(tag==="em"||tag==="i")return "_"+children.trim()+"_";
    if(tag==="code")return "`"+children.trim()+"`";
    if(tag==="pre")return "\n```\n"+children.trim()+"\n```\n\n";
    if(tag==="blockquote")return "\n> "+children.trim()+"\n\n";
    if(tag==="br")return "\n";
    return children;
  }

  md+=nodeToMd(clone,0);

  return {
    title,
    text:title+"\n\n来源："+location.href+"\n\n"+rawText,
    markdown:md,
    html:clone.innerHTML,
    wordCount:rawText.replace(/\s+/g," ").split(" ").length
  };
}

function renderReaderContent(el){
  el.innerHTML="";
  if(!readerContent){
    const err=document.createElement("div");
    err.style.cssText="text-align:center;padding:40px;";
    onT(()=>err.style.color=T.text2);
    err.textContent="未能提取到主要内容，请尝试在文章页面使用";
    el.appendChild(err);
    return;
  }

  // 标题
  const title=document.createElement("h1");
  title.textContent=readerContent.title;
  title.style.cssText=
    "font-size:1.4em;margin-bottom:8px;line-height:1.4;";
  onT(()=>title.style.color=T.text);

  // 元信息
  const meta=document.createElement("div");
  meta.style.cssText="font-size:0.8em;margin-bottom:20px;";
  onT(()=>meta.style.color=T.text2);
  meta.textContent=
    "约 "+readerContent.wordCount+" 词  ·  "+location.hostname;

  // 分割线
  const hr=document.createElement("hr");
  onT(()=>hr.style.borderColor=T.border);
  hr.style.margin="0 0 20px";

  // 正文
  const body=document.createElement("div");
  body.style.cssText="line-height:1.9;";
  onT(()=>body.style.color=T.text);
  // 段落化
  readerContent.text.split("\n\n").forEach(para=>{
    const p=para.trim();
    if(!p)return;
    const pEl=document.createElement("p");
    pEl.style.cssText="margin:0 0 1.2em;";
    pEl.textContent=p;
    body.appendChild(pEl);
  });

  el.appendChild(title);
  el.appendChild(meta);
  el.appendChild(hr);
  el.appendChild(body);
}

// ════════════════════════════════════════════════
// 工具② 页面资源提取器
// ════════════════════════════════════════════════
function buildResource(){
  const wrap=document.createElement("div");
  wrap.style.cssText=
    "display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;";

  // 子标签
  const subTabs=["🖼 图片","🔗 链接","🎬 媒体","📄 脚本/样式"];
  const subTabBtns={};
  let currentSub="🖼 图片";

  const subBar=document.createElement("div");
  subBar.style.cssText=
    "display:flex;gap:6px;padding:8px 14px;flex-shrink:0;"+
    "overflow-x:auto;";
  onT(()=>{
    subBar.style.background=T.bg2;
    subBar.style.borderBottom="1px solid "+T.border;
  });

  const subContent=document.createElement("div");
  subContent.style.cssText=
    "flex:1;overflow-y:auto;overflow-x:auto;"+
    "padding:12px 14px;min-height:0;";
  onT(()=>subContent.style.background=T.bg);

  function switchSub(name){
    currentSub=name;
    Object.entries(subTabBtns).forEach(([n,b])=>{
      b.style.background=n===name?T.accent:T.bg3;
      b.style.color=n===name?"#fff":T.text;
      b.style.borderColor=n===name?T.accent:T.border;
    });
    renderSubContent(name);
  }

  subTabs.forEach(name=>{
    const b=document.createElement("button");
    b.textContent=name;
    b.style.cssText=
      "padding:6px 14px;border:1px solid;border-radius:6px;"+
      "font-size:12px;cursor:pointer;white-space:nowrap;";
    b.onclick=()=>switchSub(name);
    subTabBtns[name]=b;
    subBar.appendChild(b);
    onT(()=>{
      b.style.background=currentSub===name?T.accent:T.bg3;
      b.style.color=currentSub===name?"#fff":T.text;
      b.style.borderColor=currentSub===name?T.accent:T.border;
    });
  });

  function getResources(){
    const imgs=[...document.querySelectorAll("img")]
      .filter(el=>!el.closest("#"+TOOL_ID))
      .map(el=>({
        src:el.src||el.currentSrc,
        alt:el.alt||"",
        width:el.naturalWidth||el.width,
        height:el.naturalHeight||el.height
      })).filter(r=>r.src&&r.src.startsWith("http"));

    const links=[...document.querySelectorAll("a")]
      .filter(el=>!el.closest("#"+TOOL_ID))
      .map(el=>({
        href:el.href,
        text:(el.textContent||"").trim().slice(0,60)
      })).filter(r=>r.href&&r.href.startsWith("http"));

    const media=[
      ...[...document.querySelectorAll("video")]
        .filter(el=>!el.closest("#"+TOOL_ID))
        .map(el=>({type:"video",src:el.src||el.currentSrc})),
      ...[...document.querySelectorAll("audio")]
        .filter(el=>!el.closest("#"+TOOL_ID))
        .map(el=>({type:"audio",src:el.src||el.currentSrc})),
      ...[...document.querySelectorAll("source")]
        .filter(el=>!el.closest("#"+TOOL_ID))
        .map(el=>({type:"source",src:el.src}))
    ].filter(r=>r.src);

    const scripts=[
      ...[...document.querySelectorAll("script[src]")]
        .map(el=>({type:"js",src:el.src})),
      ...[...document.querySelectorAll("link[rel=stylesheet]")]
        .map(el=>({type:"css",src:el.href}))
    ].filter(r=>r.src);

    return {imgs,links,media,scripts};
  }

  function mkResRow(left,right,onCopy){
    const row=document.createElement("div");
    row.style.cssText=
      "display:flex;align-items:center;gap:10px;"+
      "padding:8px 10px;border-radius:6px;margin-bottom:4px;";
    onT(()=>{
      row.style.background=T.bg2;
      row.style.border="1px solid "+T.border;
    });
    const leftEl=document.createElement("div");
    leftEl.style.cssText=
      "flex:1;font-size:12px;word-break:break-all;";
    onT(()=>leftEl.style.color=T.text);
    if(typeof left==="string") leftEl.textContent=left;
    else leftEl.appendChild(left);

    const rightEl=document.createElement("div");
    rightEl.style.cssText=
      "font-size:11px;flex-shrink:0;";
    onT(()=>rightEl.style.color=T.text2);
    rightEl.textContent=right;

    const copyB=document.createElement("button");
    copyB.textContent="复制";
    copyB.style.cssText=
      "padding:3px 10px;border:none;border-radius:4px;"+
      "font-size:11px;cursor:pointer;flex-shrink:0;";
    onT(()=>{
      copyB.style.background=T.bg4;
      copyB.style.color=T.text;
    });
    copyB.onclick=()=>{onCopy();showToast("已复制");};

    row.appendChild(leftEl);
    row.appendChild(rightEl);
    row.appendChild(copyB);
    return row;
  }

  function renderSubContent(name){
    subContent.innerHTML="";
    const res=getResources();

    // 复制全部按钮
    const actBar=document.createElement("div");
    actBar.style.cssText=
      "display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;";

    if(name==="🖼 图片"){
      const imgs=res.imgs;
      actBar.appendChild(mkBtn(
        "复制全部URL("+imgs.length+")","#555",()=>{
          copyText(imgs.map(i=>i.src).join("\n"));
          showToast("已复制"+imgs.length+"个图片URL");
        }));
      subContent.appendChild(actBar);

      if(!imgs.length){
        const e=mkEmpty("未发现图片资源");
        subContent.appendChild(e);return;
      }

      imgs.forEach(img=>{
        // 图片行：缩略图+信息
        const row=document.createElement("div");
        row.style.cssText=
          "display:flex;align-items:center;gap:10px;"+
          "padding:8px 10px;border-radius:6px;margin-bottom:6px;";
        onT(()=>{
          row.style.background=T.bg2;
          row.style.border="1px solid "+T.border;
        });

        // 缩略图
        const thumb=document.createElement("img");
        thumb.src=img.src;
        thumb.style.cssText=
          "width:48px;height:48px;object-fit:cover;"+
          "border-radius:4px;flex-shrink:0;"+
          "background:#333;";
        thumb.onerror=()=>thumb.style.display="none";

        const info=document.createElement("div");
        info.style.cssText="flex:1;min-width:0;";
        const urlEl=document.createElement("div");
        urlEl.style.cssText=
          "font-size:12px;word-break:break-all;margin-bottom:3px;";
        onT(()=>urlEl.style.color=T.text);
        urlEl.textContent=img.src;

        const metaEl=document.createElement("div");
        metaEl.style.cssText="font-size:11px;";
        onT(()=>metaEl.style.color=T.text2);
        metaEl.textContent=
          (img.width&&img.height?img.width+"×"+img.height+"  ":"")+
          (img.alt?"alt: "+img.alt:"");

        info.appendChild(urlEl);
        info.appendChild(metaEl);

        const btns=document.createElement("div");
        btns.style.cssText="display:flex;gap:4px;flex-shrink:0;";

        const cpyB=document.createElement("button");
        cpyB.textContent="复制";
        cpyB.style.cssText=
          "padding:3px 10px;border:none;border-radius:4px;"+
          "font-size:11px;cursor:pointer;";
        onT(()=>{cpyB.style.background=T.bg4;cpyB.style.color=T.text;});
        cpyB.onclick=()=>{copyText(img.src);showToast("已复制");};

        const dlB=document.createElement("a");
        dlB.textContent="下载";
        dlB.href=img.src;
        dlB.download="";
        dlB.target="_blank";
        dlB.style.cssText=
          "padding:3px 10px;border:none;border-radius:4px;"+
          "font-size:11px;cursor:pointer;text-decoration:none;"+
          "display:inline-block;";
        onT(()=>{dlB.style.background=T.accent;dlB.style.color="#fff";});

        btns.appendChild(cpyB);btns.appendChild(dlB);
        row.appendChild(thumb);row.appendChild(info);row.appendChild(btns);
        subContent.appendChild(row);
      });

    } else if(name==="🔗 链接"){
      const links=res.links;
      actBar.appendChild(mkBtn(
        "复制全部URL("+links.length+")","#555",()=>{
          copyText(links.map(l=>l.href).join("\n"));
          showToast("已复制"+links.length+"个链接");
        }));
      actBar.appendChild(mkBtn(
        "复制Markdown格式","#7e57c2",()=>{
          copyText(links.map(l=>"["+l.text+"]("+l.href+")").join("\n"));
          showToast("已复制Markdown链接");
        }));
      subContent.appendChild(actBar);

      if(!links.length){
        subContent.appendChild(mkEmpty("未发现链接"));return;
      }
      links.forEach(link=>{
        const row=mkResRow(
          link.href,
          link.text||"（无文字）",
          ()=>copyText(link.href)
        );
        subContent.appendChild(row);
      });

    } else if(name==="🎬 媒体"){
      const media=res.media;
      actBar.appendChild(mkBtn(
        "复制全部URL("+media.length+")","#555",()=>{
          copyText(media.map(m=>m.src).join("\n"));
          showToast("已复制"+media.length+"个媒体URL");
        }));
      subContent.appendChild(actBar);

      if(!media.length){
        subContent.appendChild(mkEmpty("未发现视频/音频资源"));return;
      }
      media.forEach(m=>{
        const row=mkResRow(
          m.src,
          "["+m.type+"]",
          ()=>copyText(m.src)
        );
        subContent.appendChild(row);
      });

    } else if(name==="📄 脚本/样式"){
      const scripts=res.scripts;
      actBar.appendChild(mkBtn(
        "复制全部URL("+scripts.length+")","#555",()=>{
          copyText(scripts.map(s=>s.src).join("\n"));
          showToast("已复制"+scripts.length+"个资源URL");
        }));
      subContent.appendChild(actBar);

      if(!scripts.length){
        subContent.appendChild(mkEmpty("未发现外部脚本/样式"));return;
      }
      scripts.forEach(s=>{
        const tag=document.createElement("span");
        tag.textContent=s.type.toUpperCase();
        tag.style.cssText=
          "padding:1px 6px;border-radius:3px;font-size:11px;"+
          "margin-right:6px;font-weight:bold;";
        tag.style.background=s.type==="js"?"#f0a500":"#0078ff";
        tag.style.color="#fff";
        const label=document.createElement("span");
        label.textContent=s.src;
        const wrap2=document.createElement("span");
        wrap2.appendChild(tag);wrap2.appendChild(label);
        const row=mkResRow(wrap2,"",()=>copyText(s.src));
        subContent.appendChild(row);
      });
    }
  }

  wrap.appendChild(subBar);
  wrap.appendChild(subContent);

  // 初始渲染
  switchSub("🖼 图片");
  return wrap;
}

function mkEmpty(text){
  const d=document.createElement("div");
  d.style.cssText="text-align:center;padding:40px;font-size:14px;";
  onT(()=>d.style.color=T.text2);
  d.textContent=text;
  return d;
}

// ════════════════════════════════════════════════
// 工具③ 本地存储查看器
// ════════════════════════════════════════════════
function buildStorage(){
  const wrap=document.createElement("div");
  wrap.style.cssText=
    "display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;";

  const STORE_TABS=["localStorage","sessionStorage","Cookie"];
  let currentStore="localStorage";
  const storeBtns={};
  let searchKey="";

  // 子标签栏
  const storeBar=document.createElement("div");
  storeBar.style.cssText=
    "display:flex;gap:6px;padding:8px 14px;flex-shrink:0;flex-wrap:wrap;";
  onT(()=>{
    storeBar.style.background=T.bg2;
    storeBar.style.borderBottom="1px solid "+T.border;
  });

  // 操作栏
  const actBar=document.createElement("div");
  actBar.style.cssText=
    "display:flex;gap:8px;padding:8px 14px;flex-shrink:0;flex-wrap:wrap;align-items:center;";
  onT(()=>{
    actBar.style.background=T.bg3;
    actBar.style.borderBottom="1px solid "+T.border;
  });

  // 搜索框
  const searchInput=document.createElement("input");
  searchInput.placeholder="搜索 key…";
  searchInput.style.cssText=
    "flex:1;min-width:100px;padding:6px 10px;"+
    "border-radius:6px;font-size:13px;border:1px solid;";
  onT(()=>{
    searchInput.style.background=T.inputBg;
    searchInput.style.color=T.text;
    searchInput.style.borderColor=T.border2;
  });
  searchInput.oninput=()=>{
    searchKey=searchInput.value.trim().toLowerCase();
    renderStoreContent();
  };

  const addBtn=mkBtn("+ 新增","#28a745",()=>showAddDialog());
  const exportBtn2=mkBtn("导出JSON","#0078ff",()=>exportStorage());
  const clearAllBtn=mkBtn("清空全部","#e53935",()=>{
    if(!confirm("确认清空 "+currentStore+" 的所有数据？"))return;
    if(currentStore==="Cookie"){
      showToast("Cookie删除需要服务端配合，仅可逐条操作",true);
      return;
    }
    if(currentStore==="localStorage") localStorage.clear();
    else sessionStorage.clear();
    renderStoreContent();
    showToast("已清空");
  });

  actBar.appendChild(searchInput);
  actBar.appendChild(addBtn);
  actBar.appendChild(exportBtn2);
  actBar.appendChild(clearAllBtn);

  // 内容区
  const storeContent=document.createElement("div");
  storeContent.style.cssText=
    "flex:1;overflow-y:auto;padding:10px 14px;min-height:0;";
  onT(()=>storeContent.style.background=T.bg);

  function switchStore(name){
    currentStore=name;
    Object.entries(storeBtns).forEach(([n,b])=>{
      b.style.background=n===name?T.accent:T.bg3;
      b.style.color=n===name?"#fff":T.text;
      b.style.borderColor=n===name?T.accent:T.border;
    });
    renderStoreContent();
  }

  STORE_TABS.forEach(name=>{
    const b=document.createElement("button");
    b.textContent=name;
    b.style.cssText=
      "padding:6px 14px;border:1px solid;border-radius:6px;"+
      "font-size:12px;cursor:pointer;white-space:nowrap;";
    b.onclick=()=>switchStore(name);
    storeBtns[name]=b;
    storeBar.appendChild(b);
    onT(()=>{
      b.style.background=currentStore===name?T.accent:T.bg3;
      b.style.color=currentStore===name?"#fff":T.text;
      b.style.borderColor=currentStore===name?T.accent:T.border;
    });
  });

  function getStoreData(){
    if(currentStore==="Cookie"){
      return document.cookie.split(";")
        .map(c=>c.trim())
        .filter(Boolean)
        .map(c=>{
          const idx=c.indexOf("=");
          return idx>0?
            {key:c.slice(0,idx).trim(),value:c.slice(idx+1)}:
            {key:c,value:""};
        });
    }
    const store=currentStore==="localStorage"?
      localStorage:sessionStorage;
    const items=[];
    for(let i=0;i<store.length;i++){
      const key=store.key(i);
      items.push({key,value:store.getItem(key)});
    }
    return items;
  }

  function renderStoreContent(){
    storeContent.innerHTML="";
    let items=getStoreData();
    if(searchKey){
      items=items.filter(i=>
        i.key.toLowerCase().includes(searchKey)||
        (i.value||"").toLowerCase().includes(searchKey));
    }

    // 统计行
    const statRow=document.createElement("div");
    statRow.style.cssText="font-size:12px;margin-bottom:10px;";
    onT(()=>statRow.style.color=T.text2);
    statRow.textContent=
      currentStore+" — 共 "+items.length+" 条"+
      (searchKey?" (已筛选)":"");
    storeContent.appendChild(statRow);

    if(!items.length){
      storeContent.appendChild(mkEmpty("暂无数据"));return;
    }

    items.forEach(({key,value})=>{
      const row=document.createElement("div");
      row.style.cssText=
        "border-radius:6px;margin-bottom:8px;overflow:hidden;";
      onT(()=>{
        row.style.background=T.bg2;
        row.style.border="1px solid "+T.border;
      });

      // Key行
      const keyRow=document.createElement("div");
      keyRow.style.cssText=
        "display:flex;align-items:center;gap:8px;"+
        "padding:6px 10px;";
      onT(()=>{
        keyRow.style.background=T.bg3;
        keyRow.style.borderBottom="1px solid "+T.border;
      });

      const keyEl=document.createElement("span");
      keyEl.style.cssText=
        "flex:1;font-weight:bold;font-size:12px;"+
        "word-break:break-all;";
      onT(()=>keyEl.style.color=T.text3);
      keyEl.textContent=key;

      const keyBtns=document.createElement("div");
      keyBtns.style.cssText="display:flex;gap:4px;flex-shrink:0;";

      function mkSmBtn(t,bg,fn){
        const b=document.createElement("button");
        b.textContent=t;
        b.style.cssText=
          "padding:2px 8px;background:"+bg+
          ";color:#fff;border:none;border-radius:4px;"+
          "font-size:11px;cursor:pointer;";
        b.onclick=fn;return b;
      }

      keyBtns.appendChild(mkSmBtn("复制key","#555",()=>{
        copyText(key);showToast("已复制key");
      }));
      if(currentStore!=="Cookie"){
        keyBtns.appendChild(mkSmBtn("编辑","#0078ff",()=>
          showEditDialog(key,value)));
        keyBtns.appendChild(mkSmBtn("删除","#e53935",()=>{
          if(!confirm("删除 "+key+" ?"))return;
          if(currentStore==="localStorage")
            localStorage.removeItem(key);
          else sessionStorage.removeItem(key);
          renderStoreContent();
        }));
      }

      keyRow.appendChild(keyEl);keyRow.appendChild(keyBtns);

      // Value行
      const valRow=document.createElement("div");
      valRow.style.cssText="padding:8px 10px;";

      let displayVal=value||"";
      let isJson=false;
      try{
        const parsed=JSON.parse(displayVal);
        displayVal=JSON.stringify(parsed,null,2);
        isJson=true;
      }catch(e){}

      const valEl=document.createElement("pre");
      valEl.style.cssText=
        "margin:0;font-size:12px;white-space:pre-wrap;"+
        "word-break:break-all;max-height:120px;overflow-y:auto;"+
        "font-family:monospace;";
      onT(()=>valEl.style.color=isJson?T.text3:T.text);
      valEl.textContent=displayVal;

      const copyValBtn=mkSmBtn("复制值","#555",()=>{
        copyText(value||"");showToast("已复制值");
      });
      copyValBtn.style.marginTop="6px";

      valRow.appendChild(valEl);
      valRow.appendChild(copyValBtn);
      row.appendChild(keyRow);row.appendChild(valRow);
      storeContent.appendChild(row);
    });
  }

  function showAddDialog(){
    showKVDialog("新增条目","","",false);
  }

  function showEditDialog(key,value){
    showKVDialog("编辑条目",key,value,true);
  }

  function showKVDialog(title,initKey,initVal,keyReadonly){
    const overlay=document.createElement("div");
    overlay.style.cssText=
      "position:fixed;top:0;left:0;width:100%;height:100%;"+
      "background:rgba(0,0,0,.5);z-index:2147483648;"+
      "display:flex;align-items:center;justify-content:center;";

    const dlg=document.createElement("div");
    dlg.style.cssText=
      "width:88%;max-width:480px;border-radius:12px;"+
      "padding:20px;box-shadow:0 8px 32px rgba(0,0,0,.4);";
    onT(()=>{dlg.style.background=T.bg2;dlg.style.color=T.text;});

    const dlgTitle=document.createElement("div");
    dlgTitle.style.cssText=
      "font-weight:bold;font-size:15px;margin-bottom:14px;";
    dlgTitle.textContent=title;

    const keyInput=document.createElement("input");
    keyInput.value=initKey;
    keyInput.readOnly=keyReadonly;
    keyInput.placeholder="Key";
    keyInput.style.cssText=
      "width:100%;padding:8px 10px;border-radius:6px;"+
      "font-size:13px;margin-bottom:10px;box-sizing:border-box;"+
      "border:1px solid;";
    onT(()=>{
      keyInput.style.background=T.inputBg;
      keyInput.style.color=T.text;
      keyInput.style.borderColor=T.border2;
    });

    const valInput=document.createElement("textarea");
    valInput.value=initVal;
    valInput.placeholder="Value";
    valInput.rows=5;
    valInput.style.cssText=
      "width:100%;padding:8px 10px;border-radius:6px;"+
      "font-size:13px;margin-bottom:14px;box-sizing:border-box;"+
      "resize:vertical;border:1px solid;font-family:monospace;";
    onT(()=>{
      valInput.style.background=T.inputBg;
      valInput.style.color=T.text;
      valInput.style.borderColor=T.border2;
    });

    const btnRow=document.createElement("div");
    btnRow.style.cssText="display:flex;gap:8px;justify-content:flex-end;";

    const cancelBtn=mkBtn("取消","#555",()=>overlay.remove());
    const saveBtn=mkBtn("保存",T.accent,()=>{
      const k=keyInput.value.trim();
      const v=valInput.value;
      if(!k){showToast("Key不能为空",true);return;}
      if(currentStore==="localStorage")
        localStorage.setItem(k,v);
      else sessionStorage.setItem(k,v);
      overlay.remove();
      renderStoreContent();
      showToast("已保存");
    });

    btnRow.appendChild(cancelBtn);btnRow.appendChild(saveBtn);
    dlg.appendChild(dlgTitle);dlg.appendChild(keyInput);
    dlg.appendChild(valInput);dlg.appendChild(btnRow);
    overlay.appendChild(dlg);
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
    setTimeout(()=>keyReadonly?valInput.focus():keyInput.focus(),50);
  }

  function exportStorage(){
    const items=getStoreData();
    const obj={};
    items.forEach(({key,value})=>obj[key]=value);
    const json=JSON.stringify(obj,null,2);
    const ts=getTimestamp();
    downloadText(json,ts+"_"+currentStore+".json","application/json");
    showToast("已导出");
  }

  wrap.appendChild(storeBar);
  wrap.appendChild(actBar);
  wrap.appendChild(storeContent);

  switchStore("localStorage");
  return wrap;
}

// ════════════════════════════════════════════════
// 工具④ CSS动画暂停
// ════════════════════════════════════════════════
let animPaused=false;
let animStyle=null;

function toggleAnimation(){
  if(!animPaused){
    // 暂停
    animStyle=document.createElement("style");
    animStyle.id="tb_anim_pause";
    animStyle.textContent=
      "*,*::before,*::after{"+
      "animation-play-state:paused!important;"+
      "transition:none!important;}";
    document.head.appendChild(animStyle);
    animPaused=true;

    // 统计有动画的元素
    const count=[...document.querySelectorAll("*")]
      .filter(el=>{
        if(el.closest("#"+TOOL_ID))return false;
        const cs=getComputedStyle(el);
        return cs.animationName!=="none"||
          cs.transitionDuration!=="0s";
      }).length;

    toolBtns["animation"].innerHTML="▶ 恢复动画";
    toolBtns["animation"].style.background="#28a745";
    toolBtns["animation"].style.borderColor="#28a745";
    toolBtns["animation"].style.color="#fff";
    showToast("已暂停 "+count+" 个动画/过渡元素");

    // 显示状态卡片
    renderAnimResult(count,true);
  } else {
    // 恢复
    const s=document.getElementById("tb_anim_pause");
    if(s)s.remove();
    animPaused=false;
    animStyle=null;
    toolBtns["animation"].innerHTML="⏸ 动画";
    onT(()=>{
      toolBtns["animation"].style.background=
        currentTool==="animation"?T.accent:T.bg3;
      toolBtns["animation"].style.borderColor=
        currentTool==="animation"?T.accent:T.border;
      toolBtns["animation"].style.color=
        currentTool==="animation"?"#fff":T.text;
    });
    showToast("动画已恢复");
    renderAnimResult(0,false);
  }
}

function renderAnimResult(count,paused){
  contentArea.innerHTML="";
  const wrap=document.createElement("div");
  wrap.style.cssText=
    "display:flex;flex-direction:column;align-items:center;"+
    "justify-content:center;flex:1;padding:40px;gap:16px;";

  const icon=document.createElement("div");
  icon.style.cssText="font-size:64px;";
  icon.textContent=paused?"⏸":"▶";

  const msg=document.createElement("div");
  msg.style.cssText=
    "font-size:16px;font-weight:bold;text-align:center;";
  onT(()=>msg.style.color=T.text);
  msg.textContent=paused?
    "已暂停 "+count+" 个动画/过渡元素":
    "动画已恢复正常";

  const sub=document.createElement("div");
  sub.style.cssText="font-size:13px;text-align:center;";
  onT(()=>sub.style.color=T.text2);
  sub.textContent=paused?
    "再次点击「⏸动画」按钮恢复":
    "点击「⏸动画」按钮再次暂停";

  if(paused){
    const resumeBtn=mkBtn("▶ 立即恢复动画","#28a745",()=>{
      switchTool("animation");
    },"min-width:160px;");
    wrap.appendChild(icon);wrap.appendChild(msg);
    wrap.appendChild(sub);wrap.appendChild(resumeBtn);
  } else {
    wrap.appendChild(icon);wrap.appendChild(msg);wrap.appendChild(sub);
  }

  contentArea.appendChild(wrap);
}

// ════════════════════════════════════════════════
// 工具切换渲染
// ════════════════════════════════════════════════
function renderTool(id){
  contentArea.innerHTML="";
  if(id==="reader"){
    contentArea.appendChild(buildReader());
  } else if(id==="resource"){
    contentArea.appendChild(buildResource());
  } else if(id==="storage"){
    contentArea.appendChild(buildStorage());
  }
  applyTheme();
}

// ════════════════════════════════════════════════
// 阻止事件穿透
// ════════════════════════════════════════════════
panel.addEventListener("click",e=>e.stopPropagation());
panel.addEventListener("touchend",e=>e.stopPropagation());

// ════════════════════════════════════════════════
// 初始化
// ════════════════════════════════════════════════
applyTheme();
switchTool("reader");

})();
