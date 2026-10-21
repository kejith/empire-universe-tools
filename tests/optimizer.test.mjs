import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../asteroiden-mining-flottenoptimierer/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Optimierer-JavaScript wurde nicht gefunden');
const pureCode = script.match(/function buildShipFrontier\(data\)[\s\S]*?(?=function el\()/)?.[0];
assert.ok(pureCode, 'Berechnungsfunktionen wurden nicht gefunden');
const {solve, resultForTime, bestAtTime} = vm.runInNewContext(
  '(function(){' + pureCode + '; return {solve, resultForTime, bestAtTime};})()', {}
);

function fixture(overrides={}) {
  return {
    ships:2, slots:10, reserved:2, baseCargo:0, outbound:5, inbound:5,
    interval:5, resourceRate:1000, maxMining:0,
    limitMode:'none', cargoLimit:10000000,
    modules:[
      {id:'laser',name:'Laser',slots:4,cargo:0,extraction:3},
      {id:'fracht',name:'Fracht',slots:2,cargo:20000,extraction:0}
    ],
    ...overrides
  };
}
function brute(d) {
  const free=d.slots-d.reserved;
  const options=[];
  const explore=(idx,used,level,cargo)=>{
    if(idx===d.modules.length){options.push({level,cargo});return;}
    const m=d.modules[idx];
    for(let quantity=0;used+quantity*m.slots<=free;quantity++)
      explore(idx+1,used+quantity*m.slots,level+quantity*m.extraction,cargo+quantity*m.cargo);
  };
  explore(0,0,0,0);
  let best=0;
  for(const a of options) for(const b of options) {
    const level=a.level+b.level, cargo=a.cargo+b.cargo+d.ships*d.baseCargo;
    if(!level||!cargo)continue;
    const capacity=d.limitMode==='limit'?Math.min(cargo,d.cargoLimit):cargo;
    for(let k=1;k<=40;k++) {
      if(d.maxMining>0 && k*d.interval>d.maxMining)break;
      const t=k*d.interval;
      const rate=Math.min(capacity,level*d.resourceRate*t)*60/(d.outbound+d.inbound+t);
      best=Math.max(best,rate);
    }
  }
  return best;
}

test('exakte Flottenoptimierung stimmt mit vollständiger Durchzählung überein',()=>{
  for(const args of [
    {},
    {cargoLimit:20000,limitMode:'limit'},
    {ships:2,baseCargo:1500},
    {outbound:0,inbound:3},
    {maxMining:10},
    {modules:[{id:'combo',name:'Hybrid',slots:3,cargo:12000,extraction:2}, {id:'fracht',name:'Fracht',slots:2,cargo:25000,extraction:0}]}
  ]) {
    const d=fixture(args);
    const actual=solve(d).rate;
    assert.ok(Math.abs(actual-brute(d))<1e-7, 'Abweichung: '+JSON.stringify(args)+' '+actual+'/'+brute(d));
  }
});

test('fünf Minuten Abbau, Hin- und Rückflug werden richtig berücksichtigt',()=>{
 const d=fixture({ships:1,slots:10,reserved:2});
 const result=resultForTime(3,20000,5,d);
 assert.equal(result.perTrip,15000);
 assert.equal(result.cycle,15);
 assert.equal(result.rate,60000);
});

test('Flotten-Frachtlimit wird auf gesamte Fracht angewendet',()=>{
 const d=fixture({limitMode:'limit',cargoLimit:12000,ships:2});
 const result=resultForTime(6,40000,15,d);
 assert.equal(result.usableCargo,12000);
 assert.equal(result.perTrip,12000);
});

test('80 klassische Fregatten reproduzieren den früheren Referenzwert',()=>{
 const d=fixture({
  ships:80,slots:32,reserved:4,
  modules:[
    {id:'m',name:'Fracht M',slots:3,cargo:75000,extraction:0},
    {id:'xl',name:'Fracht XL',slots:10,cargo:600000,extraction:0},
    {id:'230',name:'Fracht XL-230',slots:16,cargo:1400000,extraction:0},
    {id:'laser1',name:'Asteroiden-Laser I',slots:5,cargo:0,extraction:1},
    {id:'laser2',name:'Asteroiden-Laser II',slots:8,cargo:0,extraction:3}
  ]
 });
 const answer=solve(d);
 assert.equal(answer.minutes,45);
 assert.equal(answer.level,624);
 assert.equal(answer.installedCargo,28400000);
 assert.ok(Math.abs(answer.rate-30632727.27272727)<0.01);
 assert.equal(answer.compositions.reduce((sum,item)=>sum+item.count,0),80);
});

test('deutsche Standardmodule und Rassenbeschränkungen vorhanden',()=>{
 assert.match(html,/Mini-Asteroiden-Laser/);
 assert.match(html,/laser-nemoryx/);
 assert.match(html,/cargo-xyrrh/);
});
