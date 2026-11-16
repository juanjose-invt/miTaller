# miTaller

Manuales paso a paso, en 3D y pieza a pieza, para construir tus propios muebles y elementos de
**carpintería** y **soldadura**. Pensado para quien empieza desde cero.

- **Plantillas** listas para construir (mesas, estanterías, bancos, conejera, cuna, jaula, leñero, mesa de trabajo de acero…).
- **Configurador paramétrico**: medidas, forma, detalles y tipo de unión (incluidas uniones sin tornillos). El modelo 3D, la lista de corte, la compra y la tornillería se recalculan con cada cambio.
- **Paso a paso en 3D**: las piezas de cada paso se resaltan, con la posición de cada tornillo, tubillón, punto y cordón de soldadura. Vista de despiece y selección de piezas.
- **Manual en PDF** generado en el navegador: portada, seguridad, lista de la compra, despiece, lista de corte y todos los pasos ilustrados.
- **Consejos** de soldadura, carpintería y ensambles sin tornillos (occidentales y japoneses), cada uno con su fuente.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm run build      # comprobación de tipos + build en dist/
npm run validate   # valida todos los generadores en todo su rango de parámetros
node scripts/shot.mjs mesa "plantilla=comedor" all   # capturas 3D por paso en ./shots
node scripts/pdf.mjs mesa "plantilla=comedor"        # genera el PDF en ./shots
```

Sitio estático (Vite + React + TypeScript + three.js + jsPDF), sin backend. `base` relativo: se puede servir desde cualquier subruta.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/core/` | Modelo de datos (`types.ts`), constructor de piezas (`builder.ts`), listas derivadas (`derive.ts`) |
| `src/generators/` | Un archivo por elemento. Cualquier `Generator` exportado aquí se registra solo |
| `src/three/` | Visor three.js y capturas fuera de pantalla (miniaturas y PDF) |
| `src/pdf/` | Maquetación del manual en PDF |
| `src/data/` | Consejos y ensambles, con sus fuentes |
| `docs/` | Referencia técnica verificada (normas, medidas) e ideas tomadas de manuales reales |

### Añadir un elemento nuevo

Crea `src/generators/<id>.ts` exportando un `Generator` (toma `mesa.ts` como modelo): parámetros, plantillas y una función
`build` que coloca las piezas con `Builder` y describe los pasos. Ejecuta `npm run validate -- <id>`.

## Despliegue

`.github/workflows/deploy.yml` publica `dist/` en GitHub Pages al hacer push a `main` (hay que activar Pages con origen
«GitHub Actions» en los ajustes del repositorio).

## Aviso

Las medidas y técnicas son orientativas. Los datos de seguridad proceden de las fuentes citadas en `docs/referencia-tecnica.md`
y en la sección de consejos; un mueble hecho en casa no está ensayado ni certificado. Usa siempre el equipo de protección adecuado.
