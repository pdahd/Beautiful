// screenshot.js v2.0 — 网页截图 + 本地图片裁剪工具
(function(){

const TOOL_ID="sc_tool_987";
const old=document.getElementById(TOOL_ID);
if(old){old.remove();return;}

// ── 工具函数 ──────────────────────────────────
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
    c.appendChild(ic);
    c.appendChild(lb);
    c.onclick=fn;
    return c;
  }

  const webCard=mkCard("🌐","网页截图",()=>{
    wrap.remove();
    loadH2C(initWebshot);
  });
  const cropCard=mkCard("🖼","本地裁剪",()=>{
    wrap.remove();
    initCropper();
  });

  row.appendChild(webCard);
  row.appendChild(cropCard);

  const closeB=mkBtn("关闭","#888",()=>wrap.remove());
  closeB.style.width="100%";

  panel.appendChild(ttl);
  panel.appendChild(row);
  panel.appendChild(closeB);
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

  const sel=document.createElement("div");
  sel.style.cssText=
    "position:absolute;border:2px solid #fff;cursor:move;"+
    "box-shadow:0 0 0 1px rgba(0,0,0,.5);box-sizing:border-box;";

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
    "height:100%;width:0%;background:#0078ff;border-radius:3px;transition:width .3s;";

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
    currentProgress=0;
    progressBar.style.width="0%";
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
    b.onclick=fn;
    return b;
  }

  const backBtn=mkBarBtn("← 返回","#555",()=>{cleanup();showHome();});
  const shotBtn=mkBarBtn("📷 截图保存","#0078ff",doCapture);
  barBtns.appendChild(backBtn);
  barBtns.appendChild(shotBtn);
  bar.appendChild(barInfo);
  bar.appendChild(barBtns);

  // 8手柄
  const HANDLES=["n","s","e","w","nw","ne","sw","se"];
  const handleEls={};
  const CURSOR_MAP={
    n:"ns-resize",s:"ns-resize",e:"ew-resize",w:"ew-resize",
    nw:"nwse-resize",se:"nwse-resize",ne:"nesw-resize",sw:"nesw-resize"
  };
  HANDLES.forEach(dir=>{
    const h=document.createElement("div");
    h.style.cssText=
      "position:absolute;width:44px;height:44px;"+
      "display:flex;align-items:center;justify-content:center;"+
      "cursor:"+(CURSOR_MAP[dir]||"move")+";z-index:10;touch-action:none;";
    const dot=document.createElement("div");
    dot.style.cssText=
      "width:12px;height:12px;background:#fff;border-radius:50%;"+
      "box-shadow:0 0 0 2px rgba(0,0,0,.5);pointer-events:none;";
    h.appendChild(dot);
    handleEls[dir]=h;
    sel.appendChild(h);
  });

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
    const hx={w:-22,e:rw-22,n:rw/2-22,s:rw/2-22,nw:-22,ne:rw-22,sw:-22,se:rw-22};
    const hy={n:-22,s:rh-22,w:rh/2-22,e:rh/2-22,nw:-22,ne:-22,sw:rh-22,se:rh-22};
    HANDLES.forEach(dir=>{
      handleEls[dir].style.left=hx[dir]+"px";
      handleEls[dir].style.top=hy[dir]+"px";
    });
    const tipY=ry-24<0?ry+4:ry-24;
    sizeTip.textContent=rw+" × "+rh+" px";
    sizeTip.style.left=rx+"px";sizeTip.style.top=tipY+"px";
    barInfo.textContent="选区: "+rw+" × "+rh+" px  |  位置: ("+rx+", "+ry+")";
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
            a.click();
            cleanup();
          });
        }).catch(err=>{
          clearInterval(progressTimer);
          progressWrap.style.display="none";
          root.style.display="";
          bar.style.display="";
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

  // 文件选择
  const fileInput=document.createElement("input");
  fileInput.type="file";
  fileInput.accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/svg+xml";
  fileInput.style.display="none";
  document.body.appendChild(fileInput);

  fileInput.addEventListener("change",()=>{
    const file=fileInput.files[0];
    if(!file){fileInput.remove();return;}
    if(file.size>20*1024*1024){
      if(!confirm("图片较大("+Math.round(file.size/1024/1024*10)/10+"MB)，是否继续？"))
        {fileInput.remove();return;}
    }
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      openCropUI(img,file);
    };
    img.onerror=()=>showErr("图片加载失败");
    img.src=url;
    fileInput.remove();
  });

  fileInput.click();

  function openCropUI(img,file){

    const naturalW=img.naturalWidth;
    const naturalH=img.naturalHeight;

    // 超大图提示
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

    titleBar.appendChild(titleText);
    titleBar.appendChild(imgInfo);

    // 图片显示区
    const imgWrap=document.createElement("div");
    imgWrap.style.cssText=
      "flex:1;position:relative;overflow:hidden;"+
      "display:flex;align-items:center;justify-content:center;";

    // 计算图片显示尺寸（等比适配）
    const maxW=window.innerWidth;
    const maxH=window.innerHeight-120;
    const scaleRatio=Math.min(maxW/naturalW,maxH/naturalH,1);
    const dispW=Math.round(naturalW*scaleRatio);
    const dispH=Math.round(naturalH*scaleRatio);

    const imgEl=document.createElement("img");
    imgEl.src=img.src;
    imgEl.style.cssText=
      "width:"+dispW+"px;height:"+dispH+"px;"+
      "display:block;user-select:none;pointer-events:none;"+
      "position:absolute;";

    // 图片容器（定位基准）
    const imgContainer=document.createElement("div");
    imgContainer.style.cssText=
      "position:relative;width:"+dispW+"px;height:"+dispH+"px;flex-shrink:0;";

    // 旋转状态
    let rotation=0;

    // 选区覆盖层
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

    // 选区
    const sel=document.createElement("div");
    sel.style.cssText=
      "position:absolute;border:2px solid #fff;cursor:move;"+
      "box-shadow:0 0 0 1px rgba(0,0,0,.5);box-sizing:border-box;";

    // 尺寸提示
    const sizeTip=document.createElement("div");
    sizeTip.style.cssText=
      "position:absolute;background:rgba(0,0,0,.7);color:#fff;"+
      "font-size:11px;padding:2px 6px;border-radius:3px;"+
      "pointer-events:none;white-space:nowrap;z-index:20;";

    // 8手柄
    const HANDLES=["n","s","e","w","nw","ne","sw","se"];
    const handleEls={};
    const CURSOR_MAP={
      n:"ns-resize",s:"ns-resize",e:"ew-resize",w:"ew-resize",
      nw:"nwse-resize",se:"nwse-resize",ne:"nesw-resize",sw:"nesw-resize"
    };
    HANDLES.forEach(dir=>{
      const h=document.createElement("div");
      h.style.cssText=
        "position:absolute;width:44px;height:44px;"+
        "display:flex;align-items:center;justify-content:center;"+
        "cursor:"+(CURSOR_MAP[dir]||"move")+";z-index:10;touch-action:none;";
      const dot=document.createElement("div");
      dot.style.cssText=
        "width:11px;height:11px;background:#fff;border-radius:50%;"+
        "box-shadow:0 0 0 2px rgba(0,0,0,.5);pointer-events:none;";
      h.appendChild(dot);
      handleEls[dir]=h;
      sel.appendChild(h);
    });

    // 选区状态（显示坐标）
    let rx=Math.round(dispW*0.15),ry=Math.round(dispH*0.15);
    let rw=Math.round(dispW*0.7),rh=Math.round(dispH*0.7);
    const MIN_SIZE=20;

    function clampRect(){
      rw=Math.max(MIN_SIZE,rw);rh=Math.max(MIN_SIZE,rh);
      rx=Math.max(0,Math.min(rx,dispW-rw));
      ry=Math.max(0,Math.min(ry,dispH-rh));
    }

    // 原图实际裁剪坐标
    function getRealCrop(){
      let cw=dispW,ch=dispH;
      if(rotation===90||rotation===270){cw=dispH;ch=dispW;}
      const sX=naturalW/cw,sY=naturalH/ch;
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

      const hx={w:-22,e:rw-22,n:rw/2-22,s:rw/2-22,nw:-22,ne:rw-22,sw:-22,se:rw-22};
      const hy={n:-22,s:rh-22,w:rh/2-22,e:rh/2-22,nw:-22,ne:-22,sw:rh-22,se:rh-22};
      HANDLES.forEach(dir=>{
        handleEls[dir].style.left=hx[dir]+"px";
        handleEls[dir].style.top=hy[dir]+"px";
      });

      const tipY=ry-20<0?ry+4:ry-20;
      const rc=getRealCrop();
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

    // 底部工具栏
    const bar=document.createElement("div");
    bar.style.cssText=
      "background:rgba(30,30,30,.95);padding:10px 12px;"+
      "display:flex;flex-direction:column;gap:8px;flex-shrink:0;";

    const barInfo=document.createElement("div");
    barInfo.style.cssText="color:#aaa;font-size:11px;text-align:center;";

    const barBtns=document.createElement("div");
    barBtns.style.cssText="display:flex;gap:8px;";

    function mkBarBtn(t,bg,fn){
      const b=document.createElement("button");
      b.textContent=t;
      b.style.cssText=
        "flex:1;padding:9px 4px;background:"+bg+";color:#fff;border:none;"+
        "border-radius:6px;font-size:13px;cursor:pointer;";
      b.onclick=fn;
      return b;
    }

    const backBtn=mkBarBtn("← 返回","#555",()=>{
      cleanup();showHome();
    });
    const rotLBtn=mkBarBtn("↺ 左转","#607d8b",()=>{
      rotation=(rotation+270)%360;
      imgEl.style.transform="rotate("+rotation+"deg)";
      // 左右旋转时交换选区尺寸
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

    [backBtn,rotLBtn,rotRBtn,allBtn,cropBtn].forEach(b=>barBtns.appendChild(b));
    bar.appendChild(barInfo);
    bar.appendChild(barBtns);

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
          canvas.width=rc.cW;
          canvas.height=rc.cH;
          const ctx=canvas.getContext("2d");

          // 处理旋转：在canvas上旋转后裁剪
          if(rotation===0){
            ctx.drawImage(img,rc.cx,rc.cy,rc.cW,rc.cH,0,0,rc.cW,rc.cH);
          } else {
            // 先旋转整图到临时canvas
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

          // 导出格式
          const dot=file.name.lastIndexOf(".");
          const base=dot>0?file.name.slice(0,dot):file.name;
          const ext=dot>0?file.name.slice(dot).toLowerCase():".png";
          const mime=ext===".jpg"||ext===".jpeg"?"image/jpeg":"image/png";
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

// ── 启动 ──────────────────────────────────────
showHome();

})();
