const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const PDFLib=require('../vendor/pdf-lib.min.js');
const root=path.resolve(__dirname,'..');
const context={window:{},Blob,console,setTimeout,clearTimeout,fetch:async file=>{
  const bytes=fs.readFileSync(path.join(root,file));
  return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/pdf-lib.min.js'),'utf8'),context);
context.window.PDFLib=context.PDFLib;
for(const file of ['formPdfFields.js','formPdf.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
async function check(){
  const {FormPdf,FormPdfFields}=context.window;
  for(const level of ['TO1','TO2','TO3','TO4','TO5','FCO'])assert.equal(FormPdf.leavePosition(level),'TRANSIT OFFICER');
  for(const level of ['STO1','STO2','STO3'])assert.equal(FormPdf.leavePosition(level),'SENIOR TRANSIT OFFICER');
  assert.equal(FormPdf.leavePosition(''),'');
  const leave=await FormPdf.create('leave');
  for(const key of Object.keys(leave.map.rows)){
    const page=await leave.addPage();
    await page.text(leave.map.identity.name,'Alex D’Souza-José');
    await page.text(leave.map.identity.position,FormPdf.leavePosition('STO1'));
    const [top,bottom]=leave.map.rows[key];
    await page.text({x:619,y:top+4,width:143,height:bottom-top-8,size:20},'30/10/2026');
    page.check(leave.map.boxes.contactYes,true);
    page.check(leave.map.boxes.evidenceNo,true);
  }
  const leavePdf=await PDFLib.PDFDocument.load(await (await leave.save()).arrayBuffer());
  assert.equal(leavePdf.getPageCount(),13,'All existing Leave types/reasons retain their own pages');
  for(const page of leavePdf.getPages()){
    assert.equal(page.getWidth(),595.32);
    assert.equal(page.getHeight(),842.04);
  }
  const swap=await FormPdf.create('swap');
  const page=await swap.addPage();
  await page.text(swap.map.identity.requestName,'Alexandria José D’Souza Robertson');
  await page.text(swap.map.identity.partnerName,'Taylor Example');
  await page.text(swap.map.others,'Jordan Example');
  await assert.rejects(page.text(swap.map.identity.requestName,'Unreasonably long employee name '.repeat(30)),/too long/,'Oversize values must never be silently clipped or dropped');
  await page.text(swap.map.identity.requestService,'');
  const swapPdf=await PDFLib.PDFDocument.load(await (await swap.save()).arrayBuffer());
  assert.equal(swapPdf.getPageCount(),1);
  assert.equal(swapPdf.getPages()[0].getWidth(),595.276);
  assert.equal(swapPdf.getPages()[0].getHeight(),841.89);
  for(const map of Object.values(FormPdfFields)){
    for(const [x,y,w,h] of Object.values(map.boxes))assert.ok(x>=0&&y>=0&&x+w<map.width&&y+h<map.height);
  }
  // Precache every versioned resource referenced by HTML; first offline use of
  // either form must not depend on a previous successful generation.
  const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const [,resource] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png|json)(?:\?[^" ]*)?)"/g)){
    assert.ok(sw.includes(`'./${resource}'`),`Offline cache missing ${resource}`);
    assert.ok(fs.existsSync(path.join(root,resource.split('?')[0])));
  }
  assert.ok(sw.includes("'./leave-form-template.pdf'"));
  assert.ok(sw.includes("'./shift-change-form-template.png'"));
  console.log('PDF regression checks passed: all Leave rows, official/A4 page sizes, long values, diacritics, and first-use offline assets.');
}
check().catch(error=>{console.error(error);process.exitCode=1;});
