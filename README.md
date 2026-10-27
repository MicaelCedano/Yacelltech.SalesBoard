# YacellTech SalesBoard

Sistema moderno en tiempo real de ranking y estadísticas de equipos vendidos para **YacellTech**.

Diseñado con una interfaz minimalista inspirada en Apple: fondo claro `#F5F5F7`, tarjetas blancas, tipografía del sistema (SF Pro cuando está disponible), cifras tabulares y acento `#007AFF`. Incluye modo oscuro con fondo negro y superficies `#1C1C1E`, optimizado para televisores 16:9 (`1920×1080`, `3840×2160`), monitores ultrawide, computadoras y dispositivos móviles.

---

## 1. Stack Tecnológico

- **Framework:** Next.js 16 (App Router) + React 19
- **Lenguaje:** TypeScript (Modo estricto `strict: true`)
- **Estilos y UI:** Tailwind CSS + Radix UI (`shadcn/ui` primitives) + Lucide Icons
- **Animaciones:** Motion (`motion/react`)
- **Base de Datos y Backend:** Supabase PostgreSQL + Row Level Security (RLS)
- **Autenticación:** Supabase Auth (solo administradores autorizados; sin registro público)
- **Almacenamiento:** Supabase Storage (bucket `avatars` para fotografías)
- **Tiempo Real:** Supabase Realtime + BroadcastChannel + Heartbeat de reconexión automática
- **Validaciones:** Zod
- **Testing:** Vitest

---

## 2. Estructura de Rutas

| Ruta | Descripción | Acceso |
|---|---|---|
| `/` | **Pantalla Pública (Modo TV 16:9)**: Muestra el encabezado con fecha en zona horaria `America/Santo_Domingo`, la tarjeta horizontal superior del **Manager General** y debajo el **Gráfico Vertical de Vendedores** con fotografías circulares, nombres, barras proporcionales en escala común, cantidades y corona dorada para el 1° lugar. | Público (Solo lectura) |
| `/admin` | **Panel Administrativo**: Registro diario acumulado editable, gestión de vendedores y fotografías, configuración del Manager General, consulta histórica por fechas/rangos, auditoría de cambios (`audit_logs`) e inicialización explícita de demostración. | Privado (Supabase Auth + rol `admin` verificado en servidor) |

---

## 3. Configuración Paso a Paso con Supabase

### 3.1 Crear el proyecto en Supabase y aplicar las migraciones SQL

1. Crea un nuevo proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. Abre el **SQL Editor** en tu proyecto de Supabase.
3. Copia y ejecuta el contenido completo de:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/20261027224406_hosted_security.sql`
   - `supabase/migrations/20261027230618_restrict_storage_listing_and_internal_function.sql`
   - `supabase/seed_demo.sql` *(opcional: instala la función segura `public.initialize_demo_salesboard()`)*

### 3.2 Configurar la Autenticación (Sin registro público)

1. En Supabase Dashboard ve a **Authentication → Providers → Email**.
2. Para impedir el registro público de administradores, desactiva **Allow new users to sign up** (o crea únicamente los usuarios administradores desde **Authentication → Users → Add user**).
3. Crea tu usuario en **Authentication → Users**. El trigger crea su perfil con `role = 'viewer'`; los metadatos enviados por un cliente no pueden otorgar administración.
4. Promueve exclusivamente tu usuario administrador desde el SQL Editor:
   ```sql
   UPDATE public.profiles
   SET role = 'admin', is_active = TRUE
   WHERE email = 'tu-correo@yacelltech.com';
   ```

### 3.3 Configurar Variables de Entorno

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Edita `.env.local` con las credenciales reales de tu proyecto Supabase (**Project Settings → API**):

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-solo-servidor
NEXT_PUBLIC_SITE_URL=https://salesboard.yacelltech.com
NEXT_PUBLIC_TIMEZONE=America/Santo_Domingo
```

---

## 4. Ejecución Local y Scripts

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo (http://localhost:3000)
npm run dev

# Verificar tipos de TypeScript
npm run typecheck

# Ejecutar pruebas unitarias (Vitest)
npm test

# Compilar para producción
npm run build
npm start
```

> **Modo Demostración Local Aislado:** Si ejecutas el proyecto localmente antes de configurar `.env.local` con Supabase, el sistema activa automáticamente un entorno de demostración aislado (con los 5 vendedores de prueba: *Luis, José, Carlos, Ana y María*) sin mezclar datos con producción. Credenciales locales de prueba en `/admin`: `admin@yacelltech.com` / `Yacell2026!`.

En producción, Supabase es obligatorio: el servidor rechaza el modo demo y las cookies locales de demostración. Los datos alojados se guardan en PostgreSQL y las fotografías en Storage.

### Despliegue en Netlify

Importa este repositorio con la rama `main`. `netlify.toml` configura Node.js 22, el comando `npm run build` y la carpeta `.next`; Netlify instala automáticamente su adaptador de Next.js para las páginas y APIs del servidor. No publiques el código fuente como un sitio estático.

Antes de desplegar, configura estas variables en **Project configuration → Environment variables**, disponibles durante la compilación y en Functions:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto dedicado de SalesBoard.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave publicable del proyecto (también se admite la clave `anon` heredada). Nunca uses una clave secreta en esta variable.
- `NEXT_PUBLIC_SITE_URL`: URL HTTPS de Netlify.
- `NEXT_PUBLIC_TIMEZONE`: `America/Santo_Domingo`.
- `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK`: `false`.

Aplica las tres migraciones antes de abrir el tablero. El archivo `supabase/seed_demo.sql` instala una función de datos de prueba que solo puede ejecutar un administrador autenticado; no carga datos automáticamente. El proyecto no necesita `SUPABASE_SERVICE_ROLE_KEY` para funcionar.

En Supabase configura la URL de Netlify en **Authentication → URL Configuration**, desactiva el registro público y crea/promueve el usuario administrador como se describe arriba. Después del despliegue verifica `/`, `/admin` y `/api/board`; la API debe indicar `dataSource: "supabase"`. Las APIs administrativas deben devolver `403` sin sesión.

---

## 5. Fotografías y edición de vendedores

En `/admin`, abre **Vendedores** y pulsa **Editar datos y foto** en el vendedor correspondiente. Puedes cambiar nombre, fotografía, meta, orden, estado y visibilidad en TV. Al seleccionar un vendedor, el formulario recibe el foco automáticamente, también en celulares.

- Selecciona una fotografía JPG, PNG, WebP o AVIF de hasta 5 MB. Se muestra una vista previa; pulsa **Guardar vendedor** para publicar los cambios.
- **Quitar fotografía** permite volver a mostrar las iniciales al guardar. **Cancelar edición** descarta los cambios del formulario.
- Durante la subida se bloquean el guardado y el cambio de vendedor para evitar asociar la foto a otra persona.
- Las ventas de fechas anteriores se conservan. El tablero público recibe los cambios automáticamente.
- Las tarjetas promocionales YacellTech del formato 648×1011 (o ampliaciones proporcionales) se muestran encuadrando el retrato superior, sin el nombre impreso. El original permanece intacto. Las fotografías de otros formatos mantienen su encuadre centrado; para mejores resultados, usa retratos sin texto ni logos.
- Sin Supabase configurado, las fotografías se guardan como Data URLs en `.demo-data/sandbox-db.json`; con Supabase, se utiliza el bucket público `avatars`, con subida restringida a administradores. La integración alojada requiere configurar y verificar las credenciales reales.

Las pruebas de `src/lib/__tests__/seller-photos.test.ts` verifican permisos de subida, formato y tamaño de archivos, persistencia de la foto, auditoría y conservación del historial al editar vendedores.

## 6. Despliegue en Vercel y Dominio Futuro

1. Importa el repositorio en [Vercel](https://vercel.com/new).
2. En **Environment Variables**, añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (opcional, solo servidor)
   - `NEXT_PUBLIC_SITE_URL` (`https://salesboard.yacelltech.com`)
   - `NEXT_PUBLIC_TIMEZONE` (`America/Santo_Domingo`)
3. Despliega el proyecto.
4. **Preparación para el dominio `salesboard.yacelltech.com`** *(pendiente de configurar en tu proveedor DNS cuando lo autorices)*:
   - En Vercel ve a **Settings → Domains** y añade `salesboard.yacelltech.com`.
   - Añade el registro `CNAME` en el DNS de `yacelltech.com` apuntando `salesboard` a `cname.vercel-dns.com`.
   - En Supabase (**Authentication → URL Configuration**), configura `https://salesboard.yacelltech.com` como **Site URL**.


## 7. Apariencia y uso en televisión

La unidad visible del tablero y la administración es **Puntos**. El cambio de denominación conserva los registros, las cantidades y los cálculos existentes.

- El botón de luna/sol cambia entre claro y oscuro. La preferencia se conserva localmente y se sincroniza entre pestañas. El modo claro es el predeterminado.
- El tablero público mantiene el Manager General horizontal y el ranking vertical debajo. No incluye accesos administrativos; conserva filtros de consulta y pantalla completa.
- El tablero adapta la altura y la tipografía automáticamente para televisores HD (1280×720 y 1366×768) y Full HD (1920×1080), con cinco o seis vendedores visibles sin desplazamiento. También admite ventanas horizontales de 960×540. La resolución efectiva del navegador determina el ajuste; las pulgadas de la TV no determinan su resolución.
- Para una TV de 32 pulgadas, abre el tablero público y pulsa **Activar modo TV** (icono de pantalla completa). Usa el zoom del navegador al 100 % y, si el televisor recorta los bordes, selecciona su ajuste de imagen **Ajustar a pantalla / Sin overscan**. Se mantiene un margen alrededor de la composición. En celular el gráfico permite desplazamiento horizontal.
- El líder ocupa el centro del gráfico: segundo a su izquierda, tercero a su derecha y los demás hacia los extremos (`4.º · 2.º · 1.º · 3.º · 5.º`). Con cantidades pares se reserva espacio de equilibrio; los empatados en primer lugar comparten el centro. En móvil, el gráfico enfoca al líder automáticamente.
- Las alturas corresponden a cantidades vendidas usando una escala común, incluido cero real. Los empates comparten el primer lugar; el Manager nunca participa en el ranking.
- Motion anima cifras, barras y posiciones entre 400 y 450 ms. Con `prefers-reduced-motion: reduce`, los cambios se muestran sin movimiento.
- La administración mantiene acceso privado, registro de totales acumulados, edición de vendedores/fotos/metas, filtros históricos y auditoría. El rediseño no cambia las APIs, las migraciones ni los registros existentes.

Las barras del ranking incluyen una pista suave de referencia, cantidades junto al extremo de cada barra y el progreso individual de meta debajo. El líder conserva el centro, un aro dorado grueso alrededor de toda su fotografía y una corona grande centrada sobre el círculo; en caso de empate, ambos primeros lugares muestran la distinción. La pista usa la misma escala para todos; el relleno de cero ventas permanece en altura cero.

La paleta del ranking es automática: líder en azul intenso, resto en azul suave y pista gris azulada; los indicadores de metas cumplidas usan verde. El modo oscuro adapta estos tonos. La administración no muestra puntos ni selectores de colores por vendedor. Los valores de color de registros anteriores se conservan por compatibilidad, sin intervenir en la apariencia del tablero.
