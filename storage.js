
window.AppStorage = (() => {
  const CURRENT='ptaV2Current';
  const CYCLES='ptaV2Cycles';
  const PARTNER='ptaV2PartnerRoster';
  const loadJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  // TEST 2.8.3 used the suffix form. Normalise it when reading drafts or backups.
  const canonicalAdminCode=code=>code==='ARM-ADMIN'?'AD-ARM':code==='PER-ADMIN'?'AD-PER':code;
  const normaliseAdminCodes=cycle=>{
    if(Array.isArray(cycle?.days)){
      for(const row of cycle.days){
        if(typeof row?.code==='string')row.code=canonicalAdminCode(row.code);
        if(typeof row?.offlineShiftCode==='string')row.offlineShiftCode=canonicalAdminCode(row.offlineShiftCode);
      }
    }
    return cycle;
  };
  return {
    loadCurrent:()=>normaliseAdminCodes(loadJSON(CURRENT,null)),
    saveCurrent:data=>localStorage.setItem(CURRENT,JSON.stringify(data)),
    loadCycles:()=>loadJSON(CYCLES,[]).map(normaliseAdminCodes),
    saveCycles:data=>localStorage.setItem(CYCLES,JSON.stringify(data)),
    loadPartnerRoster:()=>loadJSON(PARTNER,null),
    savePartnerRoster:data=>{if(data===null)localStorage.removeItem(PARTNER);else localStorage.setItem(PARTNER,JSON.stringify(data))},
    clearAll:()=>{localStorage.removeItem(CURRENT);localStorage.removeItem(CYCLES);localStorage.removeItem(PARTNER)}
  };
})();
