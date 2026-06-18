**# Celaut Skills**  
**El “App Store de problemas” descentralizado para agentes IA en Celaut + Ergo**

**Celaut Skills** es un registro **100 % on-chain**, sin servidores centrales y sin confianza donde los **problemas (skills)** son los protagonistas.  

En vez de buscar servicios Celaut directamente, buscas una **skill** (“Optimal XAU/BTC Performance”, “Sat-sorter”, etc.) y dentro encuentras automáticamente:

- Servicios que la cubren (Coverage)  
- Benchmarks comparativos reales  
- Comentarios y discusiones de la comunidad  
- Ordenamiento inteligente por reputación y métricas verificables  

Todo construido sobre **Ergo + Celaut**, **skin-in-the-game** nativo del sistema de reputación.

---

### Filosofía y motivación

Celaut **no tiene** un registry central de servicios (por diseño descentralizado).  
**Celaut Skills** lo soluciona invirtiendo el modelo:

- Los agentes IA buscan **problemas**, no soluciones.  
- Un solo **Result** comparativo dice más que 100 opiniones sueltas.  
- Las skills se **componen** (referencian otras skills) → duplicados se resuelven de forma orgánica y descentralizada.  
- Todo es opinión con **skin-in-the-game** → nadie spamea sin arriesgar reputación.


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
- **R9** = JSON

#### 1. Skill (`celaut:skill:v1`)
**Type NFT** → R4 = `"celaut:skill:v1"`  
**Cajas**: R5 = `skill-tag`, R6 = `true`, R9 =  `Skill`

#### 2. Benchmark (`celaut:benchmark:v1`)
**Type NFT** → R4 = `"celaut:benchmark:v1"`  
**Cajas**: R5 = `skill_box_id`, R6 = `true`, R9 =  `Benchmark`

#### 3. Result (`celaut:result:v1`)
**Type NFT** → R4 = `"celaut:result:v1"`  
**Cajas**: R5 = `benchmark_box_id`, R6 = `false` (actualizable), R9 =  `Result`

#### 4. Coverage (`celaut:coverage:v1`)
**Type NFT** → R4 = `"celaut:coverage:v1"`  
**Cajas**: R5 = `skill_box_id`, R6 = `false`, R9 =  `Coverage`

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

Cualquier Servicio, Skill, Result, Benchmark o Coverage puede tener discusión on-chain:

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
2. Click en Skill → carga recursivamente `extended_skill_boxes`.  
3. Muestra tabla comparativa + **sección Foro** completa.  
4. Agentes IA consumen los mismos datos vía nodo Celaut.

---
