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
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.pdf':'application/pdf','.json':'application/json'};
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
    window.generatedPdfs=[];window.previewWasSynchronous=[];
    document.addEventListener('click',()=>{window.pdfClickTask=true;queueMicrotask(()=>{window.pdfClickTask=false;});},true);
    const original=FormPdf.reservePreview;
    FormPdf.reservePreview=()=>{
      window.previewWasSynchronous.push(navigator.userActivation?.isActive??window.pdfClickTask);
      const preview=original();
      return {close:()=>preview.close(),show:async(blob,filename)=>{
        window.generatedPdfs.push({filename,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))});
        preview.show(blob,filename);
      }};
    };
  });
  await installCapture();
  const collect=async(name,count)=>{
    try{await page.waitForFunction(n=>window.generatedPdfs.length===n,count);}
    catch(error){console.error('PDF flow diagnostics:',await page.evaluate(()=>({toast:document.querySelector('#toast')?.textContent,captured:window.generatedPdfs.length})),errors);throw error;}
    const result=await page.evaluate(()=>window.generatedPdfs.at(-1));
    fs.writeFileSync(path.join(output,name+'.pdf'),Buffer.from(result.bytes));
    for(const tab of context.pages())if(tab!==page)await tab.close();
    return result;
  };
  // First generation is offline: every dependency/template must already be cached.
  await context.setOffline(offline);
  await page.click('#homeGenerateLeave');
  await page.selectOption('#leaveFormType','sick:care');
  await page.fill('#leaveFormStart','2026-10-30');
  await page.fill('#leaveFormEnd','2026-10-30');
  await page.click('#leaveFormComments');
  await page.fill('.manual-leave-hours','8');
  await page.selectOption('#leaveContactable','yes');
  await page.selectOption('#leaveEvidence','no');
  await page.fill('#leaveFormComments','Family care');
  await page.click('#generateLeaveDocument');
  await collect('leave-care-offline',1);
  await page.click('#homeGenerateSwap');
  await page.fill('#swapPartnerName','Taylor Example');
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
  await collect('swap-single-offline',2);
  await page.click('[data-swap-mode="roster"]');
  await page.click('#generateShiftSwap');
  await collect('swap-roster-offline',3);
  assert.deepEqual(await page.evaluate(()=>window.previewWasSynchronous),[true,true,true]);
  // A browser that refuses popups must still receive a valid download.
  await page.evaluate(()=>{window.open=()=>null;});
  const downloaded=page.waitForEvent('download');
  await page.click('#generateShiftSwap');
  const download=await downloaded;
  assert.match(download.suggestedFilename(),/^ShiftMate-Shift-Swap-.*\.pdf$/);
  await collect('swap-popup-blocked',4);
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
    for(const file of ['./leave-form-template.pdf','./shift-change-form-template.png','./formPdf.js?v=1','./vendor/pdf-lib.min.js?v=1.17.1']){
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
  await collect('leave-mixed-groups',1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ptaV2Current')),saved,'Generating a form must not mutate saved data');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({engine,viewport:'iPhone 13',offline,firstUse:true,popupActivation:true,assets,errors},null,2));
  console.log(`${engine} iPhone viewport checks passed: ${offline?'offline first-use':'online'} Leave, single/roster Swap, Unicode, user activation, popup fallback, mixed Leave groups/data preservation, and ${offline?'offline ':''}reload.`);
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});
