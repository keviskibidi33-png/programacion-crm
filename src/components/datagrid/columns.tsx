"use client"

import { Column, ColumnDef, RowData, Table } from "@tanstack/react-table"
import { ProgramacionServicio } from "@/types/programacion"
import React from "react"
import { ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusSelect } from "./status-select"
import { AuthorizationSelect } from "./authorization-select"

// Extend meta to support custom cell editing
declare module "@tanstack/react-table" {
    interface TableMeta<TData extends RowData> {
        updateData: (rowIndex: number, columnId: string, value: unknown) => void
    }
}

interface EditableCellProps<TData> {
    getValue: () => unknown
    row: { index: number }
    column: { id: string }
    table: Table<TData>
    className?: string
}

// Editable Cell Component
const EditableCell = React.memo(({ getValue, row: { index }, column: { id }, table, className }: EditableCellProps<ProgramacionServicio>) => {
    const initialValue = getValue()
    const [value, setValue] = React.useState(initialValue)

    const [isFocused, setIsFocused] = React.useState(false)

    // Sync external changes
    React.useEffect(() => {
        setValue(initialValue)
    }, [initialValue])

    const onBlur = () => {
        setIsFocused(false)
        if (value !== initialValue) {
            table.options.meta?.updateData(index, id, value)
        }
    }

    const isDate = id.includes('fecha') || id === 'entrega_real'

    // Default size if not provided
    const textSize = className?.includes('text-') ? '' : 'text-sm'

    // Reverted Boolean Logic: User wants text
    if (isDate) {
        return (
            <input
                type="date"
                value={(value as string)?.split('T')[0] ?? ""} // Ensure YYYY-MM-DD
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                onFocus={() => setIsFocused(true)}
                className={cn(
                    "w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1 h-full text-zinc-900 placeholder:text-zinc-400",
                    textSize,
                    className
                )}
            />
        )
    }

    return (
        <textarea
            value={(value as string) ?? ""}
            onChange={e => setValue(e.target.value)}
            onBlur={onBlur}
            onFocus={() => setIsFocused(true)}
            rows={1}
            style={{
                fieldSizing: "content", // New CSS property for auto-sizing, fallback needed for older browsers or use effect resizing
                minHeight: "1.5em",
                resize: "none"
            }}
            className={cn(
                "w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1 resize-none overflow-hidden block leading-tight whitespace-pre-wrap py-1 placeholder:text-zinc-400",
                textSize,
                className?.includes('text-') ? className : `text-zinc-900 ${className || ''}`
            )}
        />
    )
})
EditableCell.displayName = "EditableCell"

// Helper for sortable header
const SortableHeader = ({ column, title, className }: { column: Column<ProgramacionServicio, unknown>, title: string, className?: string }) => {
    return (
        <div
            className={cn("flex items-center space-x-2 cursor-pointer select-none group hover:bg-slate-100/50 p-1 rounded", className)}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            <span className={cn("font-semibold whitespace-pre-line text-center leading-tight", className ? "text-current" : "text-zinc-700")}>{title}</span>
            <ArrowUpDown className={cn("ml-2 h-3.5 w-3.5 shrink-0", className ? "text-indigo-300 group-hover:text-indigo-600" : "text-zinc-400 group-hover:text-zinc-700")} />
        </div>
    )
}

// Status Badge Logic
const getStatusColor = (status: string) => {
    const s = status?.toUpperCase() || ""
    if (s.includes("COMPLETADO") || s.includes("LISTO")) return "bg-emerald-100 text-emerald-800 border-emerald-200"
    if (s.includes("PROCESO")) return "bg-amber-100 text-amber-800 border-amber-200"
    if (s.includes("PENDIENTE")) return "bg-slate-100 text-slate-700 border-slate-200"
    return "bg-white text-zinc-700 border-zinc-200"
}

const StatusCell = React.memo(({ getValue, row: { index }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string

    const onStatusChange = (newValue: string) => {
        if (newValue !== value) {
            table.options.meta?.updateData(index, id, newValue)
        }
    }

    return (
        <div className="w-full h-full flex items-center justify-center p-1">
            <StatusSelect value={value} onChange={onStatusChange} />
        </div>
    )
})
StatusCell.displayName = "StatusCell"

// Cotizacion Cell (Auto-formats number to COTIZACION-XXX-26)
const CotizacionCell = React.memo(({ getValue, row: { index }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    const onBlur = () => {
        setIsEditing(false)
        let finalValue = inputValue.trim()

        // Auto-complete logic
        if (finalValue && /^\d+$/.test(finalValue)) {
            finalValue = `COTIZACION-${finalValue}-26`
        }

        if (finalValue !== value) {
            // Update with formatted value
            table.options.meta?.updateData(index, id, finalValue)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur() // This triggers onBlur which handles formatting and saving
        }
    }

    if (isEditing) {
        return (
            <input
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                className="w-full h-full bg-white border border-blue-300 rounded text-sm p-1"
                placeholder="Ej: 123"
            />
        )
    }

    return (
        <div
            onClick={() => {
                setInputValue(value || "")
                setIsEditing(true)
            }}
            className="w-full h-full cursor-pointer hover:bg-slate-50 flex items-center px-1 text-sm truncate text-zinc-600"
            title={value || "Click para editar"}
        >
            {value || <span className="text-zinc-300 italic">...</span>}
        </div>
    )
})
CotizacionCell.displayName = "CotizacionCell"

// Autorizacion Cell (Dropdown)
// Autorizacion Cell (Dropdown with Admin Logic)
const AutorizacionCell = React.memo(({ getValue, row: { index }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string

    // TODO: Connect this to real auth context
    const isAdmin = true

    const handleChange = (newValue: string) => {
        table.options.meta?.updateData(index, id, newValue)
    }

    return (
        <div className="w-full h-full flex items-center justify-center p-1">
            <AuthorizationSelect
                value={value}
                onChange={handleChange}
                disabled={!isAdmin}
            />
        </div>
    )
})
AutorizacionCell.displayName = "AutorizacionCell"

export const columns: ColumnDef<ProgramacionServicio>[] = [
    // ============================================
    // COLUMNAS FIJAS - NO REDIMENSIONABLES
    // ============================================
    {
        accessorKey: "item_numero",
        header: ({ column }) => <SortableHeader column={column} title="ITEM" />,
        size: 69,
        minSize: 69,
        maxSize: 69,
        enablePinning: true,
        enableResizing: false,
        cell: info => <div className="text-zinc-400 font-mono text-sm text-center">{info.getValue() as string}</div>
    },
    {
        accessorKey: "recep_numero",
        header: ({ column }) => <SortableHeader column={column} title="RECEP" />,
        size: 78,
        minSize: 78,
        maxSize: 78,
        enablePinning: true,
        enableResizing: false,
        cell: EditableCell,
    },
    {
        accessorKey: "ot",
        header: ({ column }) => <SortableHeader column={column} title="OT" />,
        size: 70,
        minSize: 70,
        maxSize: 70,
        enablePinning: true,
        enableResizing: false,
        cell: EditableCell,
    },
    {
        accessorKey: "codigo_muestra",
        header: ({ column }) => <SortableHeader column={column} title="CODIGO MUESTRA" />,
        size: 87,
        minSize: 87,
        maxSize: 87,
        enablePinning: true,
        enableResizing: false,
        cell: EditableCell,
    },
    {
        accessorKey: "fecha_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nRECEPCION`} />,
        size: 100,
        minSize: 100,
        maxSize: 100,
        enablePinning: true,
        enableResizing: false,
        cell: EditableCell,
    },
    {
        accessorKey: "fecha_inicio",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nINICIO`} />,
        size: 100,
        minSize: 100,
        maxSize: 100,
        enablePinning: true,
        enableResizing: false,
        cell: EditableCell,
    },
    {
        accessorKey: "fecha_entrega_estimada",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nENTREGA`} />,
        size: 100,
        minSize: 100,
        maxSize: 100,
        enablePinning: true,
        enableResizing: false,
        cell: EditableCell,
    },
    {
        accessorKey: "cliente_nombre",
        header: ({ column }) => <SortableHeader column={column} title="CLIENTE" />,
        size: 94,
        minSize: 94,
        maxSize: 94,
        enablePinning: true,
        enableResizing: false,
        cell: ({ getValue, row, column, table }) => (
            <div
                className="line-clamp-2 whitespace-normal leading-tight text-[12.5px]"
                title={getValue() as string}
            >
                <EditableCell getValue={getValue} row={row} column={column} table={table} className="text-[12.5px] leading-3" />
            </div>
        )
    },
    {
        accessorKey: "descripcion_servicio",
        header: ({ column }) => <SortableHeader column={column} title="DESCRIPCION DEL SERVICIO" />,
        size: 157,
        minSize: 157,
        maxSize: 157,
        enablePinning: true,
        enableResizing: false,
        cell: EditableCell,
    },

    // ============================================
    // COLUMNAS SCROLLABLES - REDIMENSIONABLES
    // ============================================
    {
        accessorKey: "proyecto",
        header: ({ column }) => <SortableHeader column={column} title="PROYECTO" />,
        size: 150,
        minSize: 100,
        maxSize: 400,
        enableResizing: true,
        cell: EditableCell,
    },
    {
        accessorKey: "entrega_real",
        header: ({ column }) => <SortableHeader column={column} title={`ENTREGA\nREAL`} />,
        size: 130,
        minSize: 100,
        maxSize: 300,
        enableResizing: true,
        cell: EditableCell,
    },
    {
        accessorKey: "estado_trabajo",
        header: ({ column }) => <SortableHeader column={column} title="ESTADO" className="text-base font-semibold" />,
        size: 180,
        minSize: 160,
        maxSize: 280,
        enableResizing: true,
        cell: ({ getValue, row, column, table }) => (
            <div className="text-[13px] font-medium">
                <StatusSelect value={getValue() as string} onChange={(newValue) => {
                    if (newValue !== getValue()) table.options.meta?.updateData(row.index, column.id, newValue)
                }} />
            </div>
        ),
    },
    {
        accessorKey: "cotizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="COTIZACION" />,
        size: 150,
        minSize: 120,
        maxSize: 300,
        enableResizing: true,
        cell: CotizacionCell,
    },
    {
        accessorKey: "autorizacion_lab",
        header: ({ column }) => (
            <div className="flex flex-col items-center">
                <SortableHeader column={column} title="AUTORIZADO" className="bg-indigo-50/50 text-indigo-900" />
                <span className="text-[9px] text-indigo-500 font-medium -mt-1">ADMINISTRACIÓN</span>
            </div>
        ),
        size: 130,
        minSize: 100,
        maxSize: 200,
        enableResizing: true,
        cell: AutorizacionCell,
    },
    {
        accessorKey: "nota_admin",
        header: ({ column }) => <SortableHeader column={column} title="NOTA" className="text-base font-semibold" />,
        size: 350,
        minSize: 250,
        maxSize: 700,
        enableResizing: true,
        cell: ({ getValue, row, column, table }) => (
            <EditableCell getValue={getValue} row={row} column={column} table={table} className="text-[13px] text-zinc-900" />
        ),
    },
    {
        accessorKey: "dias_atraso_lab",
        header: ({ column }) => <SortableHeader column={column} title={`DIAS\nATRASO`} />,
        size: 70,
        minSize: 60,
        maxSize: 90,
        enableResizing: true,
        filterFn: (row, columnId, filterValue) => {
            if (!filterValue) return true
            const val = row.getValue(columnId) as number
            return val > 0
        },
        cell: ({ row }) => {
            const estimatedDateStr = row.original.fecha_entrega_estimada
            const realDateStr = row.original.entrega_real

            if (!estimatedDateStr) return <div className="text-zinc-300 text-center">-</div>

            const estimated = new Date(estimatedDateStr)
            const real = realDateStr ? new Date(realDateStr) : new Date()

            estimated.setHours(0, 0, 0, 0)
            real.setHours(0, 0, 0, 0)

            if (!realDateStr && real <= estimated) {
                return <div className="text-zinc-400 text-center font-mono">0</div>
            }

            const diffTime = real.getTime() - estimated.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            return (
                <div className={`text-center font-mono ${diffDays > 0 ? "text-red-600 font-bold" : "text-green-600"}`}>
                    {diffDays > 0 ? `+${diffDays}` : diffDays}
                </div>
            )
        }
    },
    {
        accessorKey: "motivo_dias_atraso_lab",
        header: ({ column }) => <SortableHeader column={column} title={`MOTIVO\nATRASO`} />,
        size: 180,
        minSize: 120,
        maxSize: 300,
        enableResizing: true,
        cell: EditableCell,
    },
    {
        accessorKey: "evidencia_envio_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`EVID.\nRECEP`} />,
        size: 55,
        minSize: 50,
        maxSize: 70,
        enableResizing: true,
        cell: ({ getValue }) => <div className="text-center text-xs font-semibold text-zinc-700">{(getValue() as string) || "..."}</div>,
    },
    {
        accessorKey: "envio_informes",
        header: ({ column }) => <SortableHeader column={column} title={`ENVIO\nINF.`} />,
        size: 55,
        minSize: 50,
        maxSize: 70,
        enableResizing: true,
        cell: ({ getValue }) => <div className="text-center text-xs font-semibold text-zinc-700">{(getValue() as string) || "..."}</div>,
    },
]
