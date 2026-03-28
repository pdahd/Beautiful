// screenshot.js v2.1 — 内直角手柄+预览修复+边界反馈
(function(){

const TOOL_ID="sc_tool_987";
const old=document.getElementById(TOOL_ID);
if(old){old.remove();return;}

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

function getTimestamp(){
  const d=new Date();
  const p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+
    "_"+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
}

function mkBtn(t,bg,fn){
  const b=document.createElement("button");
  b.textContent=t;
  b.style.cssText=
    "padding:10px 20px;background:"+bg+";color:#fff;border:none;"+
    "border-radius:8px;font-size:14px;cursor:pointer;"+
    "box-shadow:0 2px 6px rgba(0,0,0,.2);";
  b.onclick=fn;
  return b;
}

// ── 主入口面板 ────────────────────────────────
function showHome(){
  const wrap=document.createElement("div");
  wrap.id=TOOL_ID;
  wrap.style.cssText=
    "position:fixed;top:0;left:0;width:100%;height:100%;"+
    "background:rgba(0,0,0,.55);z-index:2147483647;"+
    "display:flex;align-items:center;justify-content:center;";

  const panel=document.createElement("div");
  panel.style.cssText=
    "background:#fff;border-radius:16px;padding:28px 24px;"+
    "box-shadow:0 8px 32px rgba(0,0,0,.3);min-width:300px;"+
    "display:flex;flex-direction:column;align-items:center;gap:16px;";

  const ttl=document.createElement("div");
  ttl.textContent="📷 截图 & 裁剪工具";
  ttl.style.cssText=
    "font-size:18px;font-weight:bold;color:#333;margin-bottom:4px;";

  const row=document.createElement("div");
  row.style.cssText="display:flex;gap:14px;width:100%;";

  function mkCard(icon,label,fn){
    const c=document.createElement("button");
    c.style.cssText=
      "flex:1;padding:20px 8px;background:#f5f7ff;border:2px solid #c5cae9;"+
      "border-radius:12px;cursor:pointer;display:flex;flex-direction:column;"+
      "align-items:center;gap:10px;font-size:13px;color:#333;"+
      "box-shadow:0 2px 8px rgba(0,0,0,.08);";
    const ic=document.createElement("div");
    ic.style.cssText="font-size:36px;";
    ic.textContent=icon;
    const lb=document.createElement("div");
    lb.style.cssText="font-weight:bold;";
    lb.textContent=label;
    c.appendChild(ic);c.appendChild(lb);
    c.onclick=fn;
    return c;
  }

  const webCard=mkCard("🌐","网页截图",()=>{
    wrap.remove();loadH2C(initWebshot);
  });
  const cropCard=mkCard("🖼","本地裁剪",()=>{
    wrap.remove();initCropper();
  });
  row.appendChild(webCard);row.appendChild(cropCard);

  const closeB=mkBtn("关闭","#888",()=>wrap.remove());
  closeB.style.width="100%";

  panel.appendChild(ttl);panel.appendChild(row);panel.appendChild(closeB);
  wrap.appendChild(panel);
  document.body.appendChild(wrap);
}

// ── 加载 html2canvas ──────────────────────────
function loadH2C(cb){
  if(window.html2canvas){cb();return;}
  const s=document.createElement("script");
  s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  s.onload=cb;
  s.onerror=()=>showErr("html2canvas 加载失败，请检查网络");
  document.head.appendChild(s);
}

// ── 共用：构建内直角L形手柄 ──────────────────
// 返回8个手柄元素，挂到容器上
// sz=手柄臂长, th=手柄粗细
function buildHandles(container,color){
  color=color||"#fff";
  const sz=18,th=3;
  const HANDLES=["nw","ne","sw","se","n","s","e","w"];
  const els={};

  HANDLES.forEach(dir=>{
    const wrap=document.createElement("div");
    wrap.style.cssText=
      "position:absolute;width:44px;height:44px;"+
      "display:flex;align-items:center;justify-content:center;"+
      "z-index:10;touch-action:none;cursor:"+getCursor(dir)+";";

    // L形由两个div拼成
    const a=document.createElement("div");
    const b=document.createElement("div");
    a.style.cssText="position:absolute;background:"+color+";"+
      "box-shadow:0 0 2px rgba(0,0,0,.5);border-radius:1px;";
    b.style.cssText="position:absolute;background:"+color+";"+
      "box-shadow:0 0 2px rgba(0,0,0,.5);border-radius:1px;";

    // 根据方向设置L形朝向
    if(dir==="nw"){
      // 左上：向右横臂 + 向下竖臂
      a.style.cssText+=`width:${sz}px;height:${th}px;left:${22-sz/2}px;top:${22-sz/2}px;`;
      b.style.cssText+=`width:${th}px;height:${sz}px;left:${22-sz/2}px;top:${22-sz/2}px;`;
    } else if(dir==="ne"){
      // 右上：向左横臂 + 向下竖臂
      a.style.cssText+=`width:${sz}px;height:${th}px;right:${22-sz/2}px;top:${22-sz/2}px;`;
      b.style.cssText+=`width:${th}px;height:${sz}px;right:${22-sz/2}px;top:${22-sz/2}px;`;
    } else if(dir==="sw"){
      // 左下：向右横臂 + 向上竖臂
      a.style.cssText+=`width:${sz}px;height:${th}px;left:${22-sz/2}px;bottom:${22-sz/2}px;`;
      b.style.cssText+=`width:${th}px;height:${sz}px;left:${22-sz/2}px;bottom:${22-sz/2}px;`;
    } else if(dir==="se"){
      // 右下：向左横臂 + 向上竖臂
      a.style.cssText+=`width:${sz}px;height:${th}px;right:${22-sz/2}px;bottom:${22-sz/2}px;`;
      b.style.cssText+=`width:${th}px;height:${sz}px;right:${22-sz/2}px;bottom:${22-sz/2}px;`;
    } else if(dir==="n"){
      // 上边中点：水平短线
      a.style.cssText+=`width:${sz}px;height:${th}px;left:${22-sz/2}px;top:${22-th/2}px;`;
      b.style.cssText+="display:none;";
    } else if(dir==="s"){
      a.style.cssText+=`width:${sz}px;height:${th}px;left:${22-sz/2}px;bottom:${22-th/2}px;`;
      b.style.cssText+="display:none;";
    } else if(dir==="w"){
      a.style.cssText+=`width:${th}px;height:${sz}px;left:${22-th/2}px;top:${22-sz/2}px;`;
      b.style.cssText+="display:none;";
    } else if(dir==="e"){
      a.style.cssText+=`width:${th}px;height:${sz}px;right:${22-th/2}px;top:${22-sz/2}px;`;
      b.style.cssText+="display:none;";
    }

    wrap.appendChild(a);wrap.appendChild(b);
    container.appendChild(wrap);
    els[dir]=wrap;
  });
  return els;
}

function getCursor(dir){
  return {
    n:"ns-resize",s:"ns-resize",
    e:"ew-resize",w:"ew-resize",
    nw:"nwse-resize",se:"nwse-resize",
    ne:"nesw-resize",sw:"nesw-resize"
  }[dir]||"move";
}

// ── 共用：构建4条独立边框线 ───────────────────
function buildBorderLines(container){
  const lines={};
  ["top","bottom","left","right"].forEach(side=>{
    const l=document.createElement("div");
    l.style.cssText="position:absolute;background:#fff;pointer-events:none;z-index:5;";
    container.appendChild(l);
    lines[side]=l;
  });
  return lines;
}

function updateBorderLines(lines,rx,ry,rw,rh,dispW,dispH){
  const SNAP=6; // 吸附距离px
  const colors={top:"#fff",bottom:"#fff",left:"#fff",right:"#fff"};

  // 检查各边
  const edges={
    top:ry,
    bottom:ry+rh,
    left:rx,
    right:rx+rw
  };

  // 吸附并着色
  function edgeColor(val,limit){
    if(Math.abs(val-limit)<=SNAP) return "#4caf50"; // 绿色：贴边
    if(val<0||val>limit) return "#f44336";           // 红色：溢出
    return "#fff";
  }

  colors.top=edgeColor(edges.top,0);
  colors.bottom=edgeColor(edges.bottom,dispH);
  colors.left=edgeColor(edges.left,0);
  colors.right=edgeColor(edges.right,dispW);

  // 上边：top=ry, 左=rx, 宽=rw, 高=2px
  lines.top.style.cssText=
    "position:absolute;pointer-events:none;z-index:5;"+
    "left:"+rx+"px;top:"+ry+"px;width:"+rw+"px;height:2px;"+
    "background:"+colors.top+";";
  // 下边
  lines.bottom.style.cssText=
    "position:absolute;pointer-events:none;z-index:5;"+
    "left:"+rx+"px;top:"+(ry+rh-2)+"px;width:"+rw+"px;height:2px;"+
    "background:"+colors.bottom+";";
  // 左边
  lines.left.style.cssText=
    "position:absolute;pointer-events:none;z-index:5;"+
    "left:"+rx+"px;top:"+ry+"px;width:2px;height:"+rh+"px;"+
    "background:"+colors.left+";";
  // 右边
  lines.right.style.cssText=
    "position:absolute;pointer-events:none;z-index:5;"+
    "left:"+(rx+rw-2)+"px;top:"+ry+"px;width:2px;height:"+rh+"px;"+
    "background:"+colors.right+";";
}

// ════════════════════════════════════════════════
// 功能A：网页截图
// ════════════════════════════════════════════════
function initWebshot(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const prevOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";

  const root=document.createElement("div");
  root.id=TOOL_ID;
  root.style.cssText=
    "position:fixed;top:0;left:0;width:100%;height:100%;"+
    "z-index:2147483647;touch-action:none;";

  const mkMask=()=>{
    const d=document.createElement("div");
    d.style.cssText="position:absolute;background:rgba(0,0,0,.45);";
    return d;
  };
  const mTop=mkMask(),mBot=mkMask(),mLft=mkMask(),mRgt=mkMask();

  // 选区容器（用于挂手柄和边框线）
  const sel=document.createElement("div");
  sel.style.cssText=
    "position:absolute;cursor:move;box-sizing:border-box;";

  const borderLines=buildBorderLines(sel);
  const handleEls=buildHandles(sel,"#fff");

  const sizeTip=document.createElement("div");
  sizeTip.style.cssText=
    "position:absolute;background:rgba(0,0,0,.65);color:#fff;"+
    "font-size:12px;padding:2px 8px;border-radius:4px;"+
    "pointer-events:none;white-space:nowrap;";

  // 进度弹窗
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
  progressIcon.style.cssText="font-size:36px;margin-bottom:12px;";
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
  progressSub.style.cssText="font-size:12px;color:#888;margin-top:10px;";
  progressSub.textContent="页面越复杂耗时越长，请耐心等待";
  progressBarWrap.appendChild(progressBar);
  progressBox.appendChild(progressIcon);
  progressBox.appendChild(progressText);
  progressBox.appendChild(progressBarWrap);
  progressBox.appendChild(progressSub);
  progressWrap.appendChild(progressBox);

  let progressTimer=null,currentProgress=0;
  function startProgress(){
    progressWrap.style.display="flex";
    currentProgress=0;progressBar.style.width="0%";
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
  function finishProgress(cb){
    clearInterval(progressTimer);
    progressBar.style.width="100%";
    progressText.textContent="截图完成！";
    setTimeout(()=>{progressWrap.style.display="none";cb();},600);
  }

  // 工具栏
  const bar=document.createElement("div");
  bar.style.cssText=
    "position:fixed;bottom:0;left:0;width:100%;"+
    "background:rgba(30,30,30,.92);color:#fff;"+
    "display:flex;align-items:center;justify-content:space-between;"+
    "padding:10px 16px;box-sizing:border-box;z-index:2147483648;";
  const barInfo=document.createElement("span");
  barInfo.style.cssText="color:#ccc;font-size:12px;";
  const barBtns=document.createElement("div");
  barBtns.style.cssText="display:flex;gap:10px;";

  function mkBarBtn(t,bg,fn){
    const b=document.createElement("button");
    b.textContent=t;
    b.style.cssText=
      "padding:8px 16px;background:"+bg+";color:#fff;border:none;"+
      "border-radius:6px;font-size:14px;cursor:pointer;";
    b.onclick=fn;return b;
  }
  const backBtn=mkBarBtn("← 返回","#555",()=>{cleanup();showHome();});
  const shotBtn=mkBarBtn("📷 截图保存","#0078ff",doCapture);
  barBtns.appendChild(backBtn);barBtns.appendChild(shotBtn);
  bar.appendChild(barInfo);bar.appendChild(barBtns);

  const vw=window.innerWidth;
  const vh=window.innerHeight-60;
  let rx=Math.round(vw*0.2),ry=Math.round(vh*0.2);
  let rw=Math.round(vw*0.6),rh=Math.round(vh*0.6);
  const MIN_SIZE=40;

  function clampRect(){
    rw=Math.max(MIN_SIZE,rw);rh=Math.max(MIN_SIZE,rh);
    rx=Math.max(0,Math.min(rx,vw-rw));
    ry=Math.max(0,Math.min(ry,vh-rh));
  }

  function render(){
    clampRect();
    sel.style.left=rx+"px";sel.style.top=ry+"px";
    sel.style.width=rw+"px";sel.style.height=rh+"px";

    mTop.style.cssText="position:absolute;background:rgba(0,0,0,.45);"+
      "left:0;top:0;width:100%;height:"+ry+"px;";
    mBot.style.cssText="position:absolute;background:rgba(0,0,0,.45);"+
      "left:0;top:"+(ry+rh)+"px;width:100%;height:"+(vh-ry-rh+60)+"px;";
    mLft.style.cssText="position:absolute;background:rgba(0,0,0,.45);"+
      "left:0;top:"+ry+"px;width:"+rx+"px;height:"+rh+"px;";
    mRgt.style.cssText="position:absolute;background:rgba(0,0,0,.45);"+
      "left:"+(rx+rw)+"px;top:"+ry+"px;"+
      "width:"+(vw-rx-rw)+"px;height:"+rh+"px;";

    // 手柄位置
    const hx={w:-22,e:rw-22,n:rw/2-22,s:rw/2-22,nw:-22,ne:rw-22,sw:-22,se:rw-22};
    const hy={n:-22,s:rh-22,w:rh/2-22,e:rh/2-22,nw:-22,ne:-22,sw:rh-22,se:rh-22};
    Object.keys(handleEls).forEach(dir=>{
      handleEls[dir].style.left=hx[dir]+"px";
      handleEls[dir].style.top=hy[dir]+"px";
    });

    updateBorderLines(borderLines,0,0,rw,rh,vw,vh);

    const tipY=ry-24<0?ry+4:ry-24;
    sizeTip.textContent=rw+" × "+rh+" px";
    sizeTip.style.left=rx+"px";sizeTip.style.top=tipY+"px";
    barInfo.textContent="选区: "+rw+" × "+rh+" px  |  位置: ("+rx+", "+ry+")";
  }

  let activeDir=null,startX=0,startY=0;
  let startRx=0,startRy=0,startRw=0,startRh=0;
  function onDragStart(dir,cx,cy){
    activeDir=dir;startX=cx;startY=cy;
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
    if(e.target===sel){onDragStart("move",e.clientX,e.clientY);e.preventDefault();}
  });
  sel.addEventListener("touchstart",e=>{
    if(e.target===sel){
      onDragStart("move",e.touches[0].clientX,e.touches[0].clientY);
      e.preventDefault();
    }
  },{passive:false});
  Object.keys(handleEls).forEach(dir=>{
    handleEls[dir].addEventListener("mousedown",e=>{
      onDragStart(dir,e.clientX,e.clientY);
      e.stopPropagation();e.preventDefault();
    });
    handleEls[dir].addEventListener("touchstart",e=>{
      onDragStart(dir,e.touches[0].clientX,e.touches[0].clientY);
      e.stopPropagation();e.preventDefault();
    },{passive:false});
  });

  function onMove(e){onDragMove(e.clientX,e.clientY);}
  function onTMove(e){
    if(activeDir){onDragMove(e.touches[0].clientX,e.touches[0].clientY);e.preventDefault();}
  }
  function onUp(){onDragEnd();}
  document.addEventListener("mousemove",onMove);
  document.addEventListener("mouseup",onUp);
  document.addEventListener("touchmove",onTMove,{passive:false});
  document.addEventListener("touchend",onUp);

  [mTop,mBot,mLft,mRgt,sel,sizeTip].forEach(e=>root.appendChild(e));
  document.body.appendChild(root);
  document.body.appendChild(bar);
  document.body.appendChild(progressWrap);
  render();

  function doCapture(){
    shotBtn.disabled=true;
    root.style.display="none";
    bar.style.display="none";
    progressWrap.style.display="none";
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const capturePromise=html2canvas(document.body,{
          x:rx,y:ry+window.scrollY,
          width:rw,height:rh,
          scale:dpr,useCORS:true,
          allowTaint:false,logging:false,imageTimeout:8000
        });
        startProgress();
        capturePromise.then(canvas=>{
          finishProgress(()=>{
            const a=document.createElement("a");
            a.download="screenshot_"+getTimestamp()+".png";
            a.href=canvas.toDataURL("image/png");
            a.click();cleanup();
          });
        }).catch(err=>{
          clearInterval(progressTimer);
          progressWrap.style.display="none";
          root.style.display="";bar.style.display="";
          shotBtn.disabled=false;
          showErr("截图失败："+err.message);
        });
      });
    });
  }

  function cleanup(){
    document.body.style.overflow=prevOverflow;
    document.removeEventListener("mousemove",onMove);
    document.removeEventListener("mouseup",onUp);
    document.removeEventListener("touchmove",onTMove);
    document.removeEventListener("touchend",onUp);
    root.remove();bar.remove();progressWrap.remove();
  }
}

// ════════════════════════════════════════════════
// 功能B：本地图片裁剪
// ════════════════════════════════════════════════
function initCropper(){
  const fileInput=document.createElement("input");
  fileInput.type="file";
  fileInput.accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/svg+xml";
  fileInput.style.display="none";
  document.body.appendChild(fileInput);

  fileInput.addEventListener("change",()=>{
    const file=fileInput.files[0];
    fileInput.remove();
    if(!file)return;
    if(file.size>20*1024*1024){
      if(!confirm("图片较大("+
        Math.round(file.size/1024/1024*10)/10+"MB)，是否继续？"))return;
    }

    // ── 修复预览：用FileReader转base64，不用revokeObjectURL ──
    const reader=new FileReader();
    reader.onload=e=>{
      const dataURL=e.target.result;
      const img=new Image();
      img.onload=()=>openCropUI(img,file,dataURL);
      img.onerror=()=>showErr("图片加载失败");
      img.src=dataURL;
    };
    reader.onerror=()=>showErr("文件读取失败");
    reader.readAsDataURL(file);
  });

  fileInput.click();

  function openCropUI(img,file,dataURL){
    const naturalW=img.naturalWidth;
    const naturalH=img.naturalHeight;

    if(naturalW>4000||naturalH>4000){
      showErr("图片分辨率较高("+naturalW+"×"+naturalH+")，裁剪导出可能稍慢");
    }

    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";

    const root=document.createElement("div");
    root.id=TOOL_ID;
    root.style.cssText=
      "position:fixed;top:0;left:0;width:100%;height:100%;"+
      "background:#1a1a1a;z-index:2147483647;"+
      "display:flex;flex-direction:column;touch-action:none;";

    // 标题栏
    const titleBar=document.createElement("div");
    titleBar.style.cssText=
      "background:#222;color:#fff;padding:10px 16px;"+
      "font-size:14px;font-weight:bold;flex-shrink:0;"+
      "display:flex;align-items:center;justify-content:space-between;";
    const titleText=document.createElement("span");
    titleText.textContent="🖼 本地图片裁剪";
    const imgInfo=document.createElement("span");
    imgInfo.style.cssText="font-size:12px;color:#aaa;font-weight:normal;";
    imgInfo.textContent="原图: "+naturalW+" × "+naturalH+" px";
    titleBar.appendChild(titleText);titleBar.appendChild(imgInfo);

    // 图片显示区
    const imgWrap=document.createElement("div");
    imgWrap.style.cssText=
      "flex:1;position:relative;overflow:hidden;"+
      "display:flex;align-items:center;justify-content:center;";

    const maxW=window.innerWidth;
    const maxH=window.innerHeight-120;
    const scaleRatio=Math.min(maxW/naturalW,maxH/naturalH,1);
    const dispW=Math.round(naturalW*scaleRatio);
    const dispH=Math.round(naturalH*scaleRatio);

    // 图片容器
    const imgContainer=document.createElement("div");
    imgContainer.style.cssText=
      "position:relative;width:"+dispW+"px;height:"+dispH+"px;flex-shrink:0;";

    // ── 修复预览：用dataURL作为src ──────────────
    const imgEl=document.createElement("img");
    imgEl.src=dataURL;
    imgEl.style.cssText=
      "position:absolute;top:0;left:0;"+
      "width:"+dispW+"px;height:"+dispH+"px;"+
      "display:block;user-select:none;pointer-events:none;";

    // 覆盖层
    const overlay=document.createElement("div");
    overlay.style.cssText=
      "position:absolute;top:0;left:0;width:100%;height:100%;";

    // 四块蒙层
    const mkMask=()=>{
      const d=document.createElement("div");
      d.style.cssText="position:absolute;background:rgba(0,0,0,.5);";
      return d;
    };
    const mTop=mkMask(),mBot=mkMask(),mLft=mkMask(),mRgt=mkMask();

    // 选区容器
    const sel=document.createElement("div");
    sel.style.cssText=
      "position:absolute;cursor:move;box-sizing:border-box;";

    const borderLines=buildBorderLines(sel);
    const handleEls=buildHandles(sel,"#fff");

    // 尺寸提示
    const sizeTip=document.createElement("div");
    sizeTip.style.cssText=
      "position:absolute;background:rgba(0,0,0,.7);color:#fff;"+
      "font-size:11px;padding:2px 6px;border-radius:3px;"+
      "pointer-events:none;white-space:nowrap;z-index:20;";

    // 旋转
    let rotation=0;

    // 选区状态
    let rx=Math.round(dispW*0.15),ry=Math.round(dispH*0.15);
    let rw=Math.round(dispW*0.7),rh=Math.round(dispH*0.7);
    const MIN_SIZE=20;

    function clampRect(){
      rw=Math.max(MIN_SIZE,rw);rh=Math.max(MIN_SIZE,rh);
      rx=Math.max(0,Math.min(rx,dispW-rw));
      ry=Math.max(0,Math.min(ry,dispH-rh));
    }

    function getRealCrop(){
      const sX=naturalW/dispW,sY=naturalH/dispH;
      let cx,cy,cW,cH;
      if(rotation===0){
        cx=rx*sX;cy=ry*sY;cW=rw*sX;cH=rh*sY;
      } else if(rotation===90){
        cx=(dispH-ry-rh)*sX;cy=rx*sY;cW=rh*sX;cH=rw*sY;
      } else if(rotation===180){
        cx=(dispW-rx-rw)*sX;cy=(dispH-ry-rh)*sY;cW=rw*sX;cH=rh*sY;
      } else {
        cx=ry*sX;cy=(dispW-rx-rw)*sY;cW=rh*sX;cH=rw*sY;
      }
      return {
        cx:Math.round(cx),cy:Math.round(cy),
        cW:Math.round(cW),cH:Math.round(cH)
      };
    }

    // 底部工具栏（提前声明barInfo供render使用）
    const bar=document.createElement("div");
    bar.style.cssText=
      "background:rgba(30,30,30,.95);padding:10px 12px;"+
      "display:flex;flex-direction:column;gap:8px;flex-shrink:0;";
    const barInfo=document.createElement("div");
    barInfo.style.cssText="color:#aaa;font-size:11px;text-align:center;";

    function render(){
      clampRect();
      sel.style.left=rx+"px";sel.style.top=ry+"px";
      sel.style.width=rw+"px";sel.style.height=rh+"px";

      mTop.style.cssText="position:absolute;background:rgba(0,0,0,.5);"+
        "left:0;top:0;width:100%;height:"+ry+"px;";
      mBot.style.cssText="position:absolute;background:rgba(0,0,0,.5);"+
        "left:0;top:"+(ry+rh)+"px;width:100%;height:"+(dispH-ry-rh)+"px;";
      mLft.style.cssText="position:absolute;background:rgba(0,0,0,.5);"+
        "left:0;top:"+ry+"px;width:"+rx+"px;height:"+rh+"px;";
      mRgt.style.cssText="position:absolute;background:rgba(0,0,0,.5);"+
        "left:"+(rx+rw)+"px;top:"+ry+"px;"+
        "width:"+(dispW-rx-rw)+"px;height:"+rh+"px;";

      const hx={w:-22,e:rw-22,n:rw/2-22,s:rw/2-22,
                nw:-22,ne:rw-22,sw:-22,se:rw-22};
      const hy={n:-22,s:rh-22,w:rh/2-22,e:rh/2-22,
                nw:-22,ne:-22,sw:rh-22,se:rh-22};
      Object.keys(handleEls).forEach(dir=>{
        handleEls[dir].style.left=hx[dir]+"px";
        handleEls[dir].style.top=hy[dir]+"px";
      });

      // 边界反馈（选区相对overlay坐标）
      updateBorderLines(borderLines,0,0,rw,rh,dispW,dispH);

      const rc=getRealCrop();
      const tipY=ry-20<0?ry+4:ry-20;
      sizeTip.textContent="裁剪: "+rc.cW+" × "+rc.cH+" px";
      sizeTip.style.left=rx+"px";sizeTip.style.top=tipY+"px";
      barInfo.textContent=
        "显示选区: "+rw+"×"+rh+" | 实际裁剪: "+rc.cW+"×"+rc.cH+" px";
    }

    // 拖动
    let activeDir=null,startX=0,startY=0;
    let startRx=0,startRy=0,startRw=0,startRh=0;
    function onDragStart(dir,cx,cy){
      activeDir=dir;startX=cx;startY=cy;
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
      if(e.target===sel){
        onDragStart("move",e.clientX,e.clientY);e.preventDefault();
      }
    });
    sel.addEventListener("touchstart",e=>{
      if(e.target===sel){
        onDragStart("move",e.touches[0].clientX,e.touches[0].clientY);
        e.preventDefault();
      }
    },{passive:false});
    Object.keys(handleEls).forEach(dir=>{
      handleEls[dir].addEventListener("mousedown",e=>{
        onDragStart(dir,e.clientX,e.clientY);
        e.stopPropagation();e.preventDefault();
      });
      handleEls[dir].addEventListener("touchstart",e=>{
        onDragStart(dir,e.touches[0].clientX,e.touches[0].clientY);
        e.stopPropagation();e.preventDefault();
      },{passive:false});
    });

    function onMove(e){onDragMove(e.clientX,e.clientY);}
    function onTMove(e){
      if(activeDir){
        onDragMove(e.touches[0].clientX,e.touches[0].clientY);
        e.preventDefault();
      }
    }
    function onUp(){onDragEnd();}
    document.addEventListener("mousemove",onMove);
    document.addEventListener("mouseup",onUp);
    document.addEventListener("touchmove",onTMove,{passive:false});
    document.addEventListener("touchend",onUp);

    // 按钮行
    const barBtns=document.createElement("div");
    barBtns.style.cssText="display:flex;gap:8px;";

    function mkBarBtn(t,bg,fn){
      const b=document.createElement("button");
      b.textContent=t;
      b.style.cssText=
        "flex:1;padding:9px 4px;background:"+bg+";color:#fff;border:none;"+
        "border-radius:6px;font-size:13px;cursor:pointer;";
      b.onclick=fn;return b;
    }

    const backBtn=mkBarBtn("← 返回","#555",()=>{cleanup();showHome();});
    const rotLBtn=mkBarBtn("↺ 左转","#607d8b",()=>{
      rotation=(rotation+270)%360;
      imgEl.style.transform="rotate("+rotation+"deg)";
      [rw,rh]=[rh,rw];
      rx=Math.round((dispW-rw)/2);
      ry=Math.round((dispH-rh)/2);
      render();
    });
    const rotRBtn=mkBarBtn("↻ 右转","#607d8b",()=>{
      rotation=(rotation+90)%360;
      imgEl.style.transform="rotate("+rotation+"deg)";
      [rw,rh]=[rh,rw];
      rx=Math.round((dispW-rw)/2);
      ry=Math.round((dispH-rh)/2);
      render();
    });
    const allBtn=mkBarBtn("全选","#7e57c2",()=>{
      rx=0;ry=0;rw=dispW;rh=dispH;render();
    });
    const cropBtn=mkBarBtn("✂ 裁剪保存","#0078ff",doCrop);

    [backBtn,rotLBtn,rotRBtn,allBtn,cropBtn]
      .forEach(b=>barBtns.appendChild(b));
    bar.appendChild(barInfo);bar.appendChild(barBtns);

    // 组装
    [mTop,mBot,mLft,mRgt,sel,sizeTip].forEach(e=>overlay.appendChild(e));
    imgContainer.appendChild(imgEl);
    imgContainer.appendChild(overlay);
    imgWrap.appendChild(imgContainer);
    root.appendChild(titleBar);
    root.appendChild(imgWrap);
    root.appendChild(bar);
    document.body.appendChild(root);
    render();

    // 裁剪执行
    function doCrop(){
      cropBtn.disabled=true;
      cropBtn.textContent="处理中...";
      const rc=getRealCrop();
      setTimeout(()=>{
        try{
          const canvas=document.createElement("canvas");
          canvas.width=rc.cW;canvas.height=rc.cH;
          const ctx=canvas.getContext("2d");
          if(rotation===0){
            ctx.drawImage(img,rc.cx,rc.cy,rc.cW,rc.cH,0,0,rc.cW,rc.cH);
          } else {
            const tmpC=document.createElement("canvas");
            if(rotation===90||rotation===270){
              tmpC.width=naturalH;tmpC.height=naturalW;
            } else {
              tmpC.width=naturalW;tmpC.height=naturalH;
            }
            const tmpCtx=tmpC.getContext("2d");
            tmpCtx.translate(tmpC.width/2,tmpC.height/2);
            tmpCtx.rotate(rotation*Math.PI/180);
            tmpCtx.drawImage(img,-naturalW/2,-naturalH/2);
            ctx.drawImage(tmpC,rc.cx,rc.cy,rc.cW,rc.cH,0,0,rc.cW,rc.cH);
          }
          const dot=file.name.lastIndexOf(".");
          const base=dot>0?file.name.slice(0,dot):file.name;
          const ext=dot>0?file.name.slice(dot).toLowerCase():".png";
          const mime=(ext===".jpg"||ext===".jpeg")?"image/jpeg":"image/png";
          const outExt=mime==="image/jpeg"?".jpg":".png";
          const outName=getTimestamp()+"_"+base+"_crop"+outExt;
          canvas.toBlob(blob=>{
            const u=URL.createObjectURL(blob);
            const a=document.createElement("a");
            a.href=u;a.download=outName;a.click();
            URL.revokeObjectURL(u);
            cropBtn.disabled=false;
            cropBtn.textContent="✂ 裁剪保存";
          },mime,0.95);
        } catch(e){
          showErr("裁剪失败："+e.message);
          cropBtn.disabled=false;
          cropBtn.textContent="✂ 裁剪保存";
        }
      },50);
    }

    function cleanup(){
      document.body.style.overflow=prevOverflow;
      document.removeEventListener("mousemove",onMove);
      document.removeEventListener("mouseup",onUp);
      document.removeEventListener("touchmove",onTMove);
      document.removeEventListener("touchend",onUp);
      root.remove();
    }
  }
}

showHome();

})();
