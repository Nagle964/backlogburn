/* BacklogBurn queue planner. Self-contained: own ids (pl-*), own storage key, no dependency on app.js. */
(function(){
"use strict";
var KEY="backlogburn.planner.v1",MAX_GAMES=200,MAX_HOURS=5000,DEFAULT_WEEKLY=10;
var state={weekly:DEFAULT_WEEKLY,games:[]};

/* ---------- pure logic (exported for tests) ---------- */
function num(v,fb){var n=parseFloat(v);return isFinite(n)?n:fb}
function remaining(g){return Math.max(0,g.hours-g.played)}
function addDays(start,days){var d=new Date(start.getTime());d.setDate(d.getDate()+Math.ceil(days));return d}
/* Games finish in list order. Completed games are skipped. weekly<=0 means no dates. */
function schedule(games,weekly,start){
  var cum=0,out=[];
  games.forEach(function(g){
    if(g.done){out.push({id:g.id,done:true});return}
    var rem=remaining(g);cum+=rem;
    var days=weekly>0?cum/weekly*7:null;
    out.push({id:g.id,rem:rem,cum:cum,days:days,date:days===null?null:addDays(start,days)});
  });
  return{rows:out,totalHours:cum,totalDays:weekly>0?cum/weekly*7:null,
    finish:weekly>0?addDays(start,cum/weekly*7):null};
}
function parseBulk(text){
  var games=[],skipped=[];
  String(text).split(/\r?\n/).forEach(function(line){
    line=line.trim();if(!line)return;
    /* Hours must follow a separator ("Hades, 22") or carry a unit ("Hades 22h"), so titles like "Portal 2" are never misread. */
    var m=line.match(/^(.+?)\s*[,;:\-\u2013\u2014|\t]\s*(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)?$/i)||line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)$/i);
    var name=m&&m[1].replace(/[\s,;:\-\u2013\u2014|]+$/,"").trim(),h=m?parseFloat(m[2]):0;
    if(name&&h>0&&h<=MAX_HOURS)games.push({name:name.slice(0,80),hours:h});else skipped.push(line);
  });
  return{games:games,skipped:skipped};
}
function sanitize(raw){
  var out={weekly:DEFAULT_WEEKLY,games:[]};
  if(!raw||typeof raw!=="object")return out;
  var w=num(raw.weekly,DEFAULT_WEEKLY);out.weekly=w>=0&&w<=168?w:DEFAULT_WEEKLY;
  if(Array.isArray(raw.games))raw.games.slice(0,MAX_GAMES).forEach(function(g,i){
    if(!g||typeof g.name!=="string")return;
    var h=num(g.hours,0);if(!(h>0))return;h=Math.min(h,MAX_HOURS);
    out.games.push({id:String(g.id||("g"+i)),name:g.name.slice(0,80),hours:h,
      played:Math.min(Math.max(num(g.played,0),0),h),done:!!g.done});
  });
  return out;
}
if(typeof module!=="undefined"&&module.exports){module.exports={schedule:schedule,parseBulk:parseBulk,sanitize:sanitize};return}

/* ---------- browser UI ---------- */
var $=function(id){return document.getElementById(id)};
var nextId=Date.now();
var fmtDate=function(d){return d?d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):"Set weekly hours"};
var fmtH=function(n){return Number(n).toLocaleString(undefined,{maximumFractionDigits:1})};
function span(d){
  if(d===null)return"";if(d<1)return"under a day";
  if(d<=70)return Math.ceil(d)+" days";
  if(d<=730)return fmtH(d/7)+" weeks";
  return fmtH(d/365.25)+" years";
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));$("pl-save-note").textContent="Saved in this browser only."}
  catch(e){$("pl-save-note").textContent="Could not save here (private mode or storage blocked). Your list works until you leave the page."}
}
function load(){try{state=sanitize(JSON.parse(localStorage.getItem(KEY)))}catch(e){state=sanitize(null)}}
function msg(t){$("pl-msg").textContent=t||""}

function render(focusSel){
  $("pl-weekly").value=state.weekly;
  var s=schedule(state.games,state.weekly,new Date());
  var list=$("pl-list");list.textContent="";
  var active=state.games.filter(function(g){return!g.done}).length;
  $("pl-empty").hidden=state.games.length>0;
  $("pl-results").hidden=active===0;
  state.games.forEach(function(g,i){
    var r=s.rows[i],li=document.createElement("li");li.className="pl-item"+(g.done?" is-done":"");
    var main=document.createElement("div");main.className="pl-main";
    var n=document.createElement("b");n.textContent=g.name;
    var meta=document.createElement("small");
    meta.textContent=g.done?"Finished":(fmtH(r.rem)+" h left"+(g.played>0?" of "+fmtH(g.hours):""));
    main.appendChild(n);main.appendChild(meta);
    var when=document.createElement("div");when.className="pl-when";
    if(!g.done){var d=document.createElement("strong");d.textContent=r.rem===0?"Today":fmtDate(r.date);
      var sm=document.createElement("small");sm.textContent=r.days===null?"":"in "+span(r.days);
      when.appendChild(d);when.appendChild(sm)}
    var acts=document.createElement("div");acts.className="pl-acts";
    [["up","\u25B2","Move "+g.name+" up",i===0],["down","\u25BC","Move "+g.name+" down",i===state.games.length-1],
     ["done",g.done?"\u21A9":"\u2713",(g.done?"Reopen ":"Mark finished: ")+g.name,false],["del","\u2715","Remove "+g.name,false]]
    .forEach(function(a){var b=document.createElement("button");b.type="button";b.className="pl-btn";
      b.dataset.act=a[0];b.dataset.id=g.id;b.textContent=a[1];b.setAttribute("aria-label",a[2]);b.disabled=a[3];acts.appendChild(b)});
    li.appendChild(main);li.appendChild(when);li.appendChild(acts);list.appendChild(li);
  });
  if(active){
    $("pl-total-h").textContent=fmtH(s.totalHours)+" h";
    $("pl-total-date").textContent=fmtDate(s.finish);
    $("pl-total-span").textContent=s.totalDays===null?"Enter your weekly hours to see dates.":"About "+span(s.totalDays)+" at "+fmtH(state.weekly)+" h/week";
    var body=$("pl-whatif");body.textContent="";
    [0,3,5,10].forEach(function(extra){
      var w=state.weekly+extra;if(!(state.weekly>0))return;
      var days=s.totalHours/w*7,tr=document.createElement("tr");
      var saved=s.totalDays-days;
      [extra===0?"Your current "+fmtH(w)+" h/week":"+"+extra+" h/week ("+fmtH(w)+" total)",fmtDate(addDays(new Date(),days)),
       extra===0?"\u2014":(saved<1?"<1 day sooner":span(saved)+" sooner")].forEach(function(t,k){
        var td=document.createElement(k===0?"th":"td");if(k===0)td.scope="row";td.textContent=t;tr.appendChild(td)});
      body.appendChild(tr);
    });
  }
  if(focusSel){var el=document.querySelector(focusSel);if(el&&!el.disabled)el.focus()}
}

function addGame(name,hours,played){
  if(state.games.length>=MAX_GAMES){msg("The list holds up to "+MAX_GAMES+" games.");return false}
  state.games.push({id:"g"+(nextId++),name:name,hours:hours,played:Math.min(played,hours),done:false});return true;
}
function onAdd(e){
  e.preventDefault();
  var name=$("pl-name").value.trim(),h=num($("pl-hours").value,0),p=Math.max(0,num($("pl-played").value,0));
  if(!name){msg("Enter a game name.");$("pl-name").focus();return}
  if(!(h>0)||h>MAX_HOURS){msg("Enter how many hours the game takes (0.1 to "+MAX_HOURS+").");$("pl-hours").focus();return}
  if(addGame(name.slice(0,80),h,p)){msg("");$("pl-name").value="";$("pl-played").value="";$("pl-name").focus();save();render()}
}
function onBulk(){
  var r=parseBulk($("pl-bulk").value),added=0;
  r.games.forEach(function(g){if(addGame(g.name,g.hours,0))added++});
  msg(added?("Added "+added+" game"+(added===1?"":"s")+(r.skipped.length?". Skipped "+r.skipped.length+" line"+(r.skipped.length===1?"":"s")+" without hours: "+r.skipped.slice(0,3).join("; ")+(r.skipped.length>3?"\u2026":""):"."))
    :"No games found. Use one per line, like: Hades, 22");
  if(added){$("pl-bulk").value="";save();render()}
}
function onList(e){
  var b=e.target.closest("button[data-act]");if(!b)return;
  var id=b.dataset.id,act=b.dataset.act,i=state.games.findIndex(function(g){return g.id===id});if(i<0)return;
  var focus="";
  if(act==="up"&&i>0){state.games.splice(i-1,0,state.games.splice(i,1)[0]);focus='[data-act="up"][data-id="'+id+'"]'}
  else if(act==="down"&&i<state.games.length-1){state.games.splice(i+1,0,state.games.splice(i,1)[0]);focus='[data-act="down"][data-id="'+id+'"]'}
  else if(act==="done"){state.games[i].done=!state.games[i].done;focus='[data-act="done"][data-id="'+id+'"]'}
  else if(act==="del"){state.games.splice(i,1);focus="#pl-name"}
  save();render(focus);
}
function onWeekly(){var w=num($("pl-weekly").value,0);if(w>=0&&w<=168){state.weekly=w;msg("");save();render()}else msg("Weekly hours must be between 0 and 168.")}
function useCalc(){
  var w=num(($("weeklyHours")||{}).value,0),f=num(($("focus")||{}).value,100)/100,e=w*f;
  if(e>=0){state.weekly=Math.round(e*10)/10;save();render();msg("Using "+fmtH(state.weekly)+" h/week from the calculator above.")}
}
function copyPlan(){
  var s=schedule(state.games,state.weekly,new Date()),lines=["My BacklogBurn queue ("+fmtH(state.weekly)+" h/week):"];
  state.games.forEach(function(g,i){var r=s.rows[i];
    lines.push((i+1)+". "+g.name+" ("+fmtH(g.hours)+"h) - "+(g.done?"finished":fmtDate(r.date)))});
  lines.push("Total: "+fmtH(s.totalHours)+" h, clear by "+fmtDate(s.finish),"https://backlogburn.com/#planner");
  var t=lines.join("\n"),ok=function(){msg("Plan copied.")};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,function(){msg("Copy failed. Select the list and copy manually.")});
  else msg("Copy is not available in this browser.");
}
function clearAll(){if(state.games.length&&confirm("Remove all "+state.games.length+" games from your queue?")){state.games=[];msg("");save();render()}}

document.addEventListener("DOMContentLoaded",function(){
  if(!$("planner"))return;
  load();render();
  $("pl-form").addEventListener("submit",onAdd);
  $("pl-bulk-btn").addEventListener("click",onBulk);
  $("pl-list").addEventListener("click",onList);
  $("pl-weekly").addEventListener("change",onWeekly);
  $("pl-use-calc").addEventListener("click",useCalc);
  $("pl-copy").addEventListener("click",copyPlan);
  $("pl-clear").addEventListener("click",clearAll);
  document.querySelectorAll(".pl-chip").forEach(function(c){c.addEventListener("click",function(){$("pl-hours").value=c.dataset.hours;$("pl-hours").focus()})});
});
})();
