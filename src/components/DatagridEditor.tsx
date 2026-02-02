"use client"

import React from "react"
import { useSearchParams } from "next/navigation"
import { DataTable } from "@/components/datagrid/data-table"
import { columns } from "@/components/datagrid/columns"
import { useProgramacionData } from "@/hooks/use-programacion-data"
import { RefreshCw, Save, Wifi, WifiOff, FileDown, Info } from "lucide-react"
import { LoginButton } from "@/components/login-button"
import { useCurrentUser } from "@/hooks/use-current-user"

export function DatagridEditor() {
    const searchParams = useSearchParams()
    const modeParam = searchParams.get('mode')
    const { loading: authLoading, role, allowedViews, canView, getCanWrite } = useCurrentUser()

    // Initialize state based on URL param
    const [viewMode, setViewMode] = React.useState<"LAB" | "COM" | "ADMIN">(() => {
        if (modeParam === 'comercial') return 'COM'
        if (modeParam === 'admin') return 'ADMIN'
        return 'LAB'
    })

    const canWrite = React.useMemo(() => getCanWrite(viewMode), [viewMode, getCanWrite])

    // Enforce Permissions Logic
    React.useEffect(() => {
        if (!authLoading && allowedViews.length > 0) {
            // If current view is NOT allowed, switch to first allowed
            if (!allowedViews.includes(viewMode)) {
                setViewMode(allowedViews[0])
            }
        }
    }, [authLoading, allowedViews, viewMode])

    const { data, isLoading, realtimeStatus, updateField, insertRow, exportToExcel } = useProgramacionData()

    // Dynamic Columns Import (lazy or static is fine here)
    const { columns: labColumns } = require("@/components/datagrid/columns")
    const { columns: comColumns } = require("@/components/datagrid/columns-comercial")
    const { columns: adminColumns } = require("@/components/datagrid/columns-admin")

    const currentColumns = React.useMemo(() => {
        if (viewMode === "COM") return comColumns
        if (viewMode === "ADMIN") return adminColumns
        return labColumns
    }, [viewMode, labColumns, comColumns, adminColumns])

    return (
        <div className="flex flex-col h-screen bg-white">
            {authLoading ? (
                <div className="flex h-screen w-full items-center justify-center">
                    <span className="text-zinc-500 text-sm animate-pulse">Verificando permisos...</span>
                </div>
            ) : (
                <>
                    {/* Header / Actions for the Page */}
                    <div className="h-14 border-b border-zinc-200 flex items-center justify-between px-4 bg-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="bg-blue-600 text-white p-1.5 rounded-md">
                                    <RefreshCw className="w-4 h-4" />
                                </div>
                                <h1 className="font-semibold text-lg tracking-tight text-zinc-800">
                                    Programación
                                </h1>
                                <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                                    {data.length}
                                </span>
                            </div>

                            {/* VIEW TOGGLE TABS */}
                            <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                                {canView("LAB") && (
                                    <button
                                        onClick={() => setViewMode("LAB")}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === "LAB" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                                    >
                                        Laboratorio
                                    </button>
                                )}
                                {canView("COM") && (
                                    <button
                                        onClick={() => setViewMode("COM")}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === "COM" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                                    >
                                        Comercial
                                    </button>
                                )}
                                {canView("ADMIN") && (
                                    <button
                                        onClick={() => setViewMode("ADMIN")}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === "ADMIN" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                                    >
                                        Administración
                                    </button>
                                )}
                                {allowedViews.length === 0 && !authLoading && (
                                    <span className="px-2.5 py-1 text-[10px] uppercase font-bold text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-md flex items-center gap-1.5 cursor-default">
                                        <Info className="w-3 h-3 text-zinc-400" />
                                        Modo Consulta
                                    </span>
                                )}
                                {!canWrite && (
                                    <span className="ml-2 px-2.5 py-1 text-[10px] uppercase font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-1.5 cursor-default" title="Solo lectura para esta vista">
                                        <Info className="w-3 h-3" />
                                        Solo Lectura
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => exportToExcel(data)}
                                disabled={data.length === 0}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FileDown className="w-3.5 h-3.5" />
                                <span>Exportar</span>
                            </button>

                            <div className="flex items-center gap-3">
                                {/* Status Indicator */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-50 border border-zinc-200" title={`Estado Realtime: ${realtimeStatus}`}>
                                    {realtimeStatus === "SUBSCRIBED" ? (
                                        <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                        <WifiOff className="w-3.5 h-3.5 text-red-500" />
                                    )}
                                    <span className="text-[10px] uppercase font-bold text-zinc-500 hidden sm:inline">
                                        {realtimeStatus === "SUBSCRIBED" ? "Online" : "Offline"}
                                    </span>
                                </div>

                                {isLoading && <span className="text-xs text-blue-500 animate-pulse">Sincronizando...</span>}
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-hidden">
                        <DataTable
                            columns={currentColumns}
                            data={data}
                            loading={isLoading}
                            onUpdate={updateField}
                            onInsert={canWrite ? insertRow : undefined}
                            userRole={role || ''}
                            canWrite={canWrite}
                            key={viewMode} // Force remount on view change to reset table state (pinning, etc)
                        />
                    </div>
                </>
            )}
        </div>
    )
}
