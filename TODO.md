# Esquema mental de todo

- Una skill es la entidad central del sistema. Posee name, prose, tags, domain, author y otherSkillBoxIds que indican otras skills que considera "de mismo proposito".
- Un coverage es una entidad asociada a una skill que manifiesta que un servicio cubre esa skill.
- Un benchmark es una entidad asociada a una skill que manifiesta una prueba que realizar a una skill.
- Un resultado es una entidad asociada a un benchmark que manifiesta que servicio y a que score resulta el benchmark.
- Todo debe ser en inglés.


# TODO

- Implementar una pestaña "profile" junto con "Skill gallery" y "Submit skill" que utilice profileBootstrap para mostrar el perfil de reputación del usuario y, si no posee ninguno, lo cree mediante ensureUserProfile(), permitiendo agregar contenido y sacrifiando tokens.
- Revisar porque los datos demo no se visualizan.
- Conectar las acciones create* con los componentes de svelte, permitiendo dar de alta on-chain todas las entidades acordadas.