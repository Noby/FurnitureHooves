# Furniture Hooves – geometrie kopyta krok za krokem

Popis odpovídá `src/core/generateBoot.ts` a je psán tak, aby šel 1:1 zopakovat
v Autodesk Fusion (Python add-in). Názvy parametrů = klíče z `docs/params.schema.json`.
Jednotky: mm. Souřadnice: dno na rovině XY (Z = 0), otevřená strana nahoru (+Z),
model vycentrovaný v ose Z.

## Odvozené hodnoty

| Symbol | Výpočet |
|---|---|
| `Wi`, `Di` (vnitřní) | `legWidth + tolerance`, `legDepth + tolerance` (kruh: `Di = Wi`) |
| `ri` (vnitřní rádius rohů) | `legCornerRadius > 0 ? legCornerRadius + tolerance/2 : 0` |
| `Wo`, `Do` (vnější) | `Wi + 2·wallThickness`, `Di + 2·wallThickness` |
| `ro` (vnější rádius) | `outerCornerRadius` (kruh: plný kruh o průměru `Wo`) |
| `H` (celková výška) | `lift + sleeveHeight` |
| `t(z)` (rozšíření zúžené nohy na stranu) | `max(0, z − lift) · tan(legTaper)` – rozměry nohy se měří u jejího spodku (Z = `lift`) |

Kontrola pro výchozí 50 × 50: `Wi = 51`, `Wo = 57`, `H = 28`.

## Postup ve Fusion

1. **Sketch – vnější profil** na rovině XY: obdélník `Wo × Do` se středem v počátku
   (nebo kruh Ø `Wo`), svislé rohy zaoblit `ro` (Sketch Fillet).
2. **Extrude** profilu do výšky `lift` a dál do výšky `H` s **Taper Angle = −legTaper**
   (rozšiřuje se nahoru; u `legTaper = 0` jedna rovná extruze) → *Body „Boot“*.
3. **Sketch – vnitřní profil** na odsazené rovině Z = `lift`: obdélník `Wi × Di`
   se zaoblením `ri` (nebo kruh Ø `Wi`).
4. **Extrude – Cut** vnitřního profilu od Z = `lift` nahoru „Through All“ s **Taper Angle =
   −legTaper** → dutina kopíruje zúženou nohu (kužel / komolý jehlan) a stěna má všude
   stejnou tloušťku. Zaoblení rohů zůstává po výšce stejné.
   (Alternativně *Shell* nelze použít, protože dno a stěny mají různé tloušťky.)
5. **Chamfer – spodní vnější hrana**: všechny hrany obvodu spodní plochy, vzdálenost
   `bottomChamfer` (45°). Vynechat, je-li 0.
6. **Chamfer – horní vnitřní hrana** (náběh): hrany obvodu otvoru na horní ploše,
   vzdálenost `topChamfer` (45°). Vynechat, je-li 0.
   **Chamfer – horní vnější hrana**: vnější obvod horní plochy, vzdálenost
   `topOuterChamfer` (45°). Vynechat, je-li 0. Platí `topChamfer + topOuterChamfer ≤
   wallThickness − 0,8`.
7. **Hole pro vrut** (jen když `screwEnabled` a `screwPosition = bottom`): na spodní ploše ve středu (0, 0), směr +Z,
   průměr `screwHoleDiameter`, „Through All“:
   - `screwHead = countersunk` → typ *Countersink*, průměr `screwHeadDiameter`, úhel 90°
     (hloubka kužele = `screwHeadDiameter / 4`, tj. kužel se zúží z Ø hlavy na ½ Ø hlavy –
     nezávisí na průměru vrutu),
   - `screwHead = none` → prostý otvor.
   Zahloubení je na **spodní** straně – šroub se zašroubuje zespodu do nohy, hlava
   zůstane zapuštěná a bota stojí rovně.
8. **Boční šroub** (`screwEnabled` a `screwPosition = side`) – viz níže.
9. **Export** těla jako STL/3MF (dno na podložce, bez podpor).

## Boční šroub (`screwPosition = side`)

Otvor je vodorovný, v ose X, prochází stěnou na straně **−X** ve středu (Y = 0)
ve výšce `zc = lift + screwSideHeight`. Zahloubení hlavy je na vnější straně.
U zúžené nohy je stěna ve výšce `zc` posunutá ven o `t(zc)`; kužel nákružku se
protíná se skutečnou (šikmou) stěnou.

1. Potřebná tloušťka materiálu: `required = recess + 1,2 mm`, kde `recess` je
   `screwHeadDiameter / 4` (zápustná hlava vrutu 90°, závisí jen na hlavě), nebo 0
   (bez zahloubení).
2. Zesílení: `extra = max(0, required − wallThickness)`. Je-li `extra > 0`:
   - **Sketch** na rovině YZ: kružnice o poloměru `Rb + extra` se středem (Y = 0, Z = zc),
     kde `Rb = min(rHlavy + 2,5, Do / 2)`.
   - **Extrude – Join** od vnitřní plochy stěny po X = `−(Wi / 2 + wallThickness + extra)`.
   - **Chamfer** obvodové hrany čela, vzdálenost `extra` (45°) → nákružek tvaru komolého
     kužele: čelo o poloměru `Rb`, u stěny `Rb + extra`. Zkosení dokola znamená, že
     nikde není převis strmější než 45° – tiskne se bez podpor. Jen pokud by kužel
     dosáhl podložky (`zc − Rb − extra < 0`), protáhne se nákružek až na podložku.
   - U kulaté nohy se kužel protíná s válcovou stěnou; poloměr u stěny se dopočítá z
     `xStěny² + (Rb + face − xStěny)² = (Wi / 2 + wallThickness)²`.
3. **Hole** na vnější ploše (případně ploše zesílení) v bodě (Y = 0, Z = zc), směr +X,
   průměr `screwHoleDiameter`, do dutiny; zahloubení stejné jako u spodního šroubu.

Validace: `screwSideHeight ≥ r + 1` a `screwSideHeight + rHlavy ≤ sleeveHeight − topChamfer − 0,5`;
hlava ≤ vnitřní hloubka − 2 mm. Pravidlo „zahloubení ≤ lift − 1“ platí jen pro spodní šroub.

## Rozšířená základna (`baseFlare`)

Spodek se rozšíří o `baseFlare` na každou stranu a pod 45° se vrátí ke stěně tak, aby
zkosení skončilo přesně ve výšce dna dutiny (Z = `lift`). Fusion: **Sketch** vnějšího
profilu odsazeného o `baseFlare` → **Extrude – Join** do výšky `lift − baseFlare`,
pak **Loft – Join** k vnějšímu profilu v Z = `lift` (45°). Spodní sražení
`bottomChamfer` se aplikuje na rozšířenou hranu. Platí `baseFlare ≤ lift − bottomChamfer − 0,5`.

## Výztužné sloupky (`reinforce`)

Ve dně pod nohou je mřížka uzavřených svislých dutinek Ø 1 mm (rozteč 6 mm, okraj 2,5 mm
od stěny dutiny, max. 400 ks – pro velké nohy se rozteč zvětší). Dutinky začínají 1,2 mm
nad podložkou a končí 1,2 mm pod dnem dutiny, takže nejsou zvenku vidět. Kolem spodního
vrutu se vynechají (poloměr hlavy + 1,5 mm). Slicer kolem každé dutinky vytiskne perimetry
→ vzniknou plné sloupky nesoucí zatížení v ose Z nezávisle na výplni.
Fusion: **Sketch** bodů mřížky na rovině Z = 1,2 → **Extrude – Cut** kružnic Ø 1 mm do
výšky `lift − 2,4` jako nové těleso a **Combine – Cut** (uzavřené dutiny).
Vyžaduje `lift ≥ 4`.

## Poradce zatížení (není geometrie)

`src/core/load.ts`: síla na nohu = hmotnost / počet nohou · g · 2 (rezerva); tlak pod
nohou = síla / plocha nohy. Podle tlaku se volí stupeň (lehké < 0,25 MPa, střední < 0,6,
vysoké < 1,5, extrémní) s doporučenou výplní, perimetry, plnými vrstvami a materiálem.
Doporučené hodnoty se ukládají do 3MF jako per-object nastavení PrusaSliceru
(`Metadata/Slic3r_PE_model.config`: `fill_density`, `perimeters`,
`top_solid_layers`, `bottom_solid_layers`).

## Implementace na webu (manifold-3d)

Profily jsou konvexní, proto web skládá tělesa jako konvexní obal (hull) vrstvených
2D profilů – zkosení tak vznikají přesně a bez dalších booleovských operací:

```
těleso  = hull( offset(vnější, −bottomChamfer) @ Z=0,
                vnější @ Z=bottomChamfer,
                vnější @ Z=lift,
                vnější + t(H) @ Z=H )
dutina  = hull( vnitřní @ Z=lift,
                vnitřní + t(H−topChamfer) @ Z=H−topChamfer,
                offset(vnitřní + t(H+ε), topChamfer+ε) @ Z=H+ε )
zesílení = hull( kružnice Rb @ X=−face,
                  kružnice Rb+extra @ X=−stěna, −vnitřek )   komolý kužel 45° (boční vrut, extra > 0)
šroub   = spodní: válec Ø screwHoleDiameter (Z −ε … lift+ε) ∪ kužel 90° od Z = −ε
          boční:  válec v ose −X skrz stěnu ∪ kužel 90° od vnější plochy
výsledek = (těleso ∪ zesílení) − dutina − šroub
```

`ε = 0,5 mm` zajišťuje, že řezné nástroje nesdílí stěnu s tělesem (robustní CSG).
Kruhové oblouky: `max(32, ⌈2πr / 0,5 mm⌉)` segmentů na celý kruh, zaokrouhleno na násobek 4.

## Validace (shodná pravidla pro Fusion)

Viz `src/core/validate.ts`:

- rozsahy z `params.schema.json`,
- `legCornerRadius ≤ min(legWidth, legDepth)/2`,
- `outerCornerRadius ≤ min(Wo, Do)/2` a nejtenčí stěna v rohu ≥ 0,8 mm
  (`ro − ri − √2·(ro − wallThickness − ri)` pro `ro > wallThickness + ri`),
- `bottomChamfer < lift` a `< wallThickness`; `topChamfer ≤ wallThickness − 0,8` a `< sleeveHeight`,
- `screwHeadDiameter > screwHoleDiameter`; šroub/hlava ≤ min(`Wi`, `Di`) − 2;
  hloubka zahloubení ≤ `lift − 1`.
