'use strict';
/* Referenzdaten aus dem lokalen Snapshot der Empire-Universe-Datenbank.
   Keine Accounts/API-Tokens, kein externer Dienst im laufenden Betrieb. */
(() => {
  const $ = id => document.getElementById(id);
  const catalogPath='../datenbank/referenzdaten.json';
  const legacyIds={
    'cargo-s':'cargos','cargo-m':'cargom','cargo-xl':'cargoXL','cargo-xl230':'cargoXL230',
    'cargo-xl270':'cargoXL270','cargo-mini':'cargoMini','cargo-jumbo':'cargoJumbo',
    'cargo-xyrrh':'cargoMiniXyrrh',
    'laser-i':'laserExtractionAsteroid','laser-ii':'laserExtractionAsteroid2',
    'laser-mini':'laserExtractionMini','laser-jumbo':'laserExtractionJumbo',
    'laser-nemoryx':'laserExtractionMiniNemoryx'
  };
  const translations={
    cargos:'Fracht S',cargom:'Fracht M',cargoL:'Fracht L',cargoXL:'Fracht XL',
    cargoXL230:'Fracht XL-230',cargoXL270:'Fracht XL-270',cargoMini:'Mini-Fracht',
    cargoJumbo:'Jumbo-Fracht',cargoAlienArtefact:'Alien-Artefakt-Fracht',
    cargoMiniXyrrh:'Verbesserter Mini-Frachtraum – Xyrrh',
    laserExtractionAsteroid:'Asteroiden-Laser I',
    laserExtractionAsteroid2:'Asteroiden-Laser II',
    laserExtractionAsteroid3:'Asteroiden-Laser III',
    laserExtractionMini:'Mini-Asteroiden-Laser',
    laserExtractionJumbo:'Jumbo-Asteroiden-Laser',
    laserExtractionMiniNemoryx:'Verbesserter Mini-Asteroidenextraktor – Nemoryx',
    moduleLaserExtractSystemAlienArtefact:'Alien-Artefakt-Extraktionslaser'
  };
  const nav=document.querySelector('header nav.navigation');
  if(nav) {
    const a=document.createElement('a');a.href='../datenbank/';a.textContent='Spieldatenbank ↗';nav.append(a);
  }
  const addButton=$('addModule');
  if(!addButton)return;
  const importButton=document.createElement('button');
  importButton.className='btn';importButton.type='button';importButton.id='loadDatabaseModules';
  importButton.textContent='Mining-Module aus Datenbank übernehmen';
  addButton.after(importButton);
  const note=document.createElement('p');note.className='help';
  note.textContent='Datenbank-Abgleich: übernimmt die offiziellen Slot-, Fracht- und Extraktionswerte; vorhandene Modulbestände und Häkchen bleiben erhalten. Neue Module werden zunächst deaktiviert.';
  importButton.parentElement.after(note);
  const shipField=document.createElement('div');shipField.className='field';
  const label=document.createElement('label');label.htmlFor='referenceShip';label.textContent='Schiffstyp aus Datenbank (optional)';
  const shipSelect=document.createElement('select');shipSelect.id='referenceShip';shipSelect.append(new Option('Manuelle Slotanzahl',''));
  const shipHint=document.createElement('small');shipHint.id='referenceShipHint';
  shipHint.textContent='Auswahl übernimmt die offiziellen Slots. Die Schiffsanzahl bleibt unverändert.';
  shipField.append(label,shipSelect,shipHint);
  $('slots').closest('.field').before(shipField);

  let snapshot=null;
  async function readCatalog(){
    if(snapshot)return snapshot;
    const response=await fetch(catalogPath,{cache:'force-cache'});
    if(!response.ok)throw new Error('Referenzdaten konnten nicht geladen werden (HTTP '+response.status+').');
    const json=await response.json();
    if(!json?.catalogs?.modules?.modules||!json?.catalogs?.ships?.ships)throw new Error('Ungültiger Referenzdatenexport.');
    snapshot=json;return snapshot;
  }
  function translate(id,name){return translations[id]||name||id;}
  function raceOf(record){
    const required=String(record.raceRequired||'').toLowerCase();
    if(required==='nemoryx'||required==='xyrrh')return required;
    // Der Flottenoptimierer bietet derzeit keine weiteren Rassenfilter.
    return 'all';
  }
  function toOptimizerModule(id,source,existing=null,activate=false){
    const slots=Number(source.emplacement);
    const cargo=Number(source.modifier?.cargo||0);
    const extraction=Number(source.modifier?.extraction_asteroid||0);
    if(!Number.isInteger(slots)||slots<=0||!Number.isFinite(cargo)||!Number.isFinite(extraction))
      throw new Error('Ungültige Werte für Modul '+id);
    if(cargo<=0&&extraction<=0)return null;
    return {
      id,
      name:translate(id,source.name),
      slots,cargo,extraction,
      enabled:existing?Boolean(existing.enabled):activate,
      maxCount:existing?.maxCount??null,
      race:raceOf(source)
    };
  }
  function equivalent(id){return legacyIds[id]||id;}
  function mergeModules(catalog,{oneId=null}={}){
    const known=new Map(modules.map(item=>[equivalent(item.id),item]));
    const result=[];
    const source=catalog.catalogs.modules.modules;
    const ids=oneId?[oneId]:Object.keys(source).filter(id=>{
      const effect=source[id].modifier||{};
      return Number(effect.cargo||0)>0||Number(effect.extraction_asteroid||0)>0;
    });
    let inserted=0,updated=0;
    if(oneId){
      if(!source[oneId])throw new Error('Modul nicht in der Datenbank gefunden: '+oneId);
      for(const old of modules){
        if(equivalent(old.id)!==oneId)result.push(old);
      }
      const old=known.get(oneId);
      const item=toOptimizerModule(oneId,source[oneId],old,true);
      if(!item)throw new Error('Dieses Modul besitzt keine Fracht- oder Asteroidenabbauwerte.');
      if(!old)item.enabled=true;
      result.push(item);inserted=old?0:1;updated=old?1:0;
    }else{
      const added=new Set();
      for(const old of modules){
        const id=equivalent(old.id);
        const def=source[id];
        if(!def || added.has(id)){if(!added.has(id))result.push(old);continue;}
        const mapped=toOptimizerModule(id,def,old);
        if(mapped){result.push(mapped);updated++;}
        else result.push(old);
        added.add(id);
      }
      for(const id of ids){
        if(added.has(id))continue;
        const item=toOptimizerModule(id,source[id]);
        if(item){result.push(item);inserted++;}
      }
    }
    if(result.length>100)throw new Error('Zu viele Module für den Optimierer.');
    modules=result;
    renderModules();dirty();
    return {inserted,updated};
  }
  function announce(message,error=false){
    const status=$('status');
    status.textContent=message;
    status.classList.toggle('error',error);
  }
  importButton.addEventListener('click',async()=>{
    importButton.disabled=true;
    importButton.textContent='Lade Referenzdaten …';
    try{
      const database=await readCatalog();
      const changes=mergeModules(database);
      announce('Datenbank-Abgleich abgeschlossen: '+changes.updated+' bestehende Module aktualisiert, '+changes.inserted+' neue Module ergänzt. Neue Module sind zunächst deaktiviert.');
    }catch(error){announce('Datenbank-Abgleich fehlgeschlagen: '+error.message,true);}
    finally{importButton.disabled=false;importButton.textContent='Mining-Module aus Datenbank übernehmen';}
  });

  function initializeShips(db){
    const entries=Object.entries(db.catalogs.ships.ships).filter(([,s])=>Number(s.emplacement)>0&&Number(s.emplacement)<=500);
    entries.sort((a,b)=>a[1].emplacement-b[1].emplacement);
    for(const [id,ship] of entries)shipSelect.append(new Option(ship.name+' · '+ship.emplacement+' Slots · '+ship.pa+' PA',id));
    const existing=Number($('slots').value);
    const match=entries.find(([,ship])=>ship.emplacement===existing);
    if(match)shipSelect.value=match[0];
    shipSelect.addEventListener('change',()=>{
      const ship=db.catalogs.ships.ships[shipSelect.value];if(!ship)return;
      $('slots').value=ship.emplacement;
      renderModules();dirty();
      shipHint.textContent=ship.name+': '+ship.emplacement+' Slots, '+ship.pa+' Baupunkte (PA) pro Schiff. Reservierte Slots bleiben unverändert.';
    });
    $('slots').addEventListener('input',()=>{shipSelect.value='';shipHint.textContent='Manuelle Slotanzahl – Schiffstyp nicht automatisch festgelegt.';});
  }
  readCatalog().then(async db=>{
    initializeShips(db);
    const id=new URL(location.href).searchParams.get('datenbankmodul');
    if(id){
      const {inserted,updated}=mergeModules(db,{oneId:id});
      const url=new URL(location.href);url.searchParams.delete('datenbankmodul');
      history.replaceState(null,'',url.pathname+url.search+url.hash);
      announce('Modul „'+translate(id,db.catalogs.modules.modules[id]?.name)+'“ aus der Datenbank übernommen ('+(inserted?'neu':'aktualisiert')+').');
      $('moduleRows').scrollIntoView({block:'start'});
    }
  }).catch(error=>{shipHint.textContent='Datenbank nicht erreichbar: '+error.message;});
})();
