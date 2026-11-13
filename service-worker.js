"use strict";
const CACHE="nubip-council-members-v1",HOME=new URL("./",self.location).href;
const ASSETS=["./","index.html","styles.css","app.js","data.json","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png","Zakon-Regular.otf","Zakon-Bold.otf"];
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
    if(url.pathname.endsWith("/data.json")){
     const data=await response.clone().json();if(data.period!==2026||![data.persons,data.defenses,data.participation].every(Array.isArray))throw Error("Invalid data");
    }
    await cache.put(key,response.clone());
   }
   if(!response.ok){const saved=await cache.match(key);if(saved)return saved;}
   return response;
  }catch{return (await cache.match(key))??Response.error();}
 })());
});
