
Add benchmarks with multiple caseDescriptors and multiple performanceMetrics to the demo data.

Service result tables must group the values of the different performance metrics for the various benchmarks, also grouping by descriptor (Important: reason out the best way to display this information).

scoring.ts TODOs:

1. AGGREGATION: median.

2. NORMALIZATION: z-score (if there aren't many services it won't have as much of an impact, but we are interested in the composite score precisely when there are many).

3. DIRECTION: Do what is required given that z-score is used for normalization.

4. CROSS-BENCHMARK METRIC MERGING: We do not want to merge them; metrics from different benchmarks are treated as distinct metrics. They will have higher or lower weighting based on the reputation of each benchmark and each result.

5. EMPTY DATA fallback: The current policy of ignoring them is correct. An empty result is equivalent to having no result at all.

6. REPUTATION WEIGHT floor: Setting the floor to 1 is a correct approach. However, keep in mind that reputation could potentially become negative. For now, we will keep this as is. (This introduces a Sybil Attack vulnerability that we will cover in more detail later.)