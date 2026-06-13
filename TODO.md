# Esquema mental de todo

- Una skill es la entidad central del sistema. Posee name, prose, tags, domain, author y otherSkillBoxIds que indican otras skills que considera "de mismo proposito".
- Un coverage es una entidad asociada a una skill que manifiesta que un servicio cubre esa skill.
- Un benchmark es una entidad asociada a una skill que manifiesta una prueba que realizar a una skill.
- Un resultado es una entidad asociada a un benchmark que manifiesta que servicio y a que score resulta el benchmark.
- Todo debe ser en inglés.


# TODO

- Add profile creation, where profile is the Reputation Library Profile. Check fetchAllUserProfiles, in case there is no one, create one with create_profile (optionally user can sacrifice assets).
- Add "Profile" details with "gallery" and "submit skill" (una nueva pestaña): R9 data and tokens sacrified.
- El aviso "This wallet is connected, but it still needs a reputation profile before it can publish on-chain." indica que la wallet está conectada cuando no es cierto.
- El perfil se debe de manejar (crear y visualizar) en la pestaña previamente mencionada.
- En el navegador Brave no conseguimos cargar la web ¿? (esto es extraño)