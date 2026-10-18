/* Partner availability is independent of pay-cycle snapshots. Calendar dates use
   UTC ordinals so rotating patterns do not drift across DST or timezone changes. */
(function(root){
  'use strict';
  const STATES=['work','off','unknown'];
  function ordinal(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
    const [y,m,d]=value.split('-').map(Number),date=new Date(0);
    date.setUTCFullYear(y,m-1,d);date.setUTCHours(0,0,0,0);
    return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.getTime()/86400000:null;
  }
  function normalize(raw){
    const versions=[];
    for(const v of Array.isArray(raw?.versions)?raw.versions:[]){
      if(ordinal(v.effectiveFrom)===null||ordinal(v.anchorDate)===null)continue;
      if(!Array.isArray(v.pattern)||!v.pattern.length||v.pattern.length>84||!v.pattern.every(s=>STATES.includes(s)))continue;
      const next={effectiveFrom:v.effectiveFrom,anchorDate:v.anchorDate,pattern:[...v.pattern]};
      const index=versions.findIndex(x=>x.effectiveFrom===next.effectiveFrom);
      if(index<0)versions.push(next);else versions[index]=next;
    }
    versions.sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
    const overrides={};
    for(const [key,state] of Object.entries(raw?.overrides||{}))if(ordinal(key)!==null&&STATES.includes(state))overrides[key]=state;
    return {name:String(raw?.name||'').slice(0,60),mode:raw?.mode==='manual'?'manual':'repeat',versions,overrides};
  }
  function stateOn(raw,key){
    if(ordinal(key)===null)return 'unknown';
    if(Object.hasOwn(raw?.overrides||{},key))return STATES.includes(raw.overrides[key])?raw.overrides[key]:'unknown';
    if(raw?.mode==='manual')return 'unknown';
    const version=[...(raw?.versions||[])].reverse().find(v=>v.effectiveFrom<=key);
    if(!version?.pattern?.length)return 'unknown';
    const distance=ordinal(key)-ordinal(version.anchorDate),length=version.pattern.length;
    return version.pattern[((distance%length)+length)%length]||'unknown';
  }
  function withVersion(raw,version){
    const next=normalize(raw);
    const clean=normalize({versions:[version]}).versions[0];
    if(!clean)throw new Error('Choose valid dates and a cycle of 1–84 days.');
    next.versions=next.versions.filter(v=>v.effectiveFrom!==clean.effectiveFrom);
    next.versions.push(clean);return normalize(next);
  }
  // Unknown availability must never be promoted to an off day.
  const sharedOff=(raw,key,userState)=>userState==='off'&&stateOn(raw,key)==='off';
  const api={ordinal,normalize,stateOn,withVersion,sharedOff};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.PartnerRoster=api;
})(typeof window!=='undefined'?window:globalThis);
