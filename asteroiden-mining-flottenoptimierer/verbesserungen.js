/* Zusätzliche Oberfläche und teilbare Konfigurationen – ohne externe Abhängigkeiten. */
'use strict';
(() => {
  const BASIS = 'https://kejith.github.io/empire-universe-tools/asteroiden-mining-flottenoptimierer/';
  const feldNamen = ['ships','slots','reserved','baseCargo','outbound','inbound','unload','interval','resourceRate','maxMining','cargoLimit','limitMode','race'];
  const modulFelder = ['id','name','slots','cargo','extraction','enabled','race'];
  const setzeText = (element, text) => { element.textContent = text; return element; };
  const element = (tag, klasse, text) => {
    const node = document.createElement(tag);
    if (klasse) node.className = klasse;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const alsZahl = value => new Intl.NumberFormat('de-DE', {maximumFractionDigits: 2}).format(value);

  document.title = 'Asteroiden-Mining-Flottenoptimierer · Empire Universe Tools';
  const kopf = document.querySelector('header');
  kopf.prepend(element('div','produktkennung','EMPIRE UNIVERSE TOOLS / MINING'));
  kopf.querySelector('h1').replaceChildren(document.createTextNode('Asteroiden-Mining-'), element('span',null,'Flottenoptimierer'));
  const intro = kopf.querySelector('p');
  intro.firstChild.textContent = 'Finde die beste Kombination aus Extraktion, Frachtraum und Flugzeit für deinen tatsächlichen Ressourcen-Ertrag pro Stunde. ';
  const kopfleiste = element('nav','navigation');
  const start = element('a',null,'Alle Tools');
  start.href = '../'; start.setAttribute('aria-label','Zur Übersicht aller Tools');
  const repo = element('a',null,'Quellcode auf GitHub ↗');
  repo.href = 'https://github.com/kejith/empire-universe-tools'; repo.target='_blank'; repo.rel='noopener noreferrer';
  kopfleiste.append(start,repo);
  kopf.append(kopfleiste);

  // Schnellstart: Die aktive Modulliste bleibt absichtlich unverändert.
  const flotte = document.querySelector('.columns .stack .panel');
  const startbox = element('div','schnellstart');
  startbox.append(element('h3',null,'Schnellstart'));
  startbox.append(element('p','smallprint','Beispielprofile ändern die Eckdaten; deine Modul-Auswahl bleibt erhalten.'));
  const profile = [
    ['80 Fregatten', {ships:80,slots:32,reserved:4,outbound:5,inbound:5,unload:0,interval:5}],
    ['Kurze Flugstrecke', {ships:80,slots:32,reserved:4,outbound:2,inbound:2,unload:0,interval:5}],
    ['Lange Flugstrecke', {ships:80,slots:32,reserved:4,outbound:20,inbound:20,unload:0,interval:5}]
  ];
  const buttons = element('div','actions');
  for (const [name, werte] of profile) {
    const button = element('button','btn profil',name); button.type='button';
    button.addEventListener('click', () => {
      for (const [id, value] of Object.entries(werte)) document.getElementById(id).value = value;
      renderModules(); dirty(); run();
      startbox.querySelectorAll('.profil').forEach(b => b.classList.toggle('ausgewaehlt', b===button));
    });
    buttons.append(button);
  }
  startbox.append(buttons);
  flotte.insertBefore(startbox, flotte.querySelector('hr'));

  const speicherbereich = document.getElementById('exportSettings').parentElement;
  const share = element('button','btn share','Link zur Konfiguration kopieren');
  share.type='button'; share.id='shareConfiguration';
  const send = element('button','btn','Teilen …');
  send.type='button'; send.id='nativeShare'; send.hidden = !Boolean(navigator.share);
  speicherbereich.append(share,send);
  const teilstatus = element('p','help'); teilstatus.id = 'shareStatus';
  speicherbereich.parentElement.append(teilstatus);

  function inUrlKodieren(settings) {
    const payload = {
      v: 1,
      s: feldNamen.map(key => settings[key]),
      m: settings.modules.map(modul => modulFelder.map(key => modul[key]))
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let text = '';
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function ausUrlDekodieren(encoded) {
    if (encoded.length > 24000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Der Freigabelink ist ungültig oder zu lang.');
    const b64 = encoded.replace(/-/g,'+').replace(/_/g,'/');
    const str = atob(b64.padEnd(Math.ceil(b64.length/4)*4, '='));
    const bytes = Uint8Array.from(str, char => char.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if (decoded.v !== 1 || !Array.isArray(decoded.s) || decoded.s.length !== feldNamen.length || !Array.isArray(decoded.m) || decoded.m.length>100)
      throw new Error('Unbekanntes oder ungültiges Freigabeformat.');
    const result = Object.fromEntries(feldNamen.map((key,i)=>[key,decoded.s[i]]));
    result.modules = decoded.m.map(row => {
      if (!Array.isArray(row) || row.length!==modulFelder.length) throw new Error('Ungültige Moduldaten im Link.');
      return Object.fromEntries(modulFelder.map((key,i)=>[key,row[i]]));
    });
    result.schemaVersion = 2;
    return result;
  }
  function erzeugeLink() {
    if (location.protocol==='file:') throw new Error('Teilbare Links benötigen GitHub Pages. Offline: Einstellungen als JSON exportieren.');
    const settings = getRawSettings();
    inputs(); // Prüfung aller aktiven Modulwerte vor dem Teilen.
    const code = inUrlKodieren(settings);
    const url = new URL(BASIS);
    url.hash = 'konfiguration=' + code;
    if (url.href.length>16000) throw new Error('Zu viele benutzerdefinierte Daten für einen zuverlässigen Link. Bitte JSON-Export nutzen.');
    return url.href;
  }
  share.addEventListener('click', async () => {
    try {
      const link=erzeugeLink();
      await navigator.clipboard.writeText(link);
      teilstatus.textContent = 'Konfigurationslink kopiert. Er enthält nur die angegebenen Einstellungen, keine Zugangsdaten.';
    } catch (error) {
      teilstatus.textContent = error.message + ' Alternativ kannst du die Einstellungen als JSON exportieren.';
    }
  });
  send.addEventListener('click', async () => {
    try {
      const url=erzeugeLink();
      await navigator.share({title:'Asteroiden-Mining-Flottenoptimierer',text:'Meine Empire-Universe-Mining-Flotte',url});
    } catch (error) {
      if (error.name!=='AbortError') teilstatus.textContent=error.message;
    }
  });

  const vorherigesDirty = dirty;
  dirty = function() {
    vorherigesDirty();
    if (window.location.hash.startsWith('#konfiguration=') && !window.__ladeFreigabe) {
      history.replaceState(null,'',location.pathname + location.search);
    }
  };

  // Erklärung der wirtschaftlichen Optimierung auf Basis des echten Bauplans.
  const vorherigesRenderResult=renderResult;
  const erklaerung = element('section','erklaerung');
  erklaerung.append(element('h2',null,'Warum diese Flotte?'));
  const warum = element('div','warum-inhalt');
  erklaerung.append(warum);
  const beschreibung = document.getElementById('cycleDescription');
  beschreibung.after(erklaerung);
  const alternativen = document.querySelector('#alternatives').parentElement.parentElement;
  const thead=alternativen.querySelector('thead tr');
  thead.append(element('th',null,'Vergleich'));

  renderResult = function(plan) {
    vorherigesRenderResult(plan);
    const d = plan.data;
    warum.replaceChildren();
    const flight=d.outbound + d.inbound + d.unload;
    const mined=plan.level*d.resourceRate*plan.minutes;
    const grad=plan.usableCargo>0 ? (plan.perTrip / plan.usableCargo * 100) : 0;
    const info=[
      ['Abbauleistung',alsZahl(plan.level)+' Extraktionsstärke × '+alsZahl(d.resourceRate)+' = '+alsZahl(plan.level*d.resourceRate)+' Ressourcen pro Minute.'],
      ['Auslastung','In '+alsZahl(plan.minutes)+' Minuten werden '+alsZahl(mined)+' Ressourcen gefördert. Davon transportierst du '+alsZahl(plan.perTrip)+' ('+alsZahl(grad)+' % des nutzbaren Frachtraums).'],
      ['Warum nicht länger?','Jede zusätzliche Abbauaktion kostet '+alsZahl(d.interval)+' Minuten. Der Optimierer vergleicht mehr Frachtraum mit zusätzlichen Extraktionsmodulen und rechnet '+alsZahl(flight)+' Minuten für Anreise, Rückflug und Entladung ein.']
    ];
    if (d.limitMode==='limit')
      info.push(['Flotten-Frachtlimit','Das eingestellte Limit von '+alsZahl(d.cargoLimit)+' Ressourcen gilt gemeinsam für alle Schiffe und begrenzt die tatsächlich transportierbare Ladung.']);
    if (plan.compositions.length>1)
      info.push(['Spezialisierung','Es werden '+plan.compositions.length+' verschiedene Schiffsausrüstungen kombiniert, damit sich Abbaustärke und gemeinsamer Frachtraum ergänzen.']);
    for (const [titel,text] of info) {
      const block=element('div','begruendung');
      block.append(element('strong',null,titel),element('p',null,text));
      warum.append(block);
    }
    const max=plan.rate;
    for (const tr of document.querySelectorAll('#alternatives tr')) {
      const wert=Number(tr.cells[2].textContent.replace(/\./g,'').replace(',','.'));
      const td=element('td');
      const bar=element('div','vergleichsbalken');
      const fill=element('span'); fill.style.width = Math.min(100,100*wert/max)+'%';
      bar.append(fill);td.append(bar);tr.append(td);
    }
  };

  const shared = new URLSearchParams(location.hash.slice(1)).get('konfiguration');
  if (shared) {
    try {
      window.__ladeFreigabe=true;
      const source=ausUrlDekodieren(shared);
      setSettings(source); inputs();
      window.__ladeFreigabe=false;
      run();
      teilstatus.textContent='Geteilte Konfiguration geladen. Änderungen bleiben zunächst nur in deinem Browser.';
    } catch (error) {
      window.__ladeFreigabe=false;
      teilstatus.textContent='Freigabelink konnte nicht geladen werden: '+error.message;
      setSettings(clone(defaults));
      run();
    }
  }

  const fuss=document.querySelector('.footer');
  const wiki = element('a',null,'Empire-Universe-Wiki');
  wiki.href='https://www.empire-universe.com/wiki#module'; wiki.target='_blank'; wiki.rel='noopener noreferrer';
  fuss.append(document.createTextNode(' · Modulwerte aus der '),wiki,document.createTextNode(' geprüft/ergänzbar. Unabhängiges Community-Tool.'));
})();