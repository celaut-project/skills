# Esquema mental de todo

- Una skill es la entidad central del sistema. Posee name, prose, tags, domain, author y otherSkillBoxIds que indican otras skills que considera "de mismo proposito".
- Un coverage es una entidad asociada a una skill que manifiesta que un servicio cubre esa skill.
- Un benchmark es una entidad asociada a una skill que manifiesta una prueba que realizar a una skill.
- Un resultado es una entidad asociada a un benchmark que manifiesta que servicio y a que score resulta el benchmark.
- Todo debe ser en inglés.


# TODO

- Add profile creation, where profile is the Reputation Library Profile. Check fetchAllUserProfiles, in case there is no one, create one with create_profile (optionally user can sacrifice assets).
- No queremos una estructura de datos con comentarios, tan solo necesitamos mostar los comentarios de cada elemento tal que <Forum topicIdentifier={benchmark_id|service_id|result_id|skill_id|...}>
- No queremos la propiedad autor en las estructuras de datos. EL autor de cada elemento es su profile_id (token_id de la prueba de reputacion).
- Dentro de la pestaña de coveranges debemos poder visualizar el rendimiento de cada coverage (cada servicio) en cada benchmark para el cual tenga resultados. Tambien debemos agregar una tabla comparativa en otra pestaña que ponga en un eje los servicios(coverages), en otro los benchmarks, y en otro los resultados. Teniendo en cuenta que puede haber multiples resultados de un servicio para un mismo benchmark, cogeremos solo el que mejor reputación tenga.
- La reputación de un objeto se mide en función del sacrificio de su profile_id (se podrá mejorar en el futuro, pero de momento lo mantenemos asi).
- Create benchmark no debe estar en una pestaña propia, si no al lado de Claim Coverage (en otro boton).



- Explorer returned 400 while loading skills.
- Comentario de cargando profile se ve bajo el footer.
- accessing with ?env=dev don't change to dev mode (and don't see anything in the code base)