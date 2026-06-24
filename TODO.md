Divide cada tarea en un agente distinto para un mejor rendimiento. Converge todo en main.

- **Fondo dinámico y sutil:** Implementa un degradado de fondo con animación lenta. Al activar el modo noche (dark mode), deben aparecer "estrellas" sutiles en la parte superior. En el modo claro (light mode), debe aparecer un efecto de "sol" sutil. El diseño debe ser minimalista y moderno, asegurándose de que este fondo no absorba la atención del usuario ni distraiga del contenido principal.

- Let's put the "How it works" section outside the Gallery, on another tab (so will be Gallery, Submit, Profile and How it works).
- Create an icon for each seedCategory, for any other category create a generic icon. Then substitute the profile icon with the category icon in the skill card on the gallery view and the skill title on  the detail view. On detail view add the profile_id as the skill creator with their icon at the bottom of the box id and source hash section. Add at the bottom of the skill creator the "current submissions for this skill" container. 
- The "current submissions for this skill container" show it in case there is no any element to show (with an "empty" message) and add an info dialog explainning it.
- The "Add service solution" button must have the same dimensions as the "create benchmark" button.
- About the "Run" buttons: Rediseña este botón para que se vea más premium y moderno: mejora la jerarquía entre icono y texto, aumenta el espaciado interno, usa un gradiente azul más refinado, añade una sombra suave para dar elevación, incorpora estados hover y active con microinteracciones sutiles, mejora el contraste y grosor del icono, y mantén una estética minimalista inspirada en Linear, Stripe y Vercel, priorizando claridad, accesibilidad y sensación de alta calidad.
- Elimina completamente el título duplicado dentro de la sección de contenido (ej. “Benchmarks”, “Service solutions”, “Comparative”) ya que esa información ya está representada en los tabs superiores. Mantén los tabs como única fuente de contexto de navegación y conserva únicamente el contenido de la lista debajo. Si es necesario reforzar contexto, reemplazar el título interno por un texto muy sutil y no redundante (ej. ayuda contextual o icono de información discreto), pero nunca repetir el nombre de la sección ni el contador de elementos. Prioriza una UI limpia, tipo Linear/Vercel, reduciendo duplicación visual y ruido cognitivo. P.D: Todo en inglés.
- Only show 4 decimals on reputation values when there is this level of precissions (5.0000 should be 5 and 5.0020 should be 5.002)

- **Rediseña Gallery** con el objetivo principal de reducir drásticamente el estrés de información y la carga cognitiva del usuario. 
  - **MANTENER EL HEADER INTACTO:** NO muevas la barra de búsqueda por encima ni reubiques las estadísticas. El header debe mantener su estructura actual: Título "Skills Gallery", subtítulo "A decentralized registry for AI agent capabilities", elemento de "How it works", y las estadísticas globales (1 SKILLS, 1 SERVICES, 1 RESULTS) en su posición original y prominencia actual.
  - Clarifica la inconsistencia numérica entre "skills registrados on-chain" y el total de skills disponibles (esto se puede hacer con un tooltip sutil en el header si es necesario, pero sin cambiar el diseño del mismo).
  - Debajo del header, la **barra de búsqueda debe ser el elemento dominante** de esa zona con mayor peso visual y contraste.
  - En las tarjetas de skills, establece una jerarquía tipográfica estricta donde el nombre del skill sea grande y negrita, la descripción tenga mayor interlineado y contraste suficiente para cumplir WCAG AA, los tags de dominio se separen visualmente de las métricas operativas (servicios, benchmarks, resultados) y los precios en ERGs se muestren en badges prominentes con color diferenciado; elimina o mitiga el truncamiento agresivo de descripciones mediante tooltips expandibles o vista previa al hover.
  - Para los filtros y navegación, define estados activos claros con fondos rellenos o bordes gruesos, añade contadores de items por categoría, reemplaza el slider confuso de "Min reputation" por un control explícito con rangos predefinidos (Any, >10 ERGs, etc.) e incluye opciones de ordenamiento útiles como reputación, cantidad de servicios y recientemente añadidos.
  - Implementa microinteracciones accesibles: estados hover con elevación de sombra en las tarjetas, etiquetas textuales para los iconos de servicios/benchmarks/resultados, tooltip con dirección completa y botón copiar en la wallet del header (esquina superior), y unificacion del estilo de iconografía.
  - Aplica color-coding consistente por categoría (Analytics, Finance, Security, Infrastructure, AI/MI) para escaneabilidad inmediata, corrige el footer truncado y añade un CTA de registro de skills más visible.
  - Enriquece el flujo de valor reemplazando los números planos de "results" por sparklines o indicadores visuales de confiabilidad, añade un modo comparación de skills mediante checkboxes en las tarjetas.
  
  **Layout objetivo para Gallery (ASCII):**
  ```text
  [Gallery] [Submit] [Profile] [How it works]                                               [0xed...cf 📋]
                                     Skills Gallery
                   A decentralized registry for AI agent capabilities
                                      [How it works ▾]
                              1 SKILLS         1 SERVICES         1 RESULTS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [All (1)] [Analytics (0)] [Finance (0)] [Security (0)] [Infrastructure (0)] [AI/MI (0)] [SAT (1)]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
    │ 🔍 Search skills...                                                       Sort: [Recent ▾]  │
    │                                                                              Min Rep: [Any ▾] │
    └────────────────────────────────────────────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ ☐  [🧩]  BOOLEAN SATISFACTION PROBLEM SOLVER                                               [ 0.5 ERG ]│
  │            A highly efficient solver designed to determine if a given... (tooltip on hover)         │
  │            [SAT] [Computation] [AI]                                                                 │
  │                                                                                                     │
  │            🛠 Services: 1      📊 Benchmarks: 1      📈 Results: ~~~/\___                          │
  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                                        [ + Register New Skill ]
  ```

- Actúa como diseñador UI/UX experto en aplicaciones web3 minimalistas y modernas. Necesito que rediseñes una pantalla de "Reputation Profile" con el siguiente contexto: ERG es un valor que el usuario quema para dar más valor a su perfil y evitar ataques sybil (el usuario ya lo sabe). Existe una sección de datos que el usuario añade voluntaryamente en formato clave-valor (actualmente llamada "R9 data" pero necesita renombrarse a algo más intuitivo como "Profile Data", "Custom Fields" o "About You" porque "R9" confunde al usuario). También debemos mostrar skills, benchmarks, services o resultados que el usuario haya realizado en la app, además de permitir quemar más ERG. Actualmente la pantalla muestra: título "Your Reputation Profile", "Tokens sacrificed", "R9 data" con "name: INHERIT", dirección wallet "edd0b36908...a209cf", valor "0.022 ERG", y un selector de 5 perfiles abajo. Problemas actuales: jerarquía visual plana (todo tiene el mismo peso), layout confuso, espacio mal utilizado, "R9 data" confuso, falta mostrar skills/benchmarks/services, wallet address demasiado prominente. IMPORTANTE: No hay cantidad máxima de ERG así que NO uses barra de progreso para el valor ERG. No especifiques qué datos concretos muestran skills o benchmarks porque eso depende del contexto de la app que tú no conoces. El diseño debe ser limpio, minimalista y moderno, haciendo énfasis visual en lo que requiere más atención del usuario y menos en lo secundario. Usa la paleta de colores ya establecida del proyecto (no te indico colores). Para el selector de perfiles, uno está seleccionado y es el que opera en toda la aplicación, debe ser visualmente claro cuál es el activo. La wallet address debe estar truncada y en posición periférica con baja atención. El valor ERG debe ser el hero element con tipografía significativamente más grande que todo lo demás. El botón "Burn More ERG" debe ser el único CTA principal. Skills, benchmarks y services deben mostrarse con su contenido real (no solo cantidades) pero con atención media, sin competir con el ERG. La sección renombrada de "R9 data" debe ser atención media-baja. Layout sugerido: 
```text
┌─────────────────────────────────────────────────────────────┐
│ REPUTATION PROFILE                              0xed...cf  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐     │
│ │                                                     │     │
│ │                 0.022 ERG                           │     │
│ │                                                     │     │
│ │             [ + Burn More ERG ]                     │     │
│ └─────────────────────────────────────────────────────┘     │
│ ┌────────────────────────┐ ┌───────────────────────────┐   │
│ │ PROFILE DATA           │ │ SKILLS                    │   │
│ │                        │ │                           │   │
│ │ name                   │ │ (contenido según contexto)│   │
│ │ INHERIT                │ │                           │   │
│ │                        │ │                           │   │
│ │ role                   │ │                           │   │
│ │ Developer              │ │                           │   │
│ │                        │ │                           │   │
│ │ [+ Add ]               │ │                           │   │
│ └────────────────────────┘ └───────────────────────────┘   │
│ ┌────────────────────────┐ ┌───────────────────────────┐   │
│ │ BENCHMARKS             │ │ SERVICES & RESULTS        │   │
│ │                        │ │                           │   │
│ │ (contenido según ctx)  │ │ (contenido según ctx)     │   │
│ │                        │ │                           │   │
│ └────────────────────────┘ └───────────────────────────┘   │
│ │ ─────────────────────────────────────────────────────────│
│ │ ACTIVE PROFILE                                           │
│ │ ● ● ● ● ○                                               │
│ └─────────────────────────────────────────────────────────┘
```
Jerarquía de atención: NIVEL 1 máxima atención (ERG valor con tipografía 3x más grande que body, botón Burn More ERG como único CTA principal), NIVEL 2 atención media (Skills y Benchmarks mostrados con su contenido real, sin especificar qué datos exactos porque depende del contexto), NIVEL 3 baja atención (Profile Data renombrado sin "R9", Services & Results, wallet truncada en esquina). Para el selector de perfiles: el activo debe tener contorno más marcado y relleno sutil, los inactivos más tenues/translúcidos, incluir opción de crear nuevo con "+" y borde discontinuo, etiqueta "Active Profile" para comunicar que opera globalmente. Proporciones tipográficas relativas: ERG value 3x del body, section titles 0.9x uppercase con espaciado amplio, body como base, labels 0.85x más tenue, metadata 0.8x aún más tenue. Espaciado: mucho entre ERG hero y resto, medio entre cards nivel 2, compacto dentro de cada card. Entrega el rediseño completo manteniendo el estilo minimalista y moderno.

- **Gestión de parámetros en la URL:** Cuando el usuario acceda a la vista de detalles de un skill, se debe agregar automáticamente `?skill=skill_id` a la URL (permitiendo compartir o refrescar la página). De igual forma, al entrar a un perfil, se debe agregar `?profile=profile_id` a la URL.

- **Mejoras de la pantalla de Detalle del Skill (Skill Detail View):** Basándote en la captura actual, rediseña esta vista para reducir la carga visual y mantener la estética minimalista (Linear/Vercel). La descripción larga debe tener mejor espaciado, interlineado y contraste (evitar bloques de texto densos). Las métricas dentro de cada benchmark (ej. Execution time, Memory, Clauses & Literals) deben presentarse en tarjetas "ghost" (fondo sutil y bordes muy suaves) con tipografía monoespaciada para los valores numéricos y labels tenues, evitando que parezca una tabla cruda sin estilo. El botón "Open discussion" debe tratarse como un elemento secundario (estilo text-link o botón fantasma) para no competir con los CTAs principales ("Add Service Solution" y "Create Benchmark"). Recuerda aplicar aquí la regla de no duplicar títulos (si el tab ya dice "Benchmarks", no repitas el título dentro) e integra sin falta: el icono de la categoría reemplazando el título, el bloque del creador (`profile_id` + icono) debajo de ID/Source Hash, y el contenedor de "current submissions" debajo del creador.