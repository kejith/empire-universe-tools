import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../asteroiden-mining-flottenoptimierer/index.html',import.meta.url),'utf8');
const source=JSON.parse(readFileSync(new URL('../datenbank/referenzdaten.json',import.meta.url),'utf8'));
function extractJson(name){
  const hit=html.match(new RegExp('const '+name+' = ([^\\n]+);'));
  assert.ok(hit,name+' missing');
  return JSON.parse(hit[1]);
}
const ships=extractJson('shipCatalog');
const defaults=extractJson('defaults');
const sourceModules=source.catalogs.modules.modules;

test('PA ist Eingabe, Schiffe werden berechnet',()=>{
  assert.match(html,/id="maxPa" type="number"/);
  assert.match(html,/id="shipId"/);
  assert.match(html,/<output id="ships" /);
  assert.match(html,/Math\.floor\(maxPa\/ship\.pa\)/);
  assert.match(html,/if\(ships<1\)/);
  assert.match(html,/if\(ships>300\)/);
});

test('PA-Umrechnung mit offizieller Fregatte: 2.000 ÷ 25 = 80',()=>{
  const fregate=ships.find(ship=>ship.id==='fregate');
  assert.equal(fregate.pa,source.catalogs.ships.ships.fregate.pa);
  assert.equal(fregate.slots,source.catalogs.ships.ships.fregate.emplacement);
  assert.equal(Math.floor(2000/fregate.pa),80);
  assert.equal(Math.floor(2099/fregate.pa),83);
  assert.equal(2099-83*fregate.pa,24);
  assert.equal(Math.floor(24/fregate.pa),0);
  assert.equal(defaults.maxPa,2000);
  assert.equal(defaults.shipId,'fregate');
});

test('Schiffsauswahl enthält nur unterstützte Schiffstypen mit gültigen PA',()=>{
  assert.ok(ships.length>=20);
  assert.ok(ships.every(ship=>ship.pa>0 && ship.slots>0 && ship.slots<=500));
  for(const ship of ships){
    const original=source.catalogs.ships.ships[ship.id];
    assert.equal(ship.pa,original.pa);
    assert.equal(ship.slots,original.emplacement);
  }
});

test('Alle Frachtmodule und Asteroiden-Laser sind dauerhaft im Startkatalog',()=>{
  const expected=Object.entries(sourceModules).filter(([id,m])=>
    (m.type==='cargo'&&Number(m.modifier?.cargo)>0) ||
    (Number(m.modifier?.extraction_asteroid)>0 &&(id.startsWith('laserExtraction')||id==='moduleLaserExtractSystemAlienArtefact')));
  assert.equal(expected.length,17);
  const existing=new Map(defaults.modules.map(m=>[m.id,m]));
  assert.equal(existing.size,expected.length);
  for(const [id,m] of expected){
    const entry=existing.get(id);
    assert.ok(entry,'Missing '+id);
    assert.equal(entry.slots,m.emplacement,id+' slots');
    assert.equal(entry.cargo,m.modifier?.cargo||0,id+' cargo');
    assert.equal(entry.extraction,m.modifier?.extraction_asteroid||0,id+' asteroid mining');
  }
  assert.ok(defaults.modules.some(m=>m.id==='cargoL'));
  assert.ok(defaults.modules.some(m=>m.id==='laserExtractionAsteroid3'));
  assert.ok(defaults.modules.some(m=>m.id==='cargoAlienArtefact'));
  assert.equal(defaults.schemaVersion,3);
});

test('Fracht- und Laser-Tabs sind unabhängig von der Optimierung',()=>{
  assert.match(html,/role="tablist"/);
  assert.match(html,/id="tabCargo"/);
  assert.match(html,/id="tabLaser"/);
  assert.match(html,/if\(\(Number\(module\.extraction\)>0\?'laser':'cargo'\)!==activeModuleTab\)continue/);
  assert.match(html,/modules:modules\.filter\(m=>m\.enabled/);
  assert.match(html,/permanentModuleIds\.has\(module\.id\)/);
});

test('Konfiguration bleibt zu alten Links und Speicherständen kompatibel',()=>{
  assert.match(html,/const fieldsV2=/);
  assert.match(html,/const fieldsV3=/);
  assert.match(html,/const fieldsOld=/);
  assert.match(html,/const payload=\{v:4/);
  assert.match(html,/\[1,2,3,4\]\.includes\(value\.v\)/);
  assert.match(html,/const budget=data\.maxPa!=null \? data\.maxPa : data\.ships!=null\?Number\(data\.ships\)\*ship\.pa/);
  assert.match(html,/modules=defaults\.modules\.map\(base=>existing\.get\(base\.id\)\|\|clone\(base\)\)/);
});
