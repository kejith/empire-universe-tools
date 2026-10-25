'use strict';
// Datenbank-Verlinkung: Stammdaten (17 Mining/Fracht-Module und Schiffstypen)
// sind bereits im Optimierer eingebettet. Kein Netzwerkladen beim Seitenstart.
(() => {
  const nav=document.querySelector('header nav.navigation');
  if(nav){
    const a=document.createElement('a');
    a.href='../datenbank/';
    a.textContent='Spieldatenbank ↗';
    nav.append(a);
  }
  const id=new URL(location.href).searchParams.get('datenbankmodul');
  if(!id)return;
  function finish(){
    const link=new URL(location.href);
    link.searchParams.delete('datenbankmodul');
    history.replaceState(null,'',link.pathname+link.search+link.hash);
  }
  const existing=modules.find(m=>m.id===id);
  if(existing){
    existing.enabled=true;
    switchModuleTab(Number(existing.extraction)>0?'laser':'cargo');
    dirty();
    document.getElementById('status').textContent='„'+existing.name+'“ aus der Datenbank aktiviert.';
    finish();
    return;
  }
  // Sondermodule außerhalb des permanenten Fracht-/Laser-Katalogs
  // werden nur bei ausdrücklichem Aufruf aus der Datenbank geladen.
  fetch('../datenbank/referenzdaten.json').then(response=>{
    if(!response.ok)throw new Error('Datenbank nicht erreichbar.');
    return response.json();
  }).then(json=>{
    const entry=json.catalogs?.modules?.modules?.[id];
    if(!entry)throw new Error('Das Modul wurde nicht in der Datenbank gefunden.');
    const cargo=Number(entry.modifier?.cargo||0);
    const extraction=Number(entry.modifier?.extraction_asteroid||0);
    if(cargo<=0&&extraction<=0)throw new Error('Keine Fracht- oder Asteroidenextraktion vorhanden.');
    const race=String(entry.raceRequired||'all').toLowerCase();
    if(!['all','nemoryx','xyrrh'].includes(race))
      throw new Error('Dieses Rassenmodul kann im Optimierer derzeit nicht korrekt gefiltert werden.');
    modules.push({id,name:entry.name,slots:entry.emplacement,cargo,extraction,enabled:true,race,maxCount:null});
    switchModuleTab(extraction>0?'laser':'cargo');
    dirty();
    document.getElementById('status').textContent='„'+entry.name+'“ zusätzlich aus der Datenbank übernommen.';
    finish();
  }).catch(error=>{
    const status=document.getElementById('status');
    status.textContent='Datenbankmodul: '+error.message;
    status.classList.add('error');
  });
})();
