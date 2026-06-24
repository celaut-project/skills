# Especificación Técnica: Sistema de Reputación y Puntuación Global Multi-Criterio (Basado en Stake)

Este documento define la arquitectura lógica y matemática para calcular la puntuación de los **Servicios** dentro de la plataforma. El sistema está diseñado bajo un modelo de **confianza en cascada** y mitigación de fraude (*Anti-Sybil*), utilizando el capital apostado (*Stake*) como ancla de reputación.

---

## 1. Modelo de Dominio y Entidades

El sistema se organiza en universos independientes llamados **Skills**. Todo el cálculo de reputación y comparación de rendimiento ocurre de forma aislada dentro de cada Skill.

* **Skill:** El contenedor global (ej: "SAT Solvers", "Image Compression").
* **User:** Entidad que aporta valor monetario (*Stake*) y emite votos o sube resultados.
* **Service:** El software/algoritmo evaluado. Cuenta con su propio *Stake* reputacional.
* **Benchmark:** Una suite de pruebas que define un listado de *Case Descriptors* (dimensiones del problema, ej: número de variables) y *Performance Metrics* (ej: tiempo de ejecución, memoria).
* **Result:** Una ejecución de un *Service* en un *Benchmark* para ciertas dimensiones, aportando los datos crudos de las métricas.

---

## 2. Normalización de Reputación por Skill ($W_e$)

La reputación no es un contador lineal, sino que se basa en el valor monetario real apostado (*Stake*). Para evitar que los usuarios con un capital masivo ("ballenas") invisibilicen por completo a los usuarios pequeños, el programador debe aplicar una **escala logarítmica**.

Para cualquier entidad $e$ (Usuario o Servicio) con un capital apostado $S_e$ dentro de una Skill específica, su reputación normalizada $W_e \in [0, 1]$ se calcula como:

$$W_e = \frac{\log(1 + S_e)}{\log(1 + S_{max})}$$

* $S_e$: Capital apostado por la entidad en esa Skill.
* $S_{max}$: El capital máximo apostado por una única entidad competidora dentro de la misma Skill.

> **Nota para el programador:** Esta normalización debe recalcularse dinámicamente o mediante un *cron* programado cada vez que varíen los *stakes* máximos de la Skill para mantener la escala $[0, 1]$ actualizada.

---

## 3. Puntuación de Opinión de la Comunidad ($R_e$)

Cualquier entidad (Servicio, Benchmark o Resultado) puede recibir votos positivos ($+1$) o negativos ($-1$) por parte de los usuarios. El peso de un voto equivale a la reputación logarítmica del usuario que lo emite ($W_u$).

La **Puntuación de Opinión ($R_e$)** neta de cualquier entidad se calcula aplicando un factor de amortiguación $K$:

$$R_e = \text{scal}\left( \frac{\sum_{i} (Voto_i \cdot W_{u_i})}{\sum_{i} W_{u_i} + K} \right)$$

* $Voto_i \in \{-1, 1\}$
* $K$ (Constante de amortiguación, recomendado $K = 5$): Evita que un único voto de un usuario con reputación $1.0$ catapulte una entidad nueva al 100% de confianza. Requiere tracción.
* $\text{scal}(x)$: Función lineal que mapea el resultado del intervalo $[-1, 1]$ al intervalo de trabajo $[0, 1]$.

---

## 4. Normalización de Métricas de Rendimiento ($N(x)$)

Los resultados crudos no se pueden comparar directamente debido a la heterogeneidad de unidades (milisegundos vs megabytes) y a las dimensiones del problema (*Case Descriptors*).

Para cada dimensión del problema $d$ analizada, se localizan los valores mínimos ($min_d$) y máximos ($max_d$) históricos de la métrica en la base de datos para realizar una normalización de $0$ a $1$:

* **Métricas "Lower is better"** (ej: `execution_time_ms`, `memory_peak_mb`):

$$N(x) = \frac{max_d - x}{max_d - min_d}$$


* **Métricas "Higher is better"** (ej: `solving_success_rate`):

$$N(x) = \frac{x - min_d}{max_d - min_d}$$



---

## 5. Reputación Híbrida del Benchmark ($R_B$)

Un benchmark de alta reputación es aquel validado por la comunidad y adoptado por los mejores servicios. Su reputación final combina ambos factores:

$$R_B = \gamma \cdot Op(B) + (1 - \gamma) \cdot P_{inst}(B)$$

* $\gamma \in [0, 1]$ (Recomendado $\gamma = 0.5$): Equilibrio entre opinión y adopción.
* $Op(B)$: Puntuación de opinión directa recibida por los usuarios (fórmula de la sección 3).
* $P_{inst}(B)$: Prestigio Institucional, calculado a partir de los Servicios que han decidido competir en él (lo que representa un voto de confianza implícito del Servicio hacia el Benchmark):

$$P_{inst}(B) = \left( \frac{\sum_{S \in Participantes} W_S}{\text{Total Participantes}} \right) \cdot \min\left(1, \frac{\text{Total Participantes}}{N_{ideal}}\right)$$

* $W_S$: Reputación basada en el *Stake* del servicio participante.
* $N_{ideal}$ (Recomendado $N_{ideal} = 5$): Penaliza benchmarks fantasmas o aislados que cuentan con muy pocos participantes.

---

## 6. Confianza y Calidad de un Resultado ($Q_r$)

Para evitar que datos falsificados sesguen las métricas, cada `Result` ($r$) es evaluado bajo un **Peso de Confianza ($W_r$)** y una **Calidad de Rendimiento ($P_r$)**.

### A. Peso de Confianza del Resultado ($W_r$)

Determina qué tan verídico es el dato según quién lo subió ($W_{u_{creador}}$) y qué opina la comunidad de él ($R_r$):


$$W_r = \alpha \cdot W_{u_{creador}} + (1 - \alpha) \cdot R_r$$


*(Donde $\alpha = 0.4$ da mayor peso a la auditoría comunitaria posterior).*

### B. Calidad Intrínseca del Rendimiento ($P_r$)

Es el promedio ponderado de las métricas del resultado una vez normalizadas:


$$P_r = \sum_{m} (w_m \cdot N(x_m))$$


*(Donde $w_m$ es el peso específico asignado a la métrica $m$ dentro del diseño del benchmark, cumpliendo que $\sum w_m = 1$).*

---

## 7. La Fórmula del Score Global ($Score_{Global}$)

Para obtener el ranking definitivo de servicios dentro de la Skill, el cálculo se realiza de abajo hacia arriba en dos etapas:

### Paso A: Rendimiento del Servicio en un Benchmark

Se calcula la media de calidad de todos los resultados del servicio en ese benchmark específico, usando la confianza del resultado como ponderador:


$$P(S, B) = \frac{\sum_{r \in Results(S,B)} (W_r \cdot P_r)}{\sum_{r \in Results(S,B)} W_r}$$

### Paso B: Rendimiento Agregado Total ($Score_{Perf}$)

Se consolida el rendimiento del servicio a lo largo de todos los benchmarks de la Skill, ponderándolo por la reputación de cada Benchmark ($R_B$):


$$Score_{Perf}(S) = \frac{\sum_{B} (R_B \cdot P(S, B))}{\sum B}$$

### Paso C: Score Global Definitivo

Para el resultado final, combinamos el rendimiento empírico verificado ($Score_{Perf}$) con la reputación comercial/institucional directa que el servicio posee a través de su propio stake y votos ($R_S$):

$$Score_{Global}(S) = \beta \cdot Score_{Perf}(S) + (1 - \beta) \cdot R_S$$

> **Parámetro Crítico:** Se establece $\beta = 0.7$. Al otorgar el 70% del peso a la experimentación técnica verificada y solo un 30% a la reputación directa de la entidad, el sistema se vuelve inmune a campañas de marketing masivas o "compras" de reviews que no vengan acompañadas de un software verdaderamente eficiente.