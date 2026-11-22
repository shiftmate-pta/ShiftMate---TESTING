// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package.
// Optional: FORM_BROWSER=webkit, FORM_BROWSER_EXECUTABLE, PDF_TEST_OUTPUT.
// FORM_RENDER_ONLY=1 skips SW/offline checks on engines without SW test support.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {once}=require('node:events');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const output=process.env.PDF_TEST_OUTPUT||path.join(root,'tmp','pdf-review');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.pdf':'application/pdf','.json':'application/json'};
let browser,server;
async function run(){
  fs.mkdirSync(output,{recursive:true});
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(file,(error,data)=>{
      if(error){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
    });
  }).listen(0,'localhost');
  await once(server,'listening');
  const base=`http://localhost:${server.address().port}`;
  const engine=process.env.FORM_BROWSER||'chromium';
  const offline=process.env.FORM_RENDER_ONLY!=='1';
  browser=await playwright[engine].launch({headless:true,...(process.env.FORM_BROWSER_EXECUTABLE?{executablePath:process.env.FORM_BROWSER_EXECUTABLE}:{})});
  const context=await browser.newContext({...playwright.devices['iPhone 13'],defaultBrowserType:undefined});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  const viewport=await page.locator('meta[name=viewport]').getAttribute('content');
  assert.doesNotMatch(viewport,/user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1\s*(?:,|$)/i);
  const assertMobileFontSize=async selectors=>{
    const sizes=await page.evaluate(selectors=>Object.fromEntries(selectors.map(selector=>
      [selector,parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)])),selectors);
    for(const [selector,size] of Object.entries(sizes))assert.ok(size>=16,`${selector} computed font size: ${size}px`);
  };
  await page.evaluate(()=>{
    localStorage.setItem('ptaV2Current',JSON.stringify({startDate:'2026-10-25',settings:{employeeName:'Alex D’Souza-José',serviceNumber:'12345',homeLine:'ARMADALE'},days:Array.from({length:14},()=>({code:'',entered:false}))}));
  });
  await page.reload();
  if(offline){
    console.log(`${engine}: app loaded; waiting for offline cache`);
    await page.evaluate(async()=>{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Service worker did not become ready')),20000))]);});
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  }
  // Capture the exact Blob given to the real open/save flow, while retaining it.
  const installCapture=async()=>page.evaluate(()=>{
    window.generatedPdfs=[];window.sharedPdfs=[];window.shareSupported=true;
    Object.defineProperty(navigator,'canShare',{value:data=>{
      window.checkedShareData=data;
      return window.shareSupported;
    }});
    Object.defineProperty(navigator,'share',{value:async data=>{
      window.sharedPdfs.push({data,checked:data===window.checkedShareData});
    }});
    const original=FormPdfViewer.show;
    FormPdfViewer.show=async(blob,filename)=>{
      window.generatedPdfs.push({filename,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))});
      await original(blob,filename);
    };
  });
  await installCapture();
  const collect=async(name,count,pageCount=1)=>{
    try{await page.waitForFunction(n=>window.generatedPdfs.length===n,count);}
    catch(error){console.error('PDF flow diagnostics:',await page.evaluate(()=>({toast:document.querySelector('#toast')?.textContent,captured:window.generatedPdfs.length})),errors);throw error;}
    const result=await page.evaluate(()=>window.generatedPdfs.at(-1));
    fs.writeFileSync(path.join(output,name+'.pdf'),Buffer.from(result.bytes));
    const viewer=page.locator('#pdfViewer');
    await viewer.waitFor();
    await page.waitForFunction(n=>document.querySelectorAll('#pdfViewerPages canvas').length===n,pageCount);
    assert.equal(await viewer.locator('#pdfViewerName').textContent(),result.filename);
    assert.equal(context.pages().length,1,'viewer stays inside ShiftMate');
    for(const action of ['Share PDF','Save','Print']){
      await viewer.getByRole('button',{name:action,exact:true}).click();
      const shared=await page.evaluate(async verifyBytes=>{
        const {data,checked}=window.sharedPdfs.at(-1);
        const [file]=data.files;
        return {keys:Object.keys(data),checked,count:data.files.length,isFile:file instanceof File,name:file.name,type:file.type,
          bytes:verifyBytes?Array.from(new Uint8Array(await file.arrayBuffer())):null};
      },action==='Share PDF');
      assert.deepEqual(shared,{keys:['files'],checked:true,count:1,isFile:true,name:result.filename,type:'application/pdf',
        bytes:action==='Share PDF'?result.bytes:null});
    }
    await page.evaluate(()=>{window.shareSupported=false;});
    const downloading=page.waitForEvent('download');
    const sharesBefore=await page.evaluate(()=>window.sharedPdfs.length);
    await viewer.getByRole('button',{name:'Share PDF',exact:true}).click();
    const downloaded=await downloading;
    assert.equal(downloaded.suggestedFilename(),result.filename);
    assert.deepEqual(fs.readFileSync(await downloaded.path()),Buffer.from(result.bytes));
    assert.equal(await page.evaluate(()=>window.sharedPdfs.length),sharesBefore);
    assert.match(await viewer.locator('#pdfViewerStatus').textContent(),/Attach the downloaded PDF/);
    await page.evaluate(()=>{window.shareSupported=true;});
    const controls=viewer.locator('#pdfViewerControls');
    const before=await controls.boundingBox();
    const originalWidth=await viewer.locator('canvas').first().evaluate(canvas=>canvas.clientWidth);
    await viewer.locator('#pdfViewerPages').evaluate(el=>{
      const finger=x=>new Touch({identifier:x,target:el,clientX:x,clientY:20});
      el.dispatchEvent(new TouchEvent('touchstart',{touches:[finger(10),finger(50)],cancelable:true}));
      el.dispatchEvent(new TouchEvent('touchmove',{touches:[finger(10),finger(90)],cancelable:true}));
      el.dispatchEvent(new TouchEvent('touchend'));
    });
    assert.ok(await viewer.locator('canvas').first().evaluate(canvas=>canvas.clientWidth)>originalWidth);
    await viewer.locator('#pdfViewerPages').evaluate(el=>el.scrollTop=el.scrollHeight);
    assert.deepEqual(await controls.boundingBox(),before);
    await viewer.getByRole('button',{name:'Close',exact:true}).click();
    assert.equal(await viewer.isVisible(),false);
    return result;
  };
  // First generation is offline: every dependency/template must already be cached.
  await context.setOffline(offline);
  await page.click('.nav-button[data-go="settings"]');
  await assertMobileFontSize(['#employeeName','#serviceNumber','#classification']);
  await page.click('.nav-button[data-go="home"]');
  await page.click('#homeGenerateLeave');
  await assertMobileFontSize(['#leaveFormType','#leaveFormStart','#leaveFormEnd','#leaveFormComments']);
  await page.selectOption('#leaveFormType','sick:care');
  await page.fill('#leaveFormStart','2026-10-30');
  await page.fill('#leaveFormEnd','2026-10-30');
  await page.click('#leaveFormComments');
  await page.fill('.manual-leave-hours','8');
  await page.selectOption('#leaveContactable','yes');
  await page.selectOption('#leaveEvidence','no');
  await page.fill('#leaveFormComments','Family care');
  await page.click('#generateLeaveDocument');
  assert.equal((await collect('leave-care-offline',1)).filename,'Leave Form_301026_D’Souza-José.pdf');
  await page.click('#homeGenerateSwap');
  await assertMobileFontSize(['#swapPartnerName','#swapPartnerService','#swapRequestDate','#swapPartnerDate','#swapPartnerShift','#swapRequestStart']);
  await page.fill('#swapPartnerName','Taylor Exa:mple');
  await page.fill('#swapPartnerService','67890');
  await page.fill('#swapRequestDate','2026-10-30');
  await page.fill('#swapPartnerDate','2026-10-27');
  await page.selectOption('#swapRequestShift','2M');
  await page.selectOption('#swapPartnerShift','2M');
  await page.fill('#swapRequestStart','05:30');
  await page.fill('#swapRequestFinish','16:30');
  await page.fill('#swapPartnerStart','05:30');
  await page.fill('#swapPartnerFinish','15:30');
  await page.check('#swapContingent');
  await page.fill('#swapOthers','Jordan Example');
  await page.check('#swapNeutralCost');
  await page.click('#generateShiftSwap');
  assert.equal((await collect('swap-single-offline',2)).filename,'Shift Swap Form_301026_Example.pdf');
  await page.click('[data-swap-mode="roster"]');
  await page.click('#generateShiftSwap');
  assert.equal((await collect('swap-roster-offline',3)).filename,'Shift Swap Form_301026_Example.pdf');
  // Unsupported WinAnsi names must remain visible through the Unicode fallback.
  const unicode=await page.evaluate(async()=>{
    const doc=await FormPdf.create('swap'),p=await doc.addPage();
    doc.map.placeholders.forEach(rect=>p.rectangle(rect));
    await p.text(doc.map.identity.requestName,'Zoë 李 Example');
    return Array.from(new Uint8Array(await (await doc.save()).arrayBuffer()));
  });
  fs.writeFileSync(path.join(output,'swap-unicode.pdf'),Buffer.from(unicode));
  // Offline reload of the installed shell must also retain renderer availability.
  await page.reload();
  await page.waitForFunction(()=>Boolean(window.FormPdf));
  const assets=await page.evaluate(async()=>{
    const results=[];
    for(const file of ['./leave-form-template.pdf','./shift-change-form-template.png','./formPdf.js?v=6','./vendor/pdfjs/pdf.min.mjs','./vendor/pdfjs/pdf.worker.min.mjs']){
      const response=await fetch(file);results.push([file,response.ok,response.headers.get('Content-Type')]);
    }
    return results;
  });
  assert.ok(assets.every(([,ok])=>ok));
  assert.equal(assets[0][2],'application/pdf');
  assert.equal(assets[1][2],'image/png');
  // Saved leave, user-adjusted hours, and partial book-off keep their existing groups.
  await page.evaluate(()=>{
    const current=JSON.parse(localStorage.getItem('ptaV2Current'));
    current.days=Array.from({length:14},()=>({code:'',entered:false}));
    current.days[5]={code:'A/L',entered:true,leaveHours:8};
    current.days[6]={code:'Sick',entered:true,leaveHours:7.6,personalLeaveReason:'care'};
    current.days[7]={code:'2M',entered:true,bookOffHours:2.5,bookOffLeaveType:'sick',bookOffLeaveReason:'unanticipated'};
    localStorage.setItem('ptaV2Current',JSON.stringify(current));
  });
  await page.reload();
  await installCapture();
  await page.click('#homeGenerateLeave');
  await page.fill('#leaveFormStart','2026-10-30');
  await page.fill('#leaveFormEnd','2026-11-01');
  await page.click('#leaveFormComments');
  await page.waitForFunction(()=>document.querySelectorAll('.leave-group-hours').length===3);
  await page.fill('.leave-group-hours[data-group-key="annual"]','9.2');
  assert.equal(await page.locator('#leaveFormType').isDisabled(),true);
  const saved=await page.evaluate(()=>localStorage.getItem('ptaV2Current'));
  await page.click('#generateLeaveDocument');
  assert.equal((await collect('leave-mixed-groups',1,3)).filename,'Leave Form_011126_D’Souza-José.pdf');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ptaV2Current')),saved,'Generating a form must not mutate saved data');
  const desktop=await browser.newContext();
  const printPage=await desktop.newPage();
  await printPage.goto(base);
  await printPage.evaluate(async bytes=>{
    window.print=()=>{
      window.printCheck={title:document.title,pages:document.querySelectorAll('#pdfPrintPages canvas').length};
    };
    await FormPdfViewer.show(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),'Leave Form_011126_Test.pdf');
  },Array.from(fs.readFileSync(path.join(output,'leave-mixed-groups.pdf'))));
  await printPage.getByRole('button',{name:'Print',exact:true}).click();
  assert.deepEqual(await printPage.evaluate(()=>window.printCheck),{title:'Leave Form_011126_Test.pdf',pages:3});
  if(engine==='chromium'){
    const printed=await printPage.pdf({preferCSSPageSize:true});
    const printedPages=await printPage.evaluate(async bytes=>{
      const pdf=await PDFLib.PDFDocument.load(new Uint8Array(bytes));
      return pdf.getPages().map(page=>[page.getWidth(),page.getHeight()]);
    },Array.from(printed));
    assert.equal(printedPages.length,3);
    assert.ok(printedPages.every(([width,height])=>Math.abs(width-595.28)<2&&Math.abs(height-841.89)<2));
  }
  await printPage.getByRole('button',{name:'Close',exact:true}).click();
  await printPage.waitForFunction(()=>document.querySelector('#pdfPrintPages').childElementCount===0);
  await desktop.close();
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({engine,viewport:'iPhone 13',offline,assets,errors},null,2));
  console.log(`${engine} PDF viewer checks passed: both forms, named sharing/saving, desktop print, pinned controls, and offline reload.`);
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});
