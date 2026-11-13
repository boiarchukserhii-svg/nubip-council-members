"use strict";
const $=id=>document.getElementById(id), roleNames={chair:"Голова ради",reviewer:"Рецензент"};
const collator=new Intl.Collator("uk",{numeric:true,sensitivity:"base"});
const normalize=value=>String(value??"").toLocaleLowerCase("uk").replace(/[’ʼ`]/g,"'").replace(/\s+/g," ").trim();
const date=value=>new Intl.DateTimeFormat("uk-UA",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Kyiv"}).format(new Date(value+"T12:00:00Z"));
const plural=new Intl.PluralRules("uk");
const word=(n,forms)=>forms[{one:0,few:1,many:2,other:2}[plural.select(n)]];
const labelPeople=n=>`${n} ${word(n,["особа","особи","осіб"])}`;
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
let database, people=[],defenses=new Map(), participationByPerson=new Map(),filtered=[],installPrompt;
$("role").replaceChildren(new Option("Усі ролі",""),new Option("Голова ради","chair"),new Option("Рецензент","reviewer"));
function allowedSource(url){try{const u=new URL(url);return u.protocol==="https:"&&["nubip.edu.ua","www.nubip.edu.ua"].includes(u.hostname);}catch{return false;}}
function validate(data){
 if(!data||data.period!==2026||!["persons","defenses","participation"].every(key=>Array.isArray(data[key])))throw Error("База має некоректний формат.");
 const pids=new Set(data.persons.map(p=>p.person_id)),dids=new Set(data.defenses.map(d=>d.defense_id));
 if(pids.size!==data.persons.length||dids.size!==data.defenses.length||data.persons.some(p=>typeof p.name!=="string")||data.defenses.some(d=>!allowedSource(d.source_url)||!/^2026-\d{2}-\d{2}$/.test(d.date))||data.participation.some(m=>!pids.has(m.person_id)||!dids.has(m.defense_id)||!roleNames[m.role]))throw Error("Порушено зв’язки між особами та радами.");
 return data;
}
async function load(){
 $("error").hidden=$("retry").hidden=true;
 try{
  const response=await fetch("data.json",{cache:"no-cache"});if(!response.ok)throw Error("Не вдалося завантажити базу.");
  database=validate(await response.json());defenses=new Map(database.defenses.map(d=>[d.defense_id,d]));
  participationByPerson=new Map(database.persons.map(p=>[p.person_id,[]]));
  for(const m of database.participation)participationByPerson.get(m.person_id).push({...m,defense:defenses.get(m.defense_id)});
  people=database.persons.map(p=>({...p,memberships:participationByPerson.get(p.person_id)}));
  $("peopleTotal").textContent=people.length;$("councilsTotal").textContent=defenses.size;
  $("chairsTotal").textContent=database.participation.filter(m=>m.role==="chair").length;
  $("reviewersTotal").textContent=database.participation.filter(m=>m.role==="reviewer").length;
  $("specialty").replaceChildren(new Option("Усі спеціальності",""),...Array.from(new Set(database.defenses.map(d=>d.specialty).filter(Boolean))).sort(collator.compare).map(s=>new Option(s,s)));
  $("dataDate").textContent="Базу перевірено "+new Intl.DateTimeFormat("uk-UA",{timeZone:"Europe/Kyiv"}).format(new Date(database.checked_at))+". Оновлення з’являються після завантаження нової версії бази.";
  restoreFilters();render();
 }catch(error){$("error").textContent=error.message+" Перевірте з’єднання та спробуйте знову.";$("error").hidden=$("retry").hidden=false;$("resultCount").textContent="База недоступна";}
}
function restoreFilters(){const params=new URLSearchParams(location.search);for(const id of ["search","role","specialty","sort"]){const value=params.get(id);if(value!==null&&(id==="search"||Array.from($(id).options).some(o=>o.value===value)))$(id).value=value;}}
function saveFilters(){const params=new URLSearchParams();for(const id of ["search","role","specialty","sort"]){const value=$(id).value;if(value&&(id!=="sort"||value!=="name"))params.set(id,value);}history.replaceState(null,"",location.pathname+(params.size?"?"+params:"")+location.hash);}
function matches(person){
 const query=normalize($("search").value),role=$("role").value,specialty=$("specialty").value;
 const tokens=query.split(" ").filter(Boolean);
 return person.memberships.filter(m=>{
  if(role&&m.role!==role||specialty&&m.defense.specialty!==specialty)return false;
  const haystack=normalize([person.name,m.defense.council,m.defense.candidate,m.defense.specialty].join(" "));
  return tokens.every(token=>haystack.includes(token));
 });
}
function tally(memberships){const chair=memberships.filter(m=>m.role==="chair").length;return {chair,reviewer:memberships.length-chair};}
function badges(memberships){const counts=tally(memberships),box=el("div",null,"counts");if(counts.chair)box.append(el("span",`Голова ради · ${counts.chair}`,"badge"));if(counts.reviewer)box.append(el("span",`Рецензент · ${counts.reviewer}`,"badge reviewer"));return box;}
function render(){
 if(!database)return;
 filtered=people.map(person=>({person,memberships:matches(person)})).filter(p=>p.memberships.length);
 filtered.sort((a,b)=>($("sort").value==="count"?b.memberships.length-a.memberships.length:0)||collator.compare(a.person.name,b.person.name));
 $("resultCount").textContent=labelPeople(filtered.length)+" · "+filtered.reduce((sum,p)=>sum+p.memberships.length,0)+" участей";
 $("empty").hidden=filtered.length>0;
 $("people").replaceChildren(...filtered.map(({person,memberships})=>{
  const card=el("button",null,"personCard");card.type="button";card.setAttribute("aria-haspopup","dialog");
  const top=el("div",null,"nameLine"),name=el("span",null,"personName"),parts=person.name.split(" ");
  name.append(el("span",parts[0],"surname"),document.createTextNode(parts.slice(1).join(" ")));
  top.append(name,el("span",parts.slice(0,2).map(p=>p[0]).join(""),"avatar"));
  const codes=Array.from(new Set(memberships.map(m=>m.defense.specialty.split(" ")[0]))).sort(collator.compare);
  const bottom=el("div",null,"cardBottom"),last=memberships.map(m=>m.defense.date).sort().at(-1);
  bottom.append(el("span","Останній захист · "+new Intl.DateTimeFormat("uk-UA").format(new Date(last+"T12:00:00"))),el("strong","Переглянути →"));
  card.append(top,badges(memberships),el("p","Спеціальності: "+codes.join(", "),"specialties"),bottom);
  card.onclick=()=>openProfile(person,memberships);return card;
 }));saveFilters();
}
function openProfile(person,memberships){
 $("profileName").textContent=person.name;
 const limited=memberships.length!==person.memberships.length;
 $("profileScope").textContent=limited?`Показано ${memberships.length} із ${person.memberships.length} участей відповідно до фільтрів.`:"Усі участі цієї особи за 2026 рік.";
 $("profileCounts").replaceChildren(badges(memberships));
 $("participations").replaceChildren(...[...memberships].sort((a,b)=>b.defense.date.localeCompare(a.defense.date)||collator.compare(a.defense.candidate,b.defense.candidate)).map(m=>{
  const d=m.defense,article=el("article",null,"participation"),meta=el("div",null,"meta");
  meta.append(el("span",roleNames[m.role],"badge"+(m.role==="reviewer"?" reviewer":"")),el("span",d.council),el("span",date(d.date)));
  article.append(meta,el("h3",d.candidate),el("p",d.specialty),el("p",d.topic,"topic"),el("p",m.qualifications_source,"qualification"),el("p",m.position_affiliation_source,"position"));
  if(allowedSource(d.source_url)){const link=el("a","Повідомлення про захист ↗","sourceLink");link.href=d.source_url;link.target="_blank";link.rel="noopener noreferrer";article.append(link);}return article;
 }));
 $("profile").showModal();$("profile").scrollTop=0;
}
$("close").onclick=()=>$("profile").close();
$("profile").addEventListener("click",event=>{if(event.target===$("profile")){const r=$("profile").getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$("profile").close();}});
$("search").oninput=render;for(const id of ["role","specialty","sort"])$(id).onchange=render;
$("reset").onclick=()=>{$("search").value=$("role").value=$("specialty").value="";$("sort").value="name";render();};
$("retry").onclick=load;
function offlineStatus(){ $("offlineStatus").textContent=navigator.onLine?"":"Ви без інтернету. Відкрито збережену версію бази.";}
window.addEventListener("online",offlineStatus);window.addEventListener("offline",offlineStatus);offlineStatus();
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("install").hidden=false;});
$("install").onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install").hidden=true;};
window.addEventListener("appinstalled",()=>{$("install").hidden=true;installPrompt=null;});
if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{$("offlineStatus").textContent="Автономне збереження недоступне у цьому браузері.";});
load();
