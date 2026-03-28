// screenshot.js v1.1 — 选区截图工具（进度提示+性能优化）
(function(){

const TOOL_ID="sc_tool_987";
const old=document.getElementById(TOOL_ID);
if(old){old.remove();return;}

function loadH2C(cb){
  if(window.html2canvas){cb();return;}
  const s=document.createElement("script");
  s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  s.onload=cb;
  s.onerror=()=>showErr("html2canvas 加载失败，请检查网络");
  document.head.appendChild(s);
}

function showErr(msg){
  const d=document.createElement("div");
  d.style.cssText=
    "position:fixed;top:20px;left:50%;transform:translateX(-50%);"+
    "background:#e53935;color:#fff;padding:12px 24px;border-radius:8px;"+
    "z-index:2147483649;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.3);";
  d.textContent="✘ "+msg;
  document.body.appendChild(d);
  setTimeout(()=>d.remove(),4000);
}

loadH2C(initTool);

function initTool(){

  const dpr=Math.min(window.devicePixelRatio||1, 2);
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
    d.style.cssText="position:absolute;background:rgba(0,0,0,.45);";
    return d;
  };
  const mTop=mkMask();
  const mBot=mkMask();
  const mLft=mkMask();
  const mRgt=mkMask();

  // ── 选区边框 ────────────────────────────────
  const sel=document.createElement("div");
  sel.style.cssText=
    "position:absolute;border:2px solid #fff;cursor:move;"+
    "box-shadow:0 0 0 1px rgba(0,0,0,.5);box-sizing:border-box;";

  // ── 尺寸提示 ────────────────────────────────
  const sizeTip=document.createElement("div");
  sizeTip.style.cssText=
    "position:absolute;background:rgba(0,0,0,.65);color:#fff;"+
    "font-size:12px;padding:2px 8px;border-radius:4px;"+
    "pointer-events:none;white-space:nowrap;";

  // ── 进度遮罩 ────────────────────────────────
  const progressWrap=document.createElement("div");
  progressWrap.style.cssText=
    "position:fixed;top:0;left:0;width:100%;height:100%;"+
    "background:rgba(0,0,0,.6);z-index:2147483649;"+
    "display:none;flex-direction:column;"+
    "align-items:center;justify-content:center;";

  const progressBox=document.createElement("div");
  progressBox.style.cssText=
    "background:#fff;border-radius:12px;padding:28px 40px;"+
    "text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.3);min-width:220px;";

  const progressIcon=document.createElement("div");
  progressIcon.style.cssText=
    "font-size:36px;margin-bottom:12px;";
  progressIcon.textContent="📷";

  const progressText=document.createElement("div");
  progressText.style.cssText=
    "font-size:15px;color:#333;margin-bottom:16px;font-weight:bold;";
  progressText.textContent="正在截图...";

  const progressBarWrap=document.createElement("div");
  progressBarWrap.style.cssText=
    "width:100%;height:6px;background:#eee;border-radius:3px;overflow:hidden;";

  const progressBar=document.createElement("div");
  progressBar.style.cssText=
    "height:100%;width:0%;background:#0078ff;"+
    "border-radius:3px;transition:width .3s;";

  const progressSub=document.createElement("div");
  progressSub.style.cssText=
    "font-size:12px;color:#888;margin-top:10px;";
  progressSub.textContent="页面越复杂耗时越长，请耐心等待";

  progressBarWrap.appendChild(progressBar);
  progressBox.appendChild(progressIcon);
  progressBox.appendChild(progressText);
  progressBox.appendChild(progressBarWrap);
  progressBox.appendChild(progressSub);
  progressWrap.appendChild(progressBox);

  // 模拟进度动画
  let progressTimer=null;
  let currentProgress=0;
  function startProgress(){
    progressWrap.style.display="flex";
    currentProgress=0;
    progressBar.style.width="0%";
    progressText.textContent="正在截图...";
    // 模拟进度：前90%用动画填充，最后10%等真实完成
    progressTimer=setInterval(()=>{
      if(currentProgress<90){
        currentProgress+=Math.random()*8;
        currentProgress=Math.min(currentProgress,90);
        progressBar.style.width=currentProgress+"%";
        if(currentProgress<30) progressText.textContent="正在分析页面...";
        else if(currentProgress<60) progressText.textContent="正在渲染元素...";
        else progressText.textContent="即将完成...";
      }
    },400);
  }
  function finishProgress(){
    clearInterval(progressTimer);
    currentProgress=100;
    progressBar.style.width="100%";
    progressText.textContent="截图完成！";
    setTimeout(()=>{
      progressWrap.style.display="none";
    },600);
  }

  // ── 工具栏 ──────────────────────────────────
  const bar=document.createElement("div");
  bar.style.cssText=
    "position:fixed;bottom:0;left:0;width:100%;"+
    "background:rgba(30,30,30,.92);color:#fff;"+
    "display:flex;align-items:center;justify-content:space-between;"+
    "padding:10px 16px;box-sizing:border-box;z-index:2147483648;"+
    "font-size:14px;";

  const barInfo=document.createElement("span");
  barInfo.style.cssText="color:#ccc;font-size:12px;";

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
  const shotBtn=mkBarBtn("📷 截图保存","#0078ff",doCapture);

  barBtns.appendChild(cancelBtn);
  barBtns.appendChild(shotBtn);
  bar.appendChild(barInfo);
  bar.appendChild(barBtns);

  // ── 8个手柄 ─────────────────────────────────
  const HANDLES=["n","s","e","w","nw","ne","sw","se"];
  const handleEls={};
  function getCursor(dir){
    return {
      n:"ns-resize",s:"ns-resize",
      e:"ew-resize",w:"ew-resize",
      nw:"nwse-resize",se:"nwse-resize",
      ne:"nesw-resize",sw:"nesw-resize"
    }[dir]||"move";
  }

  HANDLES.forEach(dir=>{
    const h=document.createElement("div");
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

  // ── 选区状态 ────────────────────────────────
  const vw=window.innerWidth;
  const vh=window.innerHeight-60;
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

  // ── 渲染 ────────────────────────────────────
  function render(){
    clampRect();
    sel.style.left=rx+"px";
    sel.style.top=ry+"px";
    sel.style.width=rw+"px";
    sel.style.height=rh+"px";

    mTop.style.cssText="position:absolute;background:rgba(0,0,0,.45);"+
      "left:0;top:0;width:100%;height:"+ry+"px;";
    mBot.style.cssText="position:absolute;background:rgba(0,0,0,.45);"+
      "left:0;top:"+(ry+rh)+"px;width:100%;height:"+(vh-ry-rh+60)+"px;";
    mLft.style.cssText="position:absolute;background:rgba(0,0,0,.45);"+
      "left:0;top:"+ry+"px;width:"+rx+"px;height:"+rh+"px;";
    mRgt.style.cssText="position:absolute;background:rgba(0,0,0,.45);"+
      "left:"+(rx+rw)+"px;top:"+ry+"px;width:"+(vw-rx-rw)+"px;height:"+rh+"px;";

    const hx={w:-22,e:rw-22,n:rw/2-22,s:rw/2-22,nw:-22,ne:rw-22,sw:-22,se:rw-22};
    const hy={n:-22,s:rh-22,w:rh/2-22,e:rh/2-22,nw:-22,ne:-22,sw:rh-22,se:rh-22};
    HANDLES.forEach(dir=>{
      handleEls[dir].style.left=hx[dir]+"px";
      handleEls[dir].style.top=hy[dir]+"px";
    });

    sizeTip.textContent=rw+" × "+rh+" px";
    let tipY=ry-24;
    if(tipY<0) tipY=ry+4;
    sizeTip.style.left=rx+"px";
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
    const ddx=cx-startX,ddy=cy-startY;
    if(activeDir==="move"){rx=startRx+ddx;ry=startRy+ddy;}
    else{
      if(activeDir.includes("n")){ry=startRy+ddy;rh=startRh-ddy;}
      if(activeDir.includes("s")){rh=startRh+ddy;}
      if(activeDir.includes("w")){rx=startRx+ddx;rw=startRw-ddx;}
      if(activeDir.includes("e")){rw=startRw+ddx;}
    }
    render();
  }
  function onDragEnd(){activeDir=null;}

  sel.addEventListener("mousedown",e=>{
    if(e.target===sel||e.target===sel.firstChild){
      onDragStart("move",e.clientX,e.clientY);e.preventDefault();
    }
  });
  sel.addEventListener("touchstart",e=>{
    if(e.target===sel||e.target===sel.firstChild){
      onDragStart("move",e.touches[0].clientX,e.touches[0].clientY);
      e.preventDefault();
    }
  },{passive:false});

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

  document.addEventListener("mousemove",onMove);
  document.addEventListener("mouseup",onUp);
  document.addEventListener("touchmove",onTMove,{passive:false});
  document.addEventListener("touchend",onUp);

  function onMove(e){onDragMove(e.clientX,e.clientY);}
  function onTMove(e){
    if(activeDir){onDragMove(e.touches[0].clientX,e.touches[0].clientY);e.preventDefault();}
  }
  function onUp(){onDragEnd();}

  // ── 组装 DOM ────────────────────────────────
  [mTop,mBot,mLft,mRgt,sel,sizeTip].forEach(e=>root.appendChild(e));
  document.body.appendChild(root);
  document.body.appendChild(bar);
  document.body.appendChild(progressWrap);
  render();

  // ── 截图执行 ────────────────────────────────
  function doCapture(){
    shotBtn.disabled=true;
    root.style.display="none";
    bar.style.display="none";

    // 稍等UI隐藏后再启动进度和截图
    setTimeout(()=>{
      startProgress();
      setTimeout(()=>{
        html2canvas(document.body,{
          x:rx,
          y:ry+window.scrollY,
          width:rw,
          height:rh,
          scale:dpr,
          useCORS:true,
          allowTaint:false,
          logging:false,
          imageTimeout:8000
        }).then(canvas=>{
          finishProgress();
          const d=new Date();
          const p=n=>String(n).padStart(2,"0");
          const ts=d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+
            "_"+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
          const a=document.createElement("a");
          a.download="screenshot_"+ts+".png";
          a.href=canvas.toDataURL("image/png");
          setTimeout(()=>{a.click();cleanup();},700);
        }).catch(err=>{
          clearInterval(progressTimer);
          progressWrap.style.display="none";
          root.style.display="";
          bar.style.display="";
          shotBtn.disabled=false;
          showErr("截图失败："+err.message);
        });
      },100);
    },200);
  }

  // ── 清理 ────────────────────────────────────
  function cleanup(){
    document.body.style.overflow=prevOverflow;
    document.removeEventListener("mousemove",onMove);
    document.removeEventListener("mouseup",onUp);
    document.removeEventListener("touchmove",onTMove);
    document.removeEventListener("touchend",onUp);
    root.remove();
    bar.remove();
    progressWrap.remove();
  }

}

})();
