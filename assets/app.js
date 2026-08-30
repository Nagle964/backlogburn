const $ = (s)=>document.querySelector(s);
const fmt = (n,d=1)=>Number(n).toLocaleString(undefined,{maximumFractionDigits:d});
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const DEFAULTS={games:40,avgHours:20,weeklyHours:10,focus:80,progress:0,newGames:1,newAvg:20};
let newAverageIsSynced=true;
let hasCalculated=false;
function readNum(id,fallback=0){const el=document.getElementById(id);if(!el)return fallback;const n=parseFloat(el.value);return Number.isFinite(n)?n:fallback}
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val}
function monthsToText(months){if(!Number.isFinite(months))return"Never at this pace";if(months<1)return`${Math.max(1,Math.round(months*4.345))} weeks`;if(months<24)return`${fmt(months,1)} months`;return`${fmt(months/12,1)} years`}
function dateFromMonths(months){if(!Number.isFinite(months)||months>1200)return"Never";const d=new Date();d.setDate(d.getDate()+Math.round(months*30.4375));return d.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"})}
function signed(n,d=1,suffix=""){const sign=n>0?"+":n<0?"−":"";return`${sign}${fmt(Math.abs(n),d)}${suffix}`}
function updateFocusOutput(){setText("focusValue",`${Math.round(readNum("focus",80))}%`)}
function updatePresetState(){const hours=readNum("avgHours",20);document.querySelectorAll(".preset").forEach(btn=>btn.classList.toggle("active",Number(btn.dataset.hours)===hours))}
function setDirty(){if(!hasCalculated)return;setText("dirtyNote","Inputs changed — calculate again for a fresh forecast.")}
function clearDirty(){setText("dirtyNote","")}
function syncNewAverage(){if(newAverageIsSynced){const avg=document.getElementById("avgHours"),newAvg=document.getElementById("newAvg");if(avg&&newAvg)newAvg.value=avg.value}}
function buildResultData(){
 const games=Math.max(0,readNum("games",DEFAULTS.games));
 const avgHours=Math.max(.1,readNum("avgHours",DEFAULTS.avgHours));
 const weeklyHours=Math.max(.1,readNum("weeklyHours",DEFAULTS.weeklyHours));
 const focus=clamp(readNum("focus",DEFAULTS.focus),0,100)/100;
 const progress=clamp(readNum("progress",DEFAULTS.progress),0,99)/100;
 const newGames=Math.max(0,readNum("newGames",DEFAULTS.newGames));
 const newAvg=Math.max(.1,readNum("newAvg",avgHours));
 const remainingCurrentHours=games*avgHours*(1-progress);
 const effectiveWeek=weeklyHours*focus;
 const effectiveMonth=effectiveWeek*52.1775/12;
 const incomingMonth=newGames*newAvg;
 const netClearHours=effectiveMonth-incomingMonth;
 const gamesPerMonth=effectiveMonth/avgHours;
 const gamesPerYear=gamesPerMonth*12;
 const gamesAddedYear=newGames*12;
 const netGamesYear=gamesPerYear-gamesAddedYear;
 const sustainablePurchases=effectiveMonth/newAvg;
 const noBuyMonths=remainingCurrentHours/effectiveMonth;
 const netMonths=netClearHours>0?remainingCurrentHours/netClearHours:Infinity;
 const growthHours=netClearHours<0?Math.abs(netClearHours):0;
 const extraWeek=(weeklyHours+5)*focus*52.1775/12;
 const extraNet=extraWeek-incomingMonth;
 const extraMonths=extraNet>0?remainingCurrentHours/extraNet:Infinity;
 const balanceRatio=effectiveMonth>0?clamp(netClearHours/effectiveMonth,-1,1):-1;
 const marker=50+(balanceRatio*45);
 return{games,avgHours,weeklyHours,focus,progress,newGames,newAvg,remainingCurrentHours,effectiveWeek,effectiveMonth,incomingMonth,netClearHours,gamesPerMonth,gamesPerYear,gamesAddedYear,netGamesYear,sustainablePurchases,noBuyMonths,netMonths,growthHours,extraMonths,marker}
}
function render(data){
 const{remainingCurrentHours,effectiveWeek,incomingMonth,netClearHours,gamesPerYear,gamesAddedYear,netGamesYear,sustainablePurchases,noBuyMonths,netMonths,growthHours,extraMonths,marker}=data;
 setText("rHours",`${fmt(remainingCurrentHours,0)} h`);
 setText("rEff",`${fmt(effectiveWeek,1)} h/week`);
 setText("rGamesYear",`${fmt(gamesPerYear,1)}`);
 setText("rGamesAddedYear",`${fmt(gamesAddedYear,1)}`);
 setText("rNetGames",`${signed(netGamesYear,1)} /yr`);
 setText("rIncoming",`${fmt(incomingMonth,1)} h/mo`);
 setText("rMaxBuy",`${fmt(sustainablePurchases,2)} games/mo`);
 setText("rClear",monthsToText(netMonths));
 setText("rDate",dateFromMonths(netMonths));
 setText("sNoBuy",monthsToText(noBuyMonths));
 setText("sCurrent",monthsToText(netMonths));
 setText("sPlus5",monthsToText(extraMonths));
 const status=document.getElementById("status"),icon=document.getElementById("statusIcon"),eyebrow=document.getElementById("statusEyebrow"),title=document.getElementById("statusTitle"),copy=document.getElementById("statusCopy"),burnLabel=document.getElementById("burnLabel"),burnDelta=document.getElementById("burnDelta"),markerEl=document.getElementById("burnMarker");
 status.className="result-hero";
 if(netClearHours>data.effectiveMonth*.25){status.classList.add("good");icon.textContent="🔥";eyebrow.textContent="BACKLOG STATUS · HEALTHY";title.textContent="You might actually finish your backlog.";copy.textContent=`You are clearing about ${fmt(netClearHours,1)} more backlog hours than you add each month. Apparently this is possible.`;burnLabel.textContent="Shrinking";burnDelta.textContent=`${fmt(netClearHours,1)} net hours cleared/month`}
 else if(netClearHours>0){status.classList.add("warn");icon.textContent="😅";eyebrow.textContent="BACKLOG STATUS · CLOSE CALL";title.textContent="You are winning — barely.";copy.textContent=`Your backlog is shrinking by only ${fmt(netClearHours,1)} hours a month. One ambitious sale could change the result.`;burnLabel.textContent="Barely shrinking";burnDelta.textContent=`${fmt(netClearHours,1)} net hours cleared/month`}
 else{status.classList.add("bad");icon.textContent="♾️";eyebrow.textContent="BACKLOG STATUS · IMMORTAL";title.textContent="Your backlog is immortal.";copy.textContent=`You add about ${fmt(growthHours,1)} more hours than you clear each month. At this pace there is no mathematical finish date. Maybe stop opening Steam sales.`;burnLabel.textContent="Growing";burnDelta.textContent=`${fmt(growthHours,1)} net hours added/month`}
 markerEl.style.left=`${marker}%`;
 const params=new URLSearchParams({games:data.games,avgHours:data.avgHours,weeklyHours:data.weeklyHours,focus:Math.round(data.focus*100),progress:Math.round(data.progress*100),newGames:data.newGames,newAvg:data.newAvg});
 history.replaceState(null,"",`${location.pathname}?${params.toString()}`);
 hasCalculated=true;clearDirty()
}
function calculate({scroll=false}={}){syncNewAverage();updateFocusOutput();updatePresetState();render(buildResultData());if(scroll&&window.innerWidth<901)document.getElementById("forecast")?.scrollIntoView({behavior:"smooth",block:"start"})}
function loadParams(){const q=new URLSearchParams(location.search);["games","avgHours","weeklyHours","focus","progress","newGames","newAvg"].forEach(k=>{if(q.has(k)&&document.getElementById(k))document.getElementById(k).value=q.get(k)});if(q.has("newAvg"))newAverageIsSynced=false}
function copyLink(){const success=()=>{const b=document.getElementById("copyBtn");if(!b)return;const old=b.textContent;b.textContent="✓ Link copied";setTimeout(()=>b.textContent=old,1400)};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(location.href).then(success);else{const temp=document.createElement("textarea");temp.value=location.href;document.body.appendChild(temp);temp.select();document.execCommand("copy");temp.remove();success()}}
function resetCalculator(){Object.entries(DEFAULTS).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value});newAverageIsSynced=true;document.getElementById("advancedSettings")?.removeAttribute("open");calculate()}
document.addEventListener("DOMContentLoaded",()=>{
 loadParams();updateFocusOutput();updatePresetState();
 document.querySelectorAll(".preset").forEach(btn=>btn.addEventListener("click",()=>{document.getElementById("avgHours").value=btn.dataset.hours;syncNewAverage();updatePresetState();setDirty()}));
 document.querySelectorAll("#calculator input,#calculator select").forEach(el=>el.addEventListener("input",()=>{if(el.id==="focus")updateFocusOutput();if(el.id==="avgHours"){syncNewAverage();updatePresetState()}if(el.id==="newAvg")newAverageIsSynced=false;setDirty()}));
 document.getElementById("calculateBtn")?.addEventListener("click",()=>calculate({scroll:true}));
 document.getElementById("copyBtn")?.addEventListener("click",copyLink);
 document.getElementById("resetBtn")?.addEventListener("click",resetCalculator);
 calculate()
});