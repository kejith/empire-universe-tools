import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const catalog=JSON.parse(read('datenbank/referenzdaten.json'));
const modules=catalog.catalogs.modules.modules;
const ships=catalog.catalogs.ships.ships;
const app=read('datenbank/app.js');
const bridge=read('asteroiden-mining-flottenoptimierer/datenbank-anbindung.js');
const opt=read('asteroiden-mining-flottenoptimierer/index.html');

test('Datensnapshot enthält alle fünf offiziellen Kataloge',()=>{
  assert.equal(Object.keys(ships).length,30);
  assert.equal(Object.keys(modules).length,144);
  assert.equal(catalog.catalogs.research.research.length,210);
  assert.equal(Object.keys(catalog.catalogs.buildings.buildings).length,11);
  assert.ok(catalog.catalogs.constants.mining.speedFormula);
  assert.match(catalog.source,/empire-universe.com/);
});

test('Mining-Referenzdaten enthalten neue Module und Originalwerte',()=>{
  assert.equal(ships.fregate.emplacement,32);
  assert.equal(ships.fregate.pa,25);
  assert.equal(modules.laserExtractionAsteroid3.emplacement,12);
  assert.equal(modules.laserExtractionAsteroid3.modifier.extraction_asteroid,6);
  assert.equal(modules.moduleLaserExtractSystemAlienArtefact.modifier.extraction_asteroid,15);
  assert.equal(modules.cargoMiniXyrrh.modifier.cargo,3000000);
  assert.equal(modules.laserExtractionMiniNemoryx.modifier.extraction_asteroid,14);
});

test('Datenbank zeigt die Quelle und behandelt Originaltext als Text',()=>{
  assert.match(app,/textContent/);
  assert.doesNotMatch(app,/innerHTML\s*=/);
  assert.match(app,/data\.catalogs\[type\]/);
  assert.match(app,/prerequisiteText/);
  assert.match(app,/referenzdaten\.json/);
});

test('Optimierer nutzt einen dauerhaften Referenzkatalog und kann Module per Link aktivieren',()=>{
  assert.match(opt,/const moduleAliases =/);
  assert.match(opt,/laserExtractionAsteroid3/);
  assert.match(opt,/cargoAlienArtefact/);
  assert.match(opt,/permanentModuleIds/);
  assert.match(bridge,/const existing=modules\.find\(m=>m\.id===id\)/);
  assert.match(bridge,/existing\.enabled=true/);
  assert.match(bridge,/switchModuleTab/);
  assert.match(bridge,/if\(!id\)return/);
});

test('Navigation und GitHub Pages veröffentlichen beide Werkzeuge',()=>{
  const home=read('index.html');
  const opt=read('asteroiden-mining-flottenoptimierer/index.html');
  const pages=read('.github/workflows/pages.yml');
  assert.match(home,/href="\.\/datenbank\/"/);
  assert.match(opt,/datenbank-anbindung\.js/);
  assert.match(pages,/datenbank\/referenzdaten\.json/);
  assert.match(pages,/datenbank-anbindung\.js/);
});
