(function(){

const id="np987";
const old=document.getElementById(id);
if(old){old.remove();return;}

// ── 字符宽度测量 ──────────────────────────────
const _canvas=document.createElement("canvas");
const _ctx=_canvas.getContext("2d");
_ctx.font="13px monospace";
const charW=_ctx.measureText("M").width;
const TA_PADDING=8;
const TA_BORDER=1;
const rulerOffsetLeft=TA_BORDER+TA_PADDING;

// ── 文件状态追踪 ──────────────────────────────
let srcFileName="";
let srcContentSig="";
let contentMode="manual";

function getContentSig(str){
  const len=str.length;
  return len+"_"+(str.slice(0,12)||"")+"_"+(str.slice(-12)||"");
}

function getTimestamp(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,"0");
  return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+
    "_"+pad(d.getHours())+pad(d.getMinutes());
}

function getExportName(){
  const ts=getTimestamp();
  if(contentMode==="imported"&&srcFileName){
    const dot=srcFileName.lastIndexOf(".");
    const base=dot>0?srcFileName.slice(0,dot):srcFileName;
    const ext=dot>0?srcFileName.slice(dot):".txt";
    const sig=getContentSig(ta.value);
    const edited=(sig!==srcContentSig)?"_edited":"";
    return ts+"_"+base+edited+ext;
  }
  return ts+"_note.txt";
}

// ── 外层面板 ──────────────────────────────────
const box=document.createElement("div");
box.id=id;
let dx=0,dy=0,collapsed=false;
const W=Math.min(window.innerWidth*0.95,720);
box.style.cssText=
  "position:fixed;top:10%;left:50%;transform:translate(-50%,0);"+
  "width:"+W+"px;height:70vh;background:#fff;border-radius:12px;"+
  "box-shadow:0 4px 20px rgba(0,0,0,.3);padding:12px;z-index:2147483647;"+
  "display:flex;flex-direction:column;box-sizing:border-box;font-size:14px;color:#333;";

// ── 标题栏 ────────────────────────────────────
const title=document.createElement("div");
title.textContent="📝 记事本(可拖动)";
title.style.cssText=
  "font-weight:bold;margin-bottom:8px;font-size:15px;cursor:move;"+
  "user-select:none;background:#4f8ef7;color:#fff;border-radius:8px;"+
  "padding:6px 10px;flex-shrink:0;";

// ── 内容区 ────────────────────────────────────
const body=document.createElement("div");
body.style.cssText="display:flex;flex-direction:column;flex:1;overflow:hidden;";

// ── 状态栏 ────────────────────────────────────
const statusBar=document.createElement("div");
statusBar.style.cssText=
  "font-size:12px;min-height:18px;margin-bottom:3px;padding:0 2px;"+
  "color:#555;flex-shrink:0;transition:opacity .3s;opacity:0;";
let statusTimer=null;
function showStatus(msg,isErr){
  statusBar.textContent=msg;
  statusBar.style.color=isErr?"#e53935":"#2e7d32";
  statusBar.style.opacity="1";
  clearTimeout(statusTimer);
  statusTimer=setTimeout(()=>statusBar.style.opacity="0",3000);
}

// ── 刻度尺开关行 ──────────────────────────────
const switchRow=document.createElement("div");
switchRow.style.cssText=
  "display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-shrink:0;";

const switchLabel=document.createElement("span");
switchLabel.textContent="刻度尺模式：";
switchLabel.style.cssText="font-size:13px;color:#555;";

const switchBtn=document.createElement("button");
switchBtn.textContent="● 关";
switchBtn.style.cssText=
  "padding:4px 12px;border:none;border-radius:12px;font-size:13px;"+
  "background:#ccc;color:#fff;cursor:pointer;";

const colLabel=document.createElement("span");
colLabel.style.cssText="font-size:12px;color:#888;margin-left:4px;";

switchRow.appendChild(switchLabel);
switchRow.appendChild(switchBtn);
switchRow.appendChild(colLabel);

// ── 刻度尺容器 ────────────────────────────────
const rulerWrap=document.createElement("div");
rulerWrap.style.cssText=
  "position:relative;height:28px;margin-bottom:2px;flex-shrink:0;"+
  "display:none;overflow:hidden;border:1px solid #c5cae9;"+
  "border-radius:4px;background:#e8eaf6;";

const rulerCanvas=document.createElement("canvas");
rulerCanvas.style.cssText=
  "position:absolute;left:0;top:0;width:100%;height:100%;";

const rulerLine=document.createElement("div");
rulerLine.style.cssText=
  "position:absolute;top:0;width:2px;height:100%;"+
  "background:#e53935;cursor:ew-resize;z-index:2;transform:translateX(-50%);";

const colTip=document.createElement("div");
colTip.style.cssText=
  "position:absolute;top:2px;font-size:10px;color:#e53935;"+
  "pointer-events:none;z-index:3;white-space:nowrap;"+
  "background:rgba(255,255,255,.85);border-radius:3px;padding:0 3px;";

rulerWrap.appendChild(rulerCanvas);
rulerWrap.appendChild(rulerLine);
rulerWrap.appendChild(colTip);

// ── textarea + 覆盖层 ─────────────────────────
const taWrap=document.createElement("div");
taWrap.style.cssText=
  "position:relative;flex:1;display:flex;flex-direction:column;";

const ta=document.createElement("textarea");
ta.placeholder="在此输入内容...";
ta.style.cssText=
  "flex:1;width:100%;resize:none;border:1px solid #b39ddb;border-radius:6px;"+
  "padding:"+TA_PADDING+"px;font-size:13px;line-height:1.5;box-sizing:border-box;"+
  "background:linear-gradient(135deg,#f3e5f5,#e8f5e9);font-family:monospace;";

const taOverlay=document.createElement("div");
taOverlay.style.cssText=
  "position:absolute;top:0;left:0;right:0;bottom:0;"+
  "pointer-events:none;overflow:hidden;border-radius:6px;display:none;";

const taLine=document.createElement("div");
taLine.style.cssText=
  "position:absolute;top:0;bottom:0;width:1px;background:rgba(229,57,53,.35);";

taOverlay.appendChild(taLine);
taWrap.appendChild(ta);
taWrap.appendChild(taOverlay);

// ── 刻度尺逻辑 ────────────────────────────────
let rulerEnabled=false;
let refCol=8;

function getRulerInnerWidth(){return rulerWrap.offsetWidth;}
function colToX(col){return rulerOffsetLeft+col*charW;}
function xToCol(x){
  const col=Math.round((x-rulerOffsetLeft)/charW);
  const maxCol=Math.floor((getRulerInnerWidth()-rulerOffsetLeft)/charW);
  return Math.max(0,Math.min(col,maxCol));
}

function updateRulerLine(){
  const x=colToX(refCol);
  rulerLine.style.left=x+"px";
  taLine.style.left=(x+TA_BORDER)+"px";
  colTip.textContent="第"+refCol+"列";
  const tipW=colTip.offsetWidth||30;
  const rW=getRulerInnerWidth();
  colTip.style.left=Math.min(x+4,rW-tipW-4)+"px";
  colLabel.textContent="(对齐第 "+refCol+" 列)";
}

function drawRuler(){
  const dpr=window.devicePixelRatio||1;
  const W2=rulerWrap.offsetWidth;
  const H2=28;
  rulerCanvas.width=W2*dpr;
  rulerCanvas.height=H2*dpr;
  rulerCanvas.style.width=W2+"px";
  rulerCanvas.style.height=H2+"px";
  const c=rulerCanvas.getContext("2d");
  c.scale(dpr,dpr);
  c.clearRect(0,0,W2,H2);
  c.fillStyle="#e8eaf6";
  c.fillRect(0,0,W2,H2);
  c.strokeStyle="#9fa8da";
  c.fillStyle="#5c6bc0";
  c.font="9px monospace";
  c.textAlign="center";
  const maxCol=Math.floor((W2-rulerOffsetLeft)/charW);
  for(let i=0;i<=maxCol;i++){
    const x=rulerOffsetLeft+i*charW;
    const big=(i%4===0);
    const tickH=big?12:6;
    c.beginPath();c.moveTo(x,H2);c.lineTo(x,H2-tickH);c.stroke();
    if(big&&i>0) c.fillText(i,x,H2-tickH-2);
  }
}

// ── 刻度尺拖动 ────────────────────────────────
let rulerDragging=false;
function onRulerDragStart(cx){
  rulerDragging=true;
  const rect=rulerWrap.getBoundingClientRect();
  refCol=xToCol(cx-rect.left);
  updateRulerLine();
}
function onRulerDragMove(cx){
  if(!rulerDragging)return;
  const rect=rulerWrap.getBoundingClientRect();
  refCol=xToCol(cx-rect.left);
  updateRulerLine();
}
function onRulerDragEnd(){rulerDragging=false;}

rulerWrap.addEventListener("mousedown",e=>{
  onRulerDragStart(e.clientX);e.stopPropagation();e.preventDefault();
});
document.addEventListener("mousemove",e=>{
  if(rulerDragging){onRulerDragMove(e.clientX);e.stopPropagation();}
});
document.addEventListener("mouseup",()=>onRulerDragEnd());
rulerWrap.addEventListener("touchstart",e=>{
  onRulerDragStart(e.touches[0].clientX);
  e.stopPropagation();e.preventDefault();
},{passive:false});
rulerWrap.addEventListener("touchmove",e=>{
  onRulerDragMove(e.touches[0].clientX);
  e.stopPropagation();e.preventDefault();
},{passive:false});
rulerWrap.addEventListener("touchend",e=>{
  onRulerDragEnd();e.stopPropagation();
},{passive:false});

// ── 开关逻辑 ──────────────────────────────────
function updateUnitState(){
  const dis=rulerEnabled;
  unitInput.disabled=dis;
  unitLabel.style.opacity=dis?"0.4":"1";
  unitInput.style.opacity=dis?"0.4":"1";
  unitSuffix.style.opacity=dis?"0.4":"1";
}

switchBtn.addEventListener("click",()=>{
  rulerEnabled=!rulerEnabled;
  if(rulerEnabled){
    switchBtn.textContent="● 开";
    switchBtn.style.background="#5c6bc0";
    rulerWrap.style.display="block";
    taOverlay.style.display="block";
    colLabel.textContent="(对齐第 "+refCol+" 列)";
    setTimeout(()=>{drawRuler();updateRulerLine();},0);
  } else {
    switchBtn.textContent="● 关";
    switchBtn.style.background="#ccc";
    rulerWrap.style.display="none";
    taOverlay.style.display="none";
    colLabel.textContent="";
  }
  updateUnitState();
});

// ── 通用按钮工厂 ──────────────────────────────
const mkBtn=(t,bg,fn)=>{
  const b=document.createElement("button");
  b.textContent=t;
  b.style.cssText=
    "padding:8px 4px;background:"+bg+";color:#fff;border:none;"+
    "border-radius:6px;font-size:13px;cursor:pointer;flex:1;box-sizing:border-box;";
  b.onclick=fn;
  return b;
};

// ── 缩进核心 ──────────────────────────────────
function doIndent(dir){
  const val=ta.value;
  const ss=ta.selectionStart;
  const se=ta.selectionEnd;
  const hasSelection=(ss!==se);

  function processLines(lines){
    let deltaStart=0,deltaEnd=0;
    const newLines=lines.map((l,i)=>{
      const curIndent=l.match(/^ */)[0].length;
      if(rulerEnabled){
        const delta=refCol-curIndent;
        if(delta>0){
          if(i===0)deltaStart+=delta;
          deltaEnd+=delta;
          return " ".repeat(delta)+l;
        } else if(delta<0){
          const remove=Math.min(-delta,curIndent);
          if(i===0)deltaStart-=remove;
          deltaEnd-=remove;
          return l.slice(remove);
        }
        return l;
      } else {
        const n=Math.max(1,parseInt(unitInput.value)||2);
        if(dir>0){
          if(i===0)deltaStart+=n;
          deltaEnd+=n;
          return " ".repeat(n)+l;
        } else {
          const remove=Math.min(n,curIndent);
          if(i===0)deltaStart-=remove;
          deltaEnd-=remove;
          return l.slice(remove);
        }
      }
    });
    return {newLines,deltaStart,deltaEnd};
  }

  if(!hasSelection){
    const lines=val.split("\n");
    const {newLines,deltaStart}=processLines(lines);
    ta.value=newLines.join("\n");
    const newSs=Math.max(0,ss+deltaStart);
    ta.setSelectionRange(newSs,newSs);
  } else {
    const lineStart=val.lastIndexOf("\n",ss-1)+1;
    const fullBefore=val.slice(0,lineStart);
    const toProcess=val.slice(lineStart,se);
    const after=val.slice(se);
    const lines=toProcess.split("\n");
    const {newLines,deltaStart,deltaEnd}=processLines(lines);
    ta.value=fullBefore+newLines.join("\n")+after;
    const newSs=Math.max(lineStart,ss+deltaStart);
    const newSe=Math.max(newSs,se+deltaEnd);
    ta.setSelectionRange(newSs,newSe);
  }
  ta.focus();
}

// ── 缩进行 ────────────────────────────────────
const indentRow=document.createElement("div");
indentRow.style.cssText=
  "display:flex;flex-direction:row;align-items:center;"+
  "gap:6px;margin-top:6px;flex-shrink:0;";

const unitLabel=document.createElement("span");
unitLabel.textContent="单位:";
unitLabel.style.cssText="font-size:13px;color:#555;white-space:nowrap;";

const unitInput=document.createElement("input");
unitInput.type="number";
unitInput.value="2";
unitInput.min="1";
unitInput.style.cssText=
  "width:44px;padding:6px 4px;border:1px solid #b39ddb;border-radius:6px;"+
  "font-size:13px;text-align:center;background:#f3e5f5;box-sizing:border-box;";

const unitSuffix=document.createElement("span");
unitSuffix.textContent="格";
unitSuffix.style.cssText="font-size:13px;color:#555;";

const dedentBtn=mkBtn("← 反缩进","#7e57c2",()=>doIndent(-1));
const indentBtn=mkBtn("→ 缩进","#5c6bc0",()=>doIndent(1));

[dedentBtn,unitLabel,unitInput,unitSuffix,indentBtn]
  .forEach(e=>indentRow.appendChild(e));

// ── 功能行 ────────────────────────────────────
const btnRow=document.createElement("div");
btnRow.style.cssText=
  "display:flex;flex-direction:row;gap:5px;margin-top:6px;flex-shrink:0;";

const copyBtn=mkBtn("复制","#0078ff",()=>{
  ta.select();
  document.execCommand("copy");
  copyBtn.textContent="已复制✔";
  setTimeout(()=>copyBtn.textContent="复制",1500);
});

const exportBtn=mkBtn("导出","#28a745",()=>{
  const name=getExportName();
  const b=new Blob([ta.value],{type:"text/plain"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=u;a.download=name;a.click();
  URL.revokeObjectURL(u);
  showStatus("✔ 已导出："+name);
});

const ACCEPT=[
  "text/*",".js",".ts",".jsx",".tsx",".json",".xml",
  ".yaml",".yml",".srt",".csv",".md",".log",".ini",
  ".cfg",".toml",".bat",".sh",".py",".html",".css",
  ".sass",".scss",".vue",".java",".c",".cpp",".h",
  ".rs",".go",".rb",".php",".swift",".kt",".sql"
].join(",");

const fileInput=document.createElement("input");
fileInput.type="file";
fileInput.accept=ACCEPT;
fileInput.style.display="none";
document.body.appendChild(fileInput);

function readAsText(file,encoding){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=e=>resolve(e.target.result);
    fr.onerror=reject;
    fr.readAsText(file,encoding||"UTF-8");
  });
}

fileInput.addEventListener("change",async()=>{
  const file=fileInput.files[0];
  if(!file)return;
  fileInput.value="";
  if(file.size>1024*1024){
    const go=confirm("文件较大("+Math.round(file.size/1024)+"KB)，可能影响性能，是否继续？");
    if(!go)return;
  }
  try{
    let text=await readAsText(file,"UTF-8");
    if(text.includes("\uFFFD")){
      showStatus("⚠ UTF-8解码异常，尝试GBK重新读取...",true);
      text=await readAsText(file,"GBK");
      if(text.includes("\uFFFD")){
        showStatus("⚠ 编码无法自动识别，内容可能有乱码",true);
      } else {
        showStatus("✔ 已用GBK导入："+file.name+
          "("+Math.round(file.size/1024*10)/10+"KB)");
      }
    } else {
      showStatus("✔ 已导入："+file.name+
        "("+Math.round(file.size/1024*10)/10+"KB)");
    }
    ta.value=text;
    srcFileName=file.name;
    srcContentSig=getContentSig(text);
    contentMode="imported";
  } catch(e){
    showStatus("✘ 导入失败："+e.message,true);
  }
});

const importBtn=mkBtn("导入","#fb8c00",()=>fileInput.click());

let clearPending=false;
let clearTimer=null;
const clearBtn=mkBtn("清空","#90a4ae",()=>{
  if(!clearPending){
    clearPending=true;
    clearBtn.textContent="确认？";
    clearBtn.style.background="#e53935";
    clearTimer=setTimeout(()=>{
      clearPending=false;
      clearBtn.textContent="清空";
      clearBtn.style.background="#90a4ae";
    },3000);
  } else {
    clearTimeout(clearTimer);
    ta.value="";
    srcFileName="";
    srcContentSig="";
    contentMode="manual";
    clearPending=false;
    clearBtn.textContent="清空";
    clearBtn.style.background="#90a4ae";
    showStatus("✔ 已清空");
    ta.focus();
  }
});

const closeBtn=mkBtn("关闭","#888",()=>{
  fileInput.remove();
  box.remove();
});

[copyBtn,exportBtn,importBtn,clearBtn,closeBtn]
  .forEach(e=>btnRow.appendChild(e));

// ── 组装结构 ──────────────────────────────────
[statusBar,switchRow,rulerWrap,taWrap,indentRow,btnRow]
  .forEach(e=>body.appendChild(e));
[title,body].forEach(e=>box.appendChild(e));
document.body.appendChild(box);

// ── 折叠 ──────────────────────────────────────
let lastTap=0;
function toggleCollapse(){
  collapsed=!collapsed;
  body.style.display=collapsed?"none":"flex";
  box.style.height=collapsed?"auto":"70vh";
  title.textContent=collapsed?"📝 记事本(已折叠)":"📝 记事本(可拖动)";
}

// ── 拖动 ──────────────────────────────────────
let dragging=false,sx=0,sy=0,moved=false;
function dragStart(cx,cy){dragging=true;sx=cx;sy=cy;moved=false;}
function dragMove(cx,cy){
  if(!dragging)return;
  const ddx=cx-sx,ddy=cy-sy;
  if(Math.abs(ddx)>3||Math.abs(ddy)>3)moved=true;
  dx+=ddx;dy+=ddy;sx=cx;sy=cy;
  box.style.transform="translate(calc(-50% + "+dx+"px),"+dy+"px)";
}
function dragEnd(){dragging=false;}

title.addEventListener("mousedown",e=>{
  dragStart(e.clientX,e.clientY);e.preventDefault();
});
document.addEventListener("mousemove",e=>{
  if(!rulerDragging)dragMove(e.clientX,e.clientY);
});
document.addEventListener("mouseup",()=>dragEnd());
title.addEventListener("dblclick",()=>{if(moved)return;toggleCollapse();});

title.addEventListener("touchstart",e=>{
  const t=e.touches[0];
  const now=Date.now();
  if(now-lastTap<300){
    toggleCollapse();lastTap=0;e.preventDefault();return;
  }
  lastTap=now;
  dragStart(t.clientX,t.clientY);
},{passive:false});
title.addEventListener("touchmove",e=>{
  dragMove(e.touches[0].clientX,e.touches[0].clientY);
  e.preventDefault();
},{passive:false});
title.addEventListener("touchend",()=>dragEnd());

window.addEventListener("resize",()=>{
  if(rulerEnabled){drawRuler();updateRulerLine();}
});

})();
