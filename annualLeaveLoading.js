// PTA/RTBU exchange of letters dated 3 August 2026, Attachment A.
// The attachment applies from the operational-roster change on 23 August.
window.AnnualLeaveLoading = (() => {
  'use strict';
  const effective='2026-08-23';
  const percentages=Object.freeze({STO3:.2879,STO2:.2894,STO1:.2910,FCO:.3130,TO5:.3138,TO4:.3158,TO3:.3178,TO2:.3197,TO1:.3217,TRAINEE:.20});
  const round=value=>Math.round((value+Number.EPSILON)*100)/100;
  const capFor=(year,hours=200,fraction=1)=>Number(year)===2026
    ? round(2648.49*fraction*Math.max(1,hours/(200*fraction))) : null;
  function resolve(settings,date,commencementDate=date){
    if(date<effective)return null;
    // No inferred STO3 fallback when the employee has not selected a level.
    if(!settings.classification&&!settings.employmentRole)return {error:'Select a substantive classification for annual leave loading.'};
    const agreement=window.PTA_AGREEMENT;
    if(!agreement)return {error:'Agreement data is unavailable for annual leave loading.'};
    const resolved=agreement.resolve(settings,date),classification=String(resolved.classification||'').toUpperCase();
    const percentage=percentages[classification];
    if(percentage==null)return {error:'Annual leave loading is unavailable for this substantive classification.'};
    const baseRate=resolved.baseRate;
    if(!(baseRate>0))return {error:'A substantive base rate is required for annual leave.'};
    const fraction=Math.min(1,Math.max(0,Number(settings.employmentFraction??1)));
    if(!fraction)return {error:'Enter an employment fraction greater than zero.'};
    const year=Number(commencementDate.slice(0,4)),cap=capFor(year,200*fraction,fraction);
    const hourlyLoading=baseRate*percentage;
    // Proportional entitlement cap: same cap/hour for full-time and part-time.
    const payableRate=cap==null?hourlyLoading:Math.min(hourlyLoading,2648.49/200);
    return {classification,baseRate,percentage,hourlyLoading,payableRate,year,fraction,cap,
      source:'PTA/RTBU MOU 3 August 2026, effective 23 August 2026',
      capped:payableRate<hourlyLoading};
  }
  return {effective,percentages,round,capFor,resolve};
})();
