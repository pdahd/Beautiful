// inspector.js v1.0 — 页面元素检测工具（尺寸+样式+DOM树+计算值）
(function(){

const ROOT_ID="inspector_root";
const old=document.getElementById(ROOT_ID);
if(old){old.remove();return;}

// ════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════
function $(sel,ctx){return (ctx||document).querySelector(sel);}

function getTimestamp(){
  const d=new Date(),p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+
    "_"+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
}

function copyText(str){
  const ta=document.createElement("textarea");
  ta.value=str;ta.style.position="fixed";ta.style.opacity="0";
  document.body.appendChild(ta);ta.select();
  document.execCommand("copy");ta.remove();
}

function showToast(msg,isErr){
  const t=document.createElement("div");
  t.style.cssText=
    "position:fixed;top:24px;left:50%;transform:translateX(-50%);"+
    "background:"+(isErr?"#e53935":"#323232")+";color:#fff;"+
    "padding:8px 20px;border-radius:20px;font-size:13px;"+
    "z-index:2147483649;pointer-events:none;white-space:nowrap;";
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2000);
}

// ════════════════════════════════════════════════
// 高亮覆盖层（4色盒模型）
// ════════════════════════════════════════════════
const COLORS={
  margin: "rgba(255,165,0,.25)",
  border: "rgba(255,220,0,.35)",
  padding:"rgba(100,200,100,.25)",
  content:"rgba(100,160,255,.25)"
};

const overlayRoot=document.createElement("div");
overlayRoot.style.cssText=
  "position:fixed;top:0;left:0;width:0;height:0;"+
  "pointer-events:none;z-index:2147483640;";

function mkOverlayBox(color){
  const d=document.createElement("div");
  d.style.cssText=
    "position:fixed;pointer-events:none;"+
    "background:"+color+";transition:all .08s;";
  return d;
}

const ovMargin =mkOverlayBox(COLORS.margin);
const ovBorder =mkOverlayBox(COLORS.border);
const ovPadding=mkOverlayBox(COLORS.padding);
const ovContent=mkOverlayBox(COLORS.content);
const ovOutline=document.createElement("div");
ovOutline.style.cssText=
  "position:fixed;pointer-events:none;"+
  "border:2px solid #0078ff;box-sizing:border-box;"+
  "transition:all .08s;z-index:2147483641;";

[ovMargin,ovBorder,ovPadding,ovContent,ovOutline]
  .forEach(d=>overlayRoot.appendChild(d));
document.body.appendChild(overlayRoot);

function setBox(el,style,x,y,w,h){
  el.style.left=x+"px";el.style.top=y+"px";
  el.style.width=w+"px";el.style.height=h+"px";
  if(style) el.style.background=style;
}

function highlightElement(el){
  if(!el||el===document.body||el===document.documentElement){
    clearHighlight();return;
  }
  const r=el.getBoundingClientRect();
  const cs=getComputedStyle(el);
  const mt=parseFloat(cs.marginTop),mb=parseFloat(cs.marginBottom);
  const ml=parseFloat(cs.marginLeft),mr=parseFloat(cs.marginRight);
  const bt=parseFloat(cs.borderTopWidth),bb=parseFloat(cs.borderBottomWidth);
  const bl=parseFloat(cs.borderLeftWidth),br=parseFloat(cs.borderRightWidth);
  const pt=parseFloat(cs.paddingTop),pb=parseFloat(cs.paddingBottom);
  const pl=parseFloat(cs.paddingLeft),pr=parseFloat(cs.paddingRight);

  // margin 区域
  setBox(ovMargin,null,
    r.left-ml, r.top-mt,
    r.width+ml+mr, r.height+mt+mb);
  // border 区域
  setBox(ovBorder,null,
    r.left, r.top, r.width, r.height);
  // padding 区域
  setBox(ovPadding,null,
    r.left+bl, r.top+bt,
    r.width-bl-br, r.height-bt-bb);
  // content 区域
  setBox(ovContent,null,
    r.left+bl+pl, r.top+bt+pt,
    r.width-bl-br-pl-pr, r.height-bt-bb-pt-pb);
  // 轮廓线
  setBox(ovOutline,null,
    r.left-ml, r.top-mt,
    r.width+ml+mr, r.height+mt+mb);

  [ovMargin,ovBorder,ovPadding,ovContent,ovOutline]
    .forEach(d=>d.style.display="block");
}

function clearHighlight(){
  [ovMargin,ovBorder,ovPadding,ovContent,ovOutline]
    .forEach(d=>d.style.display="none");
}
clearHighlight();

// ════════════════════════════════════════════════
// 数据采集
// ════════════════════════════════════════════════
function getElId(el){
  let s=el.tagName.toLowerCase();
  if(el.id) s+="#"+el.id;
  if(el.className&&typeof el.className==="string"){
    el.className.trim().split(/\s+/).forEach(c=>s+="."+c);
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
    const siblings=Array.from(node.parentElement?.children||[])
      .filter(c=>c.tagName===node.tagName);
    if(siblings.length>1){
      sel+=":nth-of-type("+(siblings.indexOf(node)+1)+")";
    }
    parts.unshift(sel);
    node=node.parentElement;
  }
  return parts.join(" > ");
}

function getXPath(el){
  const parts=[];
  let node=el;
  while(node&&node.nodeType===1){
    const siblings=Array.from(node.parentElement?.children||[])
      .filter(c=>c.tagName===node.tagName);
    const idx=siblings.indexOf(node)+1;
    parts.unshift(node.tagName.toLowerCase()+
      (siblings.length>1?"["+idx+"]":""));
    node=node.parentElement;
  }
  return "/"+parts.join("/");
}

function getDimensions(el){
  const r=el.getBoundingClientRect();
  const cs=getComputedStyle(el);
  return {
    width:  Math.round(r.width),
    height: Math.round(r.height),
    top:    Math.round(r.top+window.scrollY),
    left:   Math.round(r.left+window.scrollX),
    viewTop:Math.round(r.top),
    viewLeft:Math.round(r.left),
    margin: [cs.marginTop,cs.marginRight,
             cs.marginBottom,cs.marginLeft].map(v=>parseFloat(v)||0),
    border: [cs.borderTopWidth,cs.borderRightWidth,
             cs.borderBottomWidth,cs.borderLeftWidth].map(v=>parseFloat(v)||0),
    padding:[cs.paddingTop,cs.paddingRight,
             cs.paddingBottom,cs.paddingLeft].map(v=>parseFloat(v)||0),
    boxSizing:cs.boxSizing
  };
}

function getStyles(el){
  const cs=getComputedStyle(el);
  return [
    ["display",     cs.display],
    ["position",    cs.position],
    ["font-size",   cs.fontSize],
    ["font-weight", cs.fontWeight],
    ["font-family", cs.fontFamily.split(",")[0].trim()],
    ["line-height", cs.lineHeight],
    ["color",       cs.color],
    ["background",  cs.backgroundColor],
    ["border",      cs.border],
    ["border-radius",cs.borderRadius],
    ["opacity",     cs.opacity],
    ["z-index",     cs.zIndex],
    ["overflow",    cs.overflow],
    ["cursor",      cs.cursor],
    ["flex",        cs.flex],
    ["transform",   cs.transform==="none"?"none":cs.transform.slice(0,20)+"…"],
  ];
}

function getComputedStyles(el){
  const cs=getComputedStyle(el);
  const props=[
    "width","height","min-width","max-width","min-height","max-height",
    "margin-top","margin-right","margin-bottom","margin-left",
    "padding-top","padding-right","padding-bottom","padding-left",
    "border-top-width","border-right-width","border-bottom-width","border-left-width",
    "font-size","line-height","letter-spacing","word-spacing",
    "color","background-color","border-color",
    "display","position","top","right","bottom","left",
    "flex-direction","align-items","justify-content","flex-wrap",
    "overflow","overflow-x","overflow-y",
    "z-index","opacity","visibility","pointer-events"
  ];
  return props.map(p=>[p,cs.getPropertyValue(p)]);
}

// ════════════════════════════════════════════════
// 面板 UI 构建
// ════════════════════════════════════════════════
const root=document.createElement("div");
root.id=ROOT_ID;
root.style.cssText=
  "position:fixed;z-index:2147483647;"+
  "font-size:13px;font-family:monospace;color:#333;"+
  "touch-action:none;";

// ── 顶部提示条 ────────────────────────────────
const topBar=document.createElement("div");
topBar.style.cssText=
  "position:fixed;top:0;left:0;width:100%;"+
  "background:rgba(0,120,255,.92);color:#fff;"+
  "padding:6px 16px;box-sizing:border-box;"+
  "font-size:13px;display:flex;align-items:center;"+
  "justify-content:space-between;z-index:2147483648;"+
  "box-shadow:0 2px 8px rgba(0,0,0,.2);";

const topLeft=document.createElement("div");
topLeft.style.cssText="display:flex;align-items:center;gap:10px;";

const topTitle=document.createElement("span");
topTitle.textContent="📐 元素检测模式";
topTitle.style.fontWeight="bold";

const topHint=document.createElement("span");
topHint.textContent="悬停选元素，点击锁定";
topHint.style.cssText="font-size:12px;opacity:.85;";

const exitBtn=document.createElement("button");
exitBtn.textContent="✕ 退出";
exitBtn.style.cssText=
  "padding:4px 14px;background:rgba(255,255,255,.2);"+
  "color:#fff;border:1px solid rgba(255,255,255,.4);"+
  "border-radius:12px;font-size:13px;cursor:pointer;";
exitBtn.onclick=cleanup;

topLeft.appendChild(topTitle);
topLeft.appendChild(topHint);
topBar.appendChild(topLeft);
topBar.appendChild(exitBtn);

// ── 主面板 ────────────────────────────────────
const panel=document.createElement("div");
panel.style.cssText=
  "position:fixed;bottom:0;left:0;width:100%;"+
  "background:#fff;border-top:2px solid #0078ff;"+
  "box-shadow:0 -4px 20px rgba(0,0,0,.15);"+
  "display:flex;flex-direction:column;"+
  "max-height:55vh;z-index:2147483647;";

// 元素标识行
const elIdRow=document.createElement("div");
elIdRow.style.cssText=
  "padding:8px 12px;background:#f0f4ff;"+
  "border-bottom:1px solid #e0e8ff;"+
  "font-size:12px;color:#0078ff;font-weight:bold;"+
  "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;";
elIdRow.textContent="请悬停到页面元素上…";

// 面包屑
const breadcrumb=document.createElement("div");
breadcrumb.style.cssText=
  "padding:6px 12px;background:#fafafa;"+
  "border-bottom:1px solid #eee;"+
  "font-size:11px;color:#888;overflow-x:auto;"+
  "white-space:nowrap;flex-shrink:0;display:flex;"+
  "align-items:center;gap:4px;";

// 标签页导航
const tabBar=document.createElement("div");
tabBar.style.cssText=
  "display:flex;border-bottom:1px solid #eee;"+
  "flex-shrink:0;background:#fff;";

const TABS=["尺寸","样式","DOM树","计算值"];
const tabBtns={};
const tabPanels={};

TABS.forEach((name,i)=>{
  const btn=document.createElement("button");
  btn.textContent=name;
  btn.style.cssText=
    "flex:1;padding:8px 4px;border:none;background:none;"+
    "font-size:13px;cursor:pointer;color:#888;"+
    "border-bottom:2px solid transparent;";
  btn.onclick=()=>switchTab(name);
  tabBtns[name]=btn;
  tabBar.appendChild(btn);

  const pane=document.createElement("div");
  pane.style.cssText=
    "flex:1;overflow-y:auto;padding:10px 12px;display:none;";
  tabPanels[name]=pane;
});

function switchTab(name){
  TABS.forEach(n=>{
    tabBtns[n].style.color=n===name?"#0078ff":"#888";
    tabBtns[n].style.borderBottom=
      n===name?"2px solid #0078ff":"2px solid transparent";
    tabBtns[n].style.fontWeight=n===name?"bold":"normal";
    tabPanels[n].style.display=n===name?"block":"none";
  });
  currentTab=name;
}
let currentTab="尺寸";
switchTab("尺寸");

// 内容区
const contentArea=document.createElement("div");
contentArea.style.cssText=
  "flex:1;display:flex;flex-direction:column;overflow:hidden;";
contentArea.appendChild(tabBar);
TABS.forEach(n=>contentArea.appendChild(tabPanels[n]));

// 底部操作栏
const actionBar=document.createElement("div");
actionBar.style.cssText=
  "display:flex;gap:6px;padding:8px 12px;"+
  "border-top:1px solid #eee;flex-shrink:0;background:#fafafa;";

function mkAct(t,fn){
  const b=document.createElement("button");
  b.textContent=t;
  b.style.cssText=
    "flex:1;padding:7px 4px;background:#f0f4ff;"+
    "color:#0078ff;border:1px solid #c5d8ff;"+
    "border-radius:6px;font-size:12px;cursor:pointer;";
  b.onclick=fn;return b;
}

const actParent =mkAct("↑ 父节点",()=>navigateTo("parent"));
const actPrevSib=mkAct("← 前兄弟",()=>navigateTo("prev"));
const actNextSib=mkAct("→ 后兄弟",()=>navigateTo("next"));
const actChildren=mkAct("↓ 子节点",()=>navigateTo("children"));
[actParent,actPrevSib,actNextSib,actChildren]
  .forEach(b=>actionBar.appendChild(b));

panel.appendChild(elIdRow);
panel.appendChild(breadcrumb);
panel.appendChild(contentArea);
panel.appendChild(actionBar);

root.appendChild(topBar);
root.appendChild(panel);
document.body.appendChild(root);

// ════════════════════════════════════════════════
// 状态管理
// ════════════════════════════════════════════════
let hoveredEl=null;
let lockedEl=null;
let isLocked=false;
let history=[];
const MAX_HISTORY=20;

function getCurrentEl(){return isLocked?lockedEl:hoveredEl;}

// ════════════════════════════════════════════════
// 渲染各标签内容
// ════════════════════════════════════════════════

// ── 尺寸标签 ──────────────────────────────────
function renderDimensions(el){
  const pane=tabPanels["尺寸"];
  pane.innerHTML="";
  if(!el)return;
  const d=getDimensions(el);

  // 盒模型可视化
  const boxVis=document.createElement("div");
  boxVis.style.cssText=
    "position:relative;margin:8px auto;"+
    "width:220px;height:140px;font-size:10px;";

  function mkBoxLayer(label,color,val,style){
    const div=document.createElement("div");
    div.style.cssText=
      "position:absolute;background:"+color+";"+
      "display:flex;align-items:flex-start;"+
      "justify-content:flex-start;padding:2px 4px;"+
      "font-size:10px;color:#555;box-sizing:border-box;"+style;
    div.textContent=label+" "+val;
    return div;
  }

  const mVals=d.margin;
  const bVals=d.border;
  const pVals=d.padding;

  // margin层
  const mBox=mkBoxLayer("margin",
    COLORS.margin,
    mVals[0]+" "+mVals[1]+" "+mVals[2]+" "+mVals[3],
    "inset:0;border-radius:4px;");
  // border层
  const bBox=mkBoxLayer("border",
    COLORS.border,
    bVals[0]+"px",
    "inset:14px;border-radius:3px;");
  // padding层
  const pBox=mkBoxLayer("padding",
    COLORS.padding,
    pVals[0]+" "+pVals[1]+" "+pVals[2]+" "+pVals[3],
    "inset:28px;border-radius:2px;");
  // content层
  const cBox=document.createElement("div");
  cBox.style.cssText=
    "position:absolute;inset:42px;"+
    "background:"+COLORS.content+";"+
    "display:flex;align-items:center;justify-content:center;"+
    "font-size:11px;font-weight:bold;color:#333;border-radius:2px;";
  cBox.textContent=d.width+" × "+d.height;

  [mBox,bBox,pBox,cBox].forEach(b=>boxVis.appendChild(b));
  pane.appendChild(boxVis);

  // 数值表格
  const rows=[
    ["内容尺寸", d.width+" × "+d.height+" px"],
    ["页面位置", "top: "+d.top+" / left: "+d.left],
    ["视口位置", "top: "+d.viewTop+" / left: "+d.viewLeft],
    ["box-sizing",d.boxSizing],
    ["margin",   mVals.join(" / ")+" px"],
    ["border",   bVals.join(" / ")+" px"],
    ["padding",  pVals.join(" / ")+" px"],
  ];
  pane.appendChild(mkTable(rows));

  // 复制按钮
  const copyRow=document.createElement("div");
  copyRow.style.cssText="display:flex;gap:6px;margin-top:8px;";
  [
    ["复制尺寸",()=>copyText(d.width+"x"+d.height)],
    ["复制选择器",()=>copyText(getCssSelector(el))],
    ["复制XPath",()=>copyText(getXPath(el))],
  ].forEach(([t,fn])=>{
    const b=document.createElement("button");
    b.textContent=t;
    b.style.cssText=
      "flex:1;padding:6px;background:#f0f4ff;color:#0078ff;"+
      "border:1px solid #c5d8ff;border-radius:6px;"+
      "font-size:11px;cursor:pointer;";
    b.onclick=()=>{fn();showToast("已复制");};
    copyRow.appendChild(b);
  });
  pane.appendChild(copyRow);
}

// ── 样式标签 ──────────────────────────────────
function renderStyles(el){
  const pane=tabPanels["样式"];
  pane.innerHTML="";
  if(!el)return;
  const styles=getStyles(el);
  const table=document.createElement("table");
  table.style.cssText="width:100%;border-collapse:collapse;font-size:12px;";
  styles.forEach(([prop,val])=>{
    const tr=document.createElement("tr");
    const td1=document.createElement("td");
    td1.style.cssText=
      "padding:4px 6px;color:#888;white-space:nowrap;"+
      "border-bottom:1px solid #f5f5f5;width:40%;";
    td1.textContent=prop;
    const td2=document.createElement("td");
    td2.style.cssText=
      "padding:4px 6px;color:#333;border-bottom:1px solid #f5f5f5;"+
      "word-break:break-all;";

    // 颜色预览
    if(prop==="color"||prop==="background"){
      const swatch=document.createElement("span");
      swatch.style.cssText=
        "display:inline-block;width:12px;height:12px;"+
        "border-radius:2px;border:1px solid #ccc;"+
        "margin-right:4px;vertical-align:middle;"+
        "background:"+val+";";
      td2.appendChild(swatch);
      td2.appendChild(document.createTextNode(val));
    } else {
      td2.textContent=val||"-";
    }

    tr.appendChild(td1);tr.appendChild(td2);
    table.appendChild(tr);
  });

  // 复制全部样式
  const copyAllBtn=document.createElement("button");
  copyAllBtn.textContent="复制全部样式";
  copyAllBtn.style.cssText=
    "width:100%;margin-top:8px;padding:7px;"+
    "background:#f0f4ff;color:#0078ff;"+
    "border:1px solid #c5d8ff;border-radius:6px;"+
    "font-size:12px;cursor:pointer;";
  copyAllBtn.onclick=()=>{
    const text=styles.map(([p,v])=>p+": "+v).join("\n");
    copyText(text);showToast("已复制全部样式");
  };

  pane.appendChild(table);
  pane.appendChild(copyAllBtn);
}

// ── DOM树标签 ─────────────────────────────────
function renderDOMTree(el){
  const pane=tabPanels["DOM树"];
  pane.innerHTML="";
  if(!el)return;

  const chain=getAncestorChain(el);

  // 祖先链标题
  const chainTitle=document.createElement("div");
  chainTitle.style.cssText=
    "font-size:11px;color:#888;margin-bottom:6px;";
  chainTitle.textContent="祖先链（根节点 → 当前元素）";
  pane.appendChild(chainTitle);

  // 祖先链树形展示
  const tree=document.createElement("div");
  tree.style.cssText="font-size:12px;";

  chain.forEach((node,depth)=>{
    const isCurrent=(node===el);
    const row=document.createElement("div");
    row.style.cssText=
      "display:flex;align-items:center;"+
      "padding:3px 0;cursor:pointer;border-radius:4px;"+
      "padding-left:"+(depth*14)+"px;"+
      (isCurrent?
        "background:#e8f0ff;font-weight:bold;color:#0078ff;":
        "color:#555;");

    const arrow=document.createElement("span");
    arrow.style.cssText="margin-right:4px;color:#aaa;font-size:10px;";
    arrow.textContent= depth<chain.length-1?"▼":"►";

    const label=document.createElement("span");
    label.textContent=getElId(node);
    if(isCurrent){
      label.style.color="#0078ff";
    }

    row.appendChild(arrow);row.appendChild(label);

    if(!isCurrent){
      row.onclick=(e)=>{
        e.stopPropagation();
        lockElement(node);
      };
      row.onmouseover=()=>row.style.background="#f5f7ff";
      row.onmouseout=()=>row.style.background="";
    }
    tree.appendChild(row);
  });

  pane.appendChild(tree);

  // 当前元素子节点
  const children=Array.from(el.children);
  if(children.length>0){
    const childTitle=document.createElement("div");
    childTitle.style.cssText=
      "font-size:11px;color:#888;margin:10px 0 6px;"+
      "border-top:1px solid #eee;padding-top:8px;";
    childTitle.textContent=
      "子节点（"+children.length+"个）";
    pane.appendChild(childTitle);

    children.forEach(child=>{
      const row=document.createElement("div");
      row.style.cssText=
        "padding:3px 8px;cursor:pointer;border-radius:4px;"+
        "font-size:12px;color:#555;display:flex;"+
        "align-items:center;gap:6px;";
      const ic=document.createElement("span");
      ic.textContent="►";
      ic.style.cssText="color:#aaa;font-size:10px;";
      const lb=document.createElement("span");
      lb.textContent=getElId(child);
      row.appendChild(ic);row.appendChild(lb);
      row.onclick=(e)=>{
        e.stopPropagation();lockElement(child);
      };
      row.onmouseover=()=>row.style.background="#f5f7ff";
      row.onmouseout=()=>row.style.background="";
      pane.appendChild(row);
    });
  }

  // 兄弟节点
  const siblings=Array.from(el.parentElement?.children||[])
    .filter(c=>c!==el);
  if(siblings.length>0){
    const sibTitle=document.createElement("div");
    sibTitle.style.cssText=
      "font-size:11px;color:#888;margin:10px 0 6px;"+
      "border-top:1px solid #eee;padding-top:8px;";
    sibTitle.textContent=
      "兄弟节点（"+siblings.length+"个）";
    pane.appendChild(sibTitle);

    siblings.slice(0,8).forEach(sib=>{
      const row=document.createElement("div");
      row.style.cssText=
        "padding:3px 8px;cursor:pointer;border-radius:4px;"+
        "font-size:12px;color:#555;";
      row.textContent=getElId(sib);
      row.onclick=(e)=>{
        e.stopPropagation();lockElement(sib);
      };
      row.onmouseover=()=>row.style.background="#f5f7ff";
      row.onmouseout=()=>row.style.background="";
      pane.appendChild(row);
    });
    if(siblings.length>8){
      const more=document.createElement("div");
      more.style.cssText="font-size:11px;color:#aaa;padding:4px 8px;";
      more.textContent="…还有"+(siblings.length-8)+"个";
      pane.appendChild(more);
    }
  }
}

// ── 计算值标签 ────────────────────────────────
function renderComputed(el){
  const pane=tabPanels["计算值"];
  pane.innerHTML="";
  if(!el)return;

  // 搜索框
  const searchWrap=document.createElement("div");
  searchWrap.style.cssText="margin-bottom:8px;";
  const searchInput=document.createElement("input");
  searchInput.type="text";
  searchInput.placeholder="搜索属性…";
  searchInput.style.cssText=
    "width:100%;padding:6px 10px;border:1px solid #ddd;"+
    "border-radius:6px;font-size:12px;box-sizing:border-box;";
  searchWrap.appendChild(searchInput);
  pane.appendChild(searchWrap);

  const styles=getComputedStyles(el);
  const table=document.createElement("table");
  table.style.cssText="width:100%;border-collapse:collapse;font-size:12px;";

  function buildRows(filter){
    table.innerHTML="";
    styles
      .filter(([p])=>!filter||p.includes(filter))
      .forEach(([prop,val])=>{
        if(!val||val==="auto"&&prop!=="z-index") return;
        const tr=document.createElement("tr");
        const td1=document.createElement("td");
        td1.style.cssText=
          "padding:3px 6px;color:#888;white-space:nowrap;"+
          "border-bottom:1px solid #f5f5f5;width:50%;";
        td1.textContent=prop;
        const td2=document.createElement("td");
        td2.style.cssText=
          "padding:3px 6px;color:#333;"+
          "border-bottom:1px solid #f5f5f5;word-break:break-all;";
        td2.textContent=val||"-";
        tr.appendChild(td1);tr.appendChild(td2);
        table.appendChild(tr);
      });
  }
  buildRows("");
  searchInput.oninput=()=>buildRows(searchInput.value.trim());

  const copyAllBtn=document.createElement("button");
  copyAllBtn.textContent="复制全部计算值";
  copyAllBtn.style.cssText=
    "width:100%;margin-top:8px;padding:7px;"+
    "background:#f0f4ff;color:#0078ff;"+
    "border:1px solid #c5d8ff;border-radius:6px;"+
    "font-size:12px;cursor:pointer;";
  copyAllBtn.onclick=()=>{
    const text=styles.map(([p,v])=>p+": "+v).join("\n");
    copyText(text);showToast("已复制全部计算值");
  };

  pane.appendChild(table);
  pane.appendChild(copyAllBtn);
}

// 通用表格
function mkTable(rows){
  const table=document.createElement("table");
  table.style.cssText=
    "width:100%;border-collapse:collapse;font-size:12px;margin-top:6px;";
  rows.forEach(([k,v])=>{
    const tr=document.createElement("tr");
    const td1=document.createElement("td");
    td1.style.cssText=
      "padding:4px 6px;color:#888;white-space:nowrap;"+
      "border-bottom:1px solid #f5f5f5;width:40%;";
    td1.textContent=k;
    const td2=document.createElement("td");
    td2.style.cssText=
      "padding:4px 6px;color:#333;border-bottom:1px solid #f5f5f5;"+
      "word-break:break-all;";
    td2.textContent=v;
    tr.appendChild(td1);tr.appendChild(td2);
    table.appendChild(tr);
  });
  return table;
}

// ════════════════════════════════════════════════
// 面包屑更新
// ════════════════════════════════════════════════
function updateBreadcrumb(el){
  breadcrumb.innerHTML="";
  if(!el)return;
  const chain=getAncestorChain(el);
  chain.forEach((node,i)=>{
    const span=document.createElement("span");
    span.textContent=getElId(node);
    span.style.cssText=
      "cursor:pointer;padding:1px 4px;border-radius:3px;"+
      (node===el?
        "color:#0078ff;font-weight:bold;":
        "color:#888;");
    span.onclick=(e)=>{
      e.stopPropagation();lockElement(node);
    };
    breadcrumb.appendChild(span);
    if(i<chain.length-1){
      const sep=document.createElement("span");
      sep.textContent="›";
      sep.style.cssText="color:#ccc;padding:0 2px;";
      breadcrumb.appendChild(sep);
    }
  });
  // 自动滚到最右（当前元素）
  breadcrumb.scrollLeft=breadcrumb.scrollWidth;
}

// ════════════════════════════════════════════════
// 元素选中与锁定
// ════════════════════════════════════════════════
function selectElement(el){
  if(!el)return;
  highlightElement(el);
  updateBreadcrumb(el);
  elIdRow.textContent="<"+el.tagName.toLowerCase()+"> "+
    (el.id?"#"+el.id:"")+" "+
    (el.className&&typeof el.className==="string"?
      "."+el.className.trim().split(/\s+/).join(" ."):"")+
    "  ["+Math.round(el.getBoundingClientRect().width)+
    " × "+Math.round(el.getBoundingClientRect().height)+"px]";
  renderDimensions(el);
  renderStyles(el);
  renderDOMTree(el);
  renderComputed(el);
}

function lockElement(el){
  lockedEl=el;
  isLocked=true;

  // 添加历史
  if(!history.includes(el)){
    history.unshift(el);
    if(history.length>MAX_HISTORY) history.pop();
  }

  topHint.textContent="已锁定，点击其他元素切换";
  topHint.style.color="#ffe082";
  selectElement(el);
}

function unlockElement(){
  isLocked=false;
  lockedEl=null;
  topHint.textContent="悬停选元素，点击锁定";
  topHint.style.color="";
}

// ════════════════════════════════════════════════
// 父子兄弟导航
// ════════════════════════════════════════════════
function navigateTo(dir){
  const el=getCurrentEl();
  if(!el)return;
  let target=null;
  if(dir==="parent"){
    target=el.parentElement;
    if(!target||target===document.documentElement)return;
  } else if(dir==="prev"){
    target=el.previousElementSibling;
  } else if(dir==="next"){
    target=el.nextElementSibling;
  } else if(dir==="children"){
    if(el.children.length===0){showToast("无子节点");return;}
    target=el.children[0];
  }
  if(!target){showToast("无对应节点");return;}
  lockElement(target);
}

// ════════════════════════════════════════════════
// 事件监听（捕获阶段）
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
  e.preventDefault();
  e.stopPropagation();
  if(isLocked&&lockedEl===el){
    unlockElement();
  } else {
    lockElement(el);
  }
}

let touchMoveTimer=null;
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
  if(isLocked&&lockedEl===el){
    unlockElement();
  } else {
    lockElement(el);
  }
}

document.addEventListener("mouseover",onMouseOver,true);
document.addEventListener("click",onClick,true);
document.addEventListener("touchmove",onTouchMove,
  {capture:true,passive:true});
document.addEventListener("touchend",onTouchEnd,true);

// ════════════════════════════════════════════════
// 清理退出
// ════════════════════════════════════════════════
function cleanup(){
  document.removeEventListener("mouseover",onMouseOver,true);
  document.removeEventListener("click",onClick,true);
  document.removeEventListener("touchmove",onTouchMove,true);
  document.removeEventListener("touchend",onTouchEnd,true);
  clearHighlight();
  overlayRoot.remove();
  root.remove();
}

// 初始提示
selectElement(document.body);

})();
