import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const base=new URL('../asteroiden-mining-flottenoptimierer/',import.meta.url);
const html=readFileSync(new URL('index.html',base),'utf8');
const workerSource=readFileSync(new URL('optimizer-worker.js',base),'utf8');

function execute(data){
  let listener;
  const messages=[];
  const self={
    addEventListener(type,fn){assert.equal(type,'message');listener=fn;},
    postMessage(payload){messages.push(payload);}
  };
  vm.runInNewContext(workerSource,{self,Date,Map,Set,Float64Array,Int32Array,Number,Math,Error,Array,JSON});
  assert.equal(typeof listener,'function');
  listener({data:{type:'calculate',data}});
  return messages;
}
const fixture=(overrides={})=>({
  ships:2,slots:10,reserved:2,baseCargo:0,outbound:5,inbound:5,unload:0,
  interval:5,resourceRate:1000,maxMining:0,limitMode:'none',cargoLimit:1000000,
  modules:[
    {id:'laser',name:'Laser',slots:4,cargo:0,extraction:3,maxCount:null},
    {id:'cargo',name:'Fracht',slots:2,cargo:20000,extraction:0,maxCount:null}
  ],...overrides
});

test('Berechnung wird nicht automatisch beim Laden gestartet',()=>{
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
  assert.equal(scripts.length,3);
  assert.doesNotMatch(scripts[0],/run\(\);\s*$/);
  assert.doesNotMatch(scripts[1],/run\(\);\s*\}\)\(\)/);
  assert.doesNotMatch(scripts[2],/run\(\);\s*\}\)\(\)/);
  assert.match(html,/new Worker\('\.\/optimizer-worker\.js'\)/);
  assert.match(html,/id="cancelCalculation"/);
  assert.match(html,/id="calculationProgress"/);
});

test('Worker berechnet exakte Flotten ohne Begrenzung und zeigt Fortschritt',()=>{
  const messages=execute(fixture());
  assert.ok(messages.some(m=>m.type==='progress'));
  const result=messages.find(m=>m.type==='result');
  assert.ok(result,JSON.stringify(messages));
  assert.ok(result.plan.rate>0);
  assert.equal(result.plan.fleet,undefined,'Interne Suchzustände werden nicht zum UI übertragen');
  assert.ok(result.plan.alternatives.length>0);
  assert.equal(result.plan.compositions.reduce((sum,item)=>sum+item.count,0),2);
});

test('Worker wendet begrenzte Gesamt-Modulbestände an',()=>{
  const d=fixture({
    modules:[
      {id:'laser',name:'Laser',slots:4,cargo:0,extraction:3,maxCount:1},
      {id:'cargo',name:'Fracht',slots:2,cargo:20000,extraction:0,maxCount:3}
    ]
  });
  const messages=execute(d);
  const errors=messages.filter(m=>m.type==='error');
  assert.equal(errors.length,0,JSON.stringify(errors));
  const result=messages.find(m=>m.type==='result');
  assert.ok(result);
  const counts=new Map();
  for(const ship of result.plan.compositions){
    for(const module of ship.modules)counts.set(module.id,(counts.get(module.id)||0)+ship.count*module.quantity);
  }
  assert.ok((counts.get('laser')||0)<=1);
  assert.ok((counts.get('cargo')||0)<=3);
  assert.ok(result.plan.alternatives.length>0);
});

test('UI beendet laufenden Worker bei Änderungen oder Abbruch',()=>{
  assert.match(html,/function dirty\(\)\{\s*cancelWork\(\)/);
  assert.match(html,/function cancelWork\(\)\{/);
  assert.match(html,/currentWorker\.terminate\(\)/);
  assert.match(html,/\$\('cancelCalculation'\)\.addEventListener\('click'/);
  assert.match(html,/id!==requestId \|\| worker!==currentWorker/);
});

test('GitHub Pages stellt Worker bereit',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.match(yaml,/cp asteroiden-mining-flottenoptimierer\/optimizer-worker\.js/);
});
