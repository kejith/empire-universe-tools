import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../asteroiden-mining-flottenoptimierer/',import.meta.url);
const worker=readFileSync(new URL('optimizer-worker.js',root),'utf8');
const html=readFileSync(new URL('index.html',root),'utf8');

function execute(data,mode='fast'){
  const messages=[];
  let handler;
  const context=vm.createContext({
    self:{
      addEventListener(type,fn){if(type==='message')handler=fn;},
      postMessage(x){messages.push(x);}
    },Date,Math,Number,Array,JSON,Set,Map,Float64Array,Int32Array,Error
  });
  vm.runInContext(worker,context);
  handler({data:{type:'calculate',data:{...data,searchMode:mode}}});
  const error=messages.find(x=>x.type==='error');
  assert.ok(!error,'Calculation failed ('+mode+'): '+error?.message);
  const result=messages.find(x=>x.type==='result');
  assert.ok(result,'Missing '+mode+' result');
  return {plan:result.plan,messages,context};
}
function data(overrides={}){
  return {ships:3,slots:10,reserved:2,outbound:5,inbound:5,unload:0,baseCargo:0,
    resourceRate:1000,interval:5,maxMining:0,cargoLimit:1000000,limitMode:'none',
    modules:[
      {id:'laser',name:'Laser',slots:4,cargo:0,extraction:3,maxCount:null},
      {id:'cargo',name:'Fracht',slots:2,cargo:20000,extraction:0,maxCount:null}
    ],...overrides};
}
function checkInventory(d,plan){
  assert.equal(plan.compositions.reduce((a,s)=>a+s.count,0),d.ships);
  const used=new Map();
  for(const ship of plan.compositions){
    let slots=0;
    for(const m of ship.modules){
      const entry=d.modules.find(x=>x.id===m.id);
      assert.ok(entry,'Unexpected module '+m.id);
      slots+=m.quantity*entry.slots;
      used.set(m.id,(used.get(m.id)||0)+m.quantity*ship.count);
    }
    assert.ok(slots<=d.slots-d.reserved,'Slots exceeded on a ship');
  }
  for(const m of d.modules){
    if(m.maxCount!=null)assert.ok((used.get(m.id)||0)<=m.maxCount,'Module stock exceeded: '+m.name);
  }
}
test('Greedy performance is visible, clearly labeled as heuristic',()=>{
  assert.match(html,/id="searchMode"/);
  assert.match(html,/value="fast"/);
  assert.match(html,/value="exact"/);
  assert.match(html,/Effizienz: /);
  assert.match(html,/Extraktionslevel\/Slot/);
  assert.match(html,/Fracht\/Slot/);
  assert.match(html,/Optimum nicht garantiert/);
  const {plan}=execute(data());
  assert.equal(plan.method,'heuristic');
  assert.ok(plan.rate>0);
  assert.equal(plan.fleet,undefined);
});

test('Greedy chooses cargo and extraction under shared module inventories',()=>{
  const d=data({ships:6,modules:[
    {id:'laser',name:'Laser',slots:4,cargo:0,extraction:4,maxCount:5},
    {id:'cargo',name:'Fracht',slots:2,cargo:25000,extraction:0,maxCount:7},
    {id:'medium',name:'Fracht M',slots:3,cargo:35000,extraction:0,maxCount:null}
  ]});
  const {plan}=execute(d);
  checkInventory(d,plan);
  assert.ok(plan.level>0 && plan.usableCargo>0);
});

test('Separate laser-only and cargo-only ships when no mixed hull fits',()=>{
  const d=data({ships:2,slots:4,reserved:0,modules:[
    {id:'laser',name:'Laser',slots:4,cargo:0,extraction:5,maxCount:null},
    {id:'cargo',name:'Fracht',slots:4,cargo:15000,extraction:0,maxCount:null}
  ]});
  const {plan}=execute(d);
  checkInventory(d,plan);
  assert.equal(plan.level,5);
  assert.equal(plan.installedCargo,15000);
});

test('Small instances can still be solved exactly; heuristic does not claim equality',()=>{
  for(const d of [
    data(),
    data({ships:2,modules:[
      {id:'laser',name:'Laser',slots:4,cargo:0,extraction:3,maxCount:2},
      {id:'cargo',name:'Fracht',slots:2,cargo:20000,extraction:0,maxCount:3}
    ]}),
    data({ships:4,outbound:22,inbound:22,modules:[
      {id:'small-laser',name:'Laser I',slots:4,cargo:0,extraction:3,maxCount:null},
      {id:'big-laser',name:'Laser II',slots:6,cargo:0,extraction:6,maxCount:null},
      {id:'cargo',name:'Fracht',slots:2,cargo:10000,extraction:0,maxCount:null}
    ]})
  ]){
    const fast=execute(d,'fast').plan;
    const exact=execute(d,'exact').plan;
    checkInventory(d,fast);
    assert.ok(fast.rate<=exact.rate+1e-6,'Heuristic cannot outperform true optimum');
    assert.ok(fast.rate>=exact.rate*0.70,'Heuristic is unusually weak for a small benchmark');
  }
});

test('Dominance pruning drops strictly weaker modules with unrestricted replacement',()=>{
  const d=data({modules:[
    {id:'weak',name:'Weak',slots:7,cargo:10000,extraction:0,maxCount:4},
    {id:'strong',name:'Strong',slots:3,cargo:20000,extraction:0,maxCount:null},
    {id:'laser',name:'Laser',slots:4,cargo:0,extraction:3,maxCount:null}
  ]});
  const {context}=execute(d,'fast');
  context.__data=d;
  const result=Array.from(vm.runInContext('usableModuleIndices(__data)',context));
  assert.ok(!result.includes(0),'Dominated module should be pruned');
  assert.ok(result.includes(1));
  assert.ok(result.includes(2));
});

test('High-efficiency module ratios are evaluated at original values',()=>{
  const d=data({ships:4,slots:28,reserved:0,modules:[
    {id:'mini',name:'Mini-Fracht',slots:2,cargo:600000,extraction:0,maxCount:null},
    {id:'xl',name:'Fracht XL',slots:10,cargo:600000,extraction:0,maxCount:null},
    {id:'laser-mini',name:'Mini-Laser',slots:4,cargo:0,extraction:3,maxCount:null},
    {id:'laser-I',name:'Laser I',slots:5,cargo:0,extraction:1,maxCount:null}
  ]});
  const {plan}=execute(d);
  checkInventory(d,plan);
  assert.ok(plan.rate>0);
});

test('80 ships with scarce module inventory are feasible in the fast mode',()=>{
  const d=data({ships:80,slots:32,reserved:4,modules:[
    {id:'miniLaser',name:'Mini-Asteroiden-Laser',slots:4,cargo:0,extraction:3,maxCount:40},
    {id:'bigLaser',name:'Jumbo Laser',slots:40,cargo:0,extraction:40,maxCount:null},
    {id:'cargoMini',name:'Mini-Fracht',slots:2,cargo:600000,extraction:0,maxCount:20},
    {id:'cargoXL',name:'Fracht XL',slots:10,cargo:600000,extraction:0,maxCount:null}
  ]});
  const started=Date.now();
  const {plan}=execute(d,'fast');
  const milliseconds=Date.now()-started;
  checkInventory(d,plan);
  assert.ok(plan.rate>0);
  assert.ok(milliseconds<15000,'Fast mode took too long for an 80-ship bounded scenario: '+milliseconds+' ms');
});
