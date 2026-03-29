// inspector.js v1.1 — 页面元素检测工具完整增强版
(function(){

const ROOT_ID="inspector_root";
const old=document.getElementById(ROOT_ID);
if(old){old.remove();return;}

// ════════════════════════════════════════════════
// CSS 变量系统（深色/亮色模式）
// ════════════════════════════════════════════════
const THEME={
  light:{
    bg:"#ffffff",bg2:"#f0f4ff",bg3:"#fafafa",
    border:"#e0e8ff",border2:"#eee",
    text:"#333",text2:"#888",text3:"#0078ff",
    topBg:"rgba(0,120,255,.92)",
    panelBorder:"#0078ff",
    rowHover:"#f5f7ff",
    tableBorder:"#f5f5f5",
    drawerBg:"#fff",
    actBg:"#f0f4ff",actBorder:"#c5d8ff",
    shadow:"rgba(0,0,0,.15)"
  },
  dark:{
    bg:"#1e1e1e",bg2:"#252526",bg3:"#2d2d2d",
    border:"#3a3a3a",border2:"#333",
    text:"#ccc",text2:"#888",text3:"#4fc3f7",
    topBg:"rgba(30,30,30,.96)",
    panelBorder:"#4fc3f7",
    rowHover:"#2a2a2a",
    tableBorder:"#2d2d2d",
    drawerBg:"#252526",
    actBg:"#2a2a2a",actBorder:"#444",
    shadow:"rgba(0,0,0,.4)"
  }
};
let isDark=false;
let T=THEME.light;

function applyTheme(){
  T=isDark?THEME.dark:THEME.light;
  // 更新所有主题相关元素
  themeTargets.forEach(fn=>fn());
}

const themeTargets=[];
function onTheme(fn){themeTargets.push(fn);fn();}

// ════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════
function getTimestamp(){
  const d=new Date();
  const p=n=>String(n).padStart(2,"0");
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
  const old=document.getElementById("insp_toast");
  if(old)old.remove();
  const t=document.createElement("div");
  t.id="insp_toast";
  t.style.cssText=
    "position:fixed;top:60px;left:50%;transform:translateX(-50%);"+
    "background:"+(isErr?"#e53935":"#323232")+";color:#fff;"+
    "padding:8px 20px;border-radius:20px;font-size:13px;"+
    "z-index:2147483649;pointer-events:none;white-space:nowrap;"+
    "box-shadow:0 2px 8px rgba(0,0,0,.3);";
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2000);
}

function getElId(el){
  let s=el.tagName.toLowerCase();
  if(el.id) s+="#"+el.id;
  if(el.className&&typeof el.className==="string"&&el.className.trim()){
    el.className.trim().split(/\s+/).slice(0,3).forEach(c=>s+="."+c);
  }
  return s;
}

function getAncestorChain(el){
  const chain=[];
  let node=el;
  while(node&&node.nodeType===1){
    chain.unshift(node);
    node=node.parentElement;
  }
  return chain;
}

function getCssSelector(el){
  const parts=[];
  let node=el;
  while(node&&node.nodeType===1){
    let sel=node.tagName.toLowerCase();
    if(node.id){sel+="#"+node.id;parts.unshift(sel);break;}
    const sibs=Array.from(node.parentElement?.children||[])
      .filter(c=>c.tagName===node.tagName);
    if(sibs.length>1) sel+=":nth-of-type("+(sibs.indexOf(node)+1)+")";
    parts.unshift(sel);
    node=node.parentElement;
  }
  return parts.join(" > ");
}

function getXPath(el){
  const parts=[];
  let node=el;
  while(node&&node.nodeType===1){
    const sibs=Array.from(node.parentElement?.children||[])
      .filter(c=>c.tagName===node.tagName);
    const idx=sibs.indexOf(node)+1;
    parts.unshift(node.tagName.toLowerCase()+
      (sibs.length>1?"["+idx+"]":""));
    node=node.parentElement;
  }
  return "/"+parts.join("/");
}

function getDimensions(el){
  const r=el.getBoundingClientRect();
  const cs=getComputedStyle(el);
  const fp=v=>parseFloat(v)||0;
  return {
    width:Math.round(r.width),height:Math.round(r.height),
    top:Math.round(r.top+window.scrollY),
    left:Math.round(r.left+window.scrollX),
    viewTop:Math.round(r.top),viewLeft:Math.round(r.left),
    rect:r,
    margin:[cs.marginTop,cs.marginRight,cs.marginBottom,cs.marginLeft].map(fp),
    border:[cs.borderTopWidth,cs.borderRightWidth,
            cs.borderBottomWidth,cs.borderLeftWidth].map(fp),
    padding:[cs.paddingTop,cs.paddingRight,
             cs.paddingBottom,cs.paddingLeft].map(fp),
    boxSizing:cs.boxSizing
  };
}

function getStyles(el){
  const cs=getComputedStyle(el);
  return [
    ["display",cs.display],["position",cs.position],
    ["font-size",cs.fontSize],["font-weight",cs.fontWeight],
    ["font-family",cs.fontFamily.split(",")[0].trim()],
    ["line-height",cs.lineHeight],["color",cs.color],
    ["background",cs.backgroundColor],["border",cs.border],
    ["border-radius",cs.borderRadius],["opacity",cs.opacity],
    ["z-index",cs.zIndex],["overflow",cs.overflow],
    ["cursor",cs.cursor],["flex",cs.flex],
    ["transform",cs.transform==="none"?"none":
      cs.transform.slice(0,20)+"…"],
  ];
}

function getComputedAll(el){
  const cs=getComputedStyle(el);
  const props=[
    "width","height","min-width","max-width","min-height","max-height",
    "margin-top","margin-right","margin-bottom","margin-left",
    "padding-top","padding-right","padding-bottom","padding-left",
    "border-top-width","border-right-width",
    "border-bottom-width","border-left-width",
    "font-size","line-height","letter-spacing","word-spacing",
    "color","background-color","border-color","border-radius",
    "display","position","top","right","bottom","left",
    "flex-direction","align-items","justify-content","flex-wrap","gap",
    "overflow","overflow-x","overflow-y","z-index",
    "opacity","visibility","pointer-events","cursor",
    "transition","animation","transform","box-shadow"
  ];
  return props.map(p=>[p,cs.getPropertyValue(p)]);
}

// 颜色对比度计算（WCAG）
function getLuminance(rgb){
  const vals=rgb.match(/\d+\.?\d*/g);
  if(!vals||vals.length<3)return 0;
  const [r,g,b]=vals.map(v=>{
    const c=parseFloat(v)/255;
    return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  });
  return 0.2126*r+0.7152*g+0.0722*b;
}

function getContrastRatio(color1,color2){
  const l1=getLuminance(color1);
  const l2=getLuminance(color2);
  const lighter=Math.max(l1,l2);
  const darker=Math.min(l1,l2);
  return ((lighter+0.05)/(darker+0.05)).toFixed(2);
}

function getA11y(el){
  const cs=getComputedStyle(el);
  const tag=el.tagName.toLowerCase();
  const results=[];

  // alt检测
  if(tag==="img"){
    results.push({
      label:"alt属性",
      pass:el.hasAttribute("alt"),
      val:el.getAttribute("alt")||"（缺失）"
    });
  }
  // aria-label
  results.push({
    label:"aria-label",
    pass:el.hasAttribute("aria-label")||
         el.hasAttribute("aria-labelledby"),
    val:el.getAttribute("aria-label")||
        el.getAttribute("aria-labelledby")||"（未设置）"
  });
  // role
  results.push({
    label:"role",
    pass:el.hasAttribute("role"),
    val:el.getAttribute("role")||"（未设置）"
  });
  // tabindex
  const ti=el.getAttribute("tabindex");
  results.push({
    label:"tabindex",
    pass:ti!==null,
    val:ti!==null?ti:"（未设置）"
  });
  // 颜色对比度
  const fg=cs.color;
  const bg=cs.backgroundColor;
  if(fg&&bg){
    const ratio=getContrastRatio(fg,bg);
    const pass=parseFloat(ratio)>=4.5;
    results.push({
      label:"颜色对比度",
      pass,
      val:ratio+":1 "+(pass?"✔ AA达标":"✗ 未达AA标准(≥4.5)"),
      detail:"前景:"+fg+" / 背景:"+bg
    });
  }
  // outline/focus
  const outline=cs.outline;
  results.push({
    label:"focus样式",
    pass:outline!=="0px"&&!outline.includes("none"),
    val:outline.includes("none")||outline==="0px"?
      "可能无focus样式":outline
  });

  return results;
}

// ════════════════════════════════════════════════
// 高亮覆盖层
// ════════════════════════════════════════════════
const COLORS={
  margin:"rgba(255,165,0,.25)",border:"rgba(255,220,0,.35)",
  padding:"rgba(100,200,100,.25)",content:"rgba(100,160,255,.2)"
};

const overlayRoot=document.createElement("div");
overlayRoot.style.cssText=
  "position:fixed;top:0;left:0;width:0;height:0;"+
  "pointer-events:none;z-index:2147483640;";

function mkOvBox(color){
  const d=document.createElement("div");
  d.style.cssText=
    "position:fixed;pointer-events:none;display:none;"+
    "background:"+color+";transition:all .06s;";
  return d;
}
const ovM=mkOvBox(COLORS.margin);
const ovB=mkOvBox(COLORS.border);
const ovP=mkOvBox(COLORS.padding);
const ovC=mkOvBox(COLORS.content);
const ovLine=document.createElement("div");
ovLine.style.cssText=
  "position:fixed;pointer-events:none;display:none;"+
  "border:2px solid #0078ff;box-sizing:border-box;"+
  "transition:all .06s;z-index:2147483641;";
[ovM,ovB,ovP,ovC,ovLine].forEach(d=>overlayRoot.appendChild(d));

// 测距标注层
const measureLayer=document.createElement("div");
measureLayer.style.cssText=
  "position:fixed;top:0;left:0;width:100%;height:100%;"+
  "pointer-events:none;z-index:2147483642;display:none;";
overlayRoot.appendChild(measureLayer);

// 搜索高亮层
const searchLayer=document.createElement("div");
searchLayer.style.cssText=
  "position:fixed;top:0;left:0;width:0;height:0;"+
  "pointer-events:none;z-index:2147483643;";
overlayRoot.appendChild(searchLayer);

// 网格层
const gridLayer=document.createElement("canvas");
gridLayer.style.cssText=
  "position:fixed;top:0;left:0;width:100%;height:100%;"+
  "pointer-events:none;z-index:2147483639;display:none;opacity:.4;";
overlayRoot.appendChild(gridLayer);

document.body.appendChild(overlayRoot);

function setOvBox(el,x,y,w,h){
  el.style.left=x+"px";el.style.top=y+"px";
  el.style.width=Math.max(0,w)+"px";
  el.style.height=Math.max(0,h)+"px";
  el.style.display="block";
}

function highlightElement(el){
  if(!el||el===document.documentElement){clearHighlight();return;}
  const r=el.getBoundingClientRect();
  const cs=getComputedStyle(el);
  const fp=v=>parseFloat(v)||0;
  const mt=fp(cs.marginTop),mb=fp(cs.marginBottom);
  const ml=fp(cs.marginLeft),mr=fp(cs.marginRight);
  const bt=fp(cs.borderTopWidth),bb=fp(cs.borderBottomWidth);
  const bl=fp(cs.borderLeftWidth),br=fp(cs.borderRightWidth);
  const pt=fp(cs.paddingTop),pb=fp(cs.paddingBottom);
  const pl=fp(cs.paddingLeft),pr=fp(cs.paddingRight);
  setOvBox(ovM,r.left-ml,r.top-mt,r.width+ml+mr,r.height+mt+mb);
  setOvBox(ovB,r.left,r.top,r.width,r.height);
  setOvBox(ovP,r.left+bl,r.top+bt,r.width-bl-br,r.height-bt-bb);
  setOvBox(ovC,r.left+bl+pl,r.top+bt+pt,
    r.width-bl-br-pl-pr,r.height-bt-bb-pt-pb);
  setOvBox(ovLine,r.left-ml,r.top-mt,
    r.width+ml+mr,r.height+mt+mb);
}

function clearHighlight(){
  [ovM,ovB,ovP,ovC,ovLine].forEach(d=>d.style.display="none");
}

// ════════════════════════════════════════════════
// 网格功能
// ════════════════════════════════════════════════
let gridSize=8;
let gridOn=false;

function drawGrid(){
  const dpr=window.devicePixelRatio||1;
  const W=window.innerWidth,H=window.innerHeight;
  gridLayer.width=W*dpr;gridLayer.height=H*dpr;
  gridLayer.style.width=W+"px";gridLayer.style.height=H+"px";
  const ctx=gridLayer.getContext("2d");
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle="rgba(255,0,100,.35)";
  ctx.lineWidth=.5;
  for(let x=0;x<W;x+=gridSize){
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
  }
  for(let y=0;y<H;y+=gridSize){
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
  }
}

function toggleGrid(){
  gridOn=!gridOn;
  if(gridOn){
    gridLayer.style.display="block";
    drawGrid();
    gridBtn.textContent="网格 "+gridSize+"px ✔";
    gridBtn.style.color=T.text3;
  } else {
    gridLayer.style.display="none";
    gridBtn.textContent="网格";
    gridBtn.style.color=T.text2;
  }
}

function cycleGridSize(){
  const sizes=[4,8,16,32];
  const idx=sizes.indexOf(gridSize);
  gridSize=sizes[(idx+1)%sizes.length];
  if(gridOn){drawGrid();gridBtn.textContent="网格 "+gridSize+"px ✔";}
}

// ════════════════════════════════════════════════
// 主面板 DOM 构建
// ════════════════════════════════════════════════
const root=document.createElement("div");
root.id=ROOT_ID;
root.style.cssText=
  "position:fixed;z-index:2147483647;font-size:13px;"+
  "font-family:-apple-system,BlinkMacSystemFont,monospace;"+
  "touch-action:none;";

// ── 顶部栏 ────────────────────────────────────
const topBar=document.createElement("div");
topBar.style.cssText=
  "position:fixed;top:0;left:0;width:100%;"+
  "padding:6px 12px;box-sizing:border-box;"+
  "display:flex;align-items:center;gap:8px;"+
  "z-index:2147483648;box-shadow:0 2px 8px rgba(0,0,0,.2);";

onTheme(()=>{
  topBar.style.background=T.topBg;
  topBar.style.color="#fff";
});

const topTitle=document.createElement("span");
topTitle.textContent="📐";
topTitle.style.cssText="font-size:16px;flex-shrink:0;";

const topHint=document.createElement("span");
topHint.textContent="悬停选元素，点击锁定";
topHint.style.cssText="font-size:12px;opacity:.85;flex:1;";

// 顶部功能按钮
function mkTopBtn(t,fn){
  const b=document.createElement("button");
  b.textContent=t;
  b.style.cssText=
    "padding:4px 10px;background:rgba(255,255,255,.15);"+
    "color:#fff;border:1px solid rgba(255,255,255,.3);"+
    "border-radius:10px;font-size:12px;cursor:pointer;white-space:nowrap;";
  b.onclick=fn;return b;
}

const searchToggleBtn=mkTopBtn("🔍",toggleSearch);
const themeBtn=mkTopBtn("🌙",toggleTheme);
const gridBtn=mkTopBtn("网格",()=>{
  if(gridOn) cycleGridSize();
  else toggleGrid();
});
gridBtn.ondblclick=(e)=>{e.stopPropagation();toggleGrid();};
const historyBtn=mkTopBtn("历史",toggleDrawer);
const exitBtn=mkTopBtn("✕ 退出",cleanup);

[topTitle,topHint,searchToggleBtn,gridBtn,
 historyBtn,themeBtn,exitBtn].forEach(e=>topBar.appendChild(e));

// ── 搜索栏（默认隐藏）────────────────────────
const searchBar=document.createElement("div");
searchBar.style.cssText=
  "position:fixed;top:42px;left:0;width:100%;"+
  "padding:6px 12px;box-sizing:border-box;"+
  "z-index:2147483648;display:none;"+
  "box-shadow:0 2px 6px rgba(0,0,0,.15);";
onTheme(()=>{
  searchBar.style.background=T.bg;
  searchBar.style.borderBottom="1px solid "+T.border;
});

const searchInner=document.createElement("div");
searchInner.style.cssText=
  "display:flex;gap:8px;align-items:center;";

const searchInput=document.createElement("input");
searchInput.placeholder="#id / .class / 文字内容 / CSS选择器";
searchInput.style.cssText=
  "flex:1;padding:6px 10px;border-radius:6px;font-size:13px;"+
  "border:1px solid #ddd;box-sizing:border-box;";
onTheme(()=>{
  searchInput.style.background=T.bg2;
  searchInput.style.color=T.text;
  searchInput.style.border="1px solid "+T.border;
});

const searchCount=document.createElement("span");
searchCount.style.cssText="font-size:12px;white-space:nowrap;";
onTheme(()=>searchCount.style.color=T.text2);

const searchPrev=mkTopBtn("↑",()=>navigateSearch(-1));
const searchNext=mkTopBtn("↓",()=>navigateSearch(1));
const searchClose=mkTopBtn("✕",toggleSearch);

[searchInput,searchCount,searchPrev,searchNext,searchClose]
  .forEach(e=>searchInner.appendChild(e));
searchBar.appendChild(searchInner);

let searchResults=[],searchIdx=0;
let searchOn=false;
let searchBoxes=[];

function toggleSearch(){
  searchOn=!searchOn;
  searchBar.style.display=searchOn?"block":"none";
  panel.style.bottom=getPanelBottom()+"px";
  if(searchOn){
    searchInput.focus();
    searchInput.oninput=doSearch;
  } else {
    clearSearchHighlight();
    searchInput.value="";
    searchCount.textContent="";
  }
}

function doSearch(){
  clearSearchHighlight();
  const q=searchInput.value.trim();
  if(!q){searchCount.textContent="";return;}
  let els=[];
  try{
    if(q.startsWith("#")||q.startsWith(".")||
       q.includes(" ")||q.includes(">")){
      els=Array.from(document.querySelectorAll(q))
        .filter(e=>!e.closest("#"+ROOT_ID));
    } else {
      // 文字内容搜索
      const walker=document.createTreeWalker(
        document.body,NodeFilter.SHOW_TEXT);
      const matched=new Set();
      let n;
      while(n=walker.nextNode()){
        if(n.textContent.includes(q)&&n.parentElement&&
           !n.parentElement.closest("#"+ROOT_ID)){
          matched.add(n.parentElement);
        }
      }
      els=Array.from(matched);
    }
  } catch(e){els=[];}

  searchResults=els;
  searchIdx=0;

  // 绘制高亮框
  els.forEach((el,i)=>{
    const r=el.getBoundingClientRect();
    const box=document.createElement("div");
    box.style.cssText=
      "position:fixed;pointer-events:none;"+
      "border:2px solid "+(i===0?"#e53935":"#ff9800")+";"+
      "background:rgba(255,152,0,.08);box-sizing:border-box;"+
      "left:"+r.left+"px;top:"+r.top+"px;"+
      "width:"+r.width+"px;height:"+r.height+"px;";
    searchLayer.appendChild(box);
    searchBoxes.push(box);
  });

  searchCount.textContent=
    els.length>0?"1/"+els.length:"无结果";
  if(els.length>0) scrollToSearchResult(0);
}

function navigateSearch(dir){
  if(searchResults.length===0)return;
  searchIdx=(searchIdx+dir+searchResults.length)%searchResults.length;
  // 更新高亮颜色
  searchBoxes.forEach((b,i)=>{
    b.style.borderColor=i===searchIdx?"#e53935":"#ff9800";
  });
  searchCount.textContent=(searchIdx+1)+"/"+searchResults.length;
  scrollToSearchResult(searchIdx);
}

function scrollToSearchResult(idx){
  const el=searchResults[idx];
  if(!el)return;
  el.scrollIntoView({block:"center",behavior:"smooth"});
  lockElement(el);
}

function clearSearchHighlight(){
  searchBoxes.forEach(b=>b.remove());
  searchBoxes=[];
  searchResults=[];
}

// ── 历史记录抽屉 ──────────────────────────────
const drawer=document.createElement("div");
drawer.style.cssText=
  "position:fixed;top:0;left:-220px;width:220px;height:100%;"+
  "z-index:2147483648;transition:left .25s;"+
  "display:flex;flex-direction:column;"+
  "box-shadow:4px 0 16px rgba(0,0,0,.2);";
onTheme(()=>{
  drawer.style.background=T.drawerBg;
  drawer.style.borderRight="1px solid "+T.border;
});

const drawerTitle=document.createElement("div");
drawerTitle.style.cssText=
  "padding:12px;font-weight:bold;font-size:14px;"+
  "border-bottom:1px solid;flex-shrink:0;margin-top:42px;";
onTheme(()=>{
  drawerTitle.style.color=T.text;
  drawerTitle.style.borderColor=T.border;
});
drawerTitle.textContent="📋 历史记录";

const drawerList=document.createElement("div");
drawerList.style.cssText="flex:1;overflow-y:auto;";

const drawerClear=document.createElement("button");
drawerClear.textContent="清空历史";
drawerClear.style.cssText=
  "width:100%;padding:10px;border:none;font-size:13px;"+
  "cursor:pointer;flex-shrink:0;";
onTheme(()=>{
  drawerClear.style.background=T.bg2;
  drawerClear.style.color=T.text2;
  drawerClear.style.borderTop="1px solid "+T.border;
});
drawerClear.onclick=()=>{history=[];renderDrawer();};

drawer.appendChild(drawerTitle);
drawer.appendChild(drawerList);
drawer.appendChild(drawerClear);

let drawerOpen=false;
let drawerBackdrop=null;

function toggleDrawer(){
  drawerOpen=!drawerOpen;
  drawer.style.left=drawerOpen?"0":"-220px";
  if(drawerOpen){
    renderDrawer();
    drawerBackdrop=document.createElement("div");
    drawerBackdrop.style.cssText=
      "position:fixed;top:0;left:0;width:100%;height:100%;"+
      "background:rgba(0,0,0,.3);z-index:2147483647;";
    drawerBackdrop.onclick=toggleDrawer;
    root.appendChild(drawerBackdrop);
  } else {
    if(drawerBackdrop){drawerBackdrop.remove();drawerBackdrop=null;}
  }
}

let history=[];
const MAX_HIST=20;

function renderDrawer(){
  drawerList.innerHTML="";
  if(history.length===0){
    const empty=document.createElement("div");
    empty.style.cssText="padding:20px;text-align:center;";
    onTheme(()=>empty.style.color=T.text2);
    empty.textContent="暂无历史记录";
    drawerList.appendChild(empty);
    return;
  }
  history.forEach((item,i)=>{
    const row=document.createElement("div");
    row.style.cssText=
      "padding:10px 12px;cursor:pointer;"+
      "border-bottom:1px solid;"+
      "display:flex;align-items:center;gap:8px;";
    onTheme(()=>{
      row.style.borderColor=T.border;
      row.style.color=T.text;
    });

    const label=document.createElement("div");
    label.style.cssText="flex:1;font-size:12px;word-break:break-all;";
    try{label.textContent=getElId(item.el);}
    catch(e){label.textContent="[已移除]";}

    const size=document.createElement("div");
    size.style.cssText="font-size:11px;white-space:nowrap;";
    onTheme(()=>size.style.color=T.text2);
    try{
      const r=item.el.getBoundingClientRect();
      size.textContent=Math.round(r.width)+"×"+Math.round(r.height);
    } catch(e){size.textContent="";}

    const del=document.createElement("button");
    del.textContent="✕";
    del.style.cssText=
      "padding:2px 6px;border:none;border-radius:4px;"+
      "font-size:11px;cursor:pointer;flex-shrink:0;";
    onTheme(()=>{del.style.background=T.bg2;del.style.color=T.text2;});
    del.onclick=(e)=>{
      e.stopPropagation();
      history.splice(i,1);
      renderDrawer();
    };

    row.appendChild(label);row.appendChild(size);row.appendChild(del);
    row.onclick=()=>{
      try{lockElement(item.el);toggleDrawer();}
      catch(e){showToast("元素已不在页面中",true);}
    };
    row.onmouseover=()=>row.style.background=T.rowHover;
    row.onmouseout=()=>row.style.background="";
    drawerList.appendChild(row);
  });
}

// ── 主面板 ────────────────────────────────────
const panel=document.createElement("div");
panel.style.cssText=
  "position:fixed;bottom:0;left:0;width:100%;"+
  "display:flex;flex-direction:column;"+
  "z-index:2147483647;";
onTheme(()=>{
  panel.style.background=T.bg;
  panel.style.borderTop="2px solid "+T.panelBorder;
  panel.style.boxShadow="0 -4px 20px "+T.shadow;
});

let panelHeight=Math.round(window.innerHeight*0.5);
panel.style.maxHeight=panelHeight+"px";

// 面板高度拖动手柄
const dragHandle=document.createElement("div");
dragHandle.style.cssText=
  "height:20px;display:flex;align-items:center;"+
  "justify-content:center;cursor:ns-resize;flex-shrink:0;";
onTheme(()=>{
  dragHandle.style.background=T.bg3;
  dragHandle.style.borderBottom="1px solid "+T.border2;
});

const dragBar=document.createElement("div");
dragBar.style.cssText=
  "width:40px;height:4px;border-radius:2px;";
onTheme(()=>dragBar.style.background=T.text2);
dragHandle.appendChild(dragBar);

let panelDragging=false,panelStartY=0,panelStartH=0;
dragHandle.addEventListener("mousedown",e=>{
  panelDragging=true;panelStartY=e.clientY;
  panelStartH=panelHeight;e.preventDefault();
});
dragHandle.addEventListener("touchstart",e=>{
  panelDragging=true;
  panelStartY=e.touches[0].clientY;
  panelStartH=panelHeight;e.preventDefault();
},{passive:false});

document.addEventListener("mousemove",e=>{
  if(!panelDragging)return;
  const dy=panelStartY-e.clientY;
  panelHeight=Math.max(
    Math.round(window.innerHeight*0.2),
    Math.min(Math.round(window.innerHeight*0.85),
    panelStartH+dy));
  panel.style.maxHeight=panelHeight+"px";
});
document.addEventListener("touchmove",e=>{
  if(!panelDragging)return;
  const dy=panelStartY-e.touches[0].clientY;
  panelHeight=Math.max(
    Math.round(window.innerHeight*0.2),
    Math.min(Math.round(window.innerHeight*0.85),
    panelStartH+dy));
  panel.style.maxHeight=panelHeight+"px";
  e.preventDefault();
},{passive:false});
document.addEventListener("mouseup",()=>panelDragging=false);
document.addEventListener("touchend",()=>panelDragging=false);

// 元素标识行
const elIdRow=document.createElement("div");
elIdRow.style.cssText=
  "padding:6px 12px;font-size:12px;font-weight:bold;"+
  "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;";
onTheme(()=>{
  elIdRow.style.background=T.bg2;
  elIdRow.style.color=T.text3;
  elIdRow.style.borderBottom="1px solid "+T.border;
});
elIdRow.textContent="请悬停到页面元素上…";

// 面包屑
const breadcrumb=document.createElement("div");
breadcrumb.style.cssText=
  "padding:5px 12px;font-size:11px;"+
  "overflow-x:auto;white-space:nowrap;"+
  "flex-shrink:0;display:flex;align-items:center;gap:3px;";
onTheme(()=>{
  breadcrumb.style.background=T.bg3;
  breadcrumb.style.borderBottom="1px solid "+T.border2;
  breadcrumb.style.color=T.text2;
});

// 标签页导航
const tabBar=document.createElement("div");
tabBar.style.cssText=
  "display:flex;flex-shrink:0;";
onTheme(()=>{
  tabBar.style.borderBottom="1px solid "+T.border2;
  tabBar.style.background=T.bg;
});

const TABS=["尺寸","样式","DOM树","计算值","无障碍","对比"];
const tabBtns={};const tabPanels={};

TABS.forEach(name=>{
  const btn=document.createElement("button");
  btn.textContent=name;
  btn.style.cssText=
    "flex:1;padding:7px 2px;border:none;"+
    "font-size:12px;cursor:pointer;"+
    "border-bottom:2px solid transparent;";
  btn.onclick=()=>switchTab(name);
  tabBtns[name]=btn;tabBar.appendChild(btn);

  const pane=document.createElement("div");
  pane.style.cssText=
    "flex:1;overflow-y:auto;padding:10px 12px;display:none;";
  onTheme(()=>pane.style.background=T.bg);
  tabPanels[name]=pane;
});

let currentTab="尺寸";
function switchTab(name){
  TABS.forEach(n=>{
    const active=n===name;
    tabBtns[n].style.borderBottom=
      active?"2px solid "+T.text3:"2px solid transparent";
    tabBtns[n].style.fontWeight=active?"bold":"normal";
    tabPanels[n].style.display=active?"block":"none";
  });
  onTheme(()=>{
    TABS.forEach(n=>{
      tabBtns[n].style.background=T.bg;
      tabBtns[n].style.color=
        n===name?T.text3:T.text2;
    });
  });
  currentTab=name;
}
switchTab("尺寸");

// 内容区
const contentArea=document.createElement("div");
contentArea.style.cssText=
  "flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;";
contentArea.appendChild(tabBar);
TABS.forEach(n=>contentArea.appendChild(tabPanels[n]));

// 底部操作栏
const actionBar=document.createElement("div");
actionBar.style.cssText=
  "display:flex;gap:5px;padding:8px 10px;flex-shrink:0;flex-wrap:wrap;";
onTheme(()=>{
  actionBar.style.borderTop="1px solid "+T.border2;
  actionBar.style.background=T.bg3;
});

function mkAct(t,fn){
  const b=document.createElement("button");
  b.textContent=t;
  b.style.cssText=
    "flex:1;padding:7px 4px;border-radius:6px;"+
    "font-size:12px;cursor:pointer;min-width:60px;border:1px solid;";
  onTheme(()=>{
    b.style.background=T.actBg;
    b.style.color=T.text3;
    b.style.borderColor=T.actBorder;
  });
  b.onclick=fn;return b;
}

const actParent =mkAct("↑ 父节点",()=>navigateTo("parent"));
const actPrev   =mkAct("← 前兄弟",()=>navigateTo("prev"));
const actNext   =mkAct("→ 后兄弟",()=>navigateTo("next"));
const actChildren=mkAct("↓ 子节点",()=>navigateTo("children"));
const actMeasure=mkAct("📏 测距",toggleMeasureMode);
const actExport =mkAct("📄 导出",exportReport);

[actParent,actPrev,actNext,actChildren,actMeasure,actExport]
  .forEach(b=>actionBar.appendChild(b));

panel.appendChild(dragHandle);
panel.appendChild(elIdRow);
panel.appendChild(breadcrumb);
panel.appendChild(contentArea);
panel.appendChild(actionBar);

root.appendChild(topBar);
root.appendChild(searchBar);
root.appendChild(drawer);
root.appendChild(panel);
document.body.appendChild(root);

function getPanelBottom(){
  return 0;
}

// ════════════════════════════════════════════════
// 渲染函数
// ════════════════════════════════════════════════
function mkTable(rows){
  const table=document.createElement("table");
  table.style.cssText=
    "width:100%;border-collapse:collapse;font-size:12px;";
  rows.forEach(([k,v,extra])=>{
    const tr=document.createElement("tr");
    const td1=document.createElement("td");
    td1.style.cssText=
      "padding:4px 6px;white-space:nowrap;width:38%;";
    onTheme(()=>{
      td1.style.color=T.text2;
      td1.style.borderBottom="1px solid "+T.tableBorder;
    });
    td1.textContent=k;
    const td2=document.createElement("td");
    td2.style.cssText="padding:4px 6px;word-break:break-all;";
    onTheme(()=>{
      td2.style.color=T.text;
      td2.style.borderBottom="1px solid "+T.tableBorder;
    });
    if(extra){
      const sw=document.createElement("span");
      sw.style.cssText=
        "display:inline-block;width:11px;height:11px;"+
        "border-radius:2px;border:1px solid #ccc;"+
        "margin-right:4px;vertical-align:middle;"+
        "background:"+v+";";
      td2.appendChild(sw);
      td2.appendChild(document.createTextNode(extra));
    } else {
      td2.textContent=v||"-";
    }
    tr.appendChild(td1);tr.appendChild(td2);
    table.appendChild(tr);
  });
  return table;
}

function mkCopyBtn(label,fn){
  const b=document.createElement("button");
  b.textContent=label;
  b.style.cssText=
    "padding:6px 8px;border-radius:6px;"+
    "font-size:11px;cursor:pointer;border:1px solid;";
  onTheme(()=>{
    b.style.background=T.actBg;
    b.style.color=T.text3;
    b.style.borderColor=T.actBorder;
  });
  b.onclick=()=>{fn();showToast("已复制");};
  return b;
}

// ── 尺寸标签 ──────────────────────────────────
function renderDimensions(el){
  const pane=tabPanels["尺寸"];
  pane.innerHTML="";
  if(!el)return;
  const d=getDimensions(el);

  // 盒模型可视化
  const vis=document.createElement("div");
  vis.style.cssText=
    "position:relative;margin:6px auto 10px;"+
    "width:210px;height:130px;";

  function mkLayer(label,color,inset,val){
    const div=document.createElement("div");
    div.style.cssText=
      "position:absolute;background:"+color+";"+
      "inset:"+inset+";display:flex;"+
      "align-items:flex-start;justify-content:flex-start;"+
      "padding:2px 4px;font-size:10px;color:#555;"+
      "box-sizing:border-box;border-radius:3px;";
    div.textContent=label+" "+val;
    return div;
  }

  const m=d.margin,b=d.border,p=d.padding;
  vis.appendChild(mkLayer("margin",COLORS.margin,"0",
    m[0]+" "+m[1]+" "+m[2]+" "+m[3]));
  vis.appendChild(mkLayer("border",COLORS.border,"14px",
    b[0]+"px"));
  vis.appendChild(mkLayer("padding",COLORS.padding,"28px",
    p[0]+" "+p[1]+" "+p[2]+" "+p[3]));
  const cDiv=document.createElement("div");
  cDiv.style.cssText=
    "position:absolute;inset:42px;background:"+COLORS.content+";"+
    "display:flex;align-items:center;justify-content:center;"+
    "font-size:12px;font-weight:bold;border-radius:2px;";
  onTheme(()=>cDiv.style.color=T.text);
  cDiv.textContent=d.width+" × "+d.height;
  vis.appendChild(cDiv);
  pane.appendChild(vis);

  pane.appendChild(mkTable([
    ["内容尺寸",d.width+" × "+d.height+" px"],
    ["页面位置","top:"+d.top+" left:"+d.left],
    ["视口位置","top:"+d.viewTop+" left:"+d.viewLeft],
    ["box-sizing",d.boxSizing],
    ["margin",m.join(" / ")+" px"],
    ["border",b.join(" / ")+" px"],
    ["padding",p.join(" / ")+" px"],
  ]));

  const copyRow=document.createElement("div");
  copyRow.style.cssText=
    "display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;";
  [
    ["复制尺寸",()=>copyText(d.width+"×"+d.height)],
    ["复制选择器",()=>copyText(getCssSelector(el))],
    ["复制XPath",()=>copyText(getXPath(el))],
    ["复制为CSS",()=>copyText(genCSS(el))],
    ["复制为JSON",()=>copyText(genJSON(el))],
  ].forEach(([t,fn])=>copyRow.appendChild(mkCopyBtn(t,fn)));
  pane.appendChild(copyRow);
}

function genCSS(el){
  const d=getDimensions(el);
  const cs=getComputedStyle(el);
  return ".element {\n"+
    "  width: "+d.width+"px;\n"+
    "  height: "+d.height+"px;\n"+
    "  padding: "+d.padding.join(" ")+";\n"+
    "  margin: "+d.margin.join(" ")+";\n"+
    "  font-size: "+cs.fontSize+";\n"+
    "  color: "+cs.color+";\n"+
    "  background: "+cs.backgroundColor+";\n"+
    "  border-radius: "+cs.borderRadius+";\n"+
    "}";
}

function genJSON(el){
  const d=getDimensions(el);
  return JSON.stringify({
    tag:el.tagName.toLowerCase(),
    id:el.id||null,
    class:el.className||null,
    width:d.width,height:d.height,
    top:d.top,left:d.left,
    margin:d.margin,border:d.border,padding:d.padding
  },null,2);
}

// ── 样式标签 ──────────────────────────────────
function renderStyles(el){
  const pane=tabPanels["样式"];
  pane.innerHTML="";
  if(!el)return;
  const styles=getStyles(el);
  const rows=styles.map(([p,v])=>{
    if(p==="color"||p==="background"){
      return [p,v,v]; // extra=颜色值用于色块
    }
    return [p,v];
  });
  pane.appendChild(mkTable(rows));
  const b=mkCopyBtn("复制全部样式",()=>
    copyText(styles.map(([p,v])=>p+": "+v).join("\n")));
  b.style.marginTop="8px";b.style.width="100%";
  pane.appendChild(b);
}

// ── DOM树标签 ─────────────────────────────────
function renderDOMTree(el){
  const pane=tabPanels["DOM树"];
  pane.innerHTML="";
  if(!el)return;

  const chain=getAncestorChain(el);

  // 祖先链
  const t1=document.createElement("div");
  t1.style.cssText="font-size:11px;margin-bottom:6px;";
  onTheme(()=>t1.style.color=T.text2);
  t1.textContent="祖先链（根节点 → 当前元素）";
  pane.appendChild(t1);

  chain.forEach((node,depth)=>{
    const isCur=node===el;
    const row=document.createElement("div");
    row.style.cssText=
      "display:flex;align-items:center;padding:3px 0;"+
      "padding-left:"+(depth*12)+"px;"+
      "border-radius:4px;cursor:"+(isCur?"default":"pointer")+";";
    onTheme(()=>{
      row.style.color=isCur?T.text3:T.text;
      if(isCur) row.style.background=T.bg2;
    });

    const arr=document.createElement("span");
    arr.style.cssText="margin-right:4px;font-size:10px;";
    onTheme(()=>arr.style.color=T.text2);
    arr.textContent=depth<chain.length-1?"▼":"►";

    const lbl=document.createElement("span");
    lbl.style.cssText=
      "font-size:12px;"+(isCur?"font-weight:bold;":"");
    lbl.textContent=getElId(node);

    row.appendChild(arr);row.appendChild(lbl);
    if(!isCur){
      row.onclick=(e)=>{e.stopPropagation();lockElement(node);};
      row.onmouseover=()=>row.style.background=T.rowHover;
      row.onmouseout=()=>{
        if(node!==el) row.style.background="";
      };
    }
    pane.appendChild(row);
  });

  // 子节点
  const children=Array.from(el.children);
  if(children.length>0){
    const t2=document.createElement("div");
    t2.style.cssText=
      "font-size:11px;margin:10px 0 6px;padding-top:8px;";
    onTheme(()=>{
      t2.style.color=T.text2;
      t2.style.borderTop="1px solid "+T.border2;
    });
    t2.textContent="直接子节点（"+children.length+"）";
    pane.appendChild(t2);

    children.forEach(child=>{
      const r=document.createElement("div");
      r.style.cssText=
        "padding:3px 8px;cursor:pointer;border-radius:4px;"+
        "font-size:12px;display:flex;align-items:center;gap:6px;";
      onTheme(()=>r.style.color=T.text);
      const ic=document.createElement("span");
      ic.textContent="►";
      onTheme(()=>ic.style.color=T.text2);
      const lb=document.createElement("span");
      lb.textContent=getElId(child);
      // 子节点尺寸
      const sz=document.createElement("span");
      sz.style.cssText="font-size:10px;margin-left:auto;";
      onTheme(()=>sz.style.color=T.text2);
      try{
        const cr=child.getBoundingClientRect();
        sz.textContent=Math.round(cr.width)+"×"+
          Math.round(cr.height);
      }catch(e){}
      r.appendChild(ic);r.appendChild(lb);r.appendChild(sz);
      r.onclick=(e)=>{e.stopPropagation();lockElement(child);};
      r.onmouseover=()=>r.style.background=T.rowHover;
      r.onmouseout=()=>r.style.background="";
      pane.appendChild(r);
    });
  }

  // 兄弟节点
  const sibs=Array.from(el.parentElement?.children||[])
    .filter(c=>c!==el);
  if(sibs.length>0){
    const t3=document.createElement("div");
    t3.style.cssText=
      "font-size:11px;margin:10px 0 6px;padding-top:8px;";
    onTheme(()=>{
      t3.style.color=T.text2;
      t3.style.borderTop="1px solid "+T.border2;
    });
    t3.textContent="兄弟节点（"+sibs.length+"）";
    pane.appendChild(t3);
    sibs.slice(0,10).forEach(sib=>{
      const r=document.createElement("div");
      r.style.cssText=
        "padding:3px 8px;cursor:pointer;border-radius:4px;font-size:12px;";
      onTheme(()=>r.style.color=T.text);
      r.textContent=getElId(sib);
      r.onclick=(e)=>{e.stopPropagation();lockElement(sib);};
      r.onmouseover=()=>r.style.background=T.rowHover;
      r.onmouseout=()=>r.style.background="";
      pane.appendChild(r);
    });
    if(sibs.length>10){
      const more=document.createElement("div");
      more.style.cssText="font-size:11px;padding:4px 8px;";
      onTheme(()=>more.style.color=T.text2);
      more.textContent="…还有"+(sibs.length-10)+"个";
      pane.appendChild(more);
    }
  }
}

// ── 计算值标签 ────────────────────────────────
function renderComputed(el){
  const pane=tabPanels["计算值"];
  pane.innerHTML="";
  if(!el)return;

  const si=document.createElement("input");
  si.type="text";si.placeholder="搜索属性名…";
  si.style.cssText=
    "width:100%;padding:6px 10px;border-radius:6px;"+
    "font-size:12px;box-sizing:border-box;margin-bottom:8px;";
  onTheme(()=>{
    si.style.background=T.bg2;si.style.color=T.text;
    si.style.border="1px solid "+T.border;
  });
  pane.appendChild(si);

  const styles=getComputedAll(el);
  const table=document.createElement("table");
  table.style.cssText=
    "width:100%;border-collapse:collapse;font-size:12px;";

  function build(filter){
    table.innerHTML="";
    styles.filter(([p,v])=>
      v&&v!=="normal"&&v!=="none"&&v!=="auto"&&v!=="0px"&&
      (!filter||p.includes(filter))
    ).forEach(([p,v])=>{
      const tr=document.createElement("tr");
      const td1=document.createElement("td");
      td1.style.cssText="padding:3px 6px;white-space:nowrap;width:50%;";
      onTheme(()=>{
        td1.style.color=T.text2;
        td1.style.borderBottom="1px solid "+T.tableBorder;
      });
      td1.textContent=p;
      const td2=document.createElement("td");
      td2.style.cssText="padding:3px 6px;word-break:break-all;";
      onTheme(()=>{
        td2.style.color=T.text;
        td2.style.borderBottom="1px solid "+T.tableBorder;
      });
      td2.textContent=v;
      tr.appendChild(td1);tr.appendChild(td2);
      table.appendChild(tr);
    });
  }
  build("");
  si.oninput=()=>build(si.value.trim());
  pane.appendChild(table);

  const cb=mkCopyBtn("复制全部计算值",()=>
    copyText(styles.map(([p,v])=>p+": "+v).join("\n")));
  cb.style.cssText+=";width:100%;margin-top:8px;";
  pane.appendChild(cb);
}

// ── 无障碍标签 ────────────────────────────────
function renderA11y(el){
  const pane=tabPanels["无障碍"];
  pane.innerHTML="";
  if(!el)return;

  const results=getA11y(el);
  const title=document.createElement("div");
  title.style.cssText="font-size:11px;margin-bottom:8px;";
  onTheme(()=>title.style.color=T.text2);
  title.textContent="WCAG 无障碍检测结果";
  pane.appendChild(title);

  results.forEach(item=>{
    const row=document.createElement("div");
    row.style.cssText=
      "padding:8px 10px;border-radius:6px;margin-bottom:6px;";
    onTheme(()=>row.style.background=T.bg2);

    const head=document.createElement("div");
    head.style.cssText=
      "display:flex;align-items:center;gap:8px;margin-bottom:3px;";

    const icon=document.createElement("span");
    icon.textContent=item.pass?"✔":"✗";
    icon.style.cssText=
      "font-weight:bold;color:"+(item.pass?"#4caf50":"#e53935")+";";

    const label=document.createElement("span");
    label.style.cssText="font-size:13px;font-weight:bold;";
    onTheme(()=>label.style.color=T.text);
    label.textContent=item.label;

    head.appendChild(icon);head.appendChild(label);

    const val=document.createElement("div");
    val.style.cssText="font-size:12px;margin-left:22px;word-break:break-all;";
    onTheme(()=>val.style.color=T.text2);
    val.textContent=item.val;

    row.appendChild(head);row.appendChild(val);

    if(item.detail){
      const det=document.createElement("div");
      det.style.cssText=
        "font-size:11px;margin-left:22px;margin-top:2px;";
      onTheme(()=>det.style.color=T.text2);
      det.textContent=item.detail;
      row.appendChild(det);
    }
    pane.appendChild(row);
  });

  const passCount=results.filter(r=>r.pass).length;
  const summary=document.createElement("div");
  summary.style.cssText=
    "text-align:center;padding:8px;border-radius:6px;"+
    "font-weight:bold;font-size:13px;margin-top:4px;";
  summary.style.background=
    passCount===results.length?"#e8f5e9":"#fff3e0";
  summary.style.color=
    passCount===results.length?"#2e7d32":"#e65100";
  summary.textContent=
    "通过 "+passCount+"/"+results.length+" 项检测";
  pane.appendChild(summary);
}

// ── 对比标签 ──────────────────────────────────
let compareElA=null,compareElB=null;

function renderCompare(){
  const pane=tabPanels["对比"];
  pane.innerHTML="";

  const hint=document.createElement("div");
  hint.style.cssText="font-size:12px;margin-bottom:10px;";
  onTheme(()=>hint.style.color=T.text2);
  hint.textContent="选中元素作为A或B，对比样式差异";
  pane.appendChild(hint);

  // 选择按钮行
  const selRow=document.createElement("div");
  selRow.style.cssText="display:flex;gap:8px;margin-bottom:10px;";

  function mkSelBtn(label,color,fn){
    const b=document.createElement("button");
    b.style.cssText=
      "flex:1;padding:8px;border:none;border-radius:6px;"+
      "font-size:12px;cursor:pointer;color:#fff;background:"+color+";";
    b.onclick=fn;
    return b;
  }

  const btnA=mkSelBtn(
    compareElA?"A: "+getElId(compareElA):"选为 元素A",
    "#0078ff",()=>{
      compareElA=getCurrentEl();
      if(!compareElA){showToast("请先选中一个元素",true);return;}
      renderCompare();showToast("已设为元素A");
    });

  const btnB=mkSelBtn(
    compareElB?"B: "+getElId(compareElB):"选为 元素B",
    "#7e57c2",()=>{
      compareElB=getCurrentEl();
      if(!compareElB){showToast("请先选中一个元素",true);return;}
      renderCompare();showToast("已设为元素B");
    });

  const clearBtn=mkSelBtn("清空","#888",()=>{
    compareElA=null;compareElB=null;renderCompare();
  });

  selRow.appendChild(btnA);selRow.appendChild(btnB);
  selRow.appendChild(clearBtn);
  pane.appendChild(selRow);

  if(!compareElA||!compareElB)return;

  // 对比表格
  const stylesA=getStyles(compareElA);
  const stylesB=getStyles(compareElB);
  const dimA=getDimensions(compareElA);
  const dimB=getDimensions(compareElB);

  // 尺寸对比
  const dimTitle=document.createElement("div");
  dimTitle.style.cssText="font-weight:bold;font-size:12px;margin-bottom:6px;";
  onTheme(()=>dimTitle.style.color=T.text);
  dimTitle.textContent="尺寸对比";
  pane.appendChild(dimTitle);

  const dimRows=[
    ["宽度",dimA.width+"px",dimB.width+"px"],
    ["高度",dimA.height+"px",dimB.height+"px"],
    ["top",dimA.top+"px",dimB.top+"px"],
    ["left",dimA.left+"px",dimB.left+"px"],
  ];

  const dimTable=document.createElement("table");
  dimTable.style.cssText=
    "width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;";

  // 表头
  const thead=document.createElement("tr");
  ["属性","元素A","元素B"].forEach((h,i)=>{
    const th=document.createElement("th");
    th.style.cssText=
      "padding:4px 6px;text-align:left;font-size:11px;"+
      "background:"+(i===1?"rgba(0,120,255,.1)":
        i===2?"rgba(126,87,194,.1)":"none")+";";
    onTheme(()=>{
      th.style.color=T.text2;
      th.style.borderBottom="1px solid "+T.border;
    });
    th.textContent=h;
    thead.appendChild(th);
  });
  dimTable.appendChild(thead);

  dimRows.forEach(([prop,va,vb])=>{
    const diff=va!==vb;
    const tr=document.createElement("tr");
    if(diff) tr.style.background="rgba(255,100,100,.08)";
    [prop,va,vb].forEach((v,i)=>{
      const td=document.createElement("td");
      td.style.cssText=
        "padding:4px 6px;word-break:break-all;"+
        (diff&&i>0?"font-weight:bold;":"");
      onTheme(()=>{
        td.style.color=diff&&i>0?"#e53935":T.text;
        td.style.borderBottom="1px solid "+T.tableBorder;
      });
      td.textContent=v;
      tr.appendChild(td);
    });
    dimTable.appendChild(tr);
  });
  pane.appendChild(dimTable);

  // 样式对比
  const styTitle=document.createElement("div");
  styTitle.style.cssText="font-weight:bold;font-size:12px;margin-bottom:6px;";
  onTheme(()=>styTitle.style.color=T.text);
  styTitle.textContent="���式对比";
  pane.appendChild(styTitle);

  const styTable=document.createElement("table");
  styTable.style.cssText=
    "width:100%;border-collapse:collapse;font-size:12px;";
  styTable.appendChild(thead.cloneNode(true));

  const mapB=new Map(stylesB);
  stylesA.forEach(([prop,va])=>{
    const vb=mapB.get(prop)||"-";
    const diff=va!==vb;
    const tr=document.createElement("tr");
    if(diff) tr.style.background="rgba(255,100,100,.08)";
    [prop,va,vb].forEach((v,i)=>{
      const td=document.createElement("td");
      td.style.cssText=
        "padding:4px 6px;word-break:break-all;"+
        (diff&&i>0?"font-weight:bold;":"");
      onTheme(()=>{
        td.style.color=diff&&i>0?"#e53935":T.text;
        td.style.borderBottom="1px solid "+T.tableBorder;
      });
      td.textContent=v||"-";
      tr.appendChild(td);
    });
    styTable.appendChild(tr);
  });
  pane.appendChild(styTable);
}

// ════════════════════════════════════════════════
// 测距功能
// ════════════════════════════════════════════════
let measureMode=false;
let measureElA=null,measureElB=null;
let measureStep=0;

function toggleMeasureMode(){
  measureMode=!measureMode;
  if(measureMode){
    measureElA=null;measureElB=null;measureStep=0;
    measureLayer.style.display="block";
    measureLayer.innerHTML="";
    actMeasure.textContent="📏 取消测距";
    topHint.textContent="点击元素A开始测距";
    showToast("测距模式：点击第一个元素");
  } else {
    measureLayer.style.display="none";
    measureLayer.innerHTML="";
    actMeasure.textContent="📏 测距";
    topHint.textContent=isLocked?"已锁定":"悬停选元素，点击锁定";
  }
}

function doMeasure(el){
  if(measureStep===0){
    measureElA=el;measureStep=1;
    topHint.textContent="已选A，再点击元素B";
    showToast("已选元素A，请点击元素B");
  } else {
    measureElB=el;measureStep=0;
    drawMeasureLines();
    topHint.textContent="测距完成，可继续选新元素";
  }
}

function drawMeasureLines(){
  measureLayer.innerHTML="";
  if(!measureElA||!measureElB)return;
  const rA=measureElA.getBoundingClientRect();
  const rB=measureElB.getBoundingClientRect();

  // 绘制两个元素的轮廓
  function mkRect(r,color){
    const d=document.createElement("div");
    d.style.cssText=
      "position:fixed;pointer-events:none;"+
      "border:2px solid "+color+";box-sizing:border-box;"+
      "left:"+r.left+"px;top:"+r.top+"px;"+
      "width:"+r.width+"px;height:"+r.height+"px;";
    measureLayer.appendChild(d);
  }
  mkRect(rA,"#e53935");
  mkRect(rB,"#0078ff");

  // 计算水平/垂直间距
  const hGap=Math.max(0,Math.max(rA.left,rB.left)-
    Math.min(rA.right,rB.right));
  const vGap=Math.max(0,Math.max(rA.top,rB.top)-
    Math.min(rA.bottom,rB.bottom));

  const overlapH=rA.left<rB.right&&rA.right>rB.left;
  const overlapV=rA.top<rB.bottom&&rA.bottom>rB.top;

  // 水平距离线
  if(hGap>0){
    const x1=Math.min(rA.right,rB.right);
    const x2=Math.max(rA.left,rB.left);
    const midY=(Math.max(rA.top,rB.top)+
      Math.min(rA.bottom,rB.bottom))/2||
      (rA.top+rA.bottom)/2;
    drawLine(x1,midY,x2,midY,"#ff9800",Math.round(hGap)+"px");
  }

  // 垂直距离线
  if(vGap>0){
    const y1=Math.min(rA.bottom,rB.bottom);
    const y2=Math.max(rA.top,rB.top);
    const midX=(Math.max(rA.left,rB.left)+
      Math.min(rA.right,rB.right))/2||
      (rA.left+rA.right)/2;
    drawLine(midX,y1,midX,y2,"#ff9800",Math.round(vGap)+"px");
  }

  // 中心点连线
  const cxA=rA.left+rA.width/2,cyA=rA.top+rA.height/2;
  const cxB=rB.left+rB.width/2,cyB=rB.top+rB.height/2;
  const dist=Math.round(Math.sqrt(
    Math.pow(cxB-cxA,2)+Math.pow(cyB-cyA,2)));
  drawLine(cxA,cyA,cxB,cyB,"rgba(100,100,255,.5)",
    "中心距"+dist+"px",true);

  // 信息面板
  const info=document.createElement("div");
  info.style.cssText=
    "position:fixed;top:50px;right:10px;"+
    "background:rgba(0,0,0,.8);color:#fff;"+
    "padding:10px 14px;border-radius:8px;font-size:12px;"+
    "line-height:1.8;pointer-events:none;z-index:2147483643;";
  info.innerHTML=
    "<b>📏 测距结果</b><br>"+
    "A: "+Math.round(rA.width)+"×"+Math.round(rA.height)+"<br>"+
    "B: "+Math.round(rB.width)+"×"+Math.round(rB.height)+"<br>"+
    "水平间距: "+(hGap>0?Math.round(hGap)+"px":"重叠")+"<br>"+
    "垂直间距: "+(vGap>0?Math.round(vGap)+"px":"重叠")+"<br>"+
    "中心距离: "+dist+"px";
  measureLayer.appendChild(info);
}

function drawLine(x1,y1,x2,y2,color,label,dashed){
  const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
  if(len<1)return;
  const angle=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
  const line=document.createElement("div");
  line.style.cssText=
    "position:fixed;pointer-events:none;"+
    "height:2px;background:"+color+";"+
    (dashed?"background:repeating-linear-gradient(90deg,"+
      color+" 0,"+color+" 6px,transparent 6px,transparent 10px);":"")+
    "transform-origin:0 50%;"+
    "left:"+x1+"px;top:"+y1+"px;"+
    "width:"+len+"px;"+
    "transform:rotate("+angle+"deg);";
  measureLayer.appendChild(line);

  if(label){
    const lbl=document.createElement("div");
    const mx=(x1+x2)/2,my=(y1+y2)/2;
    lbl.style.cssText=
      "position:fixed;pointer-events:none;"+
      "background:"+color+";color:#fff;"+
      "font-size:11px;padding:1px 6px;border-radius:3px;"+
      "white-space:nowrap;transform:translate(-50%,-50%);"+
      "left:"+mx+"px;top:"+my+"px;";
    lbl.textContent=label;
    measureLayer.appendChild(lbl);
  }
}

// ════════════════════════════════════════════════
// 导出报告
// ════════════════════════════════════════════════
function exportReport(){
  try{
    const el=lockedEl||hoveredEl;
    if(!el){showToast("请先锁定一个元素",true);return;}
    const d=getDimensions(el);
    const styles=getStyles(el);
    let a11y=[];
    try{a11y=getA11y(el);}catch(e){}
    const chain=getAncestorChain(el).map(n=>getElId(n)).join(" › ");
    const ts=getTimestamp();
    const html="<!DOCTYPE html>\n"+
      "<html lang=\"zh\">\n<head>\n"+
      "<meta charset=\"utf-8\">\n"+
      "<title>元素检测报告 "+ts+"</title>\n"+
      "<style>\n"+
      "body{font-family:monospace;padding:20px;color:#333;"+
      "max-width:800px;margin:0 auto;}\n"+
      "h1{color:#0078ff;font-size:18px;}\n"+
      "h2{color:#555;font-size:14px;margin-top:20px;"+
      "border-bottom:1px solid #eee;padding-bottom:4px;}\n"+
      "table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;}\n"+
      "td{padding:5px 8px;border-bottom:1px solid #f5f5f5;}\n"+
      "td:first-child{color:#888;width:40%;}\n"+
      ".pass{color:#4caf50;font-weight:bold;}\n"+
      ".fail{color:#e53935;font-weight:bold;}\n"+
      ".chain{background:#f0f4ff;padding:8px 12px;"+
      "border-radius:6px;font-size:12px;color:#0078ff;}\n"+
      ".meta{color:#888;font-size:12px;margin-bottom:16px;}\n"+
      "</style>\n</head>\n<body>\n"+
      "<h1>📐 元素检测报告</h1>\n"+
      "<div class=\"meta\">生成时间："+ts+
      " | 页面："+location.href+"</div>\n"+
      "<div class=\"chain\">"+chain+"</div>\n"+
      "<h2>元素标识</h2>\n<table>\n"+
      "<tr><td>标签</td><td>"+el.tagName.toLowerCase()+"</td></tr>\n"+
      "<tr><td>id</td><td>"+(el.id||"（无）")+"</td></tr>\n"+
      "<tr><td>class</td><td>"+(el.className||"（无）")+"</td></tr>\n"+
      "<tr><td>CSS选择器</td><td>"+getCssSelector(el)+"</td></tr>\n"+
      "<tr><td>XPath</td><td>"+getXPath(el)+"</td></tr>\n"+
      "</table>\n"+
      "<h2>尺寸盒模型</h2>\n<table>\n"+
      "<tr><td>内容尺寸</td><td>"+d.width+" × "+d.height+" px</td></tr>\n"+
      "<tr><td>页面位置</td><td>top:"+d.top+" left:"+d.left+"</td></tr>\n"+
      "<tr><td>margin</td><td>"+d.margin.join(" / ")+" px</td></tr>\n"+
      "<tr><td>border</td><td>"+d.border.join(" / ")+" px</td></tr>\n"+
      "<tr><td>padding</td><td>"+d.padding.join(" / ")+" px</td></tr>\n"+
      "</table>\n"+
      "<h2>常用样式</h2>\n<table>\n"+
      styles.map(function(s){
        return "<tr><td>"+s[0]+"</td><td>"+s[1]+"</td></tr>";
      }).join("\n")+"\n</table>\n"+
      "<h2>无障碍检测</h2>\n<table>\n"+
      a11y.map(function(r){
        return "<tr><td>"+r.label+"</td>"+
          "<td><span class=\""+(r.pass?"pass":"fail")+
          "\">"+(r.pass?"✔":"✗")+"</span> "+r.val+"</td></tr>";
      }).join("\n")+"\n</table>\n"+
      "</body></html>";

    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const u=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=u;
    a.download="inspector_"+ts+".html";
    a.style.display="none";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},1000);
    showToast("报告已导出");
  } catch(e){
    showToast("导出失败："+e.message,true);
  }
}

// ════════════════════════════════════════════════
// 状态管理
// ════════════════════════════════════════════════
let hoveredEl=null,lockedEl=null,isLocked=false;
function getCurrentEl(){return isLocked?lockedEl:hoveredEl;}

function updateBreadcrumb(el){
  breadcrumb.innerHTML="";
  if(!el)return;
  const chain=getAncestorChain(el);
  chain.forEach((node,i)=>{
    const sp=document.createElement("span");
    sp.textContent=getElId(node);
    sp.style.cssText=
      "cursor:pointer;padding:1px 3px;border-radius:3px;";
    onTheme(()=>{
      sp.style.color=node===el?T.text3:T.text2;
      if(node===el) sp.style.fontWeight="bold";
    });
    sp.onclick=(e)=>{e.stopPropagation();lockElement(node);};
    breadcrumb.appendChild(sp);
    if(i<chain.length-1){
      const sep=document.createElement("span");
      sep.textContent="›";
      sep.style.cssText="padding:0 2px;";
      onTheme(()=>sep.style.color=T.text2);
      breadcrumb.appendChild(sep);
    }
  });
  breadcrumb.scrollLeft=breadcrumb.scrollWidth;
}

function selectElement(el){
  if(!el)return;
  highlightElement(el);
  updateBreadcrumb(el);
  const r=el.getBoundingClientRect();
  elIdRow.textContent=
    "<"+el.tagName.toLowerCase()+">"+
    (el.id?" #"+el.id:"")+
    (el.className&&typeof el.className==="string"&&
     el.className.trim()?
      " ."+el.className.trim().split(/\s+/).slice(0,2).join(" ."):"")
    +"  ["+Math.round(r.width)+"×"+Math.round(r.height)+"px]";
  renderDimensions(el);
  renderStyles(el);
  renderDOMTree(el);
  renderComputed(el);
  renderA11y(el);
  if(currentTab==="对比") renderCompare();
}

function lockElement(el){
  lockedEl=el;isLocked=true;
  history.unshift({el,time:Date.now()});
  if(history.length>MAX_HIST) history.pop();
  topHint.textContent="已锁定 · 点击其他元素切换";
  onTheme(()=>topHint.style.color="#ffe082");
  selectElement(el);
}

function unlockElement(){
  isLocked=false;lockedEl=null;
  topHint.textContent="悬停选元素，点击锁定";
  onTheme(()=>topHint.style.color="");
}

function navigateTo(dir){
  const el=getCurrentEl();if(!el)return;
  let target=null;
  if(dir==="parent"){
    target=el.parentElement;
    if(!target||target===document.documentElement)return;
  } else if(dir==="prev"){
    target=el.previousElementSibling;
  } else if(dir==="next"){
    target=el.nextElementSibling;
  } else if(dir==="children"){
    if(!el.children.length){showToast("无子节点");return;}
    target=el.children[0];
  }
  if(!target){showToast("无对应节点");return;}
  lockElement(target);
}

// ════════════════════════════════════════════════
// 深色模式
// ════════════════════════════════════════════════
function toggleTheme(){
  isDark=!isDark;
  themeBtn.textContent=isDark?"☀️":"🌙";
  applyTheme();
}

// ════════════════════════════════════════════════
// 事件监听
// ════════════════════════════════════════════════
function onMouseOver(e){
  const el=e.target;
  if(el.closest("#"+ROOT_ID))return;
  hoveredEl=el;
  if(!isLocked) selectElement(el);
}

function onClick(e){
  const el=e.target;
  if(el.closest("#"+ROOT_ID))return;
  e.preventDefault();e.stopPropagation();
  if(measureMode){doMeasure(el);return;}
  if(isLocked&&lockedEl===el) unlockElement();
  else lockElement(el);
}

function onTouchMove(e){
  const t=e.touches[0];
  const el=document.elementFromPoint(t.clientX,t.clientY);
  if(!el||el.closest("#"+ROOT_ID))return;
  hoveredEl=el;
  if(!isLocked) selectElement(el);
}

function onTouchEnd(e){
  const t=e.changedTouches[0];
  const el=document.elementFromPoint(t.clientX,t.clientY);
  if(!el||el.closest("#"+ROOT_ID))return;
  if(measureMode){doMeasure(el);return;}
  if(isLocked&&lockedEl===el) unlockElement();
  else lockElement(el);
}

document.addEventListener("mouseover",onMouseOver,true);
document.addEventListener("click",onClick,true);
document.addEventListener("touchmove",onTouchMove,
  {capture:true,passive:true});
document.addEventListener("touchend",onTouchEnd,true);

window.addEventListener("resize",()=>{
  if(gridOn) drawGrid();
});

// ════════════════════════════════════════════════
// 退出清理
// ════════════════════════════════════════════════
function cleanup(){
  document.removeEventListener("mouseover",onMouseOver,true);
  document.removeEventListener("click",onClick,true);
  document.removeEventListener("touchmove",onTouchMove,true);
  document.removeEventListener("touchend",onTouchEnd,true);
  window.removeEventListener("resize",drawGrid);
  clearHighlight();
  overlayRoot.remove();
  root.remove();
}

// 初始化
applyTheme();
selectElement(document.body);

})();
