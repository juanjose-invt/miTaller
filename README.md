# miTaller

Manuales paso a paso, en 3D y pieza a pieza, para construir tus propios muebles y elementos de
**carpintería** y **soldadura**. Pensado para quien empieza desde cero.

- **Plantillas** listas para construir (mesas, estanterías, bancos, conejera, cuna, jaula, leñero, mesa de trabajo, puertas, vallas y rejas de forja…).
- **Configurador guiado**: recorrido por apartados con opciones en miniatura 3D, cotas sobre el modelo y tiradores para estirarlo arrastrando; coste con tus precios, peso estimado, avisos de diseño, deshacer/rehacer, guardar y compartir por enlace.
- **Mueble modular**: se compone por cuerpos y huecos (baldas, puertas, cajones) sobre un alzado interactivo.
- **Editor de forja**: patrones de motivos (volutas, aros, rombos, corazones, hojas, barrotes retorcidos) por paño, con simetría.
- **Modo libre**: colocar listones, tableros y tubos a mano, con imanes; la web saca la lista de corte y el manual.
- **Paso a paso en 3D**: la cámara enfoca cada paso, los tornillos entran y los cordones se dibujan; despiece, escala humana y progreso guardado.
- **Plan de corte** optimizado para barras y tableros, **plantillas 1:1** de las piezas curvas y **manual en PDF**.
- **Aprende**: itinerario de proyectos, consejos con fuente y ensambles sin tornillos (occidentales y japoneses) en 3D interactivo.
- **Mi taller**: diseños guardados y comparador, herramientas que ya tienes y precios de tu almacén (todo en el navegador).

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
