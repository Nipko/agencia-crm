# Planetour CRM

CRM de Planetour para administrar clientes, firmas GDS, contratos públicos, cartera Karing y oferta de hospitalidad. React y Vite forman la interfaz; Express y PostgreSQL proporcionan la API y la persistencia.

La pantalla de acceso incluye una consulta operativa sin autenticación para identificar una agencia por nombre, negocio, NIT, teléfono, correo, ciudad, dirección, IATA, PCC, agente o firma GDS. Solo entrega identificación, contactos permitidos y firmas relacionadas; no expone saldos, contratos, usuarios ni configuración.

## Entrega a otro PC Windows

En el PC donde se prepara el proyecto, ejecuta:

```text
crear-paquete-entrega.bat
```

El proceso valida y compila la aplicación, y crea:

- `entrega\planetour-crm-windows.zip`
- `entrega\planetour-crm-windows.sha256.txt`

El ZIP excluye deliberadamente `.env`, `node_modules`, logs y credenciales. Envía ambos archivos al PC destino y, opcionalmente, compara allí el SHA-256 con:

```powershell
Get-FileHash .\planetour-crm-windows.zip -Algorithm SHA256
```

En el PC destino:

1. Instala una versión compatible de Node.js y PostgreSQL de 64 bits.
2. Extrae el ZIP en una ubicación estable, por ejemplo `C:\PlanetourCRM`. No lo ejecutes desde el ZIP, una carpeta temporal o una unidad de red.
3. Ejecuta `instalar-planetour.bat`.
4. La primera ejecución crea `.env`, lo abre en el Bloc de notas y se detiene. Completa las claves y vuelve a ejecutar el instalador.
5. El instalador descarga dependencias, crea o actualiza la base de datos, compila la UI y ofrece instalar el servicio automático de Windows con acceso LAN habilitado.

La instalación inicial necesita conexión a Internet para `npm ci` y, si se elige el servicio, para descargar WinSW desde su repositorio oficial.

## Requisitos

- Windows 10/11 o Windows Server de 64 bits.
- Node.js `^20.19.0` o `>=22.12.0`, con npm 10 o posterior.
- PostgreSQL activo y accesible desde el equipo.
- Internet o un proxy configurado durante la primera instalación.
- Permisos de administrador para crear el servicio y una regla de firewall.

Si `planetour_db` no existe, el usuario definido en `PGUSER` necesita permiso `CREATEDB`. Como alternativa, un administrador puede crear previamente la base y asignarle como dueño al usuario de la aplicación.

## Configuración de `.env`

Los valores mínimos son `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `ADMIN_EMAIL`, `ADMIN_NAME` y `ADMIN_PASSWORD`. Si una clave contiene espacios o `#`, escríbela entre comillas dobles.

La escucha de red se controla con:

- `HOST=0.0.0.0`: valor predeterminado; acepta conexiones desde la red, sujeto al Firewall de Windows.
- `HOST=127.0.0.1`: limita voluntariamente el acceso al propio servidor.

No copies el `.env` de otro equipo salvo que estés migrando deliberadamente esas credenciales. Nunca lo envíes dentro del ZIP ni por correo o mensajería.

## Servicio de Windows

El instalador usa [WinSW 2.12.0](https://github.com/winsw/winsw/releases/tag/v2.12.0), fijado y verificado por SHA-256, para ejecutar Node como un servicio real. Queda configurado con:

- cuenta restringida `NT AUTHORITY\LocalService`;
- directorio de trabajo absoluto;
- inicio automático retrasado;
- dependencia del servicio PostgreSQL cuando se detecta;
- reinicio automático después de fallos;
- cierre controlado y logs rotativos de 10 MB en `logs\`.

Scripts disponibles:

- `instalar-servicio-windows.bat`: instala o actualiza el servicio.
- `habilitar-acceso-red.bat`: repara en un solo paso la escucha LAN, el servicio y el firewall.
- `estado-servicio-windows.bat`: muestra servicio y estado de la API.
- `desinstalar-servicio-windows.bat`: elimina servicio y regla de firewall, conservando datos y logs.
- `ejecutar-servidor.bat`: inicia el servicio si existe; en caso contrario ejecuta el servidor en consola.

Al instalar el servicio, el script configura `HOST=0.0.0.0` y abre el puerto solo en perfiles de red **Privado** y **Dominio**, nunca en el perfil Público. Después podrás entrar desde otro equipo mediante `http://NOMBRE-DEL-PC:4000` o la IP mostrada al finalizar. Si Windows identifica la LAN como Pública, cámbiala a Privada desde las propiedades de la conexión.

Como el buscador público no requiere autenticación, mantén el servidor dentro de la red interna o VPN de Planetour. Usa HTTPS mediante un proxy inverso si se publica fuera de una red confiable.

## Instalación manual

Si no usas el instalador:

```powershell
Copy-Item .env.example .env
# Editar .env
npm ci --include=dev
npm run db:setup
npm run build
npm run server
```

Abre `http://localhost:4000`. El endpoint `GET /api/health` informa por separado el estado de la API y PostgreSQL.

## Desarrollo

Inicia la API y Vite en terminales separadas:

```powershell
npm run server
npm run dev
```

Abre `http://localhost:5173`. El puerto de Vite es estricto para evitar que un cambio silencioso rompa CORS.

## Migración de datos

Una instalación nueva crea esquema y datos iniciales, pero no copia clientes, firmas ni contratos de otra base. Si existe una base anterior, haz el respaldo antes de mover el sistema:

```powershell
pg_dump --format=custom --file=planetour.backup --dbname=planetour_db
```

En el equipo destino, con la base ya creada y la aplicación detenida:

```powershell
pg_restore --clean --if-exists --no-owner --dbname=planetour_db .\planetour.backup
npm run db:init
```

No escribas la contraseña en la línea de comandos; usa el mecanismo seguro de credenciales de PostgreSQL. Conserva el respaldo hasta comprobar clientes, firmas, contratos y acceso administrativo en el equipo nuevo.

## Verificación y diagnóstico

```powershell
npm run lint
npm run build
```

- Estado local: `http://localhost:4000/api/health`
- Logs del servicio: `logs\PlanetourCRM.out.log`, `logs\PlanetourCRM.err.log` y el log del wrapper.
- Si la base no responde, revisa el servicio PostgreSQL y las variables `PG*`.
- Reiniciar el servicio invalida las sesiones abiertas porque las sesiones se guardan en memoria; los usuarios deberán volver a iniciar sesión.
