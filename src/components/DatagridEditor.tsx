"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
    type ColumnDef,
} from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { Loader2, RefreshCw, Save, AlertCircle } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181"

// --- Interfaces ---
export interface ProgramacionServicio {
    id: string
    item_numero: number
    recep_numero: string
    ot: string | null
    codigo_muestra: string | null
    fecha_recepcion: string | null
    fecha_inicio: string | null
    fecha_entrega_estimada: string | null
    cliente_nombre: string
    descripcion_servicio: string | null
    proyecto: string | null
    fecha_entrega_real: string | null
    estado_trabajo: string
    cotizacion_lab: string | null
    autorizacion_lab: string | null
    nota_lab: string | null
    dias_atraso_lab: number
    motivo_dias_atraso_lab: string | null
    evidencia_envio_recepcion: string | null
    envio_informes: string | null
    // ... other fields can be added as needed
}

const columnHelper = createColumnHelper<ProgramacionServicio>()

export function DatagridEditor() {
    const [data, setData] = useState<ProgramacionServicio[]>([])
    const [loading, setLoading] = useState(true)

    // --- Data Fetching ---
    const fetchServicios = async () => {
        setLoading(true)
        try {
            // Fetch all for now, similar to previous module
            const res = await fetch(`${API_URL}/programacion`)
            if (!res.ok) throw new Error("Failed to fetch")
            const json = await res.json()
            if (Array.isArray(json)) {
                setData(json)
            } else {
                console.error("Invalid data format", json)
                setData([])
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchServicios()
    }, [])

    // --- Columns Definition ---
    const columns = useMemo<ColumnDef<ProgramacionServicio, any>[]>(() => [
        // --- Sticky / Fixed Columns ---
        columnHelper.accessor("item_numero", {
            header: "ITEM",
            size: 50,
            enablePinning: true,
        }),
        columnHelper.accessor("recep_numero", {
            header: "RECEP. N",
            size: 90,
            enablePinning: true,
        }),
        columnHelper.accessor("ot", {
            header: "OT",
            size: 100,
            enablePinning: true,
        }),
        columnHelper.accessor("codigo_muestra", {
            header: "CÓDIGOS",
            size: 120,
            enablePinning: true,
        }),
        columnHelper.accessor("fecha_recepcion", {
            header: "RECEPCIÓN",
            size: 100,
            enablePinning: true,
        }),
        columnHelper.accessor("fecha_inicio", {
            header: "INICIO",
            size: 100,
            enablePinning: true,
        }),
        columnHelper.accessor("fecha_entrega_estimada", {
            header: "ENTREGA",
            size: 100,
            enablePinning: true,
        }),
        columnHelper.accessor("cliente_nombre", {
            header: "CLIENTE",
            size: 200,
            enablePinning: true,
        }),
        columnHelper.accessor("descripcion_servicio", {
            header: "DESCRIPCIÓN SERVICIO",
            size: 250,
            enablePinning: true,
        }),

        // --- Scrollable Columns (Metadata & Editable Candidates) ---
        columnHelper.accessor("proyecto", {
            header: "PROYECTO",
            size: 150,
        }),
        columnHelper.accessor("estado_trabajo", {
            header: "ESTADO",
            size: 120,
        }),
        columnHelper.accessor("fecha_entrega_real", {
            header: "ENTREGA REAL",
            size: 120,
        }),
        columnHelper.accessor("dias_atraso_lab", {
            header: "DIAS ATRASO",
            size: 100,
            cell: info => {
                const val = info.getValue()
                return val > 0 ? <span className="text-red-600 font-bold">{val}</span> : val
            }
        }),
        columnHelper.accessor("motivo_dias_atraso_lab", {
            header: "MOTIVO ATRASO",
            size: 200,
        }),
        columnHelper.accessor("nota_lab", {
            header: "NOTA LAB",
            size: 200,
        }),
        columnHelper.accessor("evidencia_envio_recepcion", {
            header: "EVIDENCIA RECEP",
            size: 120,
        }),
        columnHelper.accessor("envio_informes", {
            header: "ENVIO INFORMES",
            size: 120,
        }),
    ], [])

    // --- Table Instance ---
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        state: {
            columnPinning: {
                left: [
                    "item_numero",
                    "recep_numero",
                    "ot",
                    "codigo_muestra",
                    "fecha_recepcion",
                    "fecha_inicio",
                    "fecha_entrega_estimada",
                    "cliente_nombre",
                    "descripcion_servicio"
                ],
            },
        },
        defaultColumn: {
            size: 150, // default width
            minSize: 50,
            maxSize: 500,
        },
    })

    return (
        <div className="flex flex-col h-screen bg-white text-zinc-900 font-sans">
            {/* Top Bar / Toolbar */}
            <div className="h-14 border-b border-zinc-200 flex items-center justify-between px-4 bg-white shrink-0 z-50 relative">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 text-white p-1.5 rounded-md">
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </div>
                    <h1 className="font-semibold text-lg tracking-tight text-zinc-800">
                        Editor de Programación
                    </h1>
                    <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                        {data.length} registros
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchServicios()}
                        className="text-sm text-zinc-600 hover:text-zinc-900 px-3 py-1.5 rounded-md hover:bg-zinc-100 transition-colors font-medium border border-transparent hover:border-zinc-200"
                    >
                        Refrescar
                    </button>
                    <button className="bg-zinc-900 text-white text-sm px-4 py-1.5 rounded-md hover:bg-zinc-800 transition-colors flex items-center gap-2 shadow-sm">
                        <Save className="w-4 h-4" />
                        Guardar Cambios
                    </button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-auto relative bg-zinc-50 scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent">
                <table
                    className="w-full border-collapse"
                    style={{ width: table.getTotalSize() }}
                >
                    {/* Header */}
                    <thead className="sticky top-0 z-40 bg-zinc-100 text-xs uppercase font-semibold text-zinc-500 shadow-sm h-10">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id} className="border-b border-zinc-200">
                                {headerGroup.headers.map(header => {
                                    const isPinned = header.column.getIsPinned()
                                    const isLastPinned = isPinned === "left" && header.column.id === "descripcion_servicio"

                                    return (
                                        <th
                                            key={header.id}
                                            style={{
                                                width: header.getSize(),
                                                left: isPinned ? header.column.getStart("left") : undefined,
                                                position: isPinned ? "sticky" : "relative",
                                                zIndex: isPinned ? 20 : 0,
                                            }}
                                            className={cn(
                                                "px-2 py-2 text-left bg-zinc-100 border-r border-zinc-200 truncate select-none",
                                                isLastPinned && "shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-zinc-300"
                                            )}
                                        >
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    )
                                })}
                            </tr>
                        ))}
                    </thead>

                    {/* Body */}
                    <tbody className="bg-white text-sm divide-y divide-zinc-100">
                        {table.getRowModel().rows.map(row => (
                            <tr key={row.id} className="hover:bg-blue-50/30 transition-colors group">
                                {row.getVisibleCells().map(cell => {
                                    const isPinned = cell.column.getIsPinned()
                                    const isLastPinned = isPinned === "left" && cell.column.id === "descripcion_servicio"
                                    const val = cell.getValue()
                                    const isEmpty = val === null || val === "" || val === undefined

                                    return (
                                        <td
                                            key={cell.id}
                                            style={{
                                                width: cell.column.getSize(),
                                                left: isPinned ? cell.column.getStart("left") : undefined,
                                                position: isPinned ? "sticky" : "relative",
                                                zIndex: isPinned ? 10 : 0,
                                            }}
                                            className={cn(
                                                "px-2 py-1.5 border-r border-zinc-100 truncate bg-white group-hover:bg-blue-50/30",
                                                // Visual Validation: Empty Red Highlight
                                                isEmpty && "bg-red-50/60 group-hover:bg-red-100/50",
                                                // Sticky Shadow
                                                isLastPinned && "shadow-[4px_0_5px_-2px_rgba(0,0,0,0.05)] border-r-zinc-200"
                                            )}
                                        >
                                            {/* Empty Indicator Corner */}
                                            {isEmpty && (
                                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-400 rounded-bl-[2px]" />
                                            )}

                                            <div className="truncate text-zinc-700">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </div>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Loading State Overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            <p className="text-zinc-500 font-medium text-sm">Cargando datos...</p>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && data.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-2">
                        <AlertCircle className="w-8 h-8 opacity-50" />
                        <p>No se encontraron registros</p>
                    </div>
                )}
            </div>
        </div>
    )
}
