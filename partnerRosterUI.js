(function(){
  'use strict';
  window.PartnerRosterUI={mount(host,onSave){
    const P=PartnerRoster,iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const add=(key,n)=>{const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
    let draft=P.normalize(AppStorage.loadPartnerRoster()),pattern=[],month=new Date();
    let loadedVersion=null;
    host.innerHTML=`<summary><span>Partner roster</span><small>Highlight days off together</small></summary>
      <div class="partner-editor">
      <label>Partner name (optional)<input id="partnerName" maxlength="60" autocomplete="off" type="text"></label>
      <label>Roster type<select id="partnerMode"><option value="repeat">Repeating cycle</option><option value="manual">Enter individual dates</option></select></label>
      <div id="partnerRepeat">
        <label>Pattern to edit<select id="partnerVersion"></select></label>
        <p class="field-note">New patterns apply from their chosen date. Earlier patterns are kept.</p>
        <label>Cycle length<select id="partnerLength"><option value="7">7 days</option><option value="10">10 days</option><option value="14">14 days</option><option value="28">28 days</option><option value="custom">Custom</option></select></label>
        <label id="partnerCustomWrap" hidden>Number of cycle days<input id="partnerCustom" type="number" min="1" max="84" step="1"></label>
        <button type="button" class="secondary" id="partnerSixFour">Use 6 on / 4 off</button>
        <p class="field-note">Tap a cycle day to switch between Work and Off.</p>
        <div id="partnerPattern" class="partner-pattern" aria-label="Partner cycle days"></div>
        <label>Known calendar date<input id="partnerAnchor" type="date"></label>
        <label>Cycle day on that date<select id="partnerCycleDay"></select></label>
        <label>Apply this pattern from<input id="partnerEffective" type="date"></label>
      </div>
      <div class="partner-preview-heading"><button type="button" class="ghost" id="partnerPrev" aria-label="Previous preview month">‹</button><strong id="partnerMonth"></strong><button type="button" class="ghost" id="partnerNext" aria-label="Next preview month">›</button></div>
      <p class="field-note">Preview partner availability. Tap a date: Work → Off → Unknown → Use pattern. Individual dates override the pattern.</p>
      <div class="partner-preview-legend"><span>Work</span><span>Off</span><span>Unknown</span><span>• Edited date</span></div>
      <div id="partnerPreview" class="partner-preview" aria-label="Partner availability preview"></div>
      <p id="partnerMessage" class="field-note" role="status" aria-live="polite"></p>
      <div class="action-grid"><button type="button" class="primary" id="partnerSave">Save partner roster</button><button type="button" class="ghost" id="partnerRemove">Remove partner roster</button></div>
      </div>`;
    const $=id=>host.querySelector('#'+id),message=text=>{$('partnerMessage').textContent=text};
    $('partnerName').value=draft.name;$('partnerMode').value=draft.mode;
    function versions(){
      const select=$('partnerVersion');select.replaceChildren();
      draft.versions.forEach(v=>{const o=document.createElement('option');o.value=v.effectiveFrom;o.textContent=`From ${new Date(v.effectiveFrom+'T12:00:00').toLocaleDateString('en-AU')}`;select.appendChild(o)});
      const o=document.createElement('option');o.value='new';o.textContent='New pattern…';select.appendChild(o);
      select.value=loadedVersion||'new';
    }
    function renderPattern(){
      const wrap=$('partnerPattern');wrap.replaceChildren();
      pattern.forEach((state,i)=>{
        const b=document.createElement('button');b.type='button';b.className='partner-cycle-day '+state;
        b.textContent=`${i+1} ${state==='off'?'Off':'Work'}`;b.setAttribute('aria-label',`Cycle day ${i+1}: ${state}`);b.setAttribute('aria-pressed',String(state==='work'));
        b.onclick=()=>{pattern[i]=state==='work'?'off':'work';renderPattern();preview()};wrap.appendChild(b);
      });
      const selected=Number($('partnerCycleDay').value)||1;$('partnerCycleDay').replaceChildren();
      pattern.forEach((_,i)=>{const o=document.createElement('option');o.value=String(i+1);o.textContent=`Day ${i+1}`;$('partnerCycleDay').appendChild(o)});
      $('partnerCycleDay').value=String(Math.min(selected,pattern.length));
    }
    function loadVersion(version){
      loadedVersion=version?.effectiveFrom||null;
      pattern=version?[...version.pattern]:Array.from({length:10},(_,i)=>i<6?'work':'off');
      $('partnerLength').value=[7,10,14,28].includes(pattern.length)?String(pattern.length):'custom';
      $('partnerCustom').value=pattern.length;$('partnerCustomWrap').hidden=$('partnerLength').value!=='custom';
      $('partnerAnchor').value=version?.anchorDate||iso(new Date());
      $('partnerEffective').value=version?.effectiveFrom||iso(new Date());
      renderPattern();$('partnerCycleDay').value='1';versions();preview();
    }
    function proposed(){
      let next=P.normalize(draft);next.name=$('partnerName').value.trim();next.mode=$('partnerMode').value;
      if(next.mode==='repeat'){
        const anchor=$('partnerAnchor').value,effective=$('partnerEffective').value;
        if(P.ordinal(anchor)===null||P.ordinal(effective)===null)throw new Error('Choose the known date and the date this pattern applies from.');
        const cycleDay=Number($('partnerCycleDay').value)||1;
        next=P.withVersion(next,{anchorDate:add(anchor,1-cycleDay),effectiveFrom:effective,pattern});
      }
      return next;
    }
    function preview(){
      $('partnerRepeat').hidden=$('partnerMode').value==='manual';
      let next;try{next=proposed();message('Changes are saved with “Save partner roster”.')}catch(e){message(e.message);return}
      $('partnerMonth').textContent=month.toLocaleDateString('en-AU',{month:'long',year:'numeric'});
      const wrap=$('partnerPreview');wrap.replaceChildren();
      ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day=>{const el=document.createElement('span');el.className='partner-weekday';el.textContent=day;wrap.appendChild(el)});
      const first=new Date(month.getFullYear(),month.getMonth(),1);
      for(let i=0;i<first.getDay();i++)wrap.appendChild(document.createElement('span'));
      const last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
      for(let day=1;day<=last;day++){
        const key=iso(new Date(month.getFullYear(),month.getMonth(),day)),state=P.stateOn(next,key),edited=Object.hasOwn(draft.overrides,key);
        const b=document.createElement('button');b.type='button';b.dataset.date=key;b.className=`partner-preview-day ${state}`;
        b.setAttribute('aria-label',`${key}: ${state}${edited?', edited date':''}`);
        b.textContent=String(day)+(edited?' •':'');
        b.onclick=()=>{
          const existing=draft.overrides[key],states=['work','off','unknown'];
          if(existing==='unknown')delete draft.overrides[key];else draft.overrides[key]=states[existing?states.indexOf(existing)+1:0];
          preview();
        };wrap.appendChild(b);
      }
    }
    $('partnerVersion').onchange=()=>loadVersion(draft.versions.find(v=>v.effectiveFrom===$('partnerVersion').value));
    $('partnerLength').onchange=()=>{
      $('partnerCustomWrap').hidden=$('partnerLength').value!=='custom';
      if($('partnerLength').value!=='custom')resize(Number($('partnerLength').value));
    };
    function resize(length){
      if(!Number.isInteger(length)||length<1||length>84){message('Cycle length must be a whole number from 1 to 84.');return}
      pattern=Array.from({length},(_,i)=>pattern[i]||'work');$('partnerCustom').value=length;renderPattern();preview();
    }
    $('partnerCustom').oninput=()=>resize(Number($('partnerCustom').value));
    $('partnerSixFour').onclick=()=>{pattern=Array.from({length:10},(_,i)=>i<6?'work':'off');$('partnerLength').value='10';$('partnerCustomWrap').hidden=true;renderPattern();preview()};
    for(const id of ['partnerMode','partnerAnchor','partnerCycleDay','partnerEffective'])$(id).onchange=()=>{
      if(id==='partnerAnchor'&&P.ordinal($('partnerAnchor').value)!==null)month=new Date($('partnerAnchor').value+'T12:00:00');preview();
    };
    $('partnerPrev').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);preview()};
    $('partnerNext').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);preview()};
    $('partnerSave').onclick=()=>{
      try{
        if($('partnerMode').value==='repeat'&&$('partnerLength').value==='custom'&&Number($('partnerCustom').value)!==pattern.length)throw new Error('Enter a valid cycle length from 1 to 84.');
        const next=proposed();AppStorage.savePartnerRoster(next);draft=next;loadedVersion=next.mode==='repeat'?$('partnerEffective').value:null;versions();onSave(next);message('Partner roster saved. Shared days off are shaded automatically.');
      }catch(e){message(e.message||'Could not save partner roster.');}
    };
    $('partnerRemove').onclick=()=>{
      if(!confirm('Remove the partner roster and its individual date changes?'))return;
      AppStorage.savePartnerRoster(null);draft=P.normalize(null);$('partnerName').value='';$('partnerMode').value='repeat';loadVersion(null);onSave(null);message('Partner roster removed.');
    };
    loadVersion(draft.versions.at(-1));
  }};
})();
