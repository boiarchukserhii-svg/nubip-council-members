"use strict";
const CACHE="nubip-council-members-v10-full-width-actions",HOME=new URL("./",self.location).href;
const ASSETS=["./","index.html","styles.css?v=10","app.js","xlsx-export.js","data.json","periods.json","manifest.webmanifest?v=3","icon.svg?v=2","icon-192.png?v=2","icon-512.png?v=2","Zakon-Regular.otf","Zakon-Bold.otf"];
self.addEventListener("install",event=>event.waitUntil((async()=>{await (await caches.open(CACHE)).addAll(ASSETS);await self.skipWaiting();})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith("nubip-council-members-")&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||!url.href.startsWith(HOME))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),key=event.request.mode==="navigate"?HOME:event.request;
  try{
   const response=await fetch(event.request,{cache:"no-cache"});
   if(response.ok&&response.type!=="opaque"){
    if(/\/data(?:-\d{4})?\.json$/.test(url.pathname)){
     const data=await response.clone().json();if(!Number.isInteger(data.period)||![data.persons,data.defenses,data.participation].every(Array.isArray))throw Error("Invalid data");
    }
    await cache.put(key,response.clone());
   }
   if(!response.ok){const saved=await cache.match(key);if(saved)return saved;}
   return response;
  }catch{return (await cache.match(key))??Response.error();}
 })());
});
