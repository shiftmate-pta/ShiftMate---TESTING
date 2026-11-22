(() => {
  'use strict';
  const dialog=document.querySelector('#pdfViewer');
  const pages=document.querySelector('#pdfViewerPages');
  const title=document.querySelector('#pdfViewerName');
  const status=document.querySelector('#pdfViewerStatus');
  const printRoot=document.querySelector('#pdfPrintPages');
  const printButton=document.querySelector('#pdfViewerPrint');
  const appleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let file, documentTask, generation=0, returnFocus;
  let printTitle, ready=false, zoom=1, pinch;

  function download(){
    const url=URL.createObjectURL(file);
    const link=document.createElement('a');
    link.href=url;
    link.download=file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),300000);
  }

  async function shareOrDownload(action){
    if(!file)return;
    const data={files:[file]};
    try{
      if(typeof navigator.share==='function'&&navigator.canShare?.(data)){
        status.textContent=action==='save'?'Choose Save to Files.':action==='print'?'Choose Print.':'';
        await navigator.share(data);
        return;
      }
    }catch(error){
      if(error?.name==='AbortError')return;
    }
    download();
    status.textContent=action==='print'?'Open the saved PDF to print.':
      action==='share'?'Attach the downloaded PDF in your email app.':'';
  }

  function clearPrint(){
    if(printTitle!==undefined)document.title=printTitle;
    printTitle=undefined;
    document.body.classList.remove('printing-shiftmate-pdf');
    printRoot.replaceChildren();
  }

  document.querySelector('#pdfViewerShare').onclick=()=>shareOrDownload('share');
  document.querySelector('#pdfViewerSave').onclick=()=>appleMobile?shareOrDownload('save'):download();
  printButton.onclick=()=>{
    if(appleMobile||typeof window.print!=='function'||!ready)return shareOrDownload('print');
    clearPrint();
    for(const canvas of pages.querySelectorAll('canvas')){
      const copy=canvas.cloneNode();
      copy.getContext('2d').drawImage(canvas,0,0);
      printRoot.append(copy);
    }
    printTitle=document.title;
    document.title=file.name;
    document.body.classList.add('printing-shiftmate-pdf');
    try{window.print();}
    catch{clearPrint();shareOrDownload('print');}
  };
  window.addEventListener('afterprint',clearPrint);
  document.querySelector('#pdfViewerClose').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
    if(dialog.open)return;
    generation++;
    if(documentTask)documentTask.destroy().catch(()=>{});
    documentTask=null;
    file=null;
    ready=false;
    clearPrint();
    pages.replaceChildren();
    if(returnFocus?.getClientRects().length)returnFocus.focus();
  });

  const fingerDistance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  pages.addEventListener('touchstart',event=>{
    if(event.touches.length===2)pinch={distance:fingerDistance(event.touches),zoom};
  },{passive:true});
  pages.addEventListener('touchmove',event=>{
    if(!pinch?.distance||event.touches.length!==2)return;
    if(event.cancelable)event.preventDefault();
    zoom=Math.max(1,Math.min(3,pinch.zoom*fingerDistance(event.touches)/pinch.distance));
    pages.style.setProperty('--pdf-zoom',zoom);
  },{passive:false});
  for(const type of ['touchend','touchcancel'])pages.addEventListener(type,()=>{pinch=null;},{passive:true});

  async function show(blob,filename){
    if(documentTask)documentTask.destroy().catch(()=>{});
    documentTask=null;
    ready=false;
    pinch=null;
    zoom=1;
    pages.style.removeProperty('--pdf-zoom');
    const token=++generation;
    file=new File([blob],filename,{type:'application/pdf'});
    title.textContent=file.name;
    status.textContent='Loading PDF…';
    pages.replaceChildren();
    pages.scrollTop=0;
    pages.scrollLeft=0;
    if(!dialog.open){
      returnFocus=document.activeElement;
      dialog.showModal();
    }
    try{
      const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
      const bytes=await blob.arrayBuffer();
      if(token!==generation)return;
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',document.baseURI).href;
      documentTask=pdfjs.getDocument({
        data:bytes,
        standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',document.baseURI).href,
        useWasm:false,
        isEvalSupported:false
      });
      const pdf=await documentTask.promise;
      for(let number=1;number<=pdf.numPages;number++){
        const page=await pdf.getPage(number);
        if(token!==generation)return;
        const viewport=page.getViewport({scale:2.5});
        const canvas=document.createElement('canvas');
        canvas.width=Math.ceil(viewport.width);
        canvas.height=Math.ceil(viewport.height);
        canvas.setAttribute('aria-label',`PDF page ${number} of ${pdf.numPages}`);
        canvas.setAttribute('role','img');
        await page.render({canvas,viewport}).promise;
        if(token!==generation)return;
        pages.append(canvas);
      }
      if(token===generation){
        ready=true;
        status.textContent='';
      }
    }catch{
      if(token===generation)status.textContent='Preview unavailable. Use Save or Share to open the PDF.';
    }
  }

  window.FormPdfViewer={show};
})();
