# Empire Universe Tools

Kleine, unabhängige Helfer für **Empire Universe 4**.

## Asteroiden-Mining-Flottenoptimierer

[Online öffnen](https://kejith.github.io/empire-universe-tools/asteroiden-mining-flottenoptimierer/)

Berechnet die maximale langfristige Ressourcenausbeute für eine Flotte unter Berücksichtigung von Frachtmodulen, Abbaumodulen und Flugzeiten.

### Funktionen

- Schiffe, Slots pro Schiff und reservierte Slots frei einstellbar.
- Hin- und Rückflug, Dauer einer Abbauaktion und optional maximale Abbaudauer.
- Optionales Frachtlimit für die **gesamte Flotte**.
- **Abbaueffizienz in Prozent:** 100 % entsprechen 1.000 Ressourcen pro Minute je Extraktionslevel, 80 % entsprechen 800.
- Aktivierbare Module, frei editierbare Werte, Rassenbeschränkungen und **maximale Stückzahl je Modultyp über alle Schiffe**. Leeres Anzahlfeld bedeutet unbegrenzt; 0 bedeutet nicht verfügbar.
- Kein horizontales Scrollen in der Modulliste – auch auf Mobilgeräten.
- Optimale Modulverteilung, Abbauzeit, Ausbeute pro Stunde und exportierbarer Bauplan.
- Lokale Speicherung, JSON-Import/-Export und teilbare Konfigurationslinks.

### Berechnungsmodell

```text
Ressourcen/min pro Extraktionslevel = 1000 × Abbaueffizienz (%) / 100

Ressourcen pro Runde = min(
  nutzbare Fracht der gesamten Flotte,
  Extraktionslevel der gesamten Flotte × Ressourcen/min/Level × Abbauzeit
)

Ressourcen pro Stunde = Ressourcen pro Runde × 60 /
  (Hinflug + Abbauzeit + Rückflug)
```

Die Abbauzeit wird in ganzen Abbauaktionen betrachtet. Module müssen je Schiff in die verfügbaren Slots passen, begrenzte Bestände gelten **global** für die ganze Flotte. Bei zu großen exakten Suchräumen bricht die Berechnung mit einer Fehlermeldung ab, statt eine heuristische Lösung als nachweislich optimal auszugeben.

Die Werte gelten für das gewählte Modell: gemeinsamer Frachtraum, additive Modulwerte, gleichzeitiger Abbau, keine Rohstofferschöpfung und keine zusätzliche Entladezeit. Sie sind keine Garantie für alle Spielmechaniken.

### Lokal ausführen

`asteroiden-mining-flottenoptimierer/index.html` im Browser öffnen. Kein Build-Schritt, keine externen Abhängigkeiten und kein Backend erforderlich.

### Tests

```bash
node --test tests/*.test.mjs
```

GitHub Pages wird über `.github/workflows/pages.yml` bereitgestellt.

---

Unabhängiges Community-Projekt ohne offizielle Verbindung zu Empire Universe.
