
window.AppStorage = (() => {
  const CURRENT='ptaV2Current';
  const CYCLES='ptaV2Cycles';
  const PARTNER='ptaV2PartnerRoster';
  const loadJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  return {
    loadCurrent:()=>loadJSON(CURRENT,null),
    saveCurrent:data=>localStorage.setItem(CURRENT,JSON.stringify(data)),
    loadCycles:()=>loadJSON(CYCLES,[]),
    saveCycles:data=>localStorage.setItem(CYCLES,JSON.stringify(data)),
    loadPartnerRoster:()=>loadJSON(PARTNER,null),
    savePartnerRoster:data=>{if(data===null)localStorage.removeItem(PARTNER);else localStorage.setItem(PARTNER,JSON.stringify(data))},
    clearAll:()=>{localStorage.removeItem(CURRENT);localStorage.removeItem(CYCLES);localStorage.removeItem(PARTNER)}
  };
})();
