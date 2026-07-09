# Releasing Vire

## Setup de firma del updater (una sola vez por repo)

El auto-updater (Tauri plugin `updater`) exige que cada binario venga firmado con una key
minisign. Sin esto, `latest.json` sale con `signature: ""` y el updater rechaza la actualización
en silencio.

1. Key privada vive en `~/.tauri/vire.key` (encriptada con password). **Nunca se commitea.**
2. Pubkey va en `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.
3. En GitHub → repo → Settings → Secrets and variables → Actions, deben existir:
   - `TAURI_SIGNING_PRIVATE_KEY` = contenido completo de `~/.tauri/vire.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = password de esa key
4. `release.yml` job `build` los pasa como env al step `tauri-action`, que firma cada binario y
   genera los `.sig` que `updater-json` sube dentro de `latest.json`.

Si algún día se regenera la key (`npx tauri signer generate -w ~/.tauri/vire.key`), hay que
actualizar el pubkey en `tauri.conf.json` **y** los dos secrets en GitHub, o los usuarios con la
versión anterior dejan de poder auto-actualizar (van a necesitar bajar la nueva versión a mano
una vez).

## Pre-release checklist

Antes de crear un tag de release, ejecutar localmente **en orden**:

```bash
# 1. Asegurar Node correcto (requiere >=24.18.0)
nvm use

# 2. Validar que todo compila
npm ci            # más estricto que npm install, usa exactamente el lockfile
cargo check       # desde src-tauri/
npx tsc --noEmit  # TypeScript

# 3. Bump de versión en los 3 archivos fuente
#    - package.json         → "version": "X.Y.Z"
#    - src-tauri/tauri.conf.json → "version": "X.Y.Z"
#    - src-tauri/Cargo.toml      → version = "X.Y.Z"

# 4. Regenerar lockfiles con la nueva versión
npm install       # desde raíz (actualiza package-lock.json)
cargo check       # desde src-tauri/ (actualiza Cargo.lock)

# 5. Verificar que npm ci sigue funcionando
npm ci

# 6. Commit + tag + push
git add package.json package-lock.json \
        src-tauri/Cargo.toml src-tauri/Cargo.lock \
        src-tauri/tauri.conf.json
git commit -m "chore: bump version to X.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z — <resumen de cambios>"
git push origin main --tags
```

## Qué hace CI al pushear un tag `v*`

1. **`cleanup`** — elimina cualquier release previa con el mismo tag (safety por si se force-pusheó el tag)
2. **`build`** (macOS, Ubuntu, Windows en paralelo) — compila binarios nativos y los sube como assets a la release de GitHub
3. **`updater-json`** — genera `latest.json` para el auto-updater de Tauri y lo adjunta a la release

## Fallas comunes

### `npm ci` falla con "Missing: @emnapi/... from lock file"

**Causa**: Node local es menor al requerido en `engines` (`>=24.18.0`). `npm install` con una versión incorrecta de Node no resuelve correctamente los optional dependencies de paquetes nativos (`@rolldown/binding-wasm32-wasi`), dejando el lockfile corrupto.

**Solución**: `nvm use` antes de `npm install`. Si ya está corrupto:

```bash
rm -rf node_modules package-lock.json
nvm use
npm install
```

### Assets duplicados en release (Ubuntu `.AppImage`: `Error: Not Found`)

**Causa**: Se hizo force-push del tag (por amend de commit, cambio de email, etc.). La release de GitHub ya tenía assets del CI anterior y `tauri-apps/tauri-action` no maneja sobrescritura de assets.

**Solución**: El job `cleanup` en el workflow ya lo previene automáticamente. Si aun así falla, eliminar manualmente la release desde GitHub y re-pushear el tag.

### Cambios de config local (email, gpg) en medio de un release

**Causa**: Se cambia `git config user.email` entre commits de release, forzando un amend + force push que reinicia todo CI.

**Solución**: Configurar `user.email` y `user.name` al clonar el repo por primera vez, no durante releases.

```bash
git config user.email "tu-email@example.com"
git config user.name "Tu Nombre"
```

### Versiones desincronizadas (tag dice `v0.1.2` pero binarios salen como `0.1.1`)

**Causa**: Se creó el tag sin antes hacer bump de `package.json`, `tauri.conf.json` y `Cargo.toml`.

**Solución**: Siempre ejecutar el bump **antes** de crear el tag. CI no inyecta la versión del tag en los archivos fuente.

## Puntos donde el proceso se interrumpe

| Punto de interrupción | Cómo evitarlo |
|---|---|
| Configurar email/identidad durante el release | Setup inicial del repo con `git config user.email` al clonar |
| Force-push del tag por amend de commits | No amendar commits que ya tienen tag. Si es inevitable, el job `cleanup` lo absorbe |
| Lockfile corrupto por Node incorrecto | `.nvmrc` define la versión requerida. `nvm use` antes de cualquier `npm` |
| CI cancelado manualmente y re-disparado | El job `cleanup` elimina la release vieja, no debería haber conflicto |

## Cómo optimizar

1. **Automatizar el bump**: Podría agregarse un script `npm run bump X.Y.Z` que modifique los 3 archivos, regenere lockfiles, y valide `npm ci`.
2. **CI lea la versión del tag**: Modificar `release.yml` para que el `beforeBuildCommand` inyecte la versión desde `${{ github.ref_name }}`, eliminando el paso manual de bump. Es más complejo porque Rust necesita recompilar, pero eliminaría el error más común.
3. **`.nvmrc` estricto**: Ya existe. Solo falta que el desarrollador ejecute `nvm use` al entrar al repo (o configurar `nvm auto-use`).
