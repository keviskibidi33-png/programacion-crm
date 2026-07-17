
"use client"

import React from "react"
import { DataTable } from "@/components/datagrid/data-table"
import { columnsLab } from "@/components/datagrid/columns"
import { columnsAdmin } from "@/components/datagrid/columns-admin"
import { useProgramacionData } from "@/hooks/use-programacion-data"
import { RefreshCw, Wifi, WifiOff, FileDown, Info, Lock, Building2, FlaskConical } from "lucide-react"
import { LoginButton } from "@/components/login-button"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useSearchParams } from "next/navigation"
import type { ProgramacionServicio } from "@/types/programacion"
import { hasScopedProgramacionViewAccess } from "@/lib/programacion-column-access"

const PROGRAMACION_TABLE_STORAGE_PREFIX = "programacion:table-state:v1"

export function DatagridEditor() {
    const { loading: authLoading, userId, role, email, getCanWrite, getCanView, needsAuth, permissions } = useCurrentUser()
    const { data, isLoading, realtimeStatus, updateField, insertRow, exportToExcel } = useProgramacionData()

    // State to track filtered data for Excel export
    const [filteredItems, setFilteredItems] = React.useState<ProgramacionServicio[]>([])

    const storageIdentity = React.useMemo(
        () => userId || role || "anonymous",
        [role, userId],
    )
    const searchParams = useSearchParams()
    const isAdminMode = searchParams.get("mode") === "admin"
    const viewMode = isAdminMode ? "ADMIN" : "LAB"
    const canView = React.useMemo(() => getCanView(viewMode), [getCanView, viewMode])
    const canWrite = React.useMemo(() => getCanWrite(viewMode), [viewMode, getCanWrite])
    const columns = React.useMemo(() => isAdminMode ? columnsAdmin : columnsLab, [isAdminMode])
    const hasScopedColumnAccess = hasScopedProgramacionViewAccess(email, viewMode)
    const exportMode = isAdminMode ? "administracion" : "lab"

    const tableStateStorageKey = `${PROGRAMACION_TABLE_STORAGE_PREFIX}:${storageIdentity}:${isAdminMode ? "ADMIN" : "LAB"}`

    // 1. Loading State
    if (authLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-zinc-50">
                <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-zinc-500 text-sm font-medium">Verificando credenciales...</span>
                </div>
            </div>
        )
    }

    // 2. Auth Required State (Direct access protection)
    if (needsAuth) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 p-4">
                <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-zinc-200 p-8 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                        <Lock className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-900 mb-2">Acceso Restringido</h2>
                    <p className="text-zinc-500 mb-8 px-4">
                        Para visualizar o editar la programación, debes iniciar sesión con tus credenciales de usuario.
                    </p>
                    <div className="w-full h-px bg-zinc-100 mb-8" />
                    <LoginButton />
                    <p className="mt-6 text-[11px] text-zinc-400 uppercase tracking-widest font-semibold font-mono">
                        GEO-FAL S.A.S • Seguridad Interna
                    </p>
                </div>
            </div>
        )
    }

    if (!canView) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 p-4">
                <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-xl">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                        <Lock className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="mb-2 text-2xl font-bold text-zinc-900">Acceso Denegado</h2>
                    <p className="mb-8 px-4 text-zinc-500">
                        Tu rol no tiene acceso a esta tabla de control.
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                        GEO-FAL S.A.S • Seguridad Interna
                    </p>
                </div>
            </div>
        )
    }

    // 3. Main Dashboard View
    return (
        <div className="flex flex-col h-screen bg-white">
            {/* Header / Actions */}
            <div className="h-14 border-b border-zinc-200 flex items-center justify-between px-4 bg-white shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 text-white p-1.5 rounded-md shadow-sm">
                            <RefreshCw className="w-4 h-4" />
                        </div>
                        <h1 className="font-semibold text-lg tracking-tight text-zinc-800">
                            Programación {isAdminMode && <span className="text-blue-600">/ Administración</span>}
                        </h1>
                        <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200 font-mono">
                            {data.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5">
                        <span className={'px-3 py-1 text-xs font-semibold rounded-md bg-white shadow-sm flex items-center gap-1 ' + (isAdminMode ? 'text-indigo-600' : 'text-blue-600')}>
                            {isAdminMode ? <><Building2 className="w-3 h-3" /> Administración</> : <><FlaskConical className="w-3 h-3" /> Laboratorio</>}
                        </span>
                    </div>

                    {!canWrite && !hasScopedColumnAccess && (
                        <span className="px-2.5 py-1 text-[10px] uppercase font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-1.5 cursor-default" title="Solo lectura para esta vista">
                            <Info className="w-3 h-3" />
                            Vista Solo Lectura
                        </span>
                    )}
                    {!canWrite && hasScopedColumnAccess && (
                        <span className="px-2.5 py-1 text-[10px] uppercase font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-1.5 cursor-default" title="Permiso limitado: solo Entrega real y Estado">
                            <Info className="w-3 h-3" />
                            Edicion Limitada
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            exportToExcel(filteredItems, exportMode)
                        }}
                        disabled={data.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Exportar Excel {isAdminMode ? "(Admin)" : ""}</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-50 border border-zinc-200 shadow-inner" title={`Estado Realtime: ${realtimeStatus}`}>
                            {realtimeStatus === "SUBSCRIBED" ? (
                                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                                <WifiOff className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                            )}
                            <span className="text-[10px] uppercase font-bold text-zinc-500 hidden sm:inline">
                                {realtimeStatus === "SUBSCRIBED" ? "En Línea" : "Sin Conexión"}
                            </span>
                        </div>
                        {isLoading && <span className="text-xs text-blue-500 animate-pulse font-medium">Sincronizando...</span>}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden bg-zinc-50 p-1">
                <DataTable
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    columns={columns as any}
                    data={data}
                    loading={isLoading}
                    onUpdate={updateField}
                    onInsert={canWrite ? insertRow : undefined}
                    userRole={role || ''}
                    userEmail={email || ''}
                    canWrite={canWrite}
                    permissions={permissions}
                    viewMode={viewMode}
                    onFilteredDataChange={setFilteredItems}
                    storageKey={tableStateStorageKey}
                    key={`${storageIdentity}:${isAdminMode ? "ADMIN" : "LAB"}`}
                />
            </div>
        </div>
    )
}
