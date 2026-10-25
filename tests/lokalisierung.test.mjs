import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../datenbank/',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const snapshot=JSON.parse(read('referenzdaten.json'));
const context={window:{},Intl};
vm.runInNewContext(read('lokalisierung-de.js'),context);
const de=context.window.EU4Deutsch;
const modules=snapshot.catalogs.modules.modules;

test('belegte Wiki-Lokalisierungen werden tatsächlich deutsch angezeigt',()=>{
  assert.equal(de.name('modules','cargom','Cargo M'),'Fracht M');
  assert.equal(de.name('modules','cargoMini','Mini Cargo'),'Mini-Fracht');
  assert.equal(de.name('modules','laser1','Canon Laser I'),'Laserkanone I');
  assert.equal(de.name('ships','fregate','Frégate'),'Fregatte');
  assert.equal(de.name('research','GPS1','Moteur GPS I'),'GPS-Triebwerk I');
  assert.equal(de.name('buildings','RESEARCH','RESEARCH'),'Forschungszentrum');
  assert.equal(de.origin('modules','cargom'),'Wiki');
  assert.match(de.description('buildings','MINES',{}),/10 %/);
});

test('alle Modulbilder stammen aus den offiziellen Referenz-URLs',()=>{
  assert.equal(Object.keys(modules).length,144);
  for(const [id,mod] of Object.entries(modules)){
    assert.ok(mod.img,'Kein Bild für Modul: '+id);
    assert.match(mod.img,/^https:\/\/eu4\.s3\.eu-west-3\.amazonaws\.com\/modules\//);
    assert.ok(de.name('modules',id,mod.name).length>0,'Kein lokalisierter Name: '+id);
    const summary=de.description('modules',id,mod);
    assert.ok(summary?.includes('Slots'),'Keine deutsche Kurzbeschreibung für: '+id);
  }
});

test('deutsche Moduleffekte beruhen auf realen numerischen Referenzwerten',()=>{
  const cargo=de.description('modules','cargom',modules.cargom);
  assert.match(cargo,/Frachtraum: \+75\.000/);
  const mining=de.description('modules','laserExtractionAsteroid3',modules.laserExtractionAsteroid3);
  assert.match(mining,/Asteroidenextraktion: \+6/);
});

test('Suchkarten zeigen lazy-loaded Modulbilder und deutsche Texte',()=>{
  const html=read('index.html'),app=read('app.js'),css=read('style.css');
  assert.ok(html.indexOf('lokalisierung-de.js')<html.indexOf('app.js'));
  assert.match(app,/window\.EU4Deutsch/);
  assert.match(app,/image\.loading='lazy'/);
  assert.match(app,/card-image/);
  assert.match(app,/de\.description\(/);
  assert.match(app,/Originalname \(FR\)/);
  assert.match(css,/\.result-card:has\(\.card-image\)/);
});

test('GitHub Pages enthält die Lokalisierung',()=>{
  const pages=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.match(pages,/datenbank\/lokalisierung-de\.js/);
});
