# TODO

1. - Agregar github.com/reputation-systems/source-application en Skill, Benchmark y Result (nuevo campo con hash id del source - para descripciones muy grandes).
2. - Agregar autor en benchmark.
3. - Agregar discussion en benchmark.
4. - Benchmark tiene múltiples resultados.   El actual se puede considerar (la media de todos los resultados existentes), pero agregaremos la posibilidad de ver todos de forma individual (tabla  + autor del resultado)
5. - Metric en Benchmark en realidad son múltiples parámetros.  Lo que realmente queremos definir es un tensor (https://www.youtube.com/watch?v=f5liqUk0ZTw) de cualquier dimensionalidad. (*)
6. - Agregar discussion en result.
7. - Generate mock-data where stress situation: where multiple profiles create the same skill multiple times (to think how UI can solve this)



===

(*) [Continuation of 5.]


**Example: Tensor-based benchmark for the SAT problem**

A benchmark for the SAT problem can be represented as a tensor whose dimensions encode structural properties of the instance. Each SAT instance in conjunctive normal form (CNF) can be described by a vector of features capturing relevant characteristics of the formula.

For example, a benchmark representation may include the following dimensions:

* Number of variables
* Number of clauses
* Average clause length
* Clause length variance
* Clause-to-variable ratio
* Ratio of positive to negative literals

Thus, a SAT instance can be represented as a feature vector:

[
B = (v, c, \bar{l}, \sigma_l, r_{cv}, r_{pn})
]

where:

* (v) = number of variables
* (c) = number of clauses
* (\bar{l}) = average clause length
* (\sigma_l) = clause length variance
* (r_{cv}) = clause-to-variable ratio
* (r_{pn}) = positive/negative literal ratio

For example:

[
B = (100, 420, 3.2, 0.7, 4.2, 0.51)
]

A collection of SAT instances then forms a higher-order tensor where one dimension indexes the problem instances and another indexes the features describing them. Additional dimensions can be introduced to represent solver performance metrics (e.g., solving time, number of conflicts, or memory usage), allowing systematic comparison of different robots or solvers across the benchmark space.

Then the description of the benchmark explains all the features and each result adds problem instances (dimension two), solvers with their metrics for each feature (dimension three).

Resume: 
- Benchmark especifica features (primera dimension)
- Cada resultado del benchmark muestra instancias concretas del problema y resultados de distintos solvers.

> A fin de optimizar el tamaño on-chain, los agentes se encargarán de agregar los resultados lo mas optimizados posibles (mostrando solo las instancias relevantes y los solvers relevantes: ej: si un solver no destaca en nada, no lo agregará - pero es decisión del agente)