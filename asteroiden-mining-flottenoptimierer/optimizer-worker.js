'use strict';
/** Empire Universe 4 — rechenintensiver Flottenoptimierer.
 * Exakte Suche in dediziertem Web Worker statt auf dem UI-Thread.
 * Aus den beiden existierenden DP-Algorithmen erzeugt, gleiche Suchgrenzen.
 */
// Rechenintensive Suche findet ausschließlich in diesem Worker statt.
// Fortschrittsereignisse werden während der Schiffsschleifen gepostet.
// Dadurch bleibt der UI-Thread auch bei mehreren hunderttausend Zuständen frei.
let lastProgress = 0;
let reportProgress = (_label,_done,_total)=>{};

// Sichere Dominanzregel für den Exakt-Modus: Ein unbegrenzt verfügbares
// Modul dominiert ein schwächeres, wenn es bei höchstens gleicher Slotzahl
// in BEIDEN Zielgrößen nicht schlechter ist. Bei Bestandsgrenzen gilt diese
// Regel nur, wenn der Ersatz auch bei voller Flottenbelegung verfügbar ist.
function usableModuleIndices(data) {
  const free=data.slots-data.reserved;
  return data.modules.map((m,i)=>({m,i})).filter(({m,i})=>{
    if(m.slots>free || m.maxCount===0 || (!m.cargo&&!m.extraction))return false;
    return !data.modules.some((other,j)=>{
      if(j===i || other.slots>m.slots || other.slots>free ||
          other.cargo<m.cargo || other.extraction<m.extraction)return false;
      const unlimited=other.maxCount==null ||
        Number(other.maxCount)>=data.ships*Math.floor(free/other.slots);
      if(!unlimited)return false;
      const strict=other.slots<m.slots || other.cargo>m.cargo ||
        other.extraction>m.extraction || j<i;
      return strict;
    });
  }).map(entry=>entry.i);
}

function buildShipFrontier(data){
  const free=data.slots-data.reserved;
  const mods=usableModuleIndices(data).map(i=>data.modules[i]);
  if(!mods.some(m=>m.extraction>0))throw new Error('Kein aktives Extraktionsmodul passt in die freien Slots.');
  const bySlots=Array.from({length:free+1},()=>new Map());
  bySlots[0].set(0,{cargo:0,level:0,used:0,prev:null,moduleIndex:-1});
  for(let used=0;used<=free;used++){
    reportProgress('Schiffsausrüstungen',used,free+1);
    for(const [level,node] of bySlots[used]){
      for(let i=0;i<mods.length;i++){
        const m=mods[i],nextSlots=used+m.slots;
        if(nextSlots>free)continue;
        const nextLevel=level+m.extraction,nextCargo=node.cargo+m.cargo;
        const existing=bySlots[nextSlots].get(nextLevel);
        if(!existing || nextCargo>existing.cargo){
          bySlots[nextSlots].set(nextLevel,{cargo:nextCargo,level:nextLevel,used:nextSlots,prev:node,moduleIndex:data.modules.indexOf(m)});
        }
      }
    }
  }
  const best=new Map();
  for(const slotMap of bySlots)for(const [level,node] of slotMap){
    if(!best.has(level)||node.cargo>best.get(level).cargo)best.set(level,node);
  }
  // A stronger loadout with at least as much cargo always dominates a weaker one.
  let biggest=-1;const frontier=[];
  for(const [level,node] of [...best.entries()].sort((a,b)=>b[0]-a[0])){
    if(node.cargo>biggest){frontier.push({level,cargo:node.cargo,node});biggest=node.cargo;}
  }
  if(frontier.length===0)throw new Error('Keine passende Modulkombination gefunden.');
  const largestLevel=Math.max(...frontier.map(x=>x.level));
  if(data.ships*(data.ships*largestLevel+1)>2500000)
    throw new Error('Diese Eingabe ist für die lokale Optimierung zu groß. Reduziere die Schiffszahl oder die Extraktionslevel pro Modul.');
  return frontier;
}

// Exact fleet DP. For each possible TOTAL extraction level, preserve maximum
// achievable TOTAL cargo. This suffices because throughput is monotone in both.
function buildFleetFrontier(data,shipOptions){
  const maxLevel=Math.max(...shipOptions.map(x=>x.level));
  let previous=new Float64Array(1); previous[0]=0;
  const parent=[null];
  for(let n=1;n<=data.ships;n++){
    const next=new Float64Array(n*maxLevel+1).fill(-1);
    const chosen=new Int32Array(next.length).fill(-1);
    for(let level=0;level<previous.length;level++){
      if(previous[level]<0)continue;
      const cargo=previous[level];
      for(let optionIdx=0;optionIdx<shipOptions.length;optionIdx++){
        const opt=shipOptions[optionIdx];const newLevel=level+opt.level;
        const newCargo=cargo+opt.cargo;
        if(newCargo>next[newLevel]){next[newLevel]=newCargo;chosen[newLevel]=optionIdx;}
      }
    }
    parent.push(chosen);previous=next;
    reportProgress('Flottenverteilung',n,data.ships);
  }
  return {cargoByLevel:previous,parent,shipOptions};
}
function resultForTime(level,rawCargo,minutes,data){
  const installedCargo=rawCargo+data.ships*data.baseCargo;
  const usableCargo=data.limitMode==='limit'?Math.min(installedCargo,data.cargoLimit):installedCargo;
  const mined=level*data.resourceRate*minutes;
  const perTrip=Math.min(usableCargo,mined);
  const travel=data.outbound+data.inbound;
  return {rate:perTrip*60/(travel+minutes),level,installedCargo,usableCargo,perTrip,minutes,cycle:travel+minutes};
}
function bestAtTime(fleet,data,minutes){
  let best=null;
  for(let level=1;level<fleet.cargoByLevel.length;level++){
    if(fleet.cargoByLevel[level]<0)continue;
    const result=resultForTime(level,fleet.cargoByLevel[level],minutes,data);
    if(!best || result.rate>best.rate)best=result;
  }
  return best;
}
function solve(data){
  const shipOptions=buildShipFrontier(data);
  const fleet=buildFleetFrontier(data,shipOptions);
  const maxSteps=data.maxMining>0?Math.floor((data.maxMining+1e-9)/data.interval):Infinity;
  let best=null;
  for(let level=1;level<fleet.cargoByLevel.length;level++){
    const cargo=fleet.cargoByLevel[level];
    if(cargo<0)continue;
    const capacity=data.limitMode==='limit'?Math.min(cargo+data.ships*data.baseCargo,data.cargoLimit):cargo+data.ships*data.baseCargo;
    if(capacity<=0)continue;
    // At fixed strength/cargo, throughput rises until full and falls afterwards.
    // So only the discrete ticks immediately below and above the fill point matter.
    const approximate=capacity/(level*data.resourceRate*data.interval);
    const low=Math.max(1,Math.min(maxSteps,Math.floor(approximate)));
    const high=Math.max(1,Math.min(maxSteps,Math.ceil(approximate)));
    for(const steps of new Set([low,high])){
      if(steps>maxSteps)continue;
      const value=resultForTime(level,cargo,steps*data.interval,data);
      if(!best||value.rate>best.rate+1e-9 || (Math.abs(value.rate-best.rate)<1e-9 && value.cycle<best.cycle))best=value;
    }
  }
  if(!best||best.rate<=0)throw new Error('Keine Konfiguration kann mit den aktuellen Modulen Ressourcen transportieren.');
  // Trace back fleet layouts from the exact optimal extraction level.
  const byOption=new Map();let level=best.level;
  for(let n=data.ships;n>0;n--){
    const idx=fleet.parent[n][level];
    if(idx<0)throw new Error('Interner Rekonstruktionsfehler.');
    byOption.set(idx,(byOption.get(idx)||0)+1);
    level-=fleet.shipOptions[idx].level;
  }
  const compositions=[...byOption].map(([idx,count])=>{
    const opt=fleet.shipOptions[idx],counts=new Map();let node=opt.node;
    while(node.prev){counts.set(node.moduleIndex,(counts.get(node.moduleIndex)||0)+1);node=node.prev;}
    return {count,level:opt.level,cargo:opt.cargo,used:opt.node.used,modules:[...counts].sort((a,b)=>a[0]-b[0]).map(([moduleIdx,quantity])=>({name:data.modules[moduleIdx].name,quantity}))};
  }).sort((a,b)=>b.level-a.level || b.cargo-a.cargo);
  return {...best,compositions,fleet,data};
}


(() => {
  const originalSolve = solve;
  const originalBestAtTime = bestAtTime;
  const MAX_LOCAL_STATES = 180000;
  const MAX_FLEET_STATES = 500000;

  function limitedModuleInfo(data) {
    const free = data.slots - data.reserved;
    const scarce = [];
    const useful=new Set(usableModuleIndices(data));
    for (let index = 0; index < data.modules.length; index++) {
      if(!useful.has(index))continue;
      const module = data.modules[index];
      if (module.slots > free) continue;
      if (module.maxCount == null) continue;
      const cap = Number(module.maxCount);
      if (!Number.isSafeInteger(cap) || cap < 0) throw new Error(`Ungültiger Modulbestand: ${module.name}.`);
      if (cap < data.ships * Math.floor(free / module.slots)) scarce.push({index, cap});
    }
    let product = 1;
    const byIndex = new Map();
    for (const {index,cap} of scarce) {
      const stride = product;
      product *= cap + 1;
      if (!Number.isSafeInteger(product) || product > 25000)
        throw new Error('Zu viele unabhängige Modul-Bestandsgrenzen für die exakte Suche. Bitte weniger Modultypen gleichzeitig begrenzen.');
      byIndex.set(index, {stride, radix:cap+1, cap});
    }
    return {scarce,byIndex};
  }
  function canAdd(code, addCode, scarce, byIndex) {
    for (const {index} of scarce) {
      const info = byIndex.get(index);
      const a = Math.floor(code / info.stride) % info.radix;
      const b = Math.floor(addCode / info.stride) % info.radix;
      if (a + b > info.cap) return false;
    }
    return true;
  }
  function pareto(states, label) {
    const byCode = new Map();
    for (const state of states) {
      let group=byCode.get(state.code);
      if (!group) byCode.set(state.code, group=[]);
      group.push(state);
    }
    const result=[];
    for (const group of byCode.values()) {
      group.sort((a,b)=>b.level-a.level || b.cargo-a.cargo);
      let bestCargo=-1;
      for(const state of group) {
        if(state.cargo>bestCargo) {
          result.push(state);
          bestCargo=state.cargo;
        }
      }
    }
    const cap=label==='Schiffsmodul' ? MAX_LOCAL_STATES : MAX_FLEET_STATES;
    if (result.length>cap)
      throw new Error(`Die exakte Suche ist bei diesen Modulbeständen zu groß (${result.length.toLocaleString('de-DE')} ${label}-Zustände). Bitte weniger unabhängige Modulgrenzen oder eine kleinere Flotte verwenden.`);
    return result;
  }
  function shipOptions(data, limited) {
    const free=data.slots-data.reserved;
    const allowed=usableModuleIndices(data);
    const bySlots=Array.from({length:free+1},()=>new Map());
    const root={used:0, level:0,cargo:0,code:0,prev:null,moduleIndex:-1};
    bySlots[0].set('0:0',root);
    for(let used=0;used<=free;used++) {
      reportProgress('Schiffsausrüstungen',used,free+1);
      const states=bySlots[used];
      if(states.size>MAX_LOCAL_STATES) throw new Error('Zu viele mögliche Modulbestände für ein einzelnes Schiff.');
      for(const node of states.values())for(const i of allowed){
        const mod=data.modules[i];
        const nextSlots=used+mod.slots;
        if(nextSlots>free || mod.maxCount===0)continue;
        const limitedData=limited.byIndex.get(i);
        let newCode=node.code;
        if(limitedData){
          const current=Math.floor(node.code/limitedData.stride)%limitedData.radix;
          if(current>=limitedData.cap)continue;
          newCode+=limitedData.stride;
        }
        const nextLevel=node.level+mod.extraction;
        const nextCargo=node.cargo+mod.cargo;
        const key=newCode+':'+nextLevel;
        const previous=bySlots[nextSlots].get(key);
        if(!previous || nextCargo>previous.cargo)
          bySlots[nextSlots].set(key,{used:nextSlots,level:nextLevel,cargo:nextCargo,code:newCode,prev:node,moduleIndex:i});
      }
    }
    const maxima=new Map();
    for(const slotMap of bySlots)for(const node of slotMap.values()){
      const key=node.code+':'+node.level;
      const existing=maxima.get(key);
      if(!existing||node.cargo>existing.cargo)maxima.set(key,node);
    }
    const reduced=pareto([...maxima.values()],'Schiffsmodul');
    if(reduced.length>8000) throw new Error('Zu viele mögliche Schiffsausrüstungen bei den gewählten Bestandsgrenzen.');
    return reduced.map(node=>({node,code:node.code,level:node.level,cargo:node.cargo}));
  }
  function buildLimitedFleet(data, opts, limited) {
    let states=[{level:0,cargo:0,code:0,prev:null,optionIndex:-1}];
    for(let ship=0;ship<data.ships;ship++) {
      const next=new Map();
      let transitions=0;
      for(const state of states) for(let i=0;i<opts.length;i++){
        const option=opts[i];
        if(!canAdd(state.code,option.code,limited.scarce,limited.byIndex))continue;
        const code=state.code+option.code;
        const level=state.level+option.level;
        const cargo=state.cargo+option.cargo;
        const key=code+':'+level;
        const prev=next.get(key);
        if(!prev || cargo>prev.cargo)
          next.set(key,{code,level,cargo,prev:state,optionIndex:i});
        if(++transitions>60000000)
          throw new Error('Zu viele zulässige Kombinationen für eine exakte Berechnung. Weniger verschiedene Bestandsgrenzen verwenden.');
      }
      states=pareto([...next.values()],'Flotten');
      reportProgress('Flottenverteilung',ship+1,data.ships);
    }
    return {limitedStates:states,shipOptions:opts};
  }
  function solveWithLimits(data, limited) {
    const opts=shipOptions(data,limited);
    const fleet=buildLimitedFleet(data,opts,limited);
    const maxSteps=data.maxMining>0 ? Math.floor((data.maxMining+1e-9)/data.interval):Infinity;
    let best=null,chosen=null;
    for(const state of fleet.limitedStates){
      if(state.level<=0)continue;
      const cargo=state.cargo+data.ships*data.baseCargo;
      const capacity=data.limitMode==='limit'?Math.min(cargo,data.cargoLimit):cargo;
      if(capacity<=0)continue;
      const fill=capacity/(state.level*data.resourceRate*data.interval);
      const ticks=new Set([
        Math.max(1,Math.min(maxSteps,Math.floor(fill))),
        Math.max(1,Math.min(maxSteps,Math.ceil(fill)))
      ]);
      for(const tick of ticks){
        if(tick>maxSteps)continue;
        const result=resultForTime(state.level,state.cargo,tick*data.interval,data);
        if(!best || result.rate>best.rate+1e-9 || (Math.abs(result.rate-best.rate)<1e-9 && result.cycle<best.cycle)){
          best=result;chosen=state;
        }
      }
    }
    if(!best||best.rate<=0)throw new Error('Mit den verfügbaren Modulen ist kein Abbau und Transport möglich.');
    const byOption=new Map();
    for(let cursor=chosen;cursor?.prev;cursor=cursor.prev)
      byOption.set(cursor.optionIndex,(byOption.get(cursor.optionIndex)||0)+1);
    const compositions=[...byOption].map(([index,count])=>{
      const opt=opts[index],counts=new Map();
      for(let cursor=opt.node;cursor?.prev;cursor=cursor.prev)
        counts.set(cursor.moduleIndex,(counts.get(cursor.moduleIndex)||0)+1);
      return {
        count,level:opt.level,cargo:opt.cargo,used:opt.node.used,
        modules:[...counts].sort((a,b)=>a[0]-b[0]).map(([idx,quantity])=>({id:data.modules[idx].id,name:data.modules[idx].name,quantity}))
      };
    }).sort((a,b)=>b.level-a.level || b.cargo-a.cargo);
    return {...best,compositions,fleet,data};
  }
  solve = function(data) {
    const limited=limitedModuleInfo(data);
    return limited.scarce.length ? solveWithLimits(data,limited) : originalSolve(data);
  };
  bestAtTime = function(fleet,data,minutes) {
    if(!fleet.limitedStates)return originalBestAtTime(fleet,data,minutes);
    let best=null;
    for(const state of fleet.limitedStates){
      if(state.level<=0)continue;
      const value=resultForTime(state.level,state.cargo,minutes,data);
      if(!best||value.rate>best.rate)best=value;
    }
    return best;
  };

})();

/* Effizienzbasierte, schnelle Näherung für Multi-Knapsack (mehrere Schiffe)
 * mit gemeinsamer Fracht, Extraktionsleistung und globalen Modulbeständen.
 * Greedy-Belegung + Multi-Start + begrenzte lokale Austauschsuche.
 * Kein Anspruch auf exaktes Optimum – siehe optionalen Exakt-Modus.
 */
function fastOptimize(data) {
  const free=data.slots-data.reserved;
  const modules=data.modules;
  const n=modules.length;
  const limits=modules.map(m=>m.maxCount==null ? Infinity : Number(m.maxCount));
  const orderBy=(kind,preferAbsolute)=>{
    const keys=modules.map((m,i)=>({i,slots:m.slots,power:kind==='laser'?m.extraction:m.cargo,
      efficiency:(kind==='laser'?m.extraction:m.cargo)/m.slots}))
      .filter(m=>m.power>0 && m.slots<=free && limits[m.i]>0);
    keys.sort((a,b)=> preferAbsolute?
      b.power-a.power || b.efficiency-a.efficiency || a.slots-b.slots :
      b.efficiency-a.efficiency || b.power-a.power || a.slots-b.slots);
    return keys;
  };
  const orders=[0,1].map(absolute=>({
    laser:orderBy('laser',absolute),
    cargo:orderBy('cargo',absolute)
  }));
  if(!orders[0].laser.length)throw new Error('Kein Abbaumodul passt in die verfügbaren Slots.');
  if(!orders[0].cargo.length && data.baseCargo===0)throw new Error('Kein Frachtmodul passt in die verfügbaren Slots.');

  const maxSteps=data.maxMining>0 ? Math.floor((data.maxMining+1e-9)/data.interval) : Infinity;
  const evaluate=(level,cargo)=>{
    if(level<=0)return null;
    const installedCargo=cargo+data.ships*data.baseCargo;
    const usableCargo=data.limitMode==='limit' ? Math.min(installedCargo,data.cargoLimit) : installedCargo;
    if(usableCargo<=0)return null;
    const fill=usableCargo/(level*data.resourceRate*data.interval);
    const low=Math.max(1,Math.min(maxSteps,Math.floor(fill)));
    const high=Math.max(1,Math.min(maxSteps,Math.ceil(fill)));
    let best=null;
    for(const tick of [low,high]){
      if(tick>maxSteps)continue;
      const result=resultForTime(level,cargo,tick*data.interval,data);
      if(!best || result.rate>best.rate+1e-9 ||
        (Math.abs(result.rate-best.rate)<1e-9 && result.cycle<best.cycle))best=result;
    }
    return best;
  };
  function build(fraction,laserFirst,absolute,specialized){
    const ordered=orders[absolute],used=new Int32Array(n);
    const ships=[];
    let totalCargo=0,totalLevel=0;
    function fill(ship,group,maxSlots){
      let remaining=Math.min(maxSlots,free-ship.used);
      for(const item of ordered[group]){
        if(remaining<item.slots)continue;
        const count=Math.min(Math.floor(remaining/item.slots),limits[item.i]-used[item.i]);
        if(count<=0)continue;
        ship.counts[item.i]+=count;
        used[item.i]+=count;
        ship.used+=count*item.slots;
        ship.level+=count*(modules[item.i].extraction);
        ship.cargo+=count*(modules[item.i].cargo);
        remaining-=count*item.slots;
        if(remaining===0)break;
      }
    }
    for(let i=0;i<data.ships;i++){
      const ship={counts:new Int32Array(n),used:0,level:0,cargo:0};
      const miningSlots=specialized ? ((i+0.5)/data.ships<fraction?free:0) : Math.round(free*fraction);
      if(laserFirst){
        fill(ship,'laser',miningSlots);
        fill(ship,'cargo',free-ship.used);
        fill(ship,'laser',free-ship.used);
      }else{
        fill(ship,'cargo',free-miningSlots);
        fill(ship,'laser',free-ship.used);
        fill(ship,'cargo',free-ship.used);
      }
      totalCargo+=ship.cargo;totalLevel+=ship.level;
      ships.push(ship);
    }
    return {ships,used,totalLevel,totalCargo,performance:evaluate(totalLevel,totalCargo)};
  }

  // Globales Balancing: das passende Verhältnis aus Mining und Fracht kann
  // sich mit Flugzeit, Abbaueffizienz und Frachtlimit deutlich verschieben.
  const fractions=[0,0.04,0.08,0.12,0.16,0.2,0.25,0.3,0.35,0.4,0.45,0.5,
    0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.94,0.97,1];
  const all=[];
  let progress=0;
  for(const fraction of fractions){
    for(const absolute of [0,1]){
      for(const laserFirst of [true,false])for(const specialized of [false,true]){
        const candidate=build(fraction,laserFirst,absolute,specialized);
        if(candidate.performance)all.push(candidate);
      }
    }
    progress++;
    reportProgress('Effizienzbasierte Vorbelegung',progress,fractions.length);
  }
  if(!all.length)throw new Error('Mit diesen Modulen ist kein gemeinsamer Abbau und Transport möglich.');
  all.sort((a,b)=>b.performance.rate-a.performance.rate);
  const viable=[],seen=new Set();
  for(const candidate of all){
    const key=candidate.totalCargo+':'+candidate.totalLevel;
    if(seen.has(key))continue;
    seen.add(key);viable.push(candidate);
  }

  // Einzelmodule durch passendere Kombinationen ersetzen. Die tatsächliche
  // Zielgröße ist Ressourcen/h, nicht isoliert Fracht oder Extraktion.
  function refine(candidate) {
    const {ships,used}=candidate;
    let current=candidate.performance;
    let level=candidate.totalLevel,cargo=candidate.totalCargo;
    const operationsMax=170000;
    let operations=0;
    outer:for(let pass=0;pass<2;pass++){
      let improved=false;
      for(const ship of ships){
        const sources=[-1];
        for(let i=0;i<n;i++)if(ship.counts[i]>0)sources.push(i);
        let best=null;
        for(const from of sources){
          for(let removed=from<0?0:1;removed<= (from<0?0:Math.min(3,ship.counts[from]));removed++){
            const after=free-ship.used+(from<0?0:removed*modules[from].slots);
            for(let to=0;to<n;to++){
              if(to===from||modules[to].slots>after || limits[to]===0)continue;
              const available=limits[to]-used[to];
              const maxCount=Math.min(Math.floor(after/modules[to].slots),available);
              if(maxCount<=0)continue;
              // Prüfe auch kleine Stückzahlen: maximales Auffüllen alleine
              // kann wegen des globalen Fracht/Mining-Verhältnisses schlechter sein.
              const choices=[1,2,3,maxCount];
              for(const add of choices){
                if(add>maxCount || add<1)continue;
                const newLevel=level+(add*modules[to].extraction)-(from<0?0:removed*modules[from].extraction);
                const newCargo=cargo+(add*modules[to].cargo)-(from<0?0:removed*modules[from].cargo);
                const performance=evaluate(newLevel,newCargo);
                if(performance && performance.rate>current.rate+1e-8 &&
                    (!best || performance.rate>best.performance.rate+1e-8))
                  best={from,to,removed,add,performance,newLevel,newCargo};
                if(++operations>=operationsMax)break outer;
              }
            }
          }
        }
        if(best){
          if(best.from>=0){
            ship.counts[best.from]-=best.removed;
            used[best.from]-=best.removed;
            ship.used-=best.removed*modules[best.from].slots;
            ship.cargo-=best.removed*modules[best.from].cargo;
            ship.level-=best.removed*modules[best.from].extraction;
          }
          ship.counts[best.to]+=best.add;used[best.to]+=best.add;
          ship.used+=best.add*modules[best.to].slots;
          ship.cargo+=best.add*modules[best.to].cargo;
          ship.level+=best.add*modules[best.to].extraction;
          level=best.newLevel;cargo=best.newCargo;
          current=best.performance;improved=true;
        }
      }
      reportProgress('Lokale Bauplanverbesserung',pass+1,2);
      if(!improved)break;
    }
    candidate.totalCargo=cargo;candidate.totalLevel=level;candidate.performance=current;
  }
  for(let i=0;i<Math.min(3,viable.length);i++)refine(viable[i]);
  viable.sort((a,b)=>b.performance.rate-a.performance.rate);
  const winner=viable[0];

  const compositions=new Map();
  for(const ship of winner.ships){
    const key=ship.counts.join(',');
    let record=compositions.get(key);
    if(record){record.count++;continue;}
    record={
      count:1,level:ship.level,cargo:ship.cargo,used:ship.used,
      modules:[...ship.counts].flatMap((quantity,index)=>quantity>0?
        [{id:modules[index].id,name:modules[index].name,quantity}]:[])
    };
    compositions.set(key,record);
  }
  // Zusätzlich müssen in Vergleichstabellen andere Mining-Dauern aus den
  // Kandidaten bewertet werden; hierzu reichen Level und Fracht je Kandidat.
  const fleet={fastCandidates:viable.map(c=>({level:c.totalLevel,cargo:c.totalCargo}))};
  return {...winner.performance,
    compositions:[...compositions.values()].sort((a,b)=>b.level-a.level||b.cargo-a.cargo),
    fleet,data,method:'heuristic'};
}
function fastBestAtTime(fleet,data,minutes){
  let best=null;
  for(const state of fleet.fastCandidates){
    const result=resultForTime(state.level,state.cargo,minutes,data);
    if(!best || result.rate>best.rate)best=result;
  }
  return best;
}

self.addEventListener('message',(event)=>{
  if(event.data?.type!=='calculate')return;
  const data=event.data.data;
  lastProgress=0;
  reportProgress=(stage,current,total)=>{
    const now=Date.now();
    if(now-lastProgress<120 && current!==total)return;
    lastProgress=now;
    self.postMessage({type:'progress',stage,current,total});
  };
  try{
    reportProgress('Suche vorbereiten',0,1);
    const plan=data.searchMode==='exact'?solve(data):fastOptimize(data);
    reportProgress('Alternative Abbauzeiten berechnen',0,1);
    const center=Math.round(plan.minutes/data.interval);
    const ticks=new Set([1,2,3,4,6,9,12,18,24,center-2,center-1,center,center+1,center+2]
      .filter(k=>k>=1&&(data.maxMining===0||k*data.interval<=data.maxMining+1e-9)));
    const alternatives=[...ticks].sort((a,b)=>a-b).map(tick=>{
      const result=plan.method==='heuristic' ? fastBestAtTime(plan.fleet,data,tick*data.interval) : bestAtTime(plan.fleet,data,tick*data.interval);
      return result?{tick,minutes:tick*data.interval,level:result.level,rate:result.rate}:null;
    }).filter(Boolean);
    // Für Anzeige und Export ist der riesige DP-Zwischenzustand nicht nötig.
    // Nicht klonen/übertragen: bei 500.000 Zuständen kann dies die UI blockieren.
    const {fleet:unused,...result}=plan;
    result.alternatives=alternatives;
    self.postMessage({type:'result',plan:result});
  }catch(error){
    self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});
  }
});
