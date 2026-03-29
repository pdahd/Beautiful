// network-monitor.js v1.0 — 网络请求监控工具
(function(){

const TOOL_ID="nm_tool_987";
const old=document.getElementById(TOOL_ID);
if(old){old.remove();restoreHooks();return;}

// ════════════════════════════════════════════════
// 主题（默认深色）
// ════════════════════════════════════════════════
const T={
  bg:"#1a1a1a",bg2:"#252526",bg3:"#2d2d2d",bg4:"#333",
  border:"#3a3a3a",border2:"#444",
  text:"#ccc",text2:"#888",text3:"#4fc3f7",
  success:"#4caf50",warn:"#ff9800",
  error:"#ef5350",pending:"#888",
  red:"#ef5350",green:"#4caf50",
  blue:"#64b5f6",orange:"#ff9800",
  handleBg:"#2a2a2a",handleActive:"#3d3d3d",
  rowHover:"#2a2a2a",rowSelected:"#1e3a4a",
  tag:"#37474f"
};

// ════════════════════════════════════════════════
// 全局状态
// ════════════════════════════════════════════════
const records=[];       // 所有请求记录
let recPaused=false;    // 是否暂停录制
let selectedId=null;    // 当前选中的请求ID
let filterText="";      // 关键词筛选
let filterMethod="ALL"; // 方法筛选
let filterStatus="ALL"; // 状态筛选
let filterType="ALL";   // 类型筛选
let detailTab="响应";   // 详情子标签
const MAX_RECORDS=500;
const MAX_BODY=10240;   // 10KB
let _uid=0;
function uid(){return ++_uid;}

// ════════════════════════════════════════════════
// 拦截器（fetch + XHR）
// ════════════════════════════════════════════════
const _origFetch=window.fetch;
const _origXHROpen=XMLHttpRequest.prototype.open;
const _origXHRSend=XMLHttpRequest.prototype.send;
const _origXHRSetHeader=XMLHttpRequest.prototype.setRequestHeader;

function restoreHooks(){
  window.fetch=_origFetch;
  XMLHttpRequest.prototype.open=_origXHROpen;
  XMLHttpRequest.prototype.send=_origXHRSend;
  XMLHttpRequest.prototype.setRequestHeader=_origXHRSetHeader;
}

function addRecord(rec){
  if(recPaused)return;
  records.unshift(rec);
  if(records.length>MAX_RECORDS) records.pop();
  renderList();
  updateStats();
}

function updateRecord(id,patch){
  const idx=records.findIndex(r=>r.id===id);
  if(idx<0)return;
  Object.assign(records[idx],patch);
  renderList();
  updateStats();
  if(selectedId===id) renderDetail(records[idx]);
}

// ── fetch 拦截 ────────────────────────────────
window.fetch=function(input,init){
  const id=uid();
  const method=((init&&init.method)||"GET").toUpperCase();
  const url=typeof input==="string"?input:
    input instanceof URL?input.href:
    input instanceof Request?input.url:"unknown";
  const reqHeaders={};
  if(init&&init.headers){
    try{
      new Headers(init.headers).forEach((v,k)=>reqHeaders[k]=v);
    }catch(e){}
  }
  let reqBody="";
  if(init&&init.body){
    try{
      reqBody=typeof init.body==="string"?init.body:
        init.body instanceof FormData?"[FormData]":
        init.body instanceof Blob?"[Blob]":
        JSON.stringify(init.body);
    }catch(e){reqBody="[不可序列化]";}
  }
  const rec={
    id,method,url,type:"fetch",
    status:0,statusText:"",
    startTime:Date.now(),endTime:0,duration:0,
    reqHeaders,reqBody,
    resHeaders:{},resBody:"",resSize:0,
    state:"pending",error:""
  };
  addRecord(rec);
  return _origFetch.call(this,input,init).then(res=>{
    const resHeaders={};
    res.headers.forEach((v,k)=>resHeaders[k]=v);
    const cloned=res.clone();
    cloned.text().then(body=>{
      const size=new Blob([body]).size;
      updateRecord(id,{
        status:res.status,statusText:res.statusText,
        resHeaders,
        resBody:body.length>MAX_BODY?
          body.slice(0,MAX_BODY)+"\n…(已截断，完整:"+
          Math.round(size/1024*10)/10+"KB)":body,
        resSize:size,
        endTime:Date.now(),
        duration:Date.now()-rec.startTime,
        state:"done"
      });
    }).catch(()=>{
      updateRecord(id,{
        status:res.status,statusText:res.statusText,
        resHeaders,resBody:"[无法读取响应体]",
        endTime:Date.now(),
        duration:Date.now()-rec.startTime,
        state:"done"
      });
    });
    return res;
  }).catch(err=>{
    updateRecord(id,{
      state:"error",error:err.message,
      endTime:Date.now(),
      duration:Date.now()-rec.startTime
    });
    throw err;
  });
};

// ── XHR 拦截 ──────────────────────────────────
XMLHttpRequest.prototype.open=function(method,url,...args){
  this._nm={
    id:uid(),
    method:method.toUpperCase(),
    url:String(url),
    type:"xhr",
    reqHeaders:{},
    startTime:0
  };
  return _origXHROpen.apply(this,[method,url,...args]);
};

XMLHttpRequest.prototype.setRequestHeader=function(k,v){
  if(this._nm) this._nm.reqHeaders[k]=v;
  return _origXHRSetHeader.apply(this,arguments);
};

XMLHttpRequest.prototype.send=function(body){
  if(this._nm){
    const nm=this._nm;
    nm.startTime=Date.now();
    let reqBody="";
    if(body){
      try{
        reqBody=typeof body==="string"?body:
          body instanceof FormData?"[FormData]":
          body instanceof Blob?"[Blob]":
          JSON.stringify(body);
      }catch(e){reqBody="[不可序列化]";}
    }
    const rec={
      id:nm.id,method:nm.method,url:nm.url,
      type:"xhr",status:0,statusText:"",
      startTime:nm.startTime,endTime:0,duration:0,
      reqHeaders:nm.reqHeaders,reqBody,
      resHeaders:{},resBody:"",resSize:0,
      state:"pending",error:""
    };
    addRecord(rec);

    this.addEventListener("load",()=>{
      const resHeaders={};
      this.getAllResponseHeaders().trim().split("\r\n")
        .forEach(line=>{
          const idx=line.indexOf(": ");
          if(idx>0) resHeaders[line.slice(0,idx)]=line.slice(idx+2);
        });
      const body=this.responseText||"";
      const size=new Blob([body]).size;
      updateRecord(nm.id,{
        status:this.status,statusText:this.statusText,
        resHeaders,
        resBody:body.length>MAX_BODY?
          body.slice(0,MAX_BODY)+"\n…(已截断，完整:"+
          Math.round(size/1024*10)/10+"KB)":body,
        resSize:size,
        endTime:Date.now(),
        duration:Date.now()-nm.startTime,
        state:"done"
      });
    });
    this.addEventListener("error",()=>{
      updateRecord(nm.id,{
        state:"error",error:"网络错误",
        endTime:Date.now(),
        duration:Date.now()-nm.startTime
      });
    });
    this.addEventListener("abort",()=>{
      updateRecord(nm.id,{
        state:"error",error:"已中止",
        endTime:Date.now(),
        duration:Date.now()-nm.startTime
      });
    });
  }
  return _origXHRSend.apply(this,arguments);
};

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
  const old=document.getElementById("nm_toast");
  if(old)old.remove();
  const t=document.createElement("div");
  t.id="nm_toast";
  t.style.cssText=
    "position:fixed;top:60px;left:50%;transform:translateX(-50%);"+
    "background:"+(isErr?"#e53935":"#323232")+";color:#fff;"+
    "padding:8px 20px;border-radius:20px;font-size:13px;"+
    "z-index:2147483649;pointer-events:none;white-space:nowrap;";
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2500);
}

function shortUrl(url){
  try{
    const u=new URL(url);
    const path=u.pathname+(u.search?"?...":"");
    return path.length>50?path.slice(0,50)+"…":path;
  }catch(e){
    return url.length>50?url.slice(0,50)+"…":url;
  }
}

function formatSize(bytes){
  if(!bytes||bytes===0)return "-";
  if(bytes<1024)return bytes+"B";
  if(bytes<1024*1024)return Math.round(bytes/102.4)/10+"KB";
  return Math.round(bytes/1024/102.4)/10+"MB";
}

function formatDuration(ms){
  if(!ms||ms===0)return "-";
  if(ms<1000)return ms+"ms";
  return (ms/1000).toFixed(2)+"s";
}

function statusColor(rec){
  if(rec.state==="pending")return T.pending;
  if(rec.state==="error")return T.red;
  const s=rec.status;
  if(s>=500)return T.red;
  if(s>=400)return T.orange;
  if(s>=300)return T.blue;
  if(s>=200)return T.green;
  return T.text2;
}

function statusIcon(rec){
  if(rec.state==="pending")return "⏳";
  if(rec.state==="error")return "✘";
  const s=rec.status;
  if(s>=400)return "✘";
  if(s>=200)return "✔";
  return "?";
}

function methodColor(m){
  const map={
    GET:T.green,POST:"#ab47bc",PUT:T.orange,
    DELETE:T.red,PATCH:"#26c6da",
    HEAD:T.text2,OPTIONS:T.text2
  };
  return map[m]||T.text;
}

function tryFormatJson(str){
  if(!str)return str;
  try{
    return JSON.stringify(JSON.parse(str),null,2);
  }catch(e){return str;}
}

function buildCurl(rec){
  let cmd="curl -X "+rec.method+" \""+rec.url+"\"";
  Object.entries(rec.reqHeaders).forEach(([k,v])=>{
    cmd+=" \\\n  -H \""+k+": "+v+"\"";
  });
  if(rec.reqBody&&rec.reqBody!=="[FormData]"&&
     rec.reqBody!=="[Blob]"){
    cmd+=" \\\n  -d '"+rec.reqBody.replace(/'/g,"'\\''")+"'";
  }
  return cmd;
}

function getFilteredRecords(){
  return records.filter(rec=>{
    if(filterText){
      const q=filterText.toLowerCase();
      const inUrl=rec.url.toLowerCase().includes(q);
      const inBody=(rec.resBody||"").toLowerCase().includes(q);
      if(!inUrl&&!inBody)return false;
    }
    if(filterMethod!=="ALL"&&rec.method!==filterMethod)return false;
    if(filterType!=="ALL"&&rec.type!==filterType)return false;
    if(filterStatus!=="ALL"){
      if(filterStatus==="2xx"&&(rec.status<200||rec.status>=300))
        return false;
      if(filterStatus==="3xx"&&(rec.status<300||rec.status>=400))
        return false;
      if(filterStatus==="4xx"&&(rec.status<400||rec.status>=500))
        return false;
      if(filterStatus==="5xx"&&rec.status<500)return false;
      if(filterStatus==="错误"&&rec.state!=="error")return false;
      if(filterStatus==="pending"&&rec.state!=="pending")return false;
    }
    return true;
  });
}

// ════════════════════════════════════════════════
// DOM 构建
// ════════════════════════════════════════════════
const root=document.createElement("div");
root.id=TOOL_ID;
root.style.cssText=
  "position:fixed;z-index:2147483647;font-size:13px;"+
  "font-family:-apple-system,BlinkMacSystemFont,monospace;"+
  "touch-action:none;";

// ── 主面板 ────────────────────────────────────
const VH=window.innerHeight;
const MIN_H=120,MAX_H=Math.round(VH*0.95);
let panelH=Math.round(VH*0.65);

const panel=document.createElement("div");
panel.style.cssText=
  "position:fixed;bottom:0;left:0;width:100%;"+
  "display:flex;flex-direction:column;"+
  "background:"+T.bg+";"+
  "border-top:2px solid "+T.text3+";"+
  "box-shadow:0 -4px 20px rgba(0,0,0,.5);"+
  "z-index:2147483647;height:"+panelH+"px;";

// ── 拖动手柄 ──────────────────────────────────
const dragHandle=document.createElement("div");
dragHandle.style.cssText=
  "height:44px;display:flex;align-items:center;"+
  "justify-content:center;cursor:ns-resize;flex-shrink:0;"+
  "user-select:none;touch-action:none;position:relative;"+
  "background:"+T.handleBg+";border-bottom:1px solid "+T.border+";";

const dragIcon=document.createElement("div");
dragIcon.style.cssText=
  "display:flex;flex-direction:column;gap:5px;pointer-events:none;";
[32,22,32].forEach(w=>{
  const bar=document.createElement("div");
  bar.style.cssText=
    "height:3px;border-radius:2px;width:"+w+
    "px;background:"+T.text2+";";
  dragIcon.appendChild(bar);
});

const heightTip=document.createElement("span");
heightTip.style.cssText=
  "position:absolute;right:12px;font-size:11px;"+
  "color:"+T.text2+";pointer-events:none;"+
  "opacity:0;transition:opacity .2s;";

dragHandle.appendChild(dragIcon);
dragHandle.appendChild(heightTip);

let panelDragging=false,pStartY=0,pStartH=0,lastTap=0;

function setPanelH(h){
  panelH=Math.max(MIN_H,Math.min(MAX_H,h));
  panel.style.height=panelH+"px";
  heightTip.textContent=panelH+"px";
}

dragHandle.addEventListener("mousedown",e=>{
  panelDragging=true;pStartY=e.clientY;pStartH=panelH;
  heightTip.style.opacity="1";
  dragHandle.style.background=T.handleActive;
  e.preventDefault();e.stopPropagation();
});
dragHandle.addEventListener("touchstart",e=>{
  const now=Date.now();
  if(now-lastTap<300){
    setPanelH(panelH<MAX_H-20?MAX_H:Math.round(VH*0.5));
    lastTap=0;
  } else {
    lastTap=now;
    panelDragging=true;
    pStartY=e.touches[0].clientY;pStartH=panelH;
    heightTip.style.opacity="1";
    dragHandle.style.background=T.handleActive;
  }
  e.stopPropagation();
},{passive:true});
dragHandle.addEventListener("dblclick",e=>{
  setPanelH(panelH<MAX_H-20?MAX_H:Math.round(VH*0.5));
  e.stopPropagation();
});
document.addEventListener("mousemove",e=>{
  if(panelDragging){
    setPanelH(pStartH+(pStartY-e.clientY));
    e.preventDefault();
  }
});
document.addEventListener("mouseup",()=>{
  if(panelDragging){
    panelDragging=false;
    heightTip.style.opacity="0";
    dragHandle.style.background=T.handleBg;
  }
});
document.addEventListener("touchmove",e=>{
  if(panelDragging){
    setPanelH(pStartH+(pStartY-e.touches[0].clientY));
    e.preventDefault();
  }
},{passive:false});
document.addEventListener("touchend",()=>{
  if(panelDragging){
    panelDragging=false;
    heightTip.style.opacity="0";
    dragHandle.style.background=T.handleBg;
  }
});

// ── 顶部控制栏 ────────────────────────────────
const topBar=document.createElement("div");
topBar.style.cssText=
  "display:flex;align-items:center;gap:8px;padding:8px 12px;"+
  "flex-shrink:0;border-bottom:1px solid "+T.border+";"+
  "background:"+T.bg2+";flex-wrap:wrap;";

const titleSpan=document.createElement("span");
titleSpan.style.cssText=
  "font-weight:bold;color:"+T.text3+";font-size:14px;flex-shrink:0;";
titleSpan.textContent="🌐 网络监控";

// 录制状态指示
const recDot=document.createElement("span");
recDot.style.cssText=
  "width:10px;height:10px;border-radius:50%;"+
  "background:#ef5350;display:inline-block;flex-shrink:0;"+
  "box-shadow:0 0 6px #ef5350;animation:nm_blink 1s infinite;";

// 注入闪烁动画
const style=document.createElement("style");
style.textContent=
  "@keyframes nm_blink{0%,100%{opacity:1}50%{opacity:.3}}";
document.head.appendChild(style);

function mkBtn(t,bg,fn){
  const b=document.createElement("button");
  b.textContent=t;
  b.style.cssText=
    "padding:5px 12px;background:"+bg+";color:#fff;border:none;"+
    "border-radius:6px;font-size:12px;cursor:pointer;"+
    "white-space:nowrap;flex-shrink:0;";
  b.onclick=fn;return b;
}

const pauseBtn=mkBtn("⏸ 暂停","#555",togglePause);
const clearBtn=mkBtn("🗑 清空","#555",()=>{
  records.length=0;selectedId=null;
  renderList();updateStats();renderDetail(null);
});
const exportBtn=mkBtn("📥 导出","#0078ff",exportAll);
const closeBtn=mkBtn("✕","#444",()=>{
  cleanup();root.remove();panel.remove();
});

[titleSpan,recDot,pauseBtn,clearBtn,exportBtn,closeBtn]
  .forEach(e=>topBar.appendChild(e));

function togglePause(){
  recPaused=!recPaused;
  if(recPaused){
    recDot.style.animation="none";
    recDot.style.background=T.text2;
    recDot.style.boxShadow="none";
    pauseBtn.textContent="● 录制";
    pauseBtn.style.background=T.green;
  } else {
    recDot.style.animation="nm_blink 1s infinite";
    recDot.style.background="#ef5350";
    recDot.style.boxShadow="0 0 6px #ef5350";
    pauseBtn.textContent="⏸ 暂停";
    pauseBtn.style.background="#555";
  }
}

// ── 统计栏 ────────────────────────────────────
const statsBar=document.createElement("div");
statsBar.style.cssText=
  "padding:5px 12px;font-size:12px;display:flex;"+
  "gap:16px;flex-shrink:0;background:"+T.bg3+";"+
  "border-bottom:1px solid "+T.border+";flex-wrap:wrap;";

const statTotal=mkStatItem("共 0 条");
const statFail=mkStatItem("失败 0","#ef5350");
const statPending=mkStatItem("等待 0",T.text2);
const statSize=mkStatItem("0B");
const statAvg=mkStatItem("均 -");

function mkStatItem(text,color){
  const s=document.createElement("span");
  s.style.cssText="color:"+(color||T.text2)+";";
  s.textContent=text;
  statsBar.appendChild(s);
  return s;
}

function updateStats(){
  const filtered=getFilteredRecords();
  const total=filtered.length;
  const fail=filtered.filter(r=>
    r.state==="error"||r.status>=400).length;
  const pending=filtered.filter(r=>r.state==="pending").length;
  const totalSize=filtered.reduce((a,r)=>a+r.resSize,0);
  const done=filtered.filter(r=>r.state==="done"&&r.duration>0);
  const avgMs=done.length?
    Math.round(done.reduce((a,r)=>a+r.duration,0)/done.length):0;
  statTotal.textContent="共 "+total+" 条";
  statFail.textContent="失败 "+fail;
  statFail.style.color=fail>0?T.red:T.text2;
  statPending.textContent="等待 "+pending;
  statSize.textContent=formatSize(totalSize);
  statAvg.textContent=avgMs?"均 "+avgMs+"ms":"均 -";
}

// ── 筛选栏 ────────────────────────────────────
const filterBar=document.createElement("div");
filterBar.style.cssText=
  "padding:6px 12px;display:flex;gap:8px;"+
  "flex-shrink:0;background:"+T.bg2+";"+
  "border-bottom:1px solid "+T.border+";flex-wrap:wrap;"+
  "align-items:center;";

const filterInput=document.createElement("input");
filterInput.placeholder="URL / 响应体关键词…";
filterInput.style.cssText=
  "flex:1;min-width:120px;padding:5px 10px;"+
  "background:"+T.bg3+";color:"+T.text+";"+
  "border:1px solid "+T.border2+";border-radius:6px;"+
  "font-size:12px;";
filterInput.oninput=()=>{
  filterText=filterInput.value.trim();
  renderList();updateStats();
};

function mkSelect(opts,onChange){
  const s=document.createElement("select");
  s.style.cssText=
    "padding:5px 8px;background:"+T.bg3+";color:"+T.text+";"+
    "border:1px solid "+T.border2+";border-radius:6px;"+
    "font-size:12px;cursor:pointer;";
  opts.forEach(([val,label])=>{
    const o=document.createElement("option");
    o.value=val;o.textContent=label;
    s.appendChild(o);
  });
  s.onchange=()=>onChange(s.value);
  return s;
}

const methodSel=mkSelect([
  ["ALL","全部方法"],["GET","GET"],["POST","POST"],
  ["PUT","PUT"],["DELETE","DELETE"],["PATCH","PATCH"]
],v=>{filterMethod=v;renderList();updateStats();});

const statusSel=mkSelect([
  ["ALL","全部状态"],["2xx","2xx成功"],["3xx","3xx跳转"],
  ["4xx","4xx客户端错"],["5xx","5xx服务端错"],
  ["错误","网络错误"],["pending","等待中"]
],v=>{filterStatus=v;renderList();updateStats();});

const typeSel=mkSelect([
  ["ALL","全部类型"],["fetch","fetch"],["xhr","XHR"]
],v=>{filterType=v;renderList();updateStats();});

[filterInput,methodSel,statusSel,typeSel]
  .forEach(e=>filterBar.appendChild(e));

// ── 主体区域（列表+详情）─────────────────────
const bodyArea=document.createElement("div");
bodyArea.style.cssText=
  "flex:1;display:flex;flex-direction:column;"+
  "overflow:hidden;min-height:0;";

// 列表区
const listWrap=document.createElement("div");
listWrap.style.cssText=
  "flex:1;overflow-y:auto;overflow-x:auto;"+
  "min-height:0;";

// 列表头
const listHead=document.createElement("div");
listHead.style.cssText=
  "display:grid;"+
  "grid-template-columns:32px 50px 70px 1fr 50px 60px 60px;"+
  "padding:4px 8px;font-size:11px;"+
  "color:"+T.text2+";border-bottom:1px solid "+T.border+";"+
  "background:"+T.bg3+";position:sticky;top:0;z-index:2;"+
  "min-width:480px;";
["","状态","方法","URL","类型","大小","耗时"]
  .forEach(h=>{
    const th=document.createElement("div");
    th.textContent=h;th.style.padding="0 4px";
    listHead.appendChild(th);
  });

const listBody=document.createElement("div");
listBody.style.cssText="min-width:480px;";

listWrap.appendChild(listHead);
listWrap.appendChild(listBody);

// 详情区（可折叠）
const detailWrap=document.createElement("div");
detailWrap.style.cssText=
  "flex-shrink:0;border-top:2px solid "+T.border+";"+
  "background:"+T.bg2+";display:flex;flex-direction:column;"+
  "max-height:45%;min-height:0;overflow:hidden;";

// 详情标题栏
const detailHeader=document.createElement("div");
detailHeader.style.cssText=
  "display:flex;align-items:center;gap:8px;"+
  "padding:6px 12px;border-bottom:1px solid "+T.border+";"+
  "flex-shrink:0;";

const detailTitle=document.createElement("span");
detailTitle.style.cssText=
  "font-size:12px;color:"+T.text2+";flex:1;"+
  "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
detailTitle.textContent="点击请求查看详情";

// 详情子标签
const DETAIL_TABS=["请求","响应","Headers","时序"];
const detailTabBtns={};

function mkDetailTabBtn(name){
  const b=document.createElement("button");
  b.textContent=name;
  b.style.cssText=
    "padding:3px 10px;border:none;border-radius:4px;"+
    "font-size:12px;cursor:pointer;background:transparent;"+
    "color:"+T.text2+";";
  b.onclick=()=>{
    detailTab=name;
    DETAIL_TABS.forEach(n=>{
      detailTabBtns[n].style.background=
        n===name?T.text3:"transparent";
      detailTabBtns[n].style.color=
        n===name?"#fff":T.text2;
    });
    const rec=records.find(r=>r.id===selectedId);
    if(rec) renderDetail(rec);
  };
  detailTabBtns[name]=b;
  return b;
}
DETAIL_TABS.forEach(n=>detailHeader.appendChild(mkDetailTabBtn(n)));
detailHeader.appendChild(detailTitle);

// 设置初始激活标签
detailTabBtns["响应"].style.background=T.text3;
detailTabBtns["响应"].style.color="#fff";

// 详情内容区
const detailContent=document.createElement("div");
detailContent.style.cssText=
  "flex:1;overflow-y:auto;overflow-x:auto;"+
  "padding:10px 12px;font-size:12px;min-height:0;"+
  "font-family:monospace;white-space:pre-wrap;"+
  "word-break:break-all;color:"+T.text+";";

// 详情操作栏
const detailActions=document.createElement("div");
detailActions.style.cssText=
  "display:flex;gap:6px;padding:6px 12px;"+
  "border-top:1px solid "+T.border+";flex-shrink:0;"+
  "flex-wrap:wrap;background:"+T.bg3+";";

function mkActBtn(t,fn){
  const b=document.createElement("button");
  b.textContent=t;
  b.style.cssText=
    "padding:5px 12px;background:"+T.bg4+";color:"+T.text+";"+
    "border:1px solid "+T.border2+";border-radius:6px;"+
    "font-size:12px;cursor:pointer;";
  b.onclick=fn;return b;
}

const copyUrlBtn=mkActBtn("复制URL",()=>{
  const rec=records.find(r=>r.id===selectedId);
  if(rec){copyText(rec.url);showToast("已复制URL");}
});
const copyCurlBtn=mkActBtn("复制cURL",()=>{
  const rec=records.find(r=>r.id===selectedId);
  if(rec){copyText(buildCurl(rec));showToast("已复制cURL");}
});
const copyResBtn=mkActBtn("复制响应",()=>{
  const rec=records.find(r=>r.id===selectedId);
  if(rec&&rec.resBody){copyText(rec.resBody);showToast("已复制响应体");}
});
const copyReqBtn=mkActBtn("复制请求体",()=>{
  const rec=records.find(r=>r.id===selectedId);
  if(rec&&rec.reqBody){copyText(rec.reqBody);showToast("已复制请求体");}
});

[copyUrlBtn,copyCurlBtn,copyResBtn,copyReqBtn]
  .forEach(b=>detailActions.appendChild(b));

detailWrap.appendChild(detailHeader);
detailWrap.appendChild(detailContent);
detailWrap.appendChild(detailActions);

bodyArea.appendChild(listWrap);
bodyArea.appendChild(detailWrap);

// 组装面板
panel.appendChild(dragHandle);
panel.appendChild(topBar);
panel.appendChild(statsBar);
panel.appendChild(filterBar);
panel.appendChild(bodyArea);

root.appendChild(panel);
document.body.appendChild(root);

// ════════════════════════════════════════════════
// 渲染函数
// ════════════════════════════════════════════════
function renderList(){
  const filtered=getFilteredRecords();
  listBody.innerHTML="";

  if(filtered.length===0){
    const empty=document.createElement("div");
    empty.style.cssText=
      "text-align:center;padding:40px;color:"+T.text2+";font-size:13px;";
    empty.textContent=records.length===0?
      "⏳ 等待请求中…（操作页面触发网络请求）":
      "🔍 无匹配结果";
    listBody.appendChild(empty);
    return;
  }

  filtered.forEach(rec=>{
    const row=document.createElement("div");
    const isSelected=rec.id===selectedId;
    row.style.cssText=
      "display:grid;"+
      "grid-template-columns:32px 50px 70px 1fr 50px 60px 60px;"+
      "padding:5px 8px;font-size:12px;"+
      "border-bottom:1px solid "+T.border+";"+
      "cursor:pointer;min-width:480px;"+
      "background:"+(isSelected?T.rowSelected:"transparent")+";"+
      "transition:background .1s;";

    // 图标列
    const iconCell=document.createElement("div");
    iconCell.style.cssText="color:"+statusColor(rec)+";text-align:center;";
    iconCell.textContent=statusIcon(rec);

    // 状态码列
    const statusCell=document.createElement("div");
    statusCell.style.cssText=
      "color:"+statusColor(rec)+";font-weight:bold;padding:0 4px;";
    statusCell.textContent=
      rec.state==="pending"?"…":
      rec.state==="error"?"ERR":
      String(rec.status);

    // 方法列
    const methodCell=document.createElement("div");
    methodCell.style.cssText=
      "color:"+methodColor(rec.method)+";font-weight:bold;padding:0 4px;";
    methodCell.textContent=rec.method;

    // URL列
    const urlCell=document.createElement("div");
    urlCell.style.cssText=
      "overflow:hidden;text-overflow:ellipsis;"+
      "white-space:nowrap;padding:0 4px;color:"+T.text+";";
    urlCell.textContent=shortUrl(rec.url);
    urlCell.title=rec.url;

    // 类型列
    const typeCell=document.createElement("div");
    typeCell.style.cssText=
      "color:"+T.text2+";padding:0 4px;font-size:11px;";
    typeCell.textContent=rec.type==="fetch"?"fetch":"XHR";

    // 大小列
    const sizeCell=document.createElement("div");
    sizeCell.style.cssText="color:"+T.text2+";padding:0 4px;text-align:right;";
    sizeCell.textContent=formatSize(rec.resSize);

    // 耗时列
    const durCell=document.createElement("div");
    durCell.style.cssText="color:"+T.text2+";padding:0 4px;text-align:right;";
    durCell.textContent=formatDuration(rec.duration);

    [iconCell,statusCell,methodCell,urlCell,
     typeCell,sizeCell,durCell].forEach(c=>row.appendChild(c));

    row.onmouseover=()=>{
      if(rec.id!==selectedId)
        row.style.background=T.rowHover;
    };
    row.onmouseout=()=>{
      if(rec.id!==selectedId)
        row.style.background="transparent";
    };
    row.onclick=()=>{
      selectedId=rec.id;
      renderList();
      renderDetail(rec);
    };

    listBody.appendChild(row);
  });
}

function renderDetail(rec){
  detailContent.innerHTML="";
  detailActions.style.display=rec?"flex":"none";

  if(!rec){
    detailContent.style.color=T.text2;
    detailContent.textContent="点击上方请求查看详情";
    return;
  }

  detailTitle.textContent=
    rec.method+" "+shortUrl(rec.url)+
    (rec.state==="done"?" ["+rec.status+"]":
     rec.state==="error"?" [ERROR]":" [pending]");

  const tab=detailTab;

  if(tab==="请求"){
    let out="";
    out+="方法:   "+rec.method+"\n";
    out+="URL:    "+rec.url+"\n";

    // 解析Query参数
    try{
      const u=new URL(rec.url);
      if(u.search){
        out+="\n— Query参数 —\n";
        u.searchParams.forEach((v,k)=>{
          out+="  "+k+" = "+v+"\n";
        });
      }
    }catch(e){}

    out+="\n— 请求体 —\n";
    out+=rec.reqBody?tryFormatJson(rec.reqBody):"（无请求体）";
    detailContent.textContent=out;

  } else if(tab==="响应"){
    if(rec.state==="pending"){
      detailContent.style.color=T.text2;
      detailContent.textContent="⏳ 请求进行中…";
      return;
    }
    if(rec.state==="error"){
      detailContent.style.color=T.red;
      detailContent.textContent="✘ 错误："+rec.error;
      return;
    }
    let out="状态:   "+rec.status+" "+rec.statusText+"\n";
    out+="大小:   "+formatSize(rec.resSize)+"\n";
    out+="耗时:   "+formatDuration(rec.duration)+"\n\n";
    out+="— 响应体 —\n";
    out+=rec.resBody?tryFormatJson(rec.resBody):"（无响应体）";
    detailContent.style.color=T.text;
    detailContent.textContent=out;

  } else if(tab==="Headers"){
    let out="— 请求头 —\n";
    const rh=rec.reqHeaders;
    if(Object.keys(rh).length){
      Object.entries(rh).forEach(([k,v])=>{
        out+="  "+k+": "+v+"\n";
      });
    } else {
      out+="（无）\n";
    }
    out+="\n— 响应头 —\n";
    const sh=rec.resHeaders;
    if(Object.keys(sh).length){
      Object.entries(sh).forEach(([k,v])=>{
        out+="  "+k+": "+v+"\n";
      });
    } else {
      out+="（无 / 请求未完成）\n";
    }
    detailContent.style.color=T.text;
    detailContent.textContent=out;

  } else if(tab==="时序"){
    const start=rec.startTime;
    const end=rec.endTime||Date.now();
    const dur=rec.duration||0;

    // 相对于最早请求的时间偏移
    const earliest=records.length?
      records[records.length-1].startTime:start;
    const offset=start-earliest;
    const maxDur=Math.max(...records.map(r=>r.duration||0),1);
    const barW=Math.max(2,Math.round((dur/maxDur)*200));

    let out="开始时间:  "+new Date(start).toLocaleTimeString()+
      "."+String(start%1000).padStart(3,"0")+"\n";
    out+="结束时间:  "+
      (rec.endTime?new Date(end).toLocaleTimeString()+
      "."+String(end%1000).padStart(3,"0"):"进行中")+"\n";
    out+="耗时:      "+formatDuration(dur)+"\n";
    out+="相对偏移:  +"+offset+"ms\n\n";
    out+="耗时可视化:\n";
    out+="["+("█".repeat(barW))+"] "+formatDuration(dur);
    detailContent.style.color=T.text;
    detailContent.textContent=out;
  }
}

// ════════════════════════════════════════════════
// 导出功能
// ════════════════════════════════════════════════
function exportAll(){
  const filtered=getFilteredRecords();
  if(!filtered.length){showToast("没有可导出的数据",true);return;}

  // 同时提供JSON和HAR两种格式
  const ts=getTimestamp();

  // JSON导出
  const jsonData=JSON.stringify(filtered.map(r=>({
    id:r.id,method:r.method,url:r.url,type:r.type,
    status:r.status,statusText:r.statusText,
    startTime:new Date(r.startTime).toISOString(),
    duration:r.duration,resSize:r.resSize,
    reqHeaders:r.reqHeaders,reqBody:r.reqBody,
    resHeaders:r.resHeaders,
    resBody:r.resBody.slice(0,2048),
    state:r.state,error:r.error
  })),null,2);

  // HAR导出
  const har={
    log:{
      version:"1.2",
      creator:{name:"network-monitor",version:"1.0"},
      entries:filtered.map(r=>({
        startedDateTime:new Date(r.startTime).toISOString(),
        time:r.duration||0,
        request:{
          method:r.method,url:r.url,
          httpVersion:"HTTP/1.1",
          headers:Object.entries(r.reqHeaders)
            .map(([k,v])=>({name:k,value:v})),
          queryString:[],
          cookies:[],
          headersSize:-1,
          bodySize:r.reqBody?new Blob([r.reqBody]).size:0,
          postData:r.reqBody?{
            mimeType:"application/json",
            text:r.reqBody
          }:undefined
        },
        response:{
          status:r.status,statusText:r.statusText,
          httpVersion:"HTTP/1.1",
          headers:Object.entries(r.resHeaders)
            .map(([k,v])=>({name:k,value:v})),
          cookies:[],
          content:{
            size:r.resSize,
            mimeType:r.resHeaders["content-type"]||"text/plain",
            text:r.resBody
          },
          redirectURL:"",
          headersSize:-1,
          bodySize:r.resSize
        },
        cache:{},
        timings:{send:0,wait:r.duration||0,receive:0}
      }))
    }
  };

  // 打开新标签页展示选择
  const w=window.open("","_blank");
  if(w){
    const html=
      "<!DOCTYPE html><html><head>"+
      "<meta charset='utf-8'>"+
      "<title>网络监控导出 "+ts+"</title>"+
      "<style>body{font-family:monospace;padding:20px;background:#1a1a1a;color:#ccc;}"+
      "h2{color:#4fc3f7;}button{margin:8px 8px 0 0;padding:10px 20px;"+
      "background:#0078ff;color:#fff;border:none;border-radius:6px;"+
      "font-size:14px;cursor:pointer;}"+
      "pre{background:#252526;padding:16px;border-radius:8px;"+
      "overflow:auto;font-size:12px;max-height:60vh;}"+
      "</style></head><body>"+
      "<h2>🌐 网络监控导出报告</h2>"+
      "<p style='color:#888'>时间："+ts+
      " | 共 "+filtered.length+" 条请求</p>"+
      "<button onclick='dl(\"json\")'>下载 JSON</button>"+
      "<button onclick='dl(\"har\")'>下载 HAR</button>"+
      "<button onclick='copyJ()'>复制 JSON</button>"+
      "<h2 style='margin-top:20px'>预览（前5条）</h2>"+
      "<pre id='preview'>"+
      JSON.stringify(filtered.slice(0,5).map(r=>({
        method:r.method,url:r.url,
        status:r.status,duration:r.duration
      })),null,2)
        .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      +"</pre>"+
      "<script>"+
      "const json="+JSON.stringify(jsonData)+";"+
      "const har="+JSON.stringify(JSON.stringify(har,null,2))+";"+
      "function dl(type){"+
      "  const b=new Blob([type==='json'?json:har],"+
      "    {type:'application/json'});"+
      "  const a=document.createElement('a');"+
      "  a.href=URL.createObjectURL(b);"+
      "  a.download='network_"+ts+".'+(type==='json'?'json':'har');"+
      "  a.click();"+
      "}"+
      "function copyJ(){navigator.clipboard.writeText(json)"+
      "  .then(()=>alert('已复制'))"+
      "  .catch(()=>{"+
      "    const t=document.createElement('textarea');"+
      "    t.value=json;document.body.appendChild(t);"+
      "    t.select();document.execCommand('copy');t.remove();"+
      "    alert('已复制');"+
      "  });"+
      "}"+
      "<\/script></body></html>";
    w.document.open();w.document.write(html);w.document.close();
    showToast("导出页面已打开");
  } else {
    showToast("弹窗被拦截，尝试直接下载");
    const b=new Blob([jsonData],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(b);
    a.download="network_"+ts+".json";
    a.click();
  }
}

// ════════════════════════════════════════════════
// 阻止面板内事件影响页面
// ════════════════════════════════════════════════
panel.addEventListener("click",e=>e.stopPropagation());
panel.addEventListener("touchend",e=>e.stopPropagation());

// ════════════════════════════════════════════════
// 清理
// ════════════════════════════════════════════════
function cleanup(){
  restoreHooks();
  style.remove();
  document.removeEventListener("mousemove",arguments.callee);
  document.removeEventListener("mouseup",arguments.callee);
}

// 初始化渲染
renderList();
updateStats();
renderDetail(null);
detailActions.style.display="none";

showToast("🌐 网络监控已启动，开始录制…");

})();
