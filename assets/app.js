const $ = (s)=>document.querySelector(s);
const fmt = (n,d=1)=>Number(n).toLocaleString(undefined,{maximumFractionDigits:d});
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

function readNum(id, fallback=0){
  const el=document.getElementById(id);
  if(!el) return fallback;
  const n=parseFloat(el.value);
  return Number.isFinite(n)?n:fallback;
}
function setText(id,val){ const el=document.getElementById(id); if(el) el.textContent=val; }

function monthsToText(months){
  if(!Number.isFinite(months)) return "Never at this pace";
  if(months < 1) return `${Math.max(1,Math.round(months*4.345))} weeks`;
  if(months < 24) return `${fmt(months,1)} months`;
  const years=months/12;
  return `${fmt(years,1)} years`;
}
function dateFromMonths(months){
  if(!Number.isFinite(months) || months>1200) return "No clear date";
  const d=new Date();
  d.setDate(d.getDate()+Math.round(months*30.4375));
  return d.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});
}
function calculate(){
  const games=Math.max(0,readNum("games",40));
  const avgHours=Math.max(.1,readNum("avgHours",18));
  const weeklyHours=Math.max(.1,readNum("weeklyHours",10));
  const focus=clamp(readNum("focus",80),0,100)/100;
  const progress=clamp(readNum("progress",0),0,99)/100;
  const newGames=Math.max(0,readNum("newGames",1));
  const newAvg=Math.max(.1,readNum("newAvg",avgHours));

  const remainingCurrentHours=games*avgHours*(1-progress);
  const effectiveWeek=weeklyHours*focus;
  const effectiveMonth=effectiveWeek*52.1775/12;
  const incomingMonth=newGames*newAvg;
  const netClearHours=effectiveMonth-incomingMonth;
  const gamesPerMonth=effectiveMonth/avgHours;
  const gamesPerYear=gamesPerMonth*12;
  const sustainablePurchases=effectiveMonth/newAvg;
  const currentMonths=remainingCurrentHours/effectiveMonth;
  const netMonths=netClearHours>0 ? remainingCurrentHours/netClearHours : Infinity;
  const growthHours=netClearHours<0 ? Math.abs(netClearHours) : 0;
  const growthGames=growthHours/avgHours;

  setText("rHours",`${fmt(remainingCurrentHours,0)} h`);
  setText("rEff",`${fmt(effectiveWeek,1)} h/week`);
  setText("rGamesMonth",`${fmt(gamesPerMonth,2)}/month`);
  setText("rGamesYear",`${fmt(gamesPerYear,1)}/year`);
  setText("rIncoming",`${fmt(incomingMonth,1)} h/month`);
  setText("rMaxBuy",`${fmt(sustainablePurchases,2)} games/month`);
  setText("rNoBuy",monthsToText(currentMonths));
  setText("rClear",monthsToText(netMonths));
  setText("rDate",dateFromMonths(netMonths));

  const status=document.getElementById("status");
  status.className="status";
  if(netClearHours>effectiveMonth*0.25){
    status.classList.add("good");
    status.innerHTML=`<strong>Your backlog is shrinking.</strong><p>At your current habits you remove about <b>${fmt(netClearHours,1)} backlog hours per month</b> after new purchases. Estimated clear date: <b>${dateFromMonths(netMonths)}</b>.</p>`;
  }else if(netClearHours>0){
    status.classList.add("warn");
    status.innerHTML=`<strong>You are clearing it — barely.</strong><p>You are only reducing the backlog by about <b>${fmt(netClearHours,1)} hours per month</b>. A small increase in buying or a drop in playtime could make it grow again.</p>`;
  }else{
    status.classList.add("bad");
    status.innerHTML=`<strong>At this pace, your backlog never clears.</strong><p>You add about <b>${fmt(growthHours,1)} more hours</b> than you clear each month — roughly <b>${fmt(growthGames,2)} average games</b>. Buy fewer than <b>${fmt(sustainablePurchases,2)} games/month</b>, play more, or devote more of your gaming time to the backlog.</p>`;
  }

  const ratio = effectiveMonth>0 ? clamp((netClearHours/effectiveMonth)*100,0,100):0;
  document.getElementById("paceBar").style.width=`${ratio}%`;
  setText("paceLabel", netClearHours>0 ? `${fmt(netClearHours,1)} net hours cleared each month` : `${fmt(growthHours,1)} net hours added each month`);

  const noBuyMonths=remainingCurrentHours/effectiveMonth;
  const extraWeek=(weeklyHours+5)*focus*52.1775/12;
  const extraNet=extraWeek-incomingMonth;
  setText("sNoBuy",monthsToText(noBuyMonths));
  setText("sCurrent",monthsToText(netMonths));
  setText("sPlus5",monthsToText(extraNet>0?remainingCurrentHours/extraNet:Infinity));

  const params=new URLSearchParams({games,avgHours,weeklyHours,focus:Math.round(focus*100),progress:Math.round(progress*100),newGames,newAvg});
  history.replaceState(null,"",`${location.pathname}?${params.toString()}`);
}

function loadParams(){
  const q=new URLSearchParams(location.search);
  ["games","avgHours","weeklyHours","focus","progress","newGames","newAvg"].forEach(k=>{
    if(q.has(k) && document.getElementById(k)) document.getElementById(k).value=q.get(k);
  });
}
function copyLink(){
  navigator.clipboard?.writeText(location.href).then(()=>{
    const b=document.getElementById("copyBtn");
    const old=b.textContent;b.textContent="Copied";
    setTimeout(()=>b.textContent=old,1200);
  });
}
document.addEventListener("DOMContentLoaded",()=>{
  loadParams();
  document.querySelectorAll("#calculator input,#calculator select").forEach(el=>el.addEventListener("input",calculate));
  const b=document.getElementById("copyBtn"); if(b) b.addEventListener("click",copyLink);
  calculate();
});
