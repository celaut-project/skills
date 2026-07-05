Vamos a agregar en el MCP la acciones que publican en cadena:
- Subir Skill.
- Subir Benchmark.
- Subir Coverage
- Subir Result.

Ademas, deberíamos hacer lo mismo en reputation-system/forum-application y reputation-system/source-application con sus respectivos MCPs.  Hay que estudiar como los MCPs de estas dos librerias serán heredados por las aplicaciones que la utilizan, en este caso, este mismo proyecto.

Es importante que, tal como se ha hecho hasta ahora, el código de mcp.js no repita nada que exista en src/

Se soportaran dos formas de firmar una transaccion

1. Firma interna
   - Se agrega como variable de entorno WALLET_SEED con la semilla de la cartera del usuario.
   - Internamente al firmar la transaccion se usará esa wallet.
  
2. Firma externa
   - La misma accion, en lugar de firmarse en fleetsdk, se construirá y se retornará como transaccion no firmada (revisar como se hace esto en fleet-sdk).
   - Se firmará desde fuera. Si el agente tiene el CElaut Nodo instalado puede hacer "nodo sign ...." para firmar la transaccion (o de cualquier otra forma que sepa) y enviará la transaccion firmada de nuevo al mcp.

