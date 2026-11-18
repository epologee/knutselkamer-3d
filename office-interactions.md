# Interacties in de 3D-office van Jankees

Onderzocht op 18 november 2026: [de gepubliceerde 3D-office](https://jankeesvw.com/3d-office/) en de JavaScript-modules die deze pagina zelf laadt. Dit is een inventaris van de huidige versie, met voorstellen voor de knutselkamer apart van de bevindingen. Er is geen oorspronkelijke repository of licentie voor hergebruik van de applicatiecode vastgesteld; de voorstellen gaan over zelf implementeren van gedrag.

## Automatische beweging en belichting

De [entry-module](https://jankeesvw.com/3d-office/assets/index-CElnXWnI.js) zet `OrbitControls.autoRotate` meteen aan, met snelheid `0.5`, tenzij `prefers-reduced-motion: reduce` geldt. Het eerste `start`-event van de bediening zet de automatische beweging uit. Er staat geen idle-timer die haar opnieuw aanzet. In headless Chromium is gecontroleerd: bij starten draait de camera, na pointerbediening is `autoRotate` uit en na 11 seconden blijft dat zo.

Dezelfde module kiest bij het laden `evening` wanneer `prefers-color-scheme: dark` geldt en de URL geen `mood` bevat. `?mood=evening` forceert avond; `?mood=day` voorkomt de automatische dark-modekeuze. De applicatie leest hiervoor geen lokale klok. Het besturingssysteem kan zijn dark mode wel op een tijdschema schakelen, waardoor de site indirect tijdsafhankelijk kan lijken. De voorkeur wordt bij het laden gelezen, zonder live media-querylistener. De dag- en avondkeuze is ook in Chromium gecontroleerd.

Klikken op het [raam](https://jankeesvw.com/3d-office/assets/window-lJq_kWkJ.js) schakelt de avondverlichting en daarmee tegelijk hanglampen, booglamp en haard. In avondstand gaat het directe zonlicht uit, wordt het raamlicht zwakker en blauwer en wordt de foto buiten donkerblauw getint. De warme binnenlampen en het haardvuur nemen de verlichting over. In de draaiende site is gecontroleerd dat klikken op het raam vanuit avondstand het zonlicht terugzet op intensiteit 6; het veld `mood` blijft daarbij zelf `evening`, dus dat veld alleen bewijst de actuele verlichtingsstaat niet.

## Klikbare verrassingen

De draaiende scene registreert 53 klikbare objecten. Die telling omvat zowel speelse interacties als doorklikbare tekst. De onderstaande gedragingen zijn uit de modules afgelezen; ze zijn niet elk afzonderlijk in de browser doorlopen.

| Object | Gedrag en bron | Mogelijke toepassing |
| --- | --- | --- |
| Bureau | [Het hele bureaublad met spullen gaat in 3,5 seconden omhoog of omlaag.](https://jankeesvw.com/3d-office/assets/desk-UPi1qir6.js) | Een bestaande echte verstelbare functie bedienen, met onderscheid tussen object bedienen en meubel verslepen. |
| Monitor | [Klikken wisselt met een schuifanimatie tussen drie schermbeelden.](https://jankeesvw.com/3d-office/assets/desk-UPi1qir6.js) Eén toont code die de verstelbaarheid van het bureau verraadt; een ander toont de eigen 3D-office in een browser. | Op de laptop of muziekcomputer wisselen tussen relevante schermbeelden. |
| Stoelen | [Twee stoelen maken per klik twee volledige omwentelingen en remmen af in 2,8 seconden.](https://jankeesvw.com/3d-office/assets/seating-Cwjt36WI.js) | Een kleine speelse reactie op de draaistoel. |
| Planten | [Het blad krijgt een willekeurig gerichte impuls en veert gedempt terug.](https://jankeesvw.com/3d-office/assets/kit-DwGfJuix.js) | Een subtiele reactie van kleine losse decoratie. |
| Gitaren | [Zwaaien rond hun ophangpunt en tonen een persoonlijke tekst met verbindingslijnen.](https://jankeesvw.com/3d-office/assets/guitars-Bf80QKXh.js) De aangeroepen extra callback bevat geen geluid. | Een instrument laten reageren zonder geluid onverwacht te starten. |
| Fotolijstjes | [Wiegen aan hun ophangpunt; bij veel foto's verschijnt uitleg met geanimeerde lijnen en tekst.](https://jankeesvw.com/3d-office/assets/gallery-mLFk89nF.js) Sommige labels linken naar een website. | Extra informatie bij zelfgekozen objecten, rekening houdend met de bestaande vervaging van persoonlijke foto's. |
| Gameposter | [Wiegt en onthult dat het de favoriete game uit 1995 was.](https://jankeesvw.com/3d-office/assets/walls-art-Cxtjak45.js) | Persoonlijke achtergrond bij een niet-gevoelig object. |
| Hanglamp | [Schakelt aan/uit en gaat zachtjes slingeren.](https://jankeesvw.com/3d-office/assets/lamps-DktsT696.js) | Een lamp als eigen lichtschakelaar gebruiken. |
| Booglamp | [Schakelt aan/uit; de kap veert na de klik heen en weer.](https://jankeesvw.com/3d-office/assets/arc-lamp-Cv8T-wwz.js) | De bureaulamp afzonderlijk bedienen. |
| Haard | [Klikken schakelt getekende vlammen en flakkerend licht aan/uit.](https://jankeesvw.com/3d-office/assets/fireplace-DNizX0a8.js) De gloed en lichtintensiteit variëren samen. | Alleen toepassen op een object dat werkelijk in de kamer hoort. |
| Lockers | [De drie deuren kunnen afzonderlijk open en dicht.](https://jankeesvw.com/3d-office/assets/north-BROeJDid.js) Binnenin staan gemodelleerde boeken. | De bestaande kastdeur kunnen openen. |
| Printeraccessoire | [Bij de Bambu-printer klapt de kap van de vierkleurige filamentunit open en dicht.](https://jankeesvw.com/3d-office/assets/north-BROeJDid.js) | Werkelijke beweegbare onderdelen van een object bedienen. |
| Kamerdeur | [Kan open en dicht; achter de geopende deur worden een eenvoudige vloer en wand zichtbaar.](https://jankeesvw.com/3d-office/assets/walls-art-Cxtjak45.js) | Een deur bedienen zonder een lege wereld achter de opening te tonen. |

## Ondersteunend gedrag

De entry-module biedt rondlopen met botsingen, WASD/pijltjes, sneller lopen met Shift, een aanraakstick en pointer lock op desktop. Een richtpunt wordt groter bij een klikbaar object. Klikdetectie accepteert minder dan 8 px verplaatsing en minder dan 500 ms vasthouden, zodat slepen niet direct een object bedient. Wanden en plafond schermen interacties af. Het overzicht verbergt wanden aan de camerazijde, terwijl rondlopen alle wanden toont. De pixelverhouding daalt tijdens camerabeweging en herstelt daarna; de scene rendert alleen opnieuw als haar beeld verandert.

## Toepassing in de knutselkamer

De automatische rotatie begint zodra de scene geladen is of 7 seconden na de laatste interactie, met vier seconden ease-in naar maximaal één omwenteling per 90 seconden. Indrukken, klikken, slepen, scrollen en toetsen tellen mee; losse muisbewegingen en focus- of tabwissels niet. De browser kan het tekenen van verborgen tabbladen pauzeren, maar terugkeren start geen nieuwe wachttijd. De rotatie blijft uit tijdens rondlopen of vasthouden en respecteert minder beweging. De browsertest controleert dit gedrag en de bestaande verplaatsroute blijft werken.

Voor verdere toevoegingen zijn een afzonderlijk schakelbare bureaulamp, wisselende monitorschermen en het openen van de kastdeur het meest direct te koppelen aan de aanwezige objecten. Voor belichting volgens de klok is eigen logica nodig; de bron biedt twee vaste sferen op basis van dark mode. Een volgende stap kan ochtend-, dag- en avondlicht zijn, maar daarvoor is hier nog geen werking gebouwd of vastgesteld.
