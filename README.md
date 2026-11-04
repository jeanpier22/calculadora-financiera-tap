# Calculadora de proyección financiera (Capítulo 6 del TAP)

Herramienta de apoyo para la unidad didáctica **Proyecto Integrador**. Permite construir la proyección financiera a 3 años de un modelo de negocio, entender cada cálculo y descargar un informe en PDF.

> Los datos que trae cargados son un **ejemplo didáctico con cifras ficticias**. No corresponden a ningún grupo.

## Contenido

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Calculadora en el navegador. Se abre con doble clic y funciona sin internet. |
| `Plantilla_Proyeccion_Financiera_TAP.xlsx` | La misma lógica en Excel, con fórmulas vivas (12 hojas). |
| `Informe_ejemplo.pdf` | Resultado del botón «Generar informe (PDF)» con los datos del ejemplo. |
| `js/`, `css/`, `lib/` | Código de la página y librerías para generar el PDF (incluidas, sin dependencias externas). |

## Cómo usarla

1. Abra `index.html`. Lea el recuadro «¿Qué es y cómo se calcula?» de cada sección.
2. Cambie las celdas amarillas (precios, costos, demanda…) y observe cómo se recalculan los resultados.
3. Pulse **Empezar vacío** para ingresar los datos de su proyecto. En cada tabla puede agregar o quitar filas.
4. **Guardar datos** descarga un archivo `.json` para continuar después con **Abrir datos**.
5. **Generar informe (PDF)** descarga el informe con tablas y figuras numeradas, listo para adjuntar al capítulo 6.

## Qué calcula

Demanda y ventas a 3 años · costos variables y fijos · inversión, depreciación y capital de trabajo · préstamo · estado de resultados · flujos de caja económico y financiero · VAN, TIR, periodo de recuperación y beneficio/costo · punto de equilibrio por año (con varios productos) · mercado TAM/SAM/SOM · verificaciones de coherencia.

## Reglas de coherencia que aplica

- El **precio** se decide con el mercado (rango de la competencia y disposición a pagar), no como costo más margen sobre la misma demanda.
- El **punto de equilibrio** usa solo costos fijos y el margen de contribución de cada producto.
- La **demanda del año 1** no puede superar el mercado alcanzable (SOM); la del año 3, la capacidad operativa.
- Aporte propio más préstamo deben cubrir la **inversión total**.

## Simplificaciones (decláralas en tu informe)

Montos en soles sin IGV · proyección anual a 3 años · depreciación lineal sin valor residual · impuesto a la renta sin compensación de pérdidas · el capital de trabajo se recupera en el año 3. El régimen tributario y la tasa deben confirmarse con SUNAT o un contador. La tasa de descuento (COK) es un supuesto que debe justificarse.

## Verificación

La página y el Excel usan exactamente las mismas fórmulas: con los datos del ejemplo ambos dan VAN económico de S/ 19,130 y punto de equilibrio de 1,615 unidades en el año 1.
