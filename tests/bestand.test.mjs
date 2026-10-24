import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../asteroiden-mining-flottenoptimierer/index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const pure=scripts[0].match(/function buildShipFrontier\(data\)[\s\S]*?(?=function el\()/)[0];
const constrained=scripts[1].replace(/if\(modules.some\(m=>m.maxCount!=null[\s\S]*?\)\) run\(\);/,'');
const context=vm.createContext({Intl,Map,Set,Float64Array,Int32Array,Math,Error,Number,Array,JSON});
vm.runInContext(pure+'\n'+constrained+'\nthis.api={solve,resultForTime}',context);
const {solve,resultForTime}=context.api;

function config(mods,overrides={}){
  return {ships:2,slots:10,reserved:2,baseCargo:0,outbound:5,inbound:5,unload:0,
    interval:5,efficiency:100,resourceRate:1000,maxMining:0,limitMode:'none',cargoLimit:100000,
    modules:mods.map(m=>({...m,name:m.id})),...overrides};
}
function brute(data){
  const options=[];const free=data.slots-data.reserved;
  function build(i,used,cargo,level,counts){
    if(i===data.modules.length){options.push({cargo,level,counts:[...counts]});return;}
    const m=data.modules[i];
    for(let n=0;used+n*m.slots<=free;n++)build(i+1,used+n*m.slots,cargo+n*m.cargo,level+n*m.extraction,[...counts,n]);
  }
  build(0,0,0,0,[]);
  let best=0;
  function explore(ship,level,cargo,count){
    if(ship===data.ships){
      if(!level||!cargo)return;
      for(let step=1;step<=50;step++){
        const mining=step*data.interval;
        if(data.maxMining>0&&mining>data.maxMining)break;
        const effective=data.limitMode==='limit'?Math.min(cargo+data.ships*data.baseCargo,data.cargoLimit):cargo+data.ships*data.baseCargo;
        best=Math.max(best,Math.min(effective,level*data.resourceRate*mining)*60/(data.outbound+data.inbound+mining));
      }
      return;
    }
    for(const item of options){
      if(item.counts.some((qty,i)=>qty+count[i]>(data.modules[i].maxCount??Infinity)))continue;
      explore(ship+1,level+item.level,cargo+item.cargo,item.counts.map((qty,i)=>qty+count[i]));
    }
  }
  explore(0,0,0,data.modules.map(()=>0));
  return best;
}

test('globale Modulanzahl gilt für die ganze Flotte, nicht pro Schiff',()=>{
  const cases=[
    [ {id:'laser',slots:4,cargo:0,extraction:3,maxCount:1}, {id:'cargo',slots:2,cargo:20000,extraction:0} ],
    [ {id:'laser',slots:4,cargo:0,extraction:3,maxCount:2}, {id:'cargo',slots:2,cargo:20000,extraction:0,maxCount:3} ],
    [ {id:'laser',slots:3,cargo:0,extraction:2,maxCount:3}, {id:'cargo',slots:2,cargo:25000,extraction:0,maxCount:2},{id:'mix',slots:3,cargo:10000,extraction:1} ],
  ];
  for(const modules of cases){
    const data=config(modules);const plan=solve(data);const expected=brute(data);
    assert.ok(Math.abs(plan.rate-expected)<0.00001,String(plan.rate)+' != '+String(expected));
    const counts=new Map();
    for(const ship of plan.compositions)for(const module of ship.modules)
      counts.set(module.id,(counts.get(module.id)||0)+ship.count*module.quantity);
    for(const module of data.modules)assert.ok((counts.get(module.id)||0)<=(module.maxCount??Infinity));
  }
});

test('prozentuale Abbaueffizienz skaliert feste Basisleistung 1000',()=>{
  const data=config([],{resourceRate:800,efficiency:80});
  assert.equal(resultForTime(10,1000000,5,data).perTrip,40000);
});

test('fehlende Extraktionsmodule führen zu einer klaren Fehlermeldung',()=>{
  const d=config([{id:'laser',slots:4,cargo:0,extraction:3,maxCount:0},{id:'cargo',slots:2,cargo:20000,extraction:0}]);
  assert.throws(()=>solve(d),/kein Abbau und Transport möglich/i);
});

test('keine seitlich fixierte Modul-Tabelle, kein Schnellstart, kein Entladefeld',()=>{
  assert.match(html,/module-table tr\{display:grid/);
  assert.doesNotMatch(html,/id="unload"/);
  assert.doesNotMatch(html,/id="resourceRate"/);
  assert.doesNotMatch(html,/<h3>Schnellstart<\/h3>/);
  assert.match(html,/id="efficiency"/);
  assert.match(html,/maxCount/);
});

test('Zurücksetzen ist sichtbar, bestätigt und entfernt geteilte Konfigurationen',()=>{
  const settingsPanel=html.match(/<h2>Einstellungen speichern<\/h2>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(settingsPanel?.includes('id="reset"'), 'Reset-Button in den Einstellungen erwartet');
  assert.match(settingsPanel,/Einstellungen zurücksetzen/);
  assert.match(html,/window\.confirm\('Alle Einstellungen/);
  assert.match(html,/history\.replaceState\(null,'',location\.pathname\+location\.search\)/);
  assert.match(html,/setSettings\(clone\(defaults\)\);/);
});
