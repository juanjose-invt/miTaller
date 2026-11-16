# Referencia técnica miTaller (requisitos de diseño y seguridad)

Fecha de consulta: 2026-11-16.

## Cómo leer este documento

- **Regla dura aplicada:** solo hay cifras que aparecen en una fuente abierta con éxito en esta sesión. Junto a cada dato va la URL exacta.
- Donde no hubo fuente fiable se escribe literalmente **SIN FUENTE VERIFICADA**.
- Los datos que solo vi en el texto de un resultado de búsqueda (sin abrir la página) NO se tratan como verificados. Van en la sección final "No verificado".
- Cuando una URL es un PDF, lo descargué con `curl` y lo leí con `pdftotext`, porque la herramienta de fetch no interpreta bien PDFs. El texto citado es el del documento.
- "(conv. propia)" marca una conversión de unidades hecha por mí (pulgadas a mm). No es dato de la fuente.
- **Aviso sobre la norma EN 716-1:** el único texto de la norma que pude abrir es la **vista previa gratuita del borrador FprEN 716-1:2015**, publicada como SIST EN 716-1:2017 en iteh. La edición vigente en España es UNE-EN 716-1:2018+AC:2019 (de pago, no abierta). El texto final podría diferir en detalles. Las cifras de alturas (500/200 mm) vienen de un resumen del laboratorio CATAS de la edición 2017.

---

## 1. CUNA (crítico para la seguridad)

### 1.1 Europa: EN 716-1 (borrador FprEN 716-1:2015 = edición 2017) y UNE-EN 716-1:2018

| Requisito | Valor | Norma / país | Fuente (URL exacta) |
|---|---|---|---|
| Huecos, aberturas y espacios accesibles en el interior (barrotes incluidos) | Deben ser **menores de 7 mm, entre 12 y 25 mm, o entre 45 y 65 mm** (cláusula 4.4.2.1) | EN 716-1 (UE), borrador 2015 | https://cdn.standards.iteh.ai/samples/58462/aa3f912a994c4215ac1497d2d120751c/SIST-EN-716-1-2017.pdf |
| Deducción literal de lo anterior (mía, no escrita así en la fuente) | Quedan prohibidos los huecos entre 7 y 12 mm, entre 25 y 45 mm y por encima de 65 mm. Para separación de barrotes verticales, la banda útil es **45 a 65 mm** | EN 716-1 | misma URL |
| Agujeros de montaje | No puede haber agujeros accesibles de 7 a 12 mm de diámetro, salvo que su profundidad sea menor de 10 mm (4.4.2.2) | EN 716-1 | misma URL |
| Distancia somier-laterales / somier-cabeceros | No debe pasar el cono de 25 mm (4.4.2.3) | EN 716-1 | misma URL |
| Laterales o cabeceros de malla | No debe pasar el cono de 7 mm por los agujeros de la malla (4.4.2.4) | EN 716-1 | misma URL |
| Separación entre lamas del somier | No debe pasar el cono de 60 mm entre dos lamas contiguas (4.4.2.5) | EN 716-1 | misma URL |
| Somier de malla | No debe pasar el cono de 85 mm (4.4.2.6) | EN 716-1 | misma URL |
| Aprisionamiento y cizalla | No debe haber puntos de cizalla accesibles que cierren a menos de 18 mm, salvo que queden siempre por debajo de 5 mm en la última carga de ensayo (4.4.4.3) | EN 716-1 | misma URL |
| Salientes y bordes | Bordes y partes salientes accesibles en uso normal: redondeados o achaflanados, sin rebabas ni aristas vivas (4.4.1.1) | EN 716-1 | misma URL |
| Puntos de enganche | La masa de ensayo no debe quedar sujeta por ninguna parte accesible desde el interior. Las partes de laterales/cabeceros a más de 1 400 mm sobre el somier se consideran no accesibles (4.4.5) | EN 716-1 | misma URL |
| Tornillos autorroscantes | No se pueden usar para fijar ningún componente diseñado para desmontarse al desarmar la cuna para transporte o almacenaje. La nota de la norma incluye en "autorroscantes" los tornillos para madera y para aglomerado (4.4.1.2) | EN 716-1 | misma URL |
| Etiquetas y adhesivos | No pegar etiquetas ni adhesivos en las superficies interiores de laterales y cabeceros, salvo por debajo del nivel del somier (4.4.1.3) | EN 716-1 | misma URL |
| Piezas pequeñas | Ninguna pieza accesible desmontable debe caber entera en el cilindro de piezas pequeñas (4.4.1.4) | EN 716-1 | misma URL |
| Ruedas | Solo permitidas con 2 o más ruedas más al menos 2 apoyos, o con al menos 4 ruedas de las que 2 al menos se puedan bloquear (4.4.1.5) | EN 716-1 | misma URL |
| Cambio de somier a posición más baja | Debe requerir herramienta o accionar un sistema de bloqueo (4.4.7.2) | EN 716-1 | misma URL |
| Lateral móvil en posición baja | Una de las tres condiciones: bloqueo automático, parte inferior siempre por encima del somier, o distancia al suelo mayor de 223 mm (4.4.8.1) | EN 716-1 | misma URL; el valor 223 mm también en https://catas.com/uploads/media/lettinieng.pdf |
| Acabados, pinturas y barnices | El fabricante/importador/vendedor debe aportar verificación de que **todas las partes accesibles cumplen los requisitos de EN 71-3** (4.2.1). Los límites numéricos de migración de EN 71-3 NO los he abierto | EN 716-1 | https://cdn.standards.iteh.ai/samples/58462/aa3f912a994c4215ac1497d2d120751c/SIST-EN-716-1-2017.pdf |

**Alturas y colchón (EN 716-1, edición 2017, resumen de laboratorio):**

| Requisito | Valor | Fuente |
|---|---|---|
| Altura interior con el somier en la posición **más baja** (del somier, o de la marca de espesor máximo del colchón, al borde superior de laterales y cabeceros) | **al menos 500 mm** | https://catas.com/uploads/media/tabella-istruzioni-culle-lettini-eng.pdf (apartado 6 j) y https://catas.com/uploads/media/lettinieng.pdf |
| Altura interior con el somier en la posición **más alta** | **al menos 200 mm** | las mismas dos URL de CATAS |
| Distancia desde cualquier punto de apoyo del pie (foothold) hasta el borde superior | **al menos 500 mm** | https://catas.com/uploads/media/lettinieng.pdf |
| Holgura colchón-laterales/cabeceros | La longitud y anchura del colchón deben ser tales que el hueco **no supere 30 mm** | https://catas.com/uploads/media/tabella-istruzioni-culle-lettini-eng.pdf (apartado 6 l) |
| Marcado | Debe indicarse el espesor máximo del colchón (texto o marca en la cuna a la altura correcta) | https://catas.com/uploads/media/lettinieng.pdf |
| Instrucciones | Debe incluir: no usar más de un colchón, la posición más baja es la más segura, dejar de usarla cuando el niño pueda trepar | https://catas.com/uploads/media/tabella-istruzioni-culle-lettini-eng.pdf |

### 1.2 España: resúmenes de organismos públicos

| Dato | Valor | Fuente |
|---|---|---|
| Barrotes verticales | Separación de **4,5 a 6,5 cm** | https://www.comunidad.madrid/node/73299 (cita UNE-EN 716-1:2018+AC:2019 y UNE-EN 716-2:2018) |
| Lamas del somier | Separación máxima **6 cm** | https://www.comunidad.madrid/node/73299 |
| Malla en laterales o cabeceros | Orificio de malla de **7 mm como máximo** | https://www.comunidad.madrid/node/73299 |
| Hueco colchón-laterales/cabeceros | No superior a **3 cm** | https://www.comunidad.madrid/node/73299 |
| Altura del lateral | **50 cm** desde la parte superior del colchón con el somier en la posición más baja; **20 cm** con el somier en la más alta | https://www.comunidad.madrid/node/73299 |
| Pinturas | La página no da cifras ni menciona pinturas | https://www.comunidad.madrid/node/73299 |

### 1.3 España: recomendaciones de la AEP citadas por Consumer (OJO: no coinciden del todo con la norma)

Fuente: https://www.consumer.es/?p=95609 (artículo que cita a la AEP, no es un texto de la AEP).

- Altura interna: al menos 60 cm, medida desde el punto más profundo hasta el borde superior de la barandilla.
- Distancia mínima entre el punto menos profundo y el borde superior: 30 cm.
- Separación entre barrotes: entre 4,5 y 6,6 cm.
- Holgura colchón-bordes: no más de 2 cm a cada lado.
- Pinturas y barnices: "deben evitarse los que puedan ser tóxicos o nocivos". Sin cifras ni norma.
- Recomienda cuna "homologada, estable, con formas lisas o redondeadas", sin citar una norma concreta.

**Discrepancias a resolver antes de escribir el generador:**

- Barrotes: 6,5 cm (Comunidad de Madrid) frente a 6,6 cm (Consumer/AEP). Usa el límite de la norma (65 mm) por seguridad.
- Holgura del colchón: 3 cm (norma, Madrid) frente a 2 cm (Consumer/AEP). Usa 2 cm como objetivo de diseño si quieres cubrir ambos.
- Altura: la AEP habla de 60 cm de altura interna; la norma pide 500 mm con somier bajo. Usar ≥ 600 mm cubre ambos.

### 1.4 Canadá: Cribs, Cradles and Bassinets Regulations (SOR/2016-152)

Fuente de todo este apartado: https://laws-lois.justice.gc.ca/eng/regulations/SOR-2016-152/FullText.html (leí los primeros 100 000 de 109 593 caracteres; el final, de los anexos, no).

| Requisito | Valor | Sección |
|---|---|---|
| Lateral con el somier en la posición más baja | La superficie superior del lateral, **al menos 660 mm** sobre la superficie superior del somier | s. 25(a)-(b) |
| Parte fija del lateral de acceso, posición más baja | **al menos 510 mm** | s. 25(c) |
| Lateral fijo con el somier en la posición más alta | **al menos 230 mm** | s. 26 |
| Espesor del colchón de cuna | **máximo 150 mm** | s. 22(a)(i) |
| Hueco con el colchón suministrado empujado contra un lado | **no más de 30 mm** | s. 22(b) |
| Aberturas completamente delimitadas | No debe pasar un bloque de **60 x 100 x 100 mm** en ninguna orientación (esta es la regla que limita la separación de barrotes; el texto abierto no da una cifra de "separación de barrotes" como tal) | s. 10(1)-(2), 11 |
| Malla | No debe pasar una sonda de punta hemisférica de **6,3 mm** a 22 N | s. 12(2) |
| Apoyos para el pie (toeholds) | Ningún listón, saliente o repisa horizontal a más de **76 mm** y menos de **510 mm** sobre el somier en posición más baja. Una profundidad de **10 mm o más** se presume apoyo de pie | s. 30 |
| Postes | No sobresalen más de **1,5 mm** sobre el punto más bajo del lateral más alto, medido dentro de 76 mm de la superficie exterior | s. 9(1) |
| Inclinación del somier | No más de **7°** respecto a la horizontal | s. 4 |
| Madera, plástico: superficies | Sin grietas ni rebabas, con los bordes suavizados | s. 15(1) |
| Pinturas y recubrimientos en partes accesibles | Plomo total **máx. 90 mg/kg**; mercurio total **máx. 10 mg/kg**; antimonio, arsénico, cadmio, selenio y bario no deben migrar por encima de **1 000 mg/kg** | s. 3(1) |
| Advertencia obligatoria | No usar si el niño mide más de **90 cm** o puede salir trepando | s. 53 |

### 1.5 Estados Unidos: 16 CFR 1219 (cunas de tamaño completo) y CPSC

| Dato | Valor | Fuente |
|---|---|---|
| Norma aplicable | Cada cuna de tamaño completo debe cumplir ASTM F1169-25 (incorporada por referencia en 16 CFR 1219.2) | https://www.law.cornell.edu/cfr/text/16/1219.2 |
| Separación entre listones | Máximo **2 3/8 pulgadas (6 cm)**. Es el requisito histórico de 16 CFR 1508 y se mantiene en ASTM F1169. El personal de la CPSC recomienda no permitir separaciones más anchas | https://www.cpsc.gov/s3fs-public/ProposedStandardsforFullSizeandNonFullSizeCribsunderSection104CPSIA.pdf (paquete de la CPSC de 2010; documento de 2010, no la norma vigente) |
| Dimensiones interiores de cuna de tamaño completo | **28 ± 5/8 pulgadas** de ancho por **52 3/8 ± 5/8 pulgadas** de largo (71 ± 1,6 cm por 133 ± 1,6 cm, valores del propio documento) | https://www.cpsc.gov/FAQ/Full-Size-Baby-Cribs y el mismo PDF de la CPSC |
| Colchón | Al menos **27 1/4 x 51 1/4 pulgadas** y espesor máximo **6 pulgadas** | https://www.cpsc.gov/FAQ/Full-Size-Baby-Cribs |
| Plomo en pintura y recubrimientos | Máximo **0,009 % (90 ppm)** | https://www.cpsc.gov/FAQ/Full-Size-Baby-Cribs |
| Plomo total en componentes accesibles | Máximo **100 ppm (0,01 %)** | https://www.cpsc.gov/FAQ/Full-Size-Baby-Cribs |
| Lateral con componentes móviles (histórico) | ASTM F1169-09 exigía que no hubiera secciones móviles a menos de **20 pulgadas** sobre el somier en posición más baja, lo que eliminó el lateral abatible clásico | https://www.cpsc.gov/s3fs-public/ProposedStandardsforFullSizeandNonFullSizeCribsunderSection104CPSIA.pdf |
| Altura mínima de lateral EE. UU. vigente | **SIN FUENTE VERIFICADA** (el texto de ASTM F1169-25 no pude abrirlo) | |

### 1.6 Notas de diseño que se deducen de las fuentes abiertas (para el generador)

- Si la plantilla es una cuna que se vende o se regala como producto infantil, apunta a EN 716-1 (UE/España). Para un generador hecho para un aficionado, avisa de que **una cuna de fabricación casera no está certificada** (esto es un comentario de diseño mío, no de una fuente).
- Ningún hueco entre 25 y 45 mm ni entre 7 y 12 mm (EN 716-1). Revisa también el hueco entre somier y laterales: no debe pasar el cono de 25 mm.
- Evita tornillos para madera en piezas desmontables (EN 716-1 4.4.1.2). Usa tornillo métrico con tuerca o inserto.
- Con el somier en la posición más baja, deja la altura interior ≥ 500 mm (EN) y, si quieres cubrir también Canadá, ≥ 660 mm. En posición alta, ≥ 200 mm (EN) o ≥ 230 mm (Canadá).
- Sin apoyos para el pie entre 76 y 510 mm por encima del somier (Canadá s. 30) y a menos de 500 mm del borde (EN).
- Redondear aristas y chaflanar salientes. Postes de esquina a ras del lateral (Canadá s. 9(1): 1,5 mm).

---

## 2. CONEJERA

| Dato | Valor | Fuente |
|---|---|---|
| Espacio mínimo de vida para una pareja de conejos de tamaño medio | **3 m x 2 m**, altura **al menos 1 m**. Un solo conejo necesita el mismo mínimo. Debe ser un solo bloque cerrado y disponible en todo momento. El piso superior de una caseta de dos plantas, plataformas, túneles y tubos conectados **no cuentan** | RWAF: https://rabbitwelfare.co.uk/welfare-need/space-recommendations/ |
| Zona de dormir (caseta/hutch) | Mínimo **1,8 m x 0,6 m x 0,6 m** (6 ft x 2 ft x 2 ft). "Un hutch nunca debe ser el alojamiento único ni principal" | RWAF: https://rabbitwelfare.co.uk/welfare-need/space-recommendations/ |
| Espacio total para dos conejos | "No menos de **3 m x 2 m x 1 m**", incluyendo refugio y zona de ejercicio, con acceso 24/7 | RSPCA (Reino Unido): https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/environment |
| Mínimo absoluto para una pareja | **10 ft x 6 ft x 3 ft = 3 m x 2 m x 1 m**; recomienda más | PDSA: https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/creating-the-ideal-home-for-your-rabbits |
| Altura útil | El conejo debe poder ponerse de pie sobre las patas traseras sin tocar el techo con las orejas | RSPCA y PDSA (mismas URL) |
| Anchura del alojamiento | Mínimo 60 cm (2 ft) para conejos pequeños o medianos, 90 cm (3 ft) para razas grandes | The Rabbit House: https://www.therabbithouse.com/guide_size.asp |
| Altura de la caseta (recomendada por esa guía) | 60 cm (2 ft) para pequeños, unos 90 cm (3 ft) para grandes | The Rabbit House: https://www.therabbithouse.com/guide_size.asp |
| Largo | Suficiente para 3-4 saltos sin que la nariz toque el extremo; un conejo mediano recorre unos 45 cm (18 in) por salto | The Rabbit House: https://www.therabbithouse.com/guide_size.asp |
| Alojamiento mínimo en esa guía | 12 ft² (1,1 m²), p. ej. 6 ft x 2 ft, más una carrera de al menos 32 ft², p. ej. 8 ft x 4 ft | The Rabbit House: https://www.therabbithouse.com/guide_size.asp |
| Altura mínima de jaula (RSPCA Australia) | Al menos **45 cm** para conejos de más de 12 semanas, con orejas totalmente erguidas | https://kb.rspca.org.au/knowledge-base/where-should-i-keep-my-rabbits/ |
| Suelo | Sólido y antideslizante. Los suelos de alambre o con barrotes pueden dañar patas y corvejones. Laminado brillante, madera pulida y baldosa son resbaladizos | RSPCA: https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/environment |
| Suelo (RSPCA Australia) | "Los suelos de alambre deben evitarse"; si no es posible, cubrir con periódico y heno o paja abundante | https://kb.rspca.org.au/knowledge-base/where-should-i-keep-my-rabbits/ |
| Refugio exterior | Elevado del suelo (depredadores, humedad), con malla metálica de calibre grueso, fijaciones fuertes y materiales resistentes al roído | RSPCA: https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/environment |
| Refugio exterior (PDSA) | Resistente, impermeable y elevado del suelo | PDSA: https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/creating-the-ideal-home-for-your-rabbits |
| Tratamientos | Cualquier impermeabilizante o conservante debe ser no tóxico; materiales no tóxicos con bordes lisos y redondeados | RSPCA: https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/environment |
| Protectores de madera: criterios | Al agua (no al disolvente), sin metales pesados, bajo en COV, **no creosota**. Fabricantes no garantizan que sea seguro que lo roan, así que pintar solo el exterior | The Rabbit House (web de aficionados, fuente secundaria): https://www.therabbithouse.com/outdoor/petsafewoodstain.asp |
| Referencia de EE. UU. | Recinto de 8 ft² más 24 ft² de zona de ejercicio, con al menos 4 horas diarias de ejercicio supervisado | MSPCA: https://www.mspca.org/pet-resources/suggestions-for-housing-small-animals/ |

**Sin fuente verificada en esta sesión:**

- Luz de malla recomendada para conejeras (tamaño de apertura): **SIN FUENTE VERIFICADA**. Las páginas oficiales abiertas (RSPCA, PDSA) solo dicen "malla de calibre grueso" y no dan apertura ni calibre.
- Calibre del alambre: **SIN FUENTE VERIFICADA**.
- Maderas a evitar (especies tóxicas, madera tratada a presión): **SIN FUENTE VERIFICADA** en fuente oficial. Solo hay el criterio genérico "no tóxico" de la RSPCA.
- House Rabbit Society: la página abierta (https://rabbit.org/care/habitat/living-space-how-to-set-it-up/) no da medidas; solo dice que la jaula debe ofrecer 3-4 veces la longitud del cuerpo estirado del conejo.

---

## 3. JAULA (aves y pequeños animales)

### 3.1 Aves: separación de barrotes y tamaño mínimo

Fuente de la tabla: Merck Veterinary Manual, https://www.merckvetmanual.com/multimedia/table/minimum-and-bar-spacing-recommendations

| Ave | Jaula mínima (largo x ancho x alto, pulgadas) | Separación de barrotes (pulgadas) | Conversión propia a mm |
|---|---|---|---|
| Periquito, ninfa (cockatiel), inseparable, parrotlet | 20 x 20 x 30 | 0,5 | 12,7 mm; jaula 508 x 508 x 762 mm |
| Cotorra (conure), Poicephalus, caique, guacamayo miniatura | 36 x 24 x 48 | 0,75 | 19 mm; 914 x 610 x 1219 mm |
| Yaco (loro gris), amazona, cacatúa pequeña | 40 x 30 x 60 | "0,751" (así aparece en la página; parece errata de 0,75) | 19 mm si es 0,75 |
| Guacamayo, cacatúa grande | 48 x 36 x 66 | 1,5 | 38 mm; 1219 x 914 x 1676 mm |

### 3.2 Aves: materiales a evitar

| Dato | Fuente |
|---|---|
| "Las fuentes de zinc incluyen cualquier juguete, cadena, **malla**, campana, llave y moneda (posterior a 1982) **galvanizados**" | Merck, Toxicoses of Pet Birds: https://www.merckvetmanual.com/exotic-and-laboratory-animals/pet-birds/toxicoses-of-pet-birds |
| "El alambre galvanizado contiene sobre todo zinc, pero parte puede contener también plomo" | misma URL de Merck |
| "Incluso morder jaulas de alambre galvanizado o juguetes metálicos ha causado envenenamiento por zinc en aves" | VCA Hospitals: https://vcahospitals.com/know-your-pet/zinc-poisoning-toxicity-in-pets |
| Material alternativo recomendado (acero inoxidable) | **SIN FUENTE VERIFICADA** (aparecía en un resultado de búsqueda de Merck para dueños, pero no abrí esa página) |

Nota: la página de Merck sobre toxicosis no menciona "jaulas galvanizadas" como tal; habla de malla y alambre galvanizados como fuente de zinc. La conclusión de evitar galvanizado en jaulas de aves es una inferencia razonable respaldada por el texto de VCA.

### 3.3 Roedores y otros pequeños animales

| Dato | Valor | Fuente |
|---|---|---|
| Ratas | Jaulas con separación de **1/2 pulgada (≈12,7 mm, conv. propia)** | AFRMA: https://afrma.org/bc_ratcagebarspc.htm |
| Jaulas para conejo/cobaya vendidas "aptas para ratas" | Suelen tener **3/4 de pulgada** y son inseguras: una rata adulta puede atascar la cabeza; las jóvenes (5 semanas) se escapan | AFRMA: https://afrma.org/bc_ratcagebarspc.htm |
| Ratas y degús | 1/2" (degús: "como máximo 1/2"") | MSPCA: https://www.mspca.org/pet-resources/suggestions-for-housing-small-animals/ |
| Planeador del azúcar | Barrotes a menos de 1/4", malla de alambre de máximo 1/2", aberturas menores de 1" x 1" | MSPCA (misma URL) |
| Tamaños mínimos (MSPCA) | Hámster o ratón (1-3): jaula de alambre de 12" x 12" x 20" o acuario de 20 galones. Jerbo (1-2): 20" x 20" x 12". Ratas (1-2): 24" x 24" x 24" con varios niveles. Degú (1-3): 24" x 24" x 36". Chinchilla (1-3): 30" x 24" x 15" (ideal 6 x 3 x 2 ft). Cobaya (1-2): 7,5 ft² (30" x 36"); la página tiene el texto de más cobayas muy confuso, hay que verificarlo | MSPCA (misma URL) |
| Suelos de alambre | La página desaconseja plataformas o fondos de malla (abrasión de patas, atrapan dedos y colas); prefiere fondo sólido con parte superior de alambre | MSPCA (misma URL) |

**Sin fuente verificada:** separación para ratones y hámsteres (**SIN FUENTE VERIFICADA**), tamaño de jaula de cobayas en RSPCA (la página de RSPCA Victoria dio 404), aves de tamaño intermedio con fuente AAV (**SIN FUENTE VERIFICADA**), diámetro/calibre de varilla para jaulas.

---

## 4. TORNILLERÍA EN MADERA

### 4.1 Reglas de la USDA (Wood Handbook, capítulo 8 "Fastenings", FPL-GTR-190, 2010)

Fuente única de este apartado: https://research.fs.usda.gov/download/treesearch/37424.pdf (el host fpl.fs.usda.gov dio error 502 a través del proxy, por eso uso este espejo oficial de la USDA).

- El diámetro de raíz de la mayoría de tornillos es **aproximadamente dos tercios** del diámetro del vástago.
- Taladro guía (lead hole) para la fórmula de arranque: unos **70 % del diámetro de raíz en maderas blandas** y unos **90 % en maderas duras**.
- Para cargas laterales: la parte del taladro que recibe el vástago debe tener el diámetro del vástago o algo menos; la parte que recibe la rosca, el diámetro de raíz en maderas densas, o algo menos en maderas poco densas.
- La fórmula lateral (ec. 8-13) se aplica cuando la penetración en la pieza que recibe la punta es **no menor de 7 veces el diámetro del vástago** y cuando la pieza lateral y la principal tienen densidad parecida.
- El espesor de la pieza lateral debe ser aproximadamente **la mitad de la profundidad de penetración** del tornillo en la pieza que sujeta la punta. La distancia a testa (end distance) no debe ser menor que el espesor de la pieza lateral, y la distancia a borde no menor que **la mitad** de ese espesor.
- Con penetración de 7 diámetros se obtiene aproximadamente 4 veces la carga de la ecuación; a menor penetración la carga baja casi proporcionalmente (con 4 diámetros, menos de 3 veces).
- Tornillos en testa (end grain): unos **75 %** de la carga de arranque en cara lateral.
- Se recomienda lubricar el tornillo con jabón o similar para facilitar la inserción en maderas densas; casi no afecta al arranque.
- Los tornillos se atornillan siempre; nunca se clavan a martillo.
- Diámetros de vástago por calibre (Tabla 8-9): n.º 4 = 2,84 mm (0,112 in); n.º 5 = 3,18 (0,125); n.º 6 = 3,51 (0,138); n.º 7 = 3,84 (0,151); n.º 8 = 4,17 (0,164); n.º 9 = 4,50 (0,177); n.º 10 = 4,83 (0,190); n.º 11 = 5,16 (0,203); n.º 12 = 5,49 (0,216); n.º 14 = 6,15 (0,242); n.º 16 = 6,81 (0,268); n.º 18 = 7,47 (0,294); n.º 20 = 8,13 (0,320); n.º 24 = 9,45 (0,372). (Alineación calibre-valor deducida del orden de la tabla extraída del PDF; revísala contra el PDF antes de usarla.)
- Aglomerado: se recomiendan tornillos de rosca total; el par máximo antes de pelar la rosca es casi constante con taladros guía de 0 a 90 % del diámetro de raíz.

### 4.2 Fabricante: Spax

Fuente: https://spax.us/customer-service

| Tornillo | Taladro piloto en madera dura |
|---|---|
| n.º 8 | 7/64 in |
| n.º 9 | 7/64 in |
| n.º 10 | 1/8 in |
| n.º 14 | 9/64 in |
| 1/4 in | 9/64 in |
| 5/16 in | 5/32 in |
| 3/8 in | 11/64 in |
| 1/2 in | 13/64 in |

- Regla para aplicaciones no estructurales: medir el espesor de la primera pieza (la que se sujeta) y **multiplicarlo por 3**. Ejemplo de la fuente: OSB de 3/4 in pide tornillo de 2-1/4 in.
- La página no da taladros para maderas blandas ni distancias a borde o separación.

### 4.3 Sin fuente verificada

- Regla "2/3 de la longitud en la pieza receptora": la página de McFeely's que la citaba dio 403. **SIN FUENTE VERIFICADA** (la regla de la USDA de 7 diámetros de penetración está arriba).
- Distancias a borde/testa por calibre para tornillos pequeños de carpintería: **SIN FUENTE VERIFICADA** (solo la regla de la USDA de arriba, que es de cálculo estructural).
- Kreg (la URL probada dio 404), Würth, Fischer, AITIM, Fine Woodworking: **SIN FUENTE VERIFICADA**.
- Uso combinado de cola + tornillo: **SIN FUENTE VERIFICADA**.

---

## 5. SOLDADURA DE TUBO ESTRUCTURAL DE PARED FINA (1,5 a 3 mm)

### 5.1 Electrodo revestido E6013 (Lincoln Fleetweld 37)

Fuente 1 (ficha Lincoln, copia alojada en cdn.shopify, no en el dominio de Lincoln): https://cdn.shopify.com/s/files/1/2778/4524/files/c21019.pdf (aplicaciones: "chapa fina", "operable con bajos amperajes en chapa").

| Diámetro | AC (A) | DC± (A) |
|---|---|---|
| 5/64 in (2,0 mm) | 50-80 | 45-75 |
| 3/32 in (2,4 mm) | 75-115 | 70-105 |
| 1/8 in (3,2 mm) | 110-140 | 100-135 |
| 5/32 in (4,0 mm) | 160-200 | 145-180 |
| 3/16 in (4,8 mm) | 205-260 | 185-235 |

Fuente 2 (guía Lincoln Stick Electrode Welding Guide, otra edición del mismo producto, rangos algo distintos): https://ch-delivery.lincolnelectric.com/api/public/content/dd6f6e98d1084c66a0189b143079936f

- Fleetweld 37 / E6013, AC: 3/32 = 75-105 A; 1/8 = 110-150 A; 5/32 = 160-200 A; 3/16 = 205-260 A.

Ficha Hobart/McKay 6013 (otro fabricante, rangos más bajos): https://hobartbrothers.com/wp-content/uploads/hobart-catalog/datasheets/6013.pdf

| Diámetro | Mín. (A) | Óptimo (A) | Máx. (A) |
|---|---|---|---|
| 3/32 in (2,4 mm) | 40 | 70 | 80 |
| 1/8 in (3,2 mm) | 70 | 100 | 120 |
| 5/32 in (4,0 mm) | 130 | 150 | 160 |
| 3/16 in (4,8 mm) | 140 | 190 | 220 |

- Hobart: AC, DCEN o DCEP; "para soldadura fuera de posición, reducir el amperaje un 15 %"; "desarrollado originalmente para chapa fina"; longitud de arco "1/8 a 1/4 in".

### 5.2 Electrodo básico E7018 (Lincoln Excalibur 7018 MR)

Fuente: https://ch-delivery.lincolnelectric.com/api/public/content/1e5acff4045643c0941db43b3728d119?v=a43a00d7 (ficha del producto). La ficha de Excalibur 7018-1 MR da los mismos rangos para estos diámetros: https://ch-delivery.lincolnelectric.com/api/public/content/d0df5913fd7e4fef88756cee9dff7cfe?v=527d9351

| Diámetro | DC+ (A) | AC (A) |
|---|---|---|
| 3/32 in (2,4 mm) | 70-110 | 80-120 |
| 1/8 in (3,2 mm) | 90-160 | 100-160 |
| 5/32 in (4,0 mm) | 130-210 | 140-210 |
| 3/16 in (4,8 mm) | 180-300 | 200-300 |

### 5.3 Electrodo por espesor (chapa en calibres)

Fuente: Lincoln Stick Electrode Welding Guide, sección "High Speed Welding (Sheet Metal)" (chapa de calibre 18 a 12): https://ch-delivery.lincolnelectric.com/api/public/content/dd6f6e98d1084c66a0189b143079936f

- En esa guía, las tablas de Fleetweld 37 / E6013 para chapa de calibre 18, 16, 14, 12 y 10 usan electrodos de **3/32 in (18 ga), 1/8 in (16 ga), 1/8 o 5/32 in (14 ga) y 5/32 in (12 y 10 ga)**, con corrientes AC (dos tablas con valores algo distintos, y dos pendientes de descenso, 0-30° y 30-90°) de **70-85 A (18 ga)**, **105-125 A (16 ga)**, **120-165 A (14 ga; 1/8 o 5/32 in según la tabla)**, **160-185 A (12 ga)** y **170-225 A (10 ga; 5/32 o 3/16 in según la tabla)**. No identifiqué con certeza el tipo de unión de cada tabla (filete, solape, esquina).
- La conversión calibre a mm: **SIN FUENTE VERIFICADA** en esta sesión (la guía no la da). Si la quieres, hay que buscarla en una tabla de calibres.
- Guía de espesor mínimo por electrodo para tubo de 1,5 a 3 mm (3/32 vs 1/8 según espesor, relación mm-electrodo): **SIN FUENTE VERIFICADA** de ESAB/Miller (el resumen de búsqueda no lo abrí).
- No he encontrado en fuente abierta una tabla de E7018 por espesor de chapa para tubo fino. E7018 con 3/32 in (70-110 A DC+) es el diámetro más pequeño de la ficha.

### 5.4 Hilo tubular sin gas (E71T-11), Lincoln Innershield NR-211-MP

Fuente (guía Innershield FCAW-S, 76 páginas, tabla de procedimientos típicos): https://ch-delivery.lincolnelectric.com/api/public/content/5b1a00933782415e98e56639deb63f45?v=405651b4

- Polaridad **DC- (electrodo negativo)**. "Procedimientos típicos, no específicos para ninguna aplicación."
- Limitación del electrodo de 0,030 a 0,045 in: **espesor máximo de chapa 5/16 in (7,9 mm)**. Aplicación: chapa fina a chapa más gruesa, también galvanizada o con recubrimiento de zinc.
- Distancia punta-pieza (CTWD) indicada en esa tabla: 1/2 in para 0,030 in; 1/2 a 5/8 in para 0,035 in.

| Hilo | Velocidad de hilo (in/min / m/min) | Tensión (V) | Corriente aprox. (A) |
|---|---|---|---|
| 0,030 in (0,8 mm) | 50 / 1,3 | 13-14 | 30 |
| 0,030 in | 100 / 2,5 | 13-14 | 60 |
| 0,030 in | 150 / 3,8 | 14-15 | 80 |
| 0,030 in | 200 / 5,1 | 14-15 | 100 |
| 0,035 in (0,9 mm) | 50 / 1,3 | 14-15 | 30 |
| 0,035 in | 70 / 1,8 | 15-16 | 60 |
| 0,035 in | 110 / 2,8 | 16-17 | 115 |
| 0,035 in | 150 / 3,8 | 17-18 | 130 |
| 0,035 in | 200 / 5,1 | 18-19 | 155 |

(Hobart, Miller y ESAB para hilo sin gas: **SIN FUENTE VERIFICADA**; los resultados de búsqueda eran foros o resúmenes que no abrí.)

### 5.5 Preparación de junta, punteado y ajuste

Fuente: Lincoln Stick Electrode Welding Guide, mismo PDF: https://ch-delivery.lincolnelectric.com/api/public/content/dd6f6e98d1084c66a0189b143079936f

- Las tablas de chapa **suponen un ajuste apretado y sujeción o punteado adecuados** para altas velocidades de avance y mínima distorsión. Usar respaldo de cobre siempre que sea posible para reducir el riesgo de quemar el material.
- Con mal ajuste: reducir la corriente, aumentar el ángulo de arrastre; con E6012/E6013, usar un pequeño balanceo rápido para puentear el hueco.
- Con electrodos de alta velocidad (E6012/E6013): depositar toda la soldadura en una pasada, sin balanceo o con balanceo ligero, arrastrando el electrodo y manteniéndose por delante del baño; usar corrientes de la parte alta del rango del electrodo.
- Para chapa, la guía recomienda posicionar la junta 45° a 75° en descendente para máxima velocidad (con E6010/E6011/E6013 de chapa fina).

**Sin fuente verificada:** separación y bisel recomendados para tubo de pared fina, número y longitud de puntos de soldadura, secuencia de soldadura para evitar distorsión en tubo cuadrado, normativa AWS D1.1/D1.3 aplicable. **SIN FUENTE VERIFICADA** para todo esto.

---

## 6. ERGONOMÍA Y MEDIDAS ESTÁNDAR

| Dato | Valor | Fuente |
|---|---|---|
| Altura de mesa de trabajo (oficina) | **72 ± 1,5 cm, hasta 75 cm** | Universidad de Almería, Prevención: https://w3.ual.es/GruposInv/Prevencion/evaluacion/procedimiento/A-Espacio%20de%20trabajo.pdf |
| Altura de asiento de silla de trabajo | **42 a 53 cm** (tabla de asiento de esa guía) | misma URL |
| Silla de oficina tipo A (UNE-EN 13351:2001) | Campo de regulación de la altura del asiento que incluye como mínimo **400-510 mm** | INSST, NTP 1129: https://www.insst.es/es/documentacion/colecciones-tecnicas/ntp-notas-tecnicas-de-prevencion/32-serie-ntp-numeros-1101-a-1135-ano-2018/ntp-1.129-criterios-ergonomicos-para-la-seleccion-de-sillas-de-oficina |
| Regla del codo para altura de trabajo | Alta precisión visual: **10-12 cm por encima** del codo. Trabajo con apoyo de la mano: **5-7 cm por encima**. Libertad de movimiento de las manos: ligeramente por debajo. Materiales pesados: **10-30 cm por debajo** del codo. La tarea más exigente determina la altura | https://w3.ual.es/GruposInv/Prevencion/evaluacion/procedimiento/A-Espacio%20de%20trabajo.pdf |
| Altura de banco de carpintería | Consejos de maestros en Woodworkers Journal: regla de "la mitad de tu altura" (36" para 72"); punto de partida de **34 in**; justo por debajo del codo; otro autor dice que no hay altura "correcta" | https://www.woodworkersjournal.com/whats-right-height-work-bench/ |
| Hueco libre bajo la mesa de oficina | Anchura libre mín. **60 cm**; altura libre mín. **65 cm** (pref. 70 cm) | https://w3.ual.es/GruposInv/Prevencion/evaluacion/procedimiento/A-Espacio%20de%20trabajo.pdf |
| Altura de mesa de comedor | **SIN FUENTE VERIFICADA** (solo hay cifras en resúmenes de búsqueda de webs comerciales que no abrí) | |
| Altura de asiento de banco de madera (sin respaldo) | **SIN FUENTE VERIFICADA** (como referencia, las sillas de trabajo de la fuente de Almería: 42-53 cm) | |
| Fondo y distancia entre baldas | **SIN FUENTE VERIFICADA** | |

### 6.1 Flecha de baldas

Fuente A: Fine Woodworking, "Engineer Shelves With The Sagulator": https://www.finewoodworking.com/2007/01/05/engineer-shelves-with-the-sagulator

- Flecha aceptable: **0,02 in por pie** de longitud de balda (≈0,5 mm por 305 mm, conv. propia). Por encima, "hay que hacer concesiones": madera más rígida, más espesor, más fondo, canto o menos luz.
- Reglas de proporción: reducir la luz una quinta parte duplica la rigidez; aumentarla un cuarto duplica la flecha; **duplicar la luz multiplica la flecha por 8**; **duplicar el espesor la divide por 8**; duplicar el fondo la divide por 2.
- El Sagulator da pautas, no cifras exactas, y no contempla escuadras ni tornillos al fondo del mueble.

Fuente B: Woodbin, medidas reales de balda: https://woodbin.com/ref/shelf-sag-measurements/

- Ensayo con balda de 3/4" en MDF, contrachapado de pino, pino blanco, álamo amarillo, cerezo y roble rojo; luces de 30 a 54 in; fondos de 8, 12 y 16 in; cargas de 20, 30 y 40 lb por pie lineal.
- Criterios de flecha: óptima **0,02 in por pie**; excesiva **0,06 in por pie**; objetivo simplificado del autor **1/10 in o menos**.
- Balda fija sin canto: la flecha medida es **2,5 a 3,5 veces** la calculada; con canto delantero de 1-1/2": **1,5 a 3 veces**.

Fuente C: WoodWeb, "Free Span Limits of Cabinet Shelving": https://www.woodweb.com/knowledge_base/Free_Span_Limits_of_Cabinet_Shelving.html

- Módulos de elasticidad citados (millones de psi): pino blanco del este **1,24**; pino del sur **1,79**; roble rojo **1,82**; arce duro 1,83; álamo amarillo 1,58.
- Un canto macizo de 1-1/4" sobre contrachapado permite aproximadamente un 20 % más de luz.
- Opiniones de foro: mantener baldas a **32 in** sin canto de madera maciza; canto de 5/8" x 1-1/8" válido hasta 36 in; canto macizo de **3/4" x 1"** como mínimo. (Son opiniones, no norma.)
- Fórmula citada (Gene Wengert): flecha = 0,1563 x carga por pulgada de luz x luz⁴ / (módulo x ancho x espesor³).

---

## 7. MEDIDAS COMERCIALES EN ESPAÑA

Cuatro minoristas dieron **403** a la herramienta de fetch y a `curl`: Obramat, Leroy Merlin, Bauhaus y Brico Depot. Por eso **no pude abrir ninguna ficha de producto**. Lo que sí abrí es un catálogo de fabricante de tubo cuadrado.

### 7.1 Tubo cuadrado de acero, catálogo HIASA (Hierros y Aplanaciones, S.A., Asturias), fabricación según UNE-EN 10219-1/-2

Fuente: https://construnews.com/archivos/27606/tubos_cuadrados.pdf (catálogo del fabricante, versión 6/04, hoja PC-02; de 2004, puede haber cambiado).

Peso en kg/m según lado y espesor (se omiten las unidades por paquete):

| Lado (mm) | 1,0 mm | 1,2 mm | 1,5 mm | 2,0 mm | 2,5 mm | 3,0 mm |
|---|---|---|---|---|---|---|
| 20 x 20 | 0,57 | 0,67 | 0,81 | 1,02 | n/d | n/d |
| 25 x 25 | 0,73 | 0,86 | 1,05 | 1,34 | n/d | n/d |
| 30 x 30 | 0,88 | 1,05 | 1,28 | 1,65 | 1,99 | 2,30 |
| 40 x 40 | 1,20 | 1,42 | 1,75 | 2,28 | 2,78 | 3,24 |

(n/d: ese espesor no aparece en la tabla para ese lado. La gama completa va de 16 x 16 a 100 x 100 mm y espesores de 1,0 a 5,0 mm.)

- Tolerancia de espesor: ± 10 % (hasta 5 mm). Tolerancia de lado: 25x25 a 38x38 = ± 0,25 mm; 40x40 a 50x50 = ± 0,30 mm. Rectitud: 0,15 % de la longitud.
- Longitudes: el catálogo habla de "longitud aproximada ≥ 4 000 mm" y "longitud exacta" bajo pedido (mín. 300 mm, máx. 13 000 mm). **No dice que 6 m sea la longitud estándar.**
- Acero: laminado en caliente para espesores > 1,5 mm (máx. 6 mm), laminado en frío para 1 a < 3 mm, y galvanizado para 1 a < 3 mm.
- Una hoja de HIASA indica que sus líneas de tubo soldado producen tubo rectangular desde 20 x 10 mm y 0,8 mm de espesor hasta 150 x 80 mm y 5 mm de espesor: https://construnews.com/archivos/27606/lineas_de_tubos_soldados.pdf. La tabla de pesos de tubo rectangular 40 x 20, 30 x 20, etc.: **SIN FUENTE VERIFICADA**.

### 7.2 Listón de pino cepillado, tablero alistonado, contrachapado, DM y tubo rectangular en tiendas

**SIN FUENTE VERIFICADA por apertura de página.** En la sección 8.3 hay, aparte y claramente marcados como no verificados, los títulos de producto que vi en resultados de búsqueda de Obramat y Leroy Merlin.

---

## 8. NO VERIFICADO / HOSTS FALLIDOS

### 8.1 Hosts bloqueados o con error (y qué hice)

| Host / URL | Resultado | Alternativa usada |
|---|---|---|
| https://www.ecfr.gov/current/title-16/chapter-II/subchapter-B/part-1219 | Redirigió a unblock.federalregister.gov (no seguí la redirección) | https://www.law.cornell.edu/cfr/text/16/1219.2 |
| https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Cribs y la nota de prensa de 1976 | 403 | https://www.cpsc.gov/FAQ/Full-Size-Baby-Cribs y el PDF de la CPSC de 2010 |
| https://enfamilia.aeped.es/printpdf/prevencion/seguridad-en-cuna (AEP) | 403 | https://www.consumer.es/?p=95609 (cita a la AEP) |
| OCU | Ninguna página de cunas de OCU apareció en la búsqueda | Comunidad de Madrid y Consumer |
| ANEC, Health Canada (canada.ca) | No abiertos. Usé el texto de la ley en laws-lois.justice.gc.ca | |
| https://www.lincolnelectric.com/... y https://prodcd.lincolnelectric.com/... | 403 | PDFs de ch-delivery.lincolnelectric.com y copia en cdn.shopify |
| https://ch-delivery.lincolnelectric.com/... (estos sí abrieron) | Los PDFs contienen texto; la herramienta de fetch no los leía, usé curl + pdftotext | |
| https://www.fpl.fs.usda.gov/... (Wood Handbook) | 502 a través del proxy | https://research.fs.usda.gov/download/treesearch/37424.pdf |
| https://www.pdsa.org.uk/.../rabbit-environment | 404 | https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/creating-the-ideal-home-for-your-rabbits |
| https://www.bluecross.org.uk/advice/rabbit/... | 403 | RWAF, RSPCA, PDSA |
| https://rabbit.org/wp-content/uploads/2018/10/Housing.pdf | 404 | https://rabbit.org/care/habitat/living-space-how-to-set-it-up/ (sin medidas) |
| https://www.gov.scot/publications/pet-rabbit-welfare-guidance/pages/4/ | Contenido vacío | |
| https://rspcavic.org/housing-for-guinea-pigs/ | 404 | |
| https://www.msdvetmanual.com/.../heavy-metal-toxicosis... | 404 | Merck y VCA |
| https://www.exoticpetvet.net/avian/zinc.html | Redirigió a un dominio ajeno (ne10vodka.com); no lo seguí | |
| https://theparrotsocietyuk.org/... | Contenido vacío | |
| https://www.mcfeelys.com/drilling_chart | 403 | Spax y Wood Handbook |
| https://www.kregtool.com/learn/pocket-hole-joinery-101/ | 404 | |
| https://www.woodworkingnetwork.com/... | 403 | |
| https://dxf82wtg340bb.cloudfront.net/resources/SPAX_Submittal_Multi-Material_Rev1.pdf | La herramienta de fetch devolvió solo metadatos; no lo leí con pdftotext | |
| https://cdn.standards.iteh.ai/samples/72365/.../ASTM-F1169-09.pdf y la de F1169-10 | 404 | |
| https://www.obramat.es/..., https://www.leroymerlin.es/..., https://www.bauhaus.es/, https://www.bricodepot.es/, https://gabarro.com/... | 403 incluso con curl | |
| https://www.kipp.es/doc/.../K0493_Datasheet_2022_Tubos_redondos_y_tubos_cuadrados--es.pdf | Descarga vacía | |
| https://trendshome.es/en/blog/68_height-and-standard-dimensions-of-dining-tables.html | Abrió pero no tiene medidas | |

### 8.2 Temas o datos pedidos sin fuente verificada

- Cuna: altura mínima de lateral de EE. UU. (ASTM F1169-25); texto completo y final de UNE-EN 716-1:2018+AC:2019; valores numéricos de migración de EN 71-3; guía OCU; guía ANEC; páginas de Health Canada.
- Conejera: luz y calibre de malla; maderas tóxicas o tratadas a evitar en fuente oficial; mínimos de House Rabbit Society y Blue Cross (solo vistos en texto de resultado de búsqueda: HRS 2' x 2' x 4' para un conejo y jaulas de 30 x 36 x 18 in; Blue Cross 3 x 2 x 1 m. **No los uso como datos**).
- Jaula: acero inoxidable como alternativa (fuente de Merck para dueños no abierta); separación para ratones y hámsteres; Association of Avian Veterinarians (solo en resultados de búsqueda); jaula de cobaya de la RSPCA.
- Tornillería: Kreg, Würth, Fischer, AITIM, Fine Woodworking; regla 2/3; cola + tornillo; distancias a borde en carpintería ligera.
- Soldadura: correspondencia calibre-mm; electrodo por espesor en mm de ESAB/Miller; hilo tubular sin gas de Hobart/Miller/ESAB; preparación de junta, punteado y secuencia para tubo fino; AWS.
- Ergonomía: altura de mesa de comedor; altura de asiento de banco; fondo y altura entre baldas.
- Comerciales: listón de pino cepillado, tablero alistonado, contrachapado, DM y tubo rectangular, en cualquier tienda o almacén de hierros, **por apertura de página**.

### 8.3 Visto SOLO como título de producto en resultados de búsqueda (fichas NO abiertas, 403). No es dato verificado

Úsalo solo como pista de qué medidas existen, y confírmalo en la web de la tienda antes de basar un generador en ello.

- Obramat, listón de pino radiata cepillado 2400 x 20 x 20 mm, 2400 x 30 x 30 mm, 2400 x 20 x 15 mm, 2400 x 20 x 10 mm, 2400 x 30 x 10 mm (URL de patrón https://www.obramat.es/productos/liston-de-pino-radiata-cepillado-2400x30x30mm-10786671.html).
- Obramat, listón de pino cepillado 2400 x 9 x 9, 27 x 22, 27 x 13, 48 x 9, 38 x 22 y 13 x 13 mm (patrón https://www.obramat.es/productos/liston-de-pino-cepillado-2400x27x22mm-10007543.html).
- Obramat, listón de abeto cepillado 2400 x 34 x 34, 34 x 21, 34 x 28 y 68 x 34 mm (patrón https://www.obramat.es/productos/liston-de-abeto-cepillado-2400x34x34mm-10007312.html).
- Obramat, tablero de pino macizo 200 x 30 x 1,8 cm y 200 x 50 x 1,8 cm (https://www.obramat.es/productos/tablero-de-pino-macizo-200x30x1-8cm-10008586.html). Leroy Merlin, tablero de pino de 50 x 200 cm y 18 mm, y de 60 x 200 cm y 18 mm (https://www.leroymerlin.es/productos/tablero-madera-pino-de-50x200cm-y-18mm-de-espesor-14946974.html).
- Obramat, tablero aglomerado 244 x 122 x 1,6 cm (https://www.obramat.es/productos/tablero-aglomerado-244x122x1-6cm-10001411.html). Es aglomerado, no DM.
- Obramat, tubo cuadrado de acero 40 x 40 x 1,5 mm 6 m (https://www.obramat.es/productos/tubo-cuadrado-acero-40x40x1-5mm-6m-25056998.html), 30 x 30 x 1,5 mm 1 m, 30 x 30 x 1,5 mm 3 m decapado; tubo rectangular 40 x 30 x 1,5 mm 3 m, 40 x 20 x 1,5 mm 3 m, 30 x 20 x 1,5 mm 3 m.
- Un resumen de búsqueda de FINSA indicaba tableros de fibra (MDF) en 2440 x 1220 mm para 10, 12, 15, 16, 18 y 19 mm (documento https://finsa.com/documents/d/guest/servicio-quick-finsa.pdf), no abierto.
- No encontré ningún dato de contrachapado (10, 15 mm) ni de pino alistonado de 19 mm en ninguna fuente.

---

## 9. FUENTES CONSULTADAS (abiertas con éxito)

**Cuna**
- https://cdn.standards.iteh.ai/samples/58462/aa3f912a994c4215ac1497d2d120751c/SIST-EN-716-1-2017.pdf (vista previa del borrador FprEN 716-1:2015)
- https://catas.com/uploads/media/tabella-istruzioni-culle-lettini-eng.pdf
- https://catas.com/uploads/media/lettinieng.pdf
- https://www.comunidad.madrid/node/73299
- https://www.consumer.es/?p=95609
- https://laws-lois.justice.gc.ca/eng/regulations/SOR-2016-152/FullText.html
- https://www.law.cornell.edu/cfr/text/16/1219.2
- https://www.cpsc.gov/FAQ/Full-Size-Baby-Cribs
- https://www.cpsc.gov/s3fs-public/ProposedStandardsforFullSizeandNonFullSizeCribsunderSection104CPSIA.pdf

**Conejera y jaula**
- https://rabbitwelfare.co.uk/welfare-need/space-recommendations/
- https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/environment
- https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/creating-the-ideal-home-for-your-rabbits
- https://kb.rspca.org.au/knowledge-base/where-should-i-keep-my-rabbits/
- https://www.therabbithouse.com/guide_size.asp
- https://www.therabbithouse.com/outdoor/petsafewoodstain.asp
- https://rabbit.org/care/habitat/living-space-how-to-set-it-up/
- https://www.mspca.org/pet-resources/suggestions-for-housing-small-animals/
- https://www.merckvetmanual.com/multimedia/table/minimum-and-bar-spacing-recommendations
- https://www.merckvetmanual.com/exotic-and-laboratory-animals/pet-birds/toxicoses-of-pet-birds
- https://vcahospitals.com/know-your-pet/zinc-poisoning-toxicity-in-pets
- https://afrma.org/bc_ratcagebarspc.htm

**Tornillería**
- https://research.fs.usda.gov/download/treesearch/37424.pdf
- https://spax.us/customer-service

**Soldadura**
- https://cdn.shopify.com/s/files/1/2778/4524/files/c21019.pdf
- https://ch-delivery.lincolnelectric.com/api/public/content/dd6f6e98d1084c66a0189b143079936f
- https://ch-delivery.lincolnelectric.com/api/public/content/1e5acff4045643c0941db43b3728d119?v=a43a00d7
- https://ch-delivery.lincolnelectric.com/api/public/content/d0df5913fd7e4fef88756cee9dff7cfe?v=527d9351
- https://ch-delivery.lincolnelectric.com/api/public/content/5b1a00933782415e98e56639deb63f45?v=405651b4
- https://hobartbrothers.com/wp-content/uploads/hobart-catalog/datasheets/6013.pdf

**Ergonomía y medidas**
- https://w3.ual.es/GruposInv/Prevencion/evaluacion/procedimiento/A-Espacio%20de%20trabajo.pdf
- https://www.insst.es/es/documentacion/colecciones-tecnicas/ntp-notas-tecnicas-de-prevencion/32-serie-ntp-numeros-1101-a-1135-ano-2018/ntp-1.129-criterios-ergonomicos-para-la-seleccion-de-sillas-de-oficina
- https://www.woodworkersjournal.com/whats-right-height-work-bench/
- https://www.finewoodworking.com/2007/01/05/engineer-shelves-with-the-sagulator
- https://woodbin.com/ref/shelf-sag-measurements/
- https://www.woodweb.com/knowledge_base/Free_Span_Limits_of_Cabinet_Shelving.html
- https://construnews.com/archivos/27606/tubos_cuadrados.pdf
- https://construnews.com/archivos/27606/lineas_de_tubos_soldados.pdf
