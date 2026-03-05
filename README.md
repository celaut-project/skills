**# Celaut Skills**  
**El “App Store de problemas” descentralizado para agentes IA en Celaut + Ergo**

**Celaut Skills** es un registro **100 % on-chain**, sin servidores centrales y sin confianza donde los **problemas (skills)** son los protagonistas.  

En vez de buscar servicios Celaut directamente, buscas una **skill** (“Optimal XAU/BTC Performance”, “Sat-sorter”, etc.) y dentro encuentras automáticamente:

- Servicios que la cubren (Coverage)  
- Benchmarks comparativos reales  
- Comentarios y discusiones de la comunidad  
- Ordenamiento inteligente por reputación y métricas verificables  

Todo construido sobre **Ergo + Celaut**, usando **Protobuf** (máximo ahorro de bytes) y **skin-in-the-game** nativo del sistema de reputación.

---

### Filosofía y motivación

Celaut **no tiene** un registry central de servicios (por diseño descentralizado).  
**Celaut Skills** lo soluciona invirtiendo el modelo:

- Los agentes IA buscan **problemas**, no soluciones.  
- Un solo **Benchmark** comparativo dice más que 100 opiniones sueltas.  
- Las skills se **componen** (referencian otras skills) → duplicados se resuelven de forma orgánica y descentralizada.  
- Todo es opinión con **skin-in-the-game** → nadie spamea sin arriesgar reputación.

---

### Cómo empezar – Plantilla base oficial + Wallet específico

Este proyecto **parte 100 % del template oficial** de la comunidad Ergo:

**Repositorio base (template):**  
https://github.com/ergo-basics/template

**Wallet dedicado (obligatorio):**  
https://github.com/ergo-basics/wallet-svelte-component

**Pasos exactos para arrancar el proyecto:**

```bash
git clone https://github.com/ergo-basics/template.git celaut-skills
cd celaut-skills
npm install

# Añadimos el wallet component
npm install github:ergo-basics/wallet-svelte-component

# Añadimos las dos librerías de reputación
npm install github:reputation-systems/reputation-system
npm install github:reputation-systems/forum-application
```

Renombra el proyecto en `package.json` y `svelte.config.js`.  
Limpia la demo de `/src/routes/+page.svelte` y sigue las secciones siguientes.

---

### Las tres librerías principales (todas oficiales de ergo-basics y reputation-systems)

1. **Template base**  
   https://github.com/ergo-basics/template  
   (Svelte 4 + Vite + Tailwind + Ergo Explorer integration)

2. **Wallet Svelte Component** (conexión real con Nautilus y SAFEW)  
   https://github.com/ergo-basics/wallet-svelte-component  
   Componente listo para usar, con stores reactivos y soporte completo de Ergo.

3. **Reputation System** (núcleo de tipos y reputación)  
   https://github.com/reputation-systems/reputation-system

4. **Forum Application** (comentarios on-chain en cualquier entidad)  
   https://github.com/reputation-systems/forum-application

---

### Los 4 Tipos / Entidades (esquema oficial)

Cada tipo es un **Type NFT (Digital Public Good)** del reputation-system.  
Las cajas reales son **Reputation Boxes** con estructura fija:

- **R4** = TokenId del Type NFT  
- **R5** = Identificador único  
- **R6** = `locked` (true/false)  
- **R7** = `blake2b256(ownerScript)`  
- **R8** = `polarizacion = true`  
- **R9** = **Protobuf serializado** (¡nunca JSON!)

#### 1. Skill (`celaut:skill:v1`)
**Type NFT** → R4 = `"celaut:skill:v1"`  
**Cajas**: R5 = `skill-tag`, R6 = `true`, R9 = Protobuf `Skill`

```protobuf
message Skill {
  string name = 1;
  string prose = 2;
  repeated string other_skill_box_ids = 3;
  repeated string tags = 4;
  string domain = 5;
}
```

#### 2. Benchmark Schema (`celaut:benchmark-schema:v1`)
**Type NFT** → R4 = `"celaut:benchmark-schema:v1"`  
**Cajas**: R5 = `skill_box_id`, R6 = `true`, R9 = Protobuf `BenchmarkSchema`

#### 3. Benchmark (`celaut:benchmark:v1`)
**Type NFT** → R4 = `"celaut:benchmark:v1"`  
**Cajas**: R5 = `benchschema_box_id`, R6 = `false` (actualizable), R9 = Protobuf `Benchmark`

#### 4. Coverage (`celaut:coverage:v1`)
**Type NFT** → R4 = `"celaut:coverage:v1"`  
**Cajas**: R5 = `skill_box_id`, R6 = `false`, R9 = Protobuf `Coverage`

---

### Integración del Wallet (wallet-svelte-component)

Este es el componente oficial que usaremos para toda la conexión de wallet.  
Se instala con un solo comando y se usa así:

```svelte
<script>
  import { 
    WalletButton, 
    WalletAddressChangeHandler,
    walletConnected,
    walletAddress,
    walletBalance,
    walletManager 
  } from 'wallet-svelte-component';
</script>

<header>
  <WalletButton explorerUrl="https://explorer.ergoplatform.com" />
</header>

{#if $walletConnected}
  <p>Conectado: {$walletAddress}</p>
  <p>Balance: {Number($walletBalance.nanoErgs) / 1e9} ERG</p>
{/if}

<WalletAddressChangeHandler />
```

Funciones útiles:
- `walletManager.connectWallet('nautilus')`
- `walletManager.disconnectWallet()`
- `walletManager.refreshBalance()`

El componente detecta automáticamente Nautilus y SAFEW y maneja todo el estado reactivo.

---

### Cómo crear y publicar entidades

Ejemplo completo con la librería **reputation-system** + wallet conectado:

```typescript
import { createReputationBox } from 'reputation-system';
import { walletManager } from 'wallet-svelte-component';

// ... después de conectar wallet
const skillProtoBytes = new Skill({ name: "Optimal XAU/BTC", ... }).serializeBinary();

await createReputationBox({
  typeId: skillTypeTokenId,
  r5: "trading-xau-btc",
  r6: true,
  r7: ownerScriptHash,
  r8: true,
  r9: Buffer.from(skillProtoBytes)
});
```

---

### Comentarios con Forum Application

Cualquier Servicio, Skill, Benchmark, BenchmarkSchema o Coverage puede tener discusión on-chain:

```svelte
<script>
  import { Forum } from 'forum-application';
</script>

<Forum 
  topicIdentifier={currentBoxId}  // o service_id ... 
  reputationTokenId={globalRepToken}
/>
```

---

### Flujo de la UI

1. **/skills** → Galería de Skills (ordenadas por reputación).  
2. Click en Skill → carga recursivamente `other_skill_box_ids`.  
3. Muestra tabla comparativa + **sección Foro** completa.  
4. Agentes IA consumen los mismos datos vía nodo Celaut.

---
