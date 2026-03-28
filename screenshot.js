(function(){

const TOOL_ID="sc_tool_987";
const old=document.getElementById(TOOL_ID);
if(old){old.remove();return;}

// ── 加载 html2canvas ──────────────────────────
function loadH2C(cb){
  if(window.html2canvas){cb();return;}
  const s=document.createElement("script");
  s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  s.onload=cb;
  s.onerror=()=>showErr("html2canvas 加载失败，请检查网络");
  document.head.appendChild(s);
}

// ── 错误提示 ──────────────────────────────────
function showErr(msg){
  const d=document.createElement("div");
  d.style.cssText=
    "position:fixed;top:20px;left:50%;transform:translateX(-50%);"+
    "background:#e53935;color:#fff;padding:12px 24px;border-radius:8px;"+
    "z-index:2147483648;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.3);";
  d.textContent="✘ "+msg;
  document.body.appendChild(d);
  setTimeout(()=>d.remove(),4000);
}

// ── 主体初始化 ────────────────────────────────
loadH2C(initTool);

function initTool(){

  const dpr=window.devicePixelRatio||1;

  // 禁止页面滚动
  const prevOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";

  // ── 根容器 ──────────────────────────────────
  const root=document.createElement("div");
  root.id=TOOL_ID;
  root.style.cssText=
    "position:fixed;top:0;left:0;width:100%;height:100%;"+
    "z-index:2147483647;touch-action:none;";

  // ── 四块蒙层 ────────────────────────────────
  const mkMask=()=>{
    const d=document.createElement("div");
    d.style.cssText=
      "position:absolute;background:rgba(0,0,0,.45);";
    return d;
  };
  const mTop=mkMask();
  const mBot=mkMask();
  const mLft=mkMask();
  const mRgt=mkMask();

  // ── 选区边框 ────────────────────────────────
  const sel=document.createElement("div");
  sel.style.cssText=
    "position:absolute;border:2px solid #fff;"+
    "box-shadow:0 0 0 1px rgba(0,0,0,.5);box-sizing:border-box;";

  // ── 尺寸提示 ────────────────────────────────
  const sizeTip=document.createElement("div");
  sizeTip.style.cssText=
    "position:absolute;background:rgba(0,0,0,.65);color:#fff;"+
    "font-size:12px;padding:2px 8px;border-radius:4px;"+
    "pointer-events:none;white-space:nowrap;";

  // ── 工具栏 ──────────────────────────────────
  const bar=document.createElement("div");
  bar.style.cssText=
    "position:fixed;bottom:0;left:0;width:100%;"+
    "background:rgba(30,30,30,.92);color:#fff;"+
    "display:flex;align-items:center;justify-content:space-between;"+
    "padding:10px 16px;box-sizing:border-box;z-index:2147483648;"+
    "font-size:14px;";

  const barInfo=document.createElement("span");
  barInfo.style.cssText="color:#ccc;font-size:13px;";

  const barBtns=document.createElement("div");
  barBtns.style.cssText="display:flex;gap:10px;";

  const mkBarBtn=(t,bg,fn)=>{
    const b=document.createElement("button");
    b.textContent=t;
    b.style.cssText=
      "padding:8px 20px;background:"+bg+";color:#fff;border:none;"+
      "border-radius:6px;font-size:14px;cursor:pointer;";
    b.onclick=fn;
    return b;
  };

  const cancelBtn=mkBarBtn("取消","#666",cleanup);
  const shotBtn=mkBarBtn("截图保存","#0078ff",doCapture);

  barBtns.appendChild(cancelBtn);
  barBtns.appendChild(shotBtn);
  bar.appendChild(barInfo);
  bar.appendChild(barBtns);

  // ── 8个手柄 ─────────────────────────────────
  // 方向：n/s/e/w/nw/ne/sw/se
  const HANDLES=["n","s","e","w","nw","ne","sw","se"];
  const handleEls={};

  HANDLES.forEach(dir=>{
    const h=document.createElement("div");
    // 视觉点12px，触控热区44px
    h.style.cssText=
      "position:absolute;width:44px;height:44px;"+
      "display:flex;align-items:center;justify-content:center;"+
      "cursor:"+getCursor(dir)+";z-index:10;touch-action:none;";
    const dot=document.createElement("div");
    dot.style.cssText=
      "width:12px;height:12px;background:#fff;border-radius:50%;"+
      "box-shadow:0 0 0 2px rgba(0,0,0,.5);pointer-events:none;";
    h.appendChild(dot);
    handleEls[dir]=h;
    sel.appendChild(h);
  });

  function getCursor(dir){
    const map={
      n:"ns-resize",s:"ns-resize",
      e:"ew-resize",w:"ew-resize",
      nw:"nwse-resize",se:"nwse-resize",
      ne:"nesw-resize",sw:"nesw-resize"
    };
    return map[dir]||"move";
  }

  // ── 选区状态 ────────────────────────────────
  const vw=window.innerWidth;
  const vh=window.innerHeight-60; // 留出工具栏高度

  // 默认选区：居中，占60%宽高
  let rx=Math.round(vw*0.2);
  let ry=Math.round(vh*0.2);
  let rw=Math.round(vw*0.6);
  let rh=Math.round(vh*0.6);

  const MIN_SIZE=40;

  function clampRect(){
    rw=Math.max(MIN_SIZE,rw);
    rh=Math.max(MIN_SIZE,rh);
    rx=Math.max(0,Math.min(rx,vw-rw));
    ry=Math.max(0,Math.min(ry,vh-rh));
  }

  // ── 渲染选区和蒙层 ───────────────────────────
  function render(){
    clampRect();

    // 选区
    sel.style.left=rx+"px";
    sel.style.top=ry+"px";
    sel.style.width=rw+"px";
    sel.style.height=rh+"px";

    // 四块蒙层
    mTop.style.cssText+="left:0;top:0;width:100%;height:"+ry+"px;";
    mBot.style.cssText+="left:0;top:"+(ry+rh)+"px;width:100%;height:"+(vh-ry-rh+60)+"px;";
    mLft.style.cssText+="left:0;top:"+ry+"px;width:"+rx+"px;height:"+rh+"px;";
    mRgt.style.cssText+="left:"+(rx+rw)+"px;top:"+ry+"px;width:"+(vw-rx-rw)+"px;height:"+rh+"px;";

    // 手柄位置（相对sel）
    const hx={w:-22,e:rw-22,n:rw/2-22,s:rw/2-22,nw:-22,ne:rw-22,sw:-22,se:rw-22};
    const hy={n:-22,s:rh-22,w:rh/2-22,e:rh/2-22,nw:-22,ne:-22,sw:rh-22,se:rh-22};
    HANDLES.forEach(dir=>{
      handleEls[dir].style.left=hx[dir]+"px";
      handleEls[dir].style.top=hy[dir]+"px";
    });

    // 尺寸提示
    sizeTip.textContent=rw+" × "+rh+" px";
    let tipX=rx;
    let tipY=ry-24;
    if(tipY<0) tipY=ry+4;
    sizeTip.style.left=tipX+"px";
    sizeTip.style.top=tipY+"px";

    barInfo.textContent="选区: "+rw+" × "+rh+" px  |  位置: ("+rx+", "+ry+")";
  }

  // ── 拖动逻辑 ────────────────────────────────
  let activeDir=null;
  let startX=0,startY=0;
  let startRx=0,startRy=0,startRw=0,startRh=0;

  function onDragStart(dir,cx,cy){
    activeDir=dir;
    startX=cx;startY=cy;
    startRx=rx;startRy=ry;startRw=rw;startRh=rh;
  }

  function onDragMove(cx,cy){
    if(!activeDir)return;
    const ddx=cx-startX;
    const ddy=cy-startY;

    if(activeDir==="move"){
      rx=startRx+ddx;
      ry=startRy+ddy;
    } else {
      // 北边
      if(activeDir.includes("n")){
        ry=startRy+ddy;
        rh=startRh-ddy;
      }
      // 南边
      if(activeDir.includes("s")){
        rh=startRh+ddy;
      }
      // 西边
      if(activeDir.includes("w")){
        rx=startRx+ddx;
        rw=startRw-ddx;
      }
      // 东边
      if(activeDir.includes("e")){
        rw=startRw+ddx;
      }
    }
    render();
  }

  function onDragEnd(){activeDir=null;}

  // 选区整体拖动
  sel.addEventListener("mousedown",e=>{
    if(e.target===sel){
      onDragStart("move",e.clientX,e.clientY);
      e.preventDefault();
    }
  });
  sel.addEventListener("touchstart",e=>{
    if(e.target===sel){
      onDragStart("move",e.touches[0].clientX,e.touches[0].clientY);
      e.preventDefault();
    }
  },{passive:false});

  // 手柄拖动
  HANDLES.forEach(dir=>{
    handleEls[dir].addEventListener("mousedown",e=>{
      onDragStart(dir,e.clientX,e.clientY);
      e.stopPropagation();e.preventDefault();
    });
    handleEls[dir].addEventListener("touchstart",e=>{
      onDragStart(dir,e.touches[0].clientX,e.touches[0].clientY);
      e.stopPropagation();e.preventDefault();
    },{passive:false});
  });

  document.addEventListener("mousemove",e=>onDragMove(e.clientX,e.clientY));
  document.addEventListener("mouseup",()=>onDragEnd());
  document.addEventListener("touchmove",e=>{
    if(activeDir){
      onDragMove(e.touches[0].clientX,e.touches[0].clientY);
      e.preventDefault();
    }
  },{passive:false});
  document.addEventListener("touchend",()=>onDragEnd());

  // ── 组装 DOM ────────────────────────────────
  [mTop,mBot,mLft,mRgt,sel,sizeTip].forEach(e=>root.appendChild(e));
  document.body.appendChild(root);
  document.body.appendChild(bar);

  render();

  // ── 截图执行 ────────────────────────────────
  function doCapture(){
    shotBtn.textContent="处理中...";
    shotBtn.disabled=true;

    // 隐藏工具UI再截图
    root.style.display="none";
    bar.style.display="none";

    setTimeout(()=>{
      html2canvas(document.body,{
        x:rx,
        y:ry+window.scrollY,
        width:rw,
        height:rh,
        scale:dpr,
        useCORS:true,
        allowTaint:true,
        logging:false
      }).then(canvas=>{
        // 导出图片
        const ts=(()=>{
          const d=new Date();
          const p=n=>String(n).padStart(2,"0");
          return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+
            "_"+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
        })();
        const a=document.createElement("a");
        a.download="screenshot_"+ts+".png";
        a.href=canvas.toDataURL("image/png");
        a.click();
        cleanup();
      }).catch(err=>{
        root.style.display="";
        bar.style.display="";
        shotBtn.textContent="截图保存";
        shotBtn.disabled=false;
        showErr("截图失败："+err.message);
      });
    },200);
  }

  // ── 清理 ────────────────────────────────────
  function cleanup(){
    document.body.style.overflow=prevOverflow;
    root.remove();
    bar.remove();
    // 移除事件（document级别）
    document.removeEventListener("mousemove",onDragMove);
    document.removeEventListener("mouseup",onDragEnd);
    document.removeEventListener("touchend",onDragEnd);
  }

}

})();
