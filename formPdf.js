// Shared, locally bundled PDF rendering. Business rules remain in app.js.
(() => {
  'use strict';
  const {PDFDocument,StandardFonts,rgb}=window.PDFLib;
  const leavePosition=classification=>{
    const level=String(classification||'').trim().toUpperCase();
    if(/^STO[1-3]$/.test(level))return 'SENIOR TRANSIT OFFICER';
    if(/^TO[1-5]$/.test(level)||level==='FCO')return 'TRANSIT OFFICER';
    return level==='TRAINEE'?'TRAINEE':'';
  };
  const black=rgb(0.067,0.067,0.067);
  const fetchBytes=async path=>{
    const response=await fetch(path);
    if(!response.ok)throw new Error('The form template is unavailable. Open ShiftMate online once before using it offline.');
    return new Uint8Array(await response.arrayBuffer());
  };
  const wrap=(text,width,measure)=>{
    const lines=[];
    for(const paragraph of text.split(/\r?\n/)){
      let line='';
      for(const word of paragraph.split(/\s+/).filter(Boolean)){
        if(measure(word)>width){
          if(line){lines.push(line);line='';}
          for(const character of Array.from(word)){
            if(line&&measure(line+character)>width){lines.push(line);line='';}
            line+=character;
          }
        }else if(line&&measure(line+' '+word)>width){lines.push(line);line=word;}
        else line+=`${line?' ':''}${word}`;
      }
      lines.push(line);
    }
    return lines;
  };
  const fit=(text,field,measure)=>{
    for(let size=field.size;size>=14;size-=0.5){
      const lines=field.multiline?wrap(text,field.width,v=>measure(v,size)):[text.replace(/\r?\n/g,' ')];
      if(lines.every(line=>measure(line,size)<=field.width)&&lines.length*size*1.15<=field.height)return {size,lines};
    }
    throw new Error(`${field.label||'A form value'} is too long for the official field. Shorten it before generating the form.`);
  };
  async function create(type){
    const map=window.FormPdfFields[type];
    if(!map)throw new Error('Unknown form type');
    const pdf=await PDFDocument.create();
    const bytes=await fetchBytes(map.template);
    const original=type==='leave'?await PDFDocument.load(bytes):null;
    if(original&&original.getPageCount()!==1)throw new Error('The official Leave template must contain one page');
    const background=type==='swap'?await pdf.embedPng(bytes):null;
    const regular=await pdf.embedFont(StandardFonts.Helvetica);
    const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const addPage=async()=>{
      const page=original?(await pdf.copyPages(original,[0]))[0]:pdf.addPage([595.276,841.89]);
      if(original)pdf.addPage(page);
      const {width,height}=page.getSize(),sx=width/map.width,sy=height/map.height;
      if(background)page.drawImage(background,{x:0,y:0,width,height});
      const rectangle=([x,y,w,h],color=rgb(1,1,1))=>page.drawRectangle({x:x*sx,y:height-(y+h)*sy,width:w*sx,height:h*sy,color});
      const check=([x,y,w,h],selected)=>{
        if(!selected)return;
        const line=(a,b,c,d)=>page.drawLine({start:{x:a*sx,y:height-b*sy},end:{x:c*sx,y:height-d*sy},thickness:1.8*sx,color:black});
        line(x,y,x+w,y+h);line(x+w,y,x,y+h);
      };
      const text=async(field,value)=>{
        if(value===null||value===undefined||value==='')return;
        const valueText=String(value),font=field.bold?bold:regular;
        try{font.encodeText(valueText.replace(/\r?\n/g,' '));}
        catch{
          // Canvas retains names outside WinAnsi (e.g. non-Latin names) without substitution.
          const canvas=document.createElement('canvas');
          canvas.width=Math.ceil(field.width*2);canvas.height=Math.ceil(field.height*2);
          const ctx=canvas.getContext('2d');
          if(!ctx)throw new Error('Could not render the employee field');
          const measure=(v,size)=>{ctx.font=`${field.bold?'bold ':''}${size*2}px Arial`;return ctx.measureText(v).width/2;};
          const {size,lines}=fit(valueText,field,measure);
          ctx.font=`${field.bold?'bold ':''}${size*2}px Arial`;ctx.fillStyle='#111';ctx.textBaseline='middle';ctx.textAlign=field.align==='center'?'center':'left';
          lines.forEach((line,i)=>ctx.fillText(line,field.align==='center'?field.width:0,(field.height-lines.length*size*1.15)/2*2+(i+0.5)*size*1.15*2));
          const image=await pdf.embedPng(canvas.toDataURL('image/png'));
          page.drawImage(image,{x:field.x*sx,y:height-(field.y+field.height)*sy,width:field.width*sx,height:field.height*sy});
          return;
        }
        const {size,lines}=fit(valueText,field,(v,s)=>font.widthOfTextAtSize(v,s*sx)/sx);
        const fontSize=size*sx,lineHeight=size*1.15;
        const inkHeight=font.heightAtSize(fontSize,{descender:false});
        lines.forEach((line,i)=>{
          const center=field.y+(field.height-lines.length*lineHeight)/2+(i+0.5)*lineHeight;
          const offset=field.align==='center'?(field.width*sx-font.widthOfTextAtSize(line,fontSize))/2:0;
          page.drawText(line,{x:field.x*sx+offset,y:height-center*sy-inkHeight/2,size:fontSize,font,color:black});
        });
      };
      return {text,check,rectangle};
    };
    return {map,addPage,save:async()=>new Blob([await pdf.save()],{type:'application/pdf'})};
  }
  // Reserve a tab synchronously, while Safari still has the button's user activation.
  function reservePreview(){
    const preview=window.open('about:blank','_blank');
    if(preview){
      preview.opener=null;
      preview.document.title='Preparing form';
      preview.document.body.textContent='Preparing your PDF…';
    }
    let url;
    return {
      show(blob,filename){
        url=URL.createObjectURL(blob);
        if(preview&&!preview.closed)preview.location.replace(url);
        else{
          const link=document.createElement('a');link.href=url;link.download=filename;
          document.body.appendChild(link);link.click();link.remove();
        }
        // Give Safari's PDF viewer time to load/share/save the Blob.
        setTimeout(()=>URL.revokeObjectURL(url),300000);
      },
      close(){if(preview&&!preview.closed)preview.close();if(url)URL.revokeObjectURL(url);}
    };
  }
  window.FormPdf={create,reservePreview,leavePosition};
})();
