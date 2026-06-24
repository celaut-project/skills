# Especificación Técnica: Sistema de Puntuación Global Multi-Criterio

Este documento define la arquitectura matemática para calcular la puntuación global de los **Servicios** dentro de la plataforma. El sistema asume que todas las entidades poseen una reputación externa ya calculada, representada por un número entero, y utiliza este valor para ponderar la confianza y el rendimiento empírico.

## 1. Modelo de Dominio y Entidades

El sistema evalúa el rendimiento a través de las siguientes entidades, cada una con un valor de **Reputación Cruda ($R_{raw}$)** asimilado como un entero en el rango $\{-N_{max}, \dots, 0, \dots, N_{max}\}$:

* **Skill:** La categoría global dentro de esta fórmula.
* **User:** Quien ejecuta o sube un resultado.
* **Service:** El software/algoritmo que se está evaluando.
* **Benchmark:** Suite de pruebas con *Case Descriptors* y *Performance Metrics*.
* **Result:** Los datos empíricos de una ejecución concreta.

---

## 2. Normalización de Confianza ($W_e$)

Dado que la reputación cruda ($R_{raw}$) puede tener valores extremos (positivos o negativos), no podemos usarla directamente para multiplicar métricas. Necesitamos mapearla a un **Peso de Confianza ($W_e$)** en el intervalo $[0, 1]$.

Para evitar que una entidad con una reputación masiva (una "ballena") reduzca a cero el peso del resto, aplicamos una **escala logarítmica con signo**.

Para cualquier entidad $e$, su peso de confianza $W_e$ se calcula así:

* **Si la reputación es positiva o cero ($R_{raw} \ge 0$):**

$$W_e = 0.5 + 0.5 \cdot \frac{\log(1 + R_{raw}(e))}{\log(1 + N_{max})}$$


* **Si la reputación es negativa ($R_{raw} < 0$):**

$$W_e = 0.5 - 0.5 \cdot \frac{\log(1 + |R_{raw}(e)|)}{\log(1 + N_{max})}$$



**Comportamiento de esta fórmula:**

* Reputación fuertemente negativa $\rightarrow$ $W_e$ se acerca a $0$ (su impacto se anula).
* Reputación $0$ (entidad nueva/neutral) $\rightarrow$ $W_e = 0.5$ (impacto medio).
* Reputación fuertemente positiva $\rightarrow$ $W_e$ se acerca a $1$ (máxima confianza).

*(Nota: $N_{max}$ es el valor absoluto máximo de reputación observado únicamente dentro de esa Skill para mantener la escala calibrada).*

---

## 3. Normalización de Métricas de Rendimiento ($N(x)$)

Los resultados crudos de un benchmark (ej. milisegundos vs. tasa de éxito) deben llevarse a una escala común $[0, 1]$. Para cada dimensión del problema $d$, se usan los mínimos ($min_d$) y máximos ($max_d$) históricos:

* **Métricas "Lower is better"** (ej. tiempo, memoria):

$$N(x) = \frac{max_d - x}{max_d - min_d}$$


* **Métricas "Higher is better"** (ej. ratio de éxito):

$$N(x) = \frac{x - min_d}{max_d - min_d}$$



---

## 4. Confianza y Calidad de un Resultado

Cuando un usuario sube un `Result` ($r$) de un servicio evaluado en un benchmark, calculamos dos factores: **qué tan real es** y **qué tan bueno es**.

### A. Peso de Confianza del Resultado ($C_r$)

Combina el peso de confianza del usuario que subió el dato ($W_u$) y el peso de confianza del resultado en sí mismo ($W_r$, derivado de su propia reputación externa por los votos que haya recibido).

$$C_r = \alpha \cdot W_u + (1 - \alpha) \cdot W_r$$

*(Donde $\alpha \in [0, 1]$, ej. **0.4**, permite balancear si nos fiamos más del creador original o de la reputación que ha cosechado el propio resultado).*

### B. Calidad de Rendimiento ($P_r$)

Es la suma ponderada de sus métricas normalizadas:

$$P_r = \sum_{m} (w_m \cdot N(x_m))$$

*(Donde $w_m$ es el peso que el creador del benchmark le dio a esa métrica específica, sumando $\sum w_m = 1$).*

---

## 5. La Fórmula del Score Global ($Score_{Global}$)

La puntuación final del servicio se construye de forma ascendente.

### Paso 1: Rendimiento dentro de un Benchmark específico

Se promedian todos los resultados ($r$) del Servicio ($S$) en el Benchmark ($B$), ponderados por la confianza del resultado ($C_r$):

$$P(S, B) = \frac{\sum (C_r \cdot P_r)}{\sum C_r}$$


*Si un resultado tiene mala reputación (falso/incorrecto), su $C_r$ será cercano a 0 y no afectará la nota del servicio.*

### Paso 2: Rendimiento Técnico Total ($Score_{Perf}$)

Se consolida el rendimiento del servicio en todos los benchmarks, ponderado por la confianza/reputación de cada Benchmark ($W_B$):

$$Score_{Perf}(S) = \frac{\sum (W_B \cdot P(S, B))}{\sum W_B}$$


*Los benchmarks con mala reputación (mal diseñados o maliciosos) apenas impactan en la nota final.*

### Paso 3: Score Global Definitivo

El ranking real del Servicio se obtiene combinando sus resultados empíricos ($Score_{Perf}$) con el peso de la reputación directa de la entidad Servicio ($W_S$):

$$Score_{Global}(S) = \beta \cdot Score_{Perf}(S) + (1 - \beta) \cdot W_S$$

*(Se recomienda $\beta = 0.7$ para dar un **70%** de importancia al rendimiento técnico verificado y un **30%** a la reputación externa de la marca/servicio).*

---