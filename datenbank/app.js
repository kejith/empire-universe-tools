'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const number = new Intl.NumberFormat('de-DE');
  const categoryNames = {cargo:'Fracht',engine:'Antrieb',defense:'Verteidigung',weapon:'Waffen',other:'Sonstige',construction:'Konstruktion',normal:'Allgemein'};
  const buildingNames = {
    COMMUNICATION:'Kommunikationszentrum',FACTORY:'Fabrik',MINES:'Minen',RESEARCH:'Forschung',
    SHIP_BUILDER:'Schiffswerft',SPATIOPORT:'Raumhafen',HANGAR:'Hangar',SPYING:'Spionage',
    STORAGE:'Lager',POWER:'Energie',DEFENSE:'Verteidigung'
  };
  const miningModuleNames = {
    cargos:'Fracht S',cargom:'Fracht M',cargoL:'Fracht L',cargoXL:'Fracht XL',
    cargoXL230:'Fracht XL-230',cargoXL270:'Fracht XL-270',cargoMini:'Mini-Fracht',
    cargoJumbo:'Jumbo-Fracht',cargoAlienArtefact:'Alien-Artefakt-Fracht',
    laserExtractionAsteroid:'Asteroiden-Laser I',
    laserExtractionAsteroid2:'Asteroiden-Laser II',
    laserExtractionAsteroid3:'Asteroiden-Laser III',
    laserExtractionMini:'Mini-Asteroiden-Laser',
    laserExtractionJumbo:'Jumbo-Asteroiden-Laser',
    moduleLaserExtractSystemAlienArtefact:'Alien-Artefakt-Extraktionslaser',
    laserExtractionMiniNemoryx:'Verbesserter Mini-Asteroidenextraktor – Nemoryx',
    cargoMiniXyrrh:'Verbesserter Mini-Frachtraum – Xyrrh'
  };
  const types = ['modules','ships','research','buildings','constants'];
  let data, items=[], selected=null, catalog='modules';
  const el = (tag,className,text) => {
    const result=document.createElement(tag);
    if(className) result.className=className;
    if(text!==undefined)result.textContent=text;
    return result;
  };
  const addText = (parent,tag,className,text) => parent.appendChild(el(tag,className,text));
  const fmt = value => typeof value==='number'?number.format(value):String(value ?? '–');
  const classification = type => categoryNames[type]||type||'—';
  const isMiningModule = m => m && (Number(m.modifier?.cargo||0)>0 || Number(m.modifier?.extraction_asteroid||0)>0);
  const customTitle = record => catalog==='modules' ? (miningModuleNames[record.id]||record.data.name||record.id) : record.name;
  function recordsFor(type) {
    const ds = data.catalogs[type];
    if(type==='modules')return Object.entries(ds.modules).map(([id,value])=>({id,name:value.name,data:value,type:value.type||'other',catalog:type}));
    if(type==='ships')return Object.entries(ds.ships).map(([id,value])=>({id,name:value.name,data:value,type:value.classType||'Schiff',catalog:type}));
    if(type==='research')return ds.research.map((value,i)=>({id:value.id||String(i),name:value.name||value.id||String(i),data:value,type:value.type||'other',catalog:type}));
    if(type==='buildings')return Object.entries(ds.buildings).map(([id,value])=>({id,name:buildingNames[id]||id,data:value,type:'Gebäude',catalog:type}));
    return Object.entries(ds).filter(([key])=>key!=='schemaVersion').map(([id,value])=>({id,name:({mining:'Bergbau',construction:'Konstruktion',combat:'Kampf'}[id]||id),data:value,type:'Konstanten',catalog:type}));
  }
  function initialState() {
    const args=new URLSearchParams(location.search);
    const t=args.get('typ');if(types.includes(t)) catalog=t;
    selected=args.get('id');
    return args.get('suche')||'';
  }
  function updateQuery() {
    const url=new URL(location.href);
    url.searchParams.set('typ',catalog);
    if(selected)url.searchParams.set('id',selected);else url.searchParams.delete('id');
    const search=$('search').value.trim();
    if(search)url.searchParams.set('suche',search);else url.searchParams.delete('suche');
    history.replaceState(null,'',url.pathname+url.search);
  }
  function setCatalog(type) {
    catalog=type;selected=null;
    for(const button of document.querySelectorAll('[data-catalog]'))button.classList.toggle('active',button.dataset.catalog===catalog);
    const kinds=[...new Set(recordsFor(type).map(item=>item.type))].sort((a,b)=>classification(a).localeCompare(classification(b),'de'));
    $('kind').replaceChildren(new Option('Alle Kategorien',''),...kinds.map(key=>new Option(classification(key),key)));
    $('kind').value='';
    $('miningOnly').parentElement.parentElement.hidden=type!=='modules';
    $('order').parentElement.hidden=type!=='modules'&&type!=='ships';
    $('order').value='name';
    items=recordsFor(type);
    show();
  }
  function searchText(item) {
    // Aus Originaldaten abgeleiteter Suchindex, ohne diese zu verändern.
    return (customTitle(item)+' '+item.name+' '+item.id+' '+item.type+' '+JSON.stringify(item.data)).toLocaleLowerCase('de');
  }
  function filtered() {
    const q=$('search').value.trim().toLocaleLowerCase('de');
    const filter=$('kind').value;
    let found=items.filter(item=>(!filter||item.type===filter)&&(!q||searchText(item).includes(q))&&
      (!$('miningOnly').checked || catalog!=='modules' || isMiningModule(item.data)));
    const sort=$('order').value;
    found.sort((a,b)=>{
      if(sort==='cargo')return Number(b.data.modifier?.cargo||0)-Number(a.data.modifier?.cargo||0)||customTitle(a).localeCompare(customTitle(b),'de');
      if(sort==='power')return Number(b.data.modifier?.extraction_asteroid||0)-Number(a.data.modifier?.extraction_asteroid||0)||customTitle(a).localeCompare(customTitle(b),'de');
      if(sort==='slots')return Number(a.data.emplacement||0)-Number(b.data.emplacement||0)||customTitle(a).localeCompare(customTitle(b),'de');
      return customTitle(a).localeCompare(customTitle(b),'de');
    });
    return found;
  }
  function chips(item) {
    const value=item.data;
    if(catalog==='modules'){
      const out=[['Slots: '+fmt(value.emplacement)]];
      if(value.modifier?.cargo>0)out.push(['Fracht: '+fmt(value.modifier.cargo),'good']);
      if(value.modifier?.extraction_asteroid>0)out.push(['Asteroidenabbau: +'+fmt(value.modifier.extraction_asteroid),'good']);
      return out;
    }
    if(catalog==='ships')return [['Slots: '+fmt(value.emplacement)],['PA: '+fmt(value.pa)],['Klasse: '+fmt(value.classType)]];
    if(catalog==='research')return [[classification(value.type)],['Forschungszeit: '+fmt(value.time??'–')]];
    if(catalog==='buildings')return [['Stufen: '+Object.keys(value).filter(key=>/^\d+$/.test(key)).length]];
    return [['Datensatz']];
  }
  function show() {
    const found=filtered(),root=$('results');
    $('summary').textContent=found.length+' von '+items.length+' Einträgen';
    $('empty').hidden=found.length!==0;
    const fragment=document.createDocumentFragment();
    for(const item of found){
      const button=el('button','result-card'+(selected===item.id?' selected':''));button.type='button';
      button.dataset.id=item.id;
      addText(button,'span','item-name',customTitle(item));
      addText(button,'span','item-type',classification(item.type));
      addText(button,'span','item-code',item.id);
      const stats=el('span','item-stats');
      for(const [text,extra] of chips(item))addText(stats,'span','chip '+(extra||''),text);
      button.append(stats);fragment.append(button);
    }
    root.replaceChildren(fragment);
    updateDetail(found.find(x=>x.id===selected)||items.find(x=>x.id===selected)||null);
    updateQuery();
  }
  function listSection(parent,heading,values) {
    if(!values||!values.length)return;
    addText(parent,'h3',null,heading);
    const ul=el('ul','plain-list');
    for(const [name,value] of values){
      const li=el('li');addText(li,'span',null,name);addText(li,'strong',null,fmt(value));ul.append(li);
    }
    parent.append(ul);
  }
  function addKeyValues(parent, pairs) {
    const list=el('dl','kv');
    for(const [key,value] of pairs){
      addText(list,'dt',null,key);
      addText(list,'dd',null,fmt(value));
    }
    parent.append(list);
  }
  function prerequisiteText(pre) {
    if(!pre||typeof pre!=='object')return [];
    const values=[];
    for(const [type,data] of Object.entries(pre)){
      if(Array.isArray(data))values.push([({research:'Forschung',ships:'Schiffe'}[type]||type),data.join(', ')||'–']);
      else if(data&&typeof data==='object')values.push([({buildings:'Gebäude',uniqueBuildings:'Spezialgebäude'}[type]||type),Object.entries(data).map(([key,value])=>key+' '+value).join(' · ')]);
      else values.push([type,typeof data==='object'?JSON.stringify(data):String(data)]);
    }
    return values;
  }
  function urlForModule(id){
    const url=new URL('../asteroiden-mining-flottenoptimierer/',location.href);
    url.searchParams.set('datenbankmodul',id);
    return url.href;
  }
  function detailHeader(parent,item) {
    addText(parent,'div','item-type',classification(item.type)+' · '+item.id);
    const header=el('div','summary');
    const image=item.data.img;
    if(typeof image==='string'&&/^https:\/\/eu4\.s3\.eu-west-3\.amazonaws\.com\//.test(image)){
      const img=el('img');img.src=image;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';header.append(img);
    }
    const head=el('div');addText(head,'h2',null,customTitle(item));
    if(item.data.description)addText(head,'p','lead',item.data.description);
    if(customTitle(item)!==item.name)addText(head,'p','subtle','Originalname: '+item.name);
    header.append(head);parent.append(header);
  }
  function updateDetail(item) {
    const root=$('details');
    root.replaceChildren();
    if(!item) {
      const p=el('div','placeholder');addText(p,'h2',null,'Datensatz auswählen');addText(p,'p',null,'Wähle einen Eintrag für Effekte, Kosten, Voraussetzungen und Originaldaten.');root.append(p);return;
    }
    detailHeader(root,item);
    const v=item.data;
    if(catalog==='modules'){
      addText(root,'h3',null,'Moduldaten');
      addKeyValues(root,[['Typ',classification(v.type)],['Slots',v.emplacement],['Rasse',v.raceRequired||'Alle (laut Export)']]);
      listSection(root,'Effekte',Object.entries(v.modifier||{}).map(([k,val])=>[({
        cargo:'Frachtraum',extraction_asteroid:'Asteroidenextraktion',mining_optimizer:'Mining-Optimierer',extraction_debris:'Wrackextraktion'
      }[k]||k),val]));
      listSection(root,'Baukosten',Object.entries(v.cost||{}).filter(([,count])=>count!==0));
      if(isMiningModule(v)){
        const link=el('a','primary-link','Im Flottenoptimierer verwenden');
        link.href=urlForModule(item.id);root.append(link);
      }
    } else if(catalog==='ships'){
      addText(root,'h3',null,'Schiffsdaten');
      addKeyValues(root,[['Slots',v.emplacement],['Baupunkte (PA)',v.pa],['Klasse',v.classType],['Grundhülle',v.baseCoque],['Treibstoffraum',v.fuelSpace],['Max. Ausweichen',v.maxEvasion]]);
      listSection(root,'Multiplikatoren',Object.entries(v.multiplier||{}));
      listSection(root,'Baukosten',Object.entries(v.cost||{}).filter(([,count])=>count!==0));
    } else if(catalog==='research'){
      addText(root,'h3',null,'Forschung');
      addKeyValues(root,[['Typ',classification(v.type)],['Forschungszeit (Rohwert)',v.time],['ID',v.id]]);
    } else if(catalog==='buildings'){
      const levels=Object.entries(v).filter(([k])=>/^\d+$/.test(k)).sort((a,b)=>Number(a[0])-Number(b[0]));
      const box=el('div','field');
      addText(box,'label',null,'Gebäudestufe');
      const select=el('select');select.id='buildingLevel';
      for(const [level] of levels)select.add(new Option('Stufe '+level,level));
      if(levels.length)select.value=levels[0][0];
      box.append(select);root.append(box);
      const dynamic=el('div');root.append(dynamic);
      const render=()=>{
        dynamic.replaceChildren();
        const entry=v[select.value];
        addKeyValues(dynamic,[['Stufe',select.value],['Bauzeit (Rohwert)',entry?.time??'–']]);
        listSection(dynamic,'Baukosten',Object.entries(entry?.cost||{}).filter(([,value])=>value!==0));
      };
      select.addEventListener('change',render);render();
    } else if(catalog==='constants'){
      addText(root,'h3',null,'Original-Konstanten');
      for(const [k,value] of Object.entries(v)) {
        if(value&&typeof value==='object')listSection(root,k,Object.entries(value).map(([name,val])=>[name,typeof val==='object'?JSON.stringify(val):val]));
        else addKeyValues(root,[[k,value]]);
      }
    }
    if(catalog!=='buildings') {
      const prerequisites=prerequisiteText(v.prerequisites);
      if(prerequisites.length){
        addText(root,'h3',null,'Voraussetzungen');
        addKeyValues(root,prerequisites);
      }
    }
    const raw=el('details');const sum=el('summary',null,'Originaldaten (JSON) anzeigen');raw.append(sum);
    const pre=el('pre');pre.textContent=JSON.stringify(v,null,2);raw.append(pre);root.append(raw);
    const permalink=el('a','source-link','Link zu diesem Datensatz kopieren');
    permalink.href='#';
    permalink.addEventListener('click',async event=>{
      event.preventDefault();
      try {await navigator.clipboard.writeText(location.href);permalink.textContent='Link kopiert';}
      catch{permalink.textContent='Link in der Browseradresse kopieren';}
    });
    root.append(permalink);
  }

  $('results').addEventListener('click',event=>{
    const button=event.target.closest('[data-id]');if(!button)return;
    selected=button.dataset.id;show();
    if(matchMedia('(max-width:1000px)').matches)$('details').scrollIntoView({behavior:'smooth',block:'start'});
  });
  for(const button of document.querySelectorAll('[data-catalog]'))button.addEventListener('click',()=>setCatalog(button.dataset.catalog));
  $('search').addEventListener('input',()=>{selected=null;show()});
  for(const id of ['kind','order','miningOnly'])$(id).addEventListener('change',show);
  $('clearFilters').addEventListener('click',()=>{
    $('search').value='';$('kind').value='';$('order').value='name';$('miningOnly').checked=false;selected=null;show();
  });

  fetch('./referenzdaten.json')
    .then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json()})
    .then(value=>{
      for(const name of types)if(!value.catalogs?.[name])throw new Error('Datensatz fehlt: '+name);
      data=value;
      for(const t of ['ships','modules','research','buildings']){
        const qty=recordsFor(t).length;
        $('count-'+t).textContent='('+fmt(qty)+')';
      }
      $('datasetStatus').textContent='Referenzexport geladen';
      $('updated').textContent='Stand: '+new Date(data.exportedAt).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'});
      const q=initialState();setCatalog(catalog);$('search').value=q;show();
    })
    .catch(error=>{
      $('datasetStatus').textContent='Daten konnten nicht geladen werden: '+error.message;
      $('empty').hidden=false;
      $('empty').textContent='Referenzdaten nicht verfügbar. GitHub-Pages-Version prüfen oder einen lokalen HTTP-Server starten.';
    });
})();
