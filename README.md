# Empire Universe Tools

Kleine, unabhängig nutzbare Helfer für **Empire Universe 4**.

## Tools

| Tool | Beschreibung | Öffnen |
| --- | --- | --- |
| **Asteroiden-Mining-Flottenoptimierer** | Berechnet die beste Verteilung von Abbau- und Frachtmodulen auf eine Flotte für maximale Ressourcen pro Stunde. | [Optimierer öffnen](https://kejith.github.io/empire-universe-tools/asteroiden-mining-flottenoptimierer/) |

## Asteroiden-Mining-Flottenoptimierer

- Frei konfigurierbare Schiffsanzahl, Slots, reservierte Slots und Flugzeiten.
- Optionale Frachtraumgrenze **für die gesamte Flotte**.
- Frei editierbare Fracht- und Extraktionsmodule, einschließlich Rassenmodule für Nemoryx und Xyrrh.
- Extraktionsstärke und Ressourcenertrag pro Minute konfigurierbar.
- Berücksichtigt ganze 5-Minuten-Abbauaktionen, den Hin- und Rückflug sowie optionale Entladezeit.
- Optimaler Bauplan pro Schiffskonfiguration, Gesamtliste der Module und Vergleich alternativer Abbauzeiten.
- Einstellungen im Browser speichern, importieren, exportieren und als Link teilen.

### Berechnungsmodell

Die Flotte teilt sich den Frachtraum. Extraktions- und Frachtwerte aller Module addieren sich.
Pro Flugrunde werden höchstens `min(Frachtkapazität, Extraktionslevel × Ressourcen/min/Level × Abbauzeit)` Ressourcen transportiert.

```text
Ressourcen pro Stunde =
  min(Frachtkapazität, Level × Ressourcen/min/Level × Abbauzeit)
  × 60 / (Hinflug + Abbauzeit + Rückflug + Entladen)
```

Das Programm sucht diskret über alle zulässigen Schiffsausrüstungen und Abbauzeiten nach dem höchsten **langfristigen** Ressourcenertrag. Das Ergebnis gilt unter den eingegebenen Spielmechaniken und Modulwerten, nicht als verbindliche Aussage über alle Spielregeln.

### Lokale Nutzung

`asteroiden-mining-flottenoptimierer/index.html` im Browser öffnen. Kein Backend und kein Konto nötig.

### Bereitstellung

GitHub Pages veröffentlicht die statischen Dateien über `.github/workflows/pages.yml`.
Falls Pages im neuen Repository noch nicht aktiviert ist, unter **Settings → Pages → Build and deployment → Source: GitHub Actions** auswählen.

---

Unabhängiges Community-Projekt, keine offizielle Verbindung zu Empire Universe.
