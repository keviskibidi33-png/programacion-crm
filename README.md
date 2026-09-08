# Control de Programación de Laboratorio — Micro-frontend (`programacion-crm`)

Módulo web especializado en la **programación, asignación y seguimiento operativo de ensayos de laboratorio** para el CRM de **Geofal**, construido con **Next.js 16**, **React 19**, **TypeScript** y **Tailwind CSS v4**.

---

## 🎯 1. Propósito y Funcionalidad

`programacion-crm` proporciona una interfaz interactiva de tipo **hoja de cálculo de alto rendimiento** (`DatagridEditor`) para planificar los ensayos geomecánicos, tiempos de entrega y asignación de personal técnico en el laboratorio de Geofal:

- **Virtualización de Alto Desempeño**: Emplea `@tanstack/react-virtual` y `@tanstack/react-table` para renderizar fluidamente miles de registros de laboratorio con scroll continuo sin degradación de memoria ni FPS.
- **Edición Rápida en Línea**: Permite modificar celdas de forma masiva (fechas de inicio, entregas estimadas, técnicos asignados, autorizaciones) con sincronización directa hacia la base de datos Supabase (`programacion_lab`).
- **Superación del Límite de 1000 Filas**: Implementa un bucle de paginación automática que supera el límite por defecto de 1000 registros de Supabase PostgREST, garantizando visibilidad histórica completa.
- **Auto-Sync con Recepción**: La columna de cotización (`cotizacion_lab`) sincroniza automáticamente el código hacia la tabla de recepciones del CRM para mantener la trazabilidad comercial.
- **Exportación a Excel**: Generación de reportes tabulares de programación para comités operativos y reuniones de laboratorio.

---

## 💻 2. Stack Tecnológico

| Capa | Tecnología | Propósito |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Renderizado optimizado y modular |
| **Biblioteca UI** | React 19 | Arquitectura de componentes reactivos |
| **Virtualización** | TanStack React Virtual v3 | Manejo eficiente de miles de filas en el DOM |
| **Gestión de Grilla** | TanStack Table v8 | Ordenamiento, filtrado y modelado de datos |
| **Cache Asíncrono** | TanStack React Query v5 | Mutaciones optimistas y revalidación en background |
| **Estilos** | Tailwind CSS v4 | Estilizado moderno y responsivo |
| **Formularios & Validación** | React Hook Form + Zod | Validación de datos en celdas |
| **Autenticación & DB** | Supabase JS v2 | Conexión directa a tabla `programacion_lab` |
| **Notificaciones** | Sonner | Feedback toast de guardado y errores |

---

## 📁 3. Estructura del Proyecto

```
programacion-crm/
├── src/
│   ├── app/                        # App Router de Next.js
│   │   ├── layout.tsx              # Root Layout con QueryClient y Toaster
│   │   ├── page.tsx                # Página principal con Suspense y DatagridEditor
│   │   └── globals.css             # Estilos globales y tokens Tailwind v4
│   ├── components/
│   │   ├── DatagridEditor.tsx      # Orquestador del datagrid virtualizado
│   │   ├── datagrid/               # Celdas editables, toolbars, filtros y paginadores
│   │   ├── login-button.tsx        # Control de sesión y login con Supabase
│   │   ├── providers.tsx           # QueryClientProvider y configuración de cache
│   │   └── ui/                     # Primitivas UI estilizadas
│   ├── hooks/                      # Hooks para fetching paginado y mutaciones en lote
│   ├── lib/                        # Cliente de Supabase y utilidades de fecha
│   ├── services/                   # Capa de llamadas a PostgREST
│   └── types/                      # Definición de tipos de filas de programación
├── next.config.ts                  # Configuración de Next.js
├── package.json                    # Dependencias y scripts
└── tsconfig.json                   # Configuración de TypeScript
```

---

## ⚙️ 4. Instalación y Ejecución Local

### Prerrequisitos
- Node.js v20 o superior.
- npm v10 o superior.

### Pasos
```bash
# 1. Clonar o ingresar al directorio
cd programacion-crm

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local

# 4. Iniciar servidor de desarrollo
npm run dev
```
La grilla estará disponible en: `http://localhost:3000` (o el puerto configurado).

### Variables de Entorno (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://db.geofal.com.pe
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

---

## 🐳 5. Despliegue en Producción

El proyecto incluye un `Dockerfile` multi-stage optimizado para Next.js:

```bash
# Construir imagen
docker build -t programacion-crm \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://db.geofal.com.pe \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key \
  .

# Ejecutar contenedor
docker run -d -p 3001:3000 --name programacion-crm programacion-crm
```
En **Coolify**, el servicio opera bajo el subdominio `https://lab.geofal.com.pe` con balanceo y certificados SSL administrados por Traefik.
