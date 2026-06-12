# Esquema mental de todo

- Una skill es la entidad central del sistema. Posee name, prose, tags, domain, author y otherSkillBoxIds que indican otras skills que considera "de mismo proposito".
- Un coverage es una entidad asociada a una skill que manifiesta que un servicio cubre esa skill.
- Un benchmark es una entidad asociada a una skill que manifiesta una prueba que realizar a una skill.
- Un resultado es una entidad asociada a un benchmark que manifiesta que servicio y a que score resulta el benchmark.
- Todo debe ser en inglés.


# TODO

- Add profile creation, where profile is the Reputation Library Profile. Check fetchAllUserProfiles, in case there is no one, create one with create_profile (optionally user can sacrifice assets).
- Add "Profile" details: R9 data and tokens sacrified.

- La reputación de un objeto se mide en función del sacrificio de su profile_id (se podrá mejorar en el futuro, pero de momento lo mantenemos asi).
- deriveReputation(parsed) en api.ts es erroneo. La reputación no viene dada en R9, si no que se obtiene de import { calculate_reputation } from "reputation-system";

