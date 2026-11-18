# Knutselkamer in 3D

Een kamer van 278 bij 427 cm, nagebouwd als three.js-scene op basis van een iPhone LiDAR-scan. De wand tussen camera en kamer valt weg, zodat je van buitenaf naar binnen kijkt. Elk meubel is een los onderdeel dat je kunt selecteren, verslepen en een kwartslag draaien. Het doel is spelen met de indeling: bestaande meubels verplaatsen en later vervangen door meubels die nog gekocht of gebouwd worden.

## Bekijken

`https://knutselkamer.test` start de Vite dev-server via de gedeelde Caddy. De pagina herlaadt zelf bij elke wijziging in de broncode en na een herstart van de server. Het camerastandpunt staat in de URL (`?camera=x,y,z`), dus een herlaad laat het beeld staan. Verplaatste meubels blijven per browser bewaard; "Zet indeling terug" herstelt de gekozen indeling.

Het paneel "Maten" linksboven toont de binnenmaten van de kamer, de indelingen waartussen je kiest en drie oppervlaktes: vrije vloer, tafelhoogte en bovenop de kasten. Klik op een oppervlakte om de getelde vlakken in de kamer te kleuren en de opbouw te zien. Een tafel telt op de vloer als bezet, ook als er ruimte onder is.

Selecteer de vakkenkast om er een bedkast in te bouwen: een horizontaal opklapbed van 215 cm breed, 42 cm diep en 111 cm hoog, met bureaublad, in de onderste drie rijen aan de raamkant. Het bed klapt geanimeerd uit; het selectiepaneel noemt de meubels die het uitgeklapte bed zou raken. De kamer heeft één slaapplek: met de bedkast erin verdwijnt de slaapfauteuil, zonder bedkast komt hij terug.

Met "Rondlopen" sta je in de kamer op ooghoogte, met alle wanden en het plafond in beeld. Sleep om rond te kijken, loop met WASD of de pijltjes (op een aanraakscherm met de stick linksonder) en ga terug met Escape of de knop. Meubels en wanden houden je tegen. Het standpunt staat in de URL (`?walk=x,z,draaiing`).

Zodra de scene geladen is, begint het overzicht rond te draaien, met vier seconden geleidelijke versnelling naar maximaal één rondje per 90 seconden. Indrukken, klikken, aanraken, slepen, scrollen of toetsen stoppen de automatische rotatie en beginnen een nieuwe wachttijd van 7 seconden. Losse muisbewegingen en focus- of tabwissels tellen niet mee. Tijdens rondlopen, vasthouden of verslepen en met de systeemvoorkeur voor minder beweging blijft de automatische rotatie uit. De browser kan het tekenen van een verborgen tabblad pauzeren; terugkeren voegt geen nieuwe wachttijd toe. Automatische rotatie overschrijft het bewaarde camerastandpunt niet.

[Onderzoek naar interacties in een andere 3D-kamer](office-interactions.md) beschrijft mogelijke verdere toevoegingen en hun bron.

Zonder Caddy: `npm install` en `npm run dev`.

## Opbouw

- `src/room.js`: de vier wanden met deur, raam, plinten, radiator, gordijnen en de schilderijen. Alles wat aan een wand hangt verdwijnt samen met die wand.
- `src/furniture/`: één object per meubel met `name`, `size` (breedte, hoogte, diepte in meters) en `build(materials, item)`. De oorsprong ligt op de vloer in het midden van het grondvlak, de voorkant wijst naar lokaal +Z. Optioneel: `footprint` (grondvlakken als dat niet het hele `size`-blok is), `surfaces` (bladen op tafelhoogte of bovenop, met hoogte) en `tucksUnder` (mag onder een tafel staan). `wall-bed.js` is de bedkast die de vakkenkast als variant inbouwt.
- `src/layout.js`: de catalogus van meubeltypen, `scannedLayout` (de plek en draaiing van elk meubel zoals de scan het aantrof) en `arrangements`, de indelingen in het paneel. Een nieuw meubel is een nieuw object in `src/furniture/` plus een regel hier.
- `src/surfaces.js`: grondvlakken, bladen, het vloerraster van een vierkante centimeter en de oranje markering in de kamer.
- `src/facts.js`: het paneel "Maten".
- `src/layout-check.js`: toetst een indeling op overlap, de draai van de deur, de radiator, het uitgeklapte bed en een vrije doorgang van 50 cm vanaf de deur naar elk meubel.
- `src/interaction.js`: selecteren, verslepen binnen de kamer, draaien, de bedkast en het kiezen van een indeling.
- `src/walking.js`: rondlopen in de kamer, met botsing tegen wanden en de grondvlakken van de meubels.
- `src/main.js`: renderer, licht, ambient occlusion en de lichtprobe van de kamer zelf.
- `src/idle-rotation.js`: automatische rotatie na inactiviteit, met ease-in en respect voor de systeemvoorkeur voor minder beweging.

Het assenstelsel is in meters, +Y omhoog, oorsprong op de vloer in het midden van de kamer. De raamwand staat op -Z, de deurwand op -X.

Lichtinstellingen zijn te proberen via de URL: `exposure`, `sun`, `sky`, `window` en `bounce`. De ambient occlusion en kantafvlakking zijn op dezelfde manier bij te stellen: `aoSamples`, `aoDenoise`, `aoScale`, `msaa` (gewone schermen) en `msaaRetina` (pixelverhouding 2 en hoger, standaard 0). Op een retina-scherm zijn de pixels zo klein dat kantafvlakking nauwelijks zichtbaar is, terwijl hij een derde van de rendertijd kostte.

## Van scan naar scene

De ruwe scan staat in `scan/` en blijft buiten git (290 MB, met foto's uit de kamer). Alle maten komen uit de LiDAR-mesh en de scanfoto's, die samen één stelsel delen. RoomPlan (`scan/Room/rooms/room-0.json`) levert alleen de eerste schatting: zijn wanden staan ongeveer 5 graden gedraaid en 10 cm verschoven ten opzichte van de mesh. `tools/roomframe.py` legt het kamerstelsel daarom vast op de wanden uit de mesh.

- `python3 -I tools/survey.py scan/Room walls` controleert dat de vier wanden uit de mesh op het stelsel liggen. Met `box` en `map` meet je een meubel op: omtrek, hoogte en een hoogtekaart van bovenaf.
- `node tools/export-layout.js > reference/layout.json` en daarna `python3 -I tools/measure.py scan/Room reference/layout.json reference/measure` tekenen de gemodelleerde grondvlakken over de mesh, per hoogteband. Elk grondvlak hoort op zijn meubel te vallen.
- `python3 -I tools/mosaic.py scan/Room reference/mosaic` bakt per wand en voor de vloer een rechtgetrokken fotomozaïek op 240 px per meter. Daaruit zijn deur, raam, schilderijen, kleed en mat afgelezen.
- `python3 -I tools/bake_textures.py scan/Room public/baked` trekt elk schilderij recht op zijn eigen vier hoeken, zodat de hoeken van de afbeelding op de hoeken van de lijst vallen. De hoeken staan per schilderij bovenin dat bestand in wandcoördinaten en zijn afgelezen op een uitsnede van de scanfoto met maatraster. Hetzelfde script snijdt de ordnerrij, het prikbord op de kastdeur en het uitzicht uit.

Een meubel verplaatsen of toevoegen in `src/layout.js` begint dus bij een meting met `survey.py`, niet bij een schatting uit een foto.

## Controleren

Met de site draaiend:

- `node tools/check-idle-rotation.js <preview-url>` controleert de wachttijd, ease-in, camerabeweging, onderbreking en hervatting, vasthouden, minder beweging en rondlopen in headless Chromium.
- `node tools/screenshot.js https://knutselkamer.test/ beeld.png` maakt een render in headless Chromium.
- `node tools/check-rearranging.js https://knutselkamer.test/ reference/rearrange` doorloopt selecteren, verslepen, draaien, herladen en terugzetten.
- `node tools/check-wall-bed.js https://knutselkamer.test/ reference/bed` telt de oppervlaktes, bouwt de bedkast in, klapt hem uit, herlaadt en zet terug.
- `node tools/check-layouts.js [id]` toetst de indelingen uit `src/layout.js` zonder browser en meldt per indeling de oppervlaktes en wat in de weg staat.
- `node tools/search-layouts.js <doel> <stappen> <seed>` zoekt met simulated annealing een indeling met de bedkast op zijn plek, met de rug van elk meubel tegen een wand. Doelen: `plain`, `daylight` (werktafel bij het raam), `overview` (zicht op de deur) en `workshop` (werkbladen samen langs één wand). De uitkomst is een startpunt om met de hand af te maken.
- `node tools/check-walking.js https://knutselkamer.test/ reference/walk` loopt de kamer in, tegen een meubel aan, kijkt om en gaat terug naar het overzicht.
- `node tools/check-live-reload.js https://knutselkamer.test/` controleert dat een bronwijziging de pagina herlaadt met behoud van het standpunt.
- `node tools/check-slow-textures.js https://knutselkamer.test/ beeld.png` vertraagt de fototexturen en controleert dat het eerste beeld erop wacht.
- `node tools/measure-frames.js https://knutselkamer.test/ 2` draait de kamer rond op retina-resolutie en meldt de tijd tussen beelden en het aantal tekenopdrachten.
- `node tools/benchmark-render.js https://knutselkamer.test/ "<query>" <map>` meet de rendertijd per beeld op pixelverhouding 1 en 2 en legt vier vaste standpunten vast voor een beeldvergelijking.
- `node tools/find-coplanar.js https://knutselkamer.test/` zoekt vlakken met verschillend materiaal die in hetzelfde vlak liggen en elkaar overlappen. Zulke paren flikkeren in beeld.

## Publiceren

`.github/workflows/pages.yml` bouwt de site bij elke push naar `main` en zet `dist/` op GitHub Pages. De build gebruikt relatieve paden, dus de site werkt ook in een submap.

## Privacy

De texturen in `public/baked/` komen uit foto's van een echte kamer. `tools/bake_textures.py` vervaagt bij het bakken de ingelijste familiefoto's, het prikbord op de kastdeur en de etiketten op de ordners (`BLUR_BEFORE_PUBLISHING`), zodat personen, briefjes en etiketten niet herkenbaar in de site of in git staan. De ruwe scan in `scan/` bevat de onbewerkte foto's en het adres en blijft buiten git.
