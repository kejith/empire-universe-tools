'use strict';
// Aus der vom Nutzer bereitgestellten deutschsprachigen Wiki-Ansicht sowie
// den strukturierten Spielwerten. Originaldaten bleiben unverändert.
window.EU4Deutsch=(()=>{
const wikiModules={
cargos:'Fracht S',cargom:'Fracht M',cargoL:'Fracht L',cargoXL:'Fracht XL',
cargoXL230:'Fracht XL-230',cargoXL270:'Fracht XL-270',cargoMini:'Mini-Fracht',
cargoJumbo:'Jumbo-Fracht',cargoAlienArtefact:'Alien-Artefakt-Fracht',
laser1:'Laserkanone I',laser2:'Laserkanone II',laser3:'Laserkanone III'
};
const wikiShips={sonde:'Sonde',explorateur:'Entdecker',navette:'Raumfähre',
chasseur:'Jäger',corvette:'Korvette',fregate:'Fregatte',
destroyer:'Zerstörer',croiseur:'Kreuzer'};
const wikiResearch={cargos:'Fracht S',cargom:'Fracht M',cargol:'Fracht L',
cargoxl:'Fracht XL',cargoxl230:'Fracht XL-230',cargoxl270:'Fracht XL-270',
cargomini:'Mini Fracht',cargojumbo:'Jumbo Fracht',
GPS1:'GPS-Triebwerk I',GPS2:'GPS-Triebwerk II',
GPS3:'GPS-Triebwerk III',GPS4:'GPS-Triebwerk IV'};
const buildings={
RESEARCH:['Forschungszentrum','Schaltet fortgeschrittene Technologien und Forschungsfähigkeiten frei. Höhere Stufen ermöglichen komplexere Forschungsprojekte.'],
MINES:['Mine','Extrahiert Ressourcen vom Planeten. Jede Stufe erhöht die Ressourcenproduktion um 10 %.'],
COMMUNICATION:['Kommunikation','Erweitert die Kommandoreichweite Ihrer Flotte. Höhere Stufen ermöglichen es Flotten, sich weiter von Ihren Planeten zu entfernen.'],
SHIP_BUILDER:['Schiffsfabrik','Konstruiert neue Schiffe. Höhere Stufen erhöhen die Produktionskapazität (PA) und schalten größere Schiffsklassen frei.'],
SPATIOPORT:['Raumhafen','Verwaltet angedockte Schiffe auf dem Planeten. Höhere Stufen erhöhen die Schiffskapazität und ermöglichen Flottenerstellung.'],
FACTORY:['Fabrik','Produziert Module für Ihre Schiffe. Höhere Stufen schalten fortgeschrittenere Modultypen und schnellere Produktion frei.'],
UNIVERSITY:['Universität','Bildet Wissenschaftler für Ihr Imperium aus. Wissenschaftler beschleunigen Forschung in ihrer Spezialisierung.'],
MARKET:['Markt','Ermöglicht Handel auf dem galaktischen Markt. Höhere Stufen reduzieren Transaktionsgebühren.'],
BARRACKS:['Kaserne','Bildet Soldaten für planetare Verteidigung und Enteroperationen aus. Höhere Stufen erhöhen die Ausbildungsgeschwindigkeit.'],
BUNKER:['Bunker','Bietet sichere Lagerung für Ressourcen und Module. Schützt einen Teil Ihrer Güter bei Angriffen.'],
GOVERNMENT:['Regierung','Verwaltungszentrum Ihrer Kolonie. Erforderlich für planetare Entwicklung und Kolonialisierung.']
};
const miningNames={laserExtractionAsteroid:'Asteroiden-Laser I',
laserExtractionAsteroid2:'Asteroiden-Laser II',laserExtractionAsteroid3:'Asteroiden-Laser III',
laserExtractionMini:'Mini-Asteroiden-Laser',laserExtractionJumbo:'Jumbo-Asteroiden-Laser',
laserExtractionMiniNemoryx:'Verbesserter Mini-Asteroidenextraktor – Nemoryx',
cargoMiniXyrrh:'Verbesserter Mini-Frachtraum – Xyrrh',
moduleLaserExtractSystemAlienArtefact:'Alien-Artefakt-Extraktionslaser'};
const expressions=[
["Réservoir d'hydrogène",'Wasserstofftank'],
['Réservoir de krypton','Kryptontank'],["Collecteur d'Épaves",'Wracksammler'],
['Renforcement de Coque','Rumpfverstärkung'],['Blindage Renforcé','Verstärkte Panzerung'],
['Générateur de Bouclier','Schildgenerator'],['Système de Visée','Zielsystem'],
['Ordinateur de Ciblage','Zielcomputer'],['Ordinateur de Combat','Kampfcomputer'],
['Propulseur Warp','Warpantrieb'],['Moteur GPS','GPS-Triebwerk'],
['Réseau de Minage','Abbaunetzwerk'],['Optimiseur de minage','Abbauoptimierer'],
['Transfert de Module','Modultransfer'],['Transport de Troupes','Truppentransporter'],
["Laser à Astéroïdes",'Asteroiden-Laser'],["Laser d'Extraction",'Extraktionslaser'],
['Camouflage','Tarnung'],['Bouclier','Schild'],['Coque','Rumpf'],
['Amélioré','Verbessert'],['Avancé','Fortgeschritten'],['Basique','Einfach'],
['Massif','Massiv'],['Cargo','Fracht'],['Artefact Alien','Alien-Artefakt'],
['Collecteur','Sammler'],['Préfabrication','Vorfertigung'],
['Minage','Bergbau'],['Recrutement','Rekrutierung'],
['Colonisation','Kolonisierung'],['Explorateur','Entdecker'],
['Chasseur','Jäger'],['Frégate','Fregatte'],['Croiseur','Kreuzer'],
['Intergalactique','Intergalaktisch'],['Transporteur','Transporter']
];
const labels={cargo:'Frachtraum',laser:'Laserschaden',missile:'Raketenschaden',
precision:'Präzision',critical_damage:'Kritischer Schaden',
impulsion:'Impulsantrieb',warp:'Warpantrieb',shield:'Schildpunkte',
coque:'Rumpfpunkte',krypton:'Kryptonkapazität',
extraction_debris:'Wrackextraktion',extraction_asteroid:'Asteroidenextraktion',
scan:'Scanner',soldier_transport:'Soldatentransport',camouflage:'Tarnung',
mining_optimizer:'Abbauoptimierung',transfer_module:'Modultransfer',
mining_network:'Abbaunetzwerk',FUEL:'Treibstoff'};
const types={cargo:'Fracht',engine:'Antrieb',weapon:'Waffen',
defense:'Verteidigung',other:'Spezial',construction:'Konstruktion',
chassis:'Schiffsklassen',general:'Allgemein'};
const fmt=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2});
function translate(value){
 let result=String(value||'');
 for(const [from,to] of expressions)result=result.split(from).join(to);
 return result;
}
function name(category,id,original){
 if(category==='modules')return wikiModules[id]||miningNames[id]||translate(original);
 if(category==='ships')return wikiShips[id]||translate(original);
 if(category==='research')return wikiResearch[id]||translate(original);
 if(category==='buildings')return buildings[id]?.[0]||translate(original||id);
 return translate(original||id);
}
function description(category,id,obj){
 if(category==='buildings')return buildings[id]?.[1]||null;
 if(category==='modules'){
   const effects=Object.entries(obj.modifier||{}).filter(([,value])=>typeof value==='number'&&value!==0)
      .map(([key,value])=>(labels[key]||key)+': '+(value>0?'+':'')+fmt.format(value));
   return 'Modul mit '+fmt.format(obj.emplacement)+' Slots. '+(effects.length?effects.join(' · ')+'.':'Eigenschaften siehe Originaldaten.');
 }
 if(category==='ships')return 'Schiff mit '+fmt.format(obj.emplacement)+' Modulslots und '+fmt.format(obj.pa)+' Baupunkten (PA).';
 if(category==='research'){
   const title=name(category,id,obj.name);
   const numbers=[...String(obj.description||'').matchAll(/[+-]?\d+(?:[,.]\d+)?\s*%/g)].map(x=>x[0]);
   const action=/^Débloque\b/.test(obj.description||'')?'Schaltet „'+title+'“ frei.':'Forschungsprojekt „'+title+'“.';
   return action+(numbers.length?' Prozentwerte im Originaltext: '+numbers.join(', ')+'.':'');
 }
 return null;
}
function origin(category,id){
 return (category==='modules'&&wikiModules[id])||
 (category==='ships'&&wikiShips[id])||
 (category==='research'&&wikiResearch[id])||
 (category==='buildings'&&buildings[id])?'Wiki':'Redaktionell';
}
return {name,description,origin,labels,types};
})();
