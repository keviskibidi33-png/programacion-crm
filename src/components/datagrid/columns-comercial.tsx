"use client"

import { Column, ColumnDef, RowData, Table } from "@tanstack/react-table"
import { ProgramacionServicio } from "@/types/programacion"
import React from "react"
import { ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
// We reuse the helpers, simplified for brevity or imported? 
// Ideally we should refactor helpers to a shared file, but to keep it simple and safe I will duplicate them for now as per instructions "has lo mismo".
// Or I can import them if I export them. `columns.tsx` does NOT export them currently. 
// I will Duplicate the helpers to avoid breaking `columns.tsx` by adding exports.

import { StatusSelect } from "./status-select"
import { AuthorizationSelect } from "./authorization-select"

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

const EditableCell = React.memo(({ getValue, row: { index }, column: { id }, table, className }: EditableCellProps<ProgramacionServicio>) => {
    const initialValue = getValue()
    const [value, setValue] = React.useState(initialValue)
    const [isFocused, setIsFocused] = React.useState(false)

    React.useEffect(() => { setValue(initialValue) }, [initialValue])

    const onBlur = () => {
        setIsFocused(false)
        if (value !== initialValue) {
            table.options.meta?.updateData(index, id, value)
        }
    }

    const isDate = id.includes('fecha') || id === 'entrega_real'
    const textSize = className?.includes('text-') ? '' : 'text-sm'

    if (isDate) {
        return (
            <input
                type="date"
                value={(value as string)?.split('T')[0] ?? ""}
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
            style={{ fieldSizing: "content", minHeight: "1.5em", resize: "none" } as any}
            className={cn(
                "w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1 resize-none overflow-hidden block leading-tight whitespace-pre-wrap py-1 text-zinc-900 placeholder:text-zinc-400",
                textSize,
                className
            )}
        />
    )
})
EditableCell.displayName = "EditableCell"

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

const CotizacionCell = React.memo(({ getValue, row: { index }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    const onBlur = () => {
        setIsEditing(false)
        let finalValue = inputValue.trim()
        if (finalValue && /^\d+$/.test(finalValue)) {
            finalValue = `COTIZACION-${finalValue}-26`
        }
        if (finalValue !== value) {
            table.options.meta?.updateData(index, id, finalValue)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
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

export const columns: ColumnDef<ProgramacionServicio>[] = [
    // ============================================
    // COLUMNAS FIJAS (SHARED)
    // ============================================
    {
        accessorKey: "item_numero",
        header: ({ column }) => <SortableHeader column={column} title="ITEM" />,
        size: 69, minSize: 69, maxSize: 69, enablePinning: true, enableResizing: false,
        cell: info => <div className="text-zinc-400 font-mono text-sm text-center">{info.getValue() as string}</div>
    },
    {
        accessorKey: "recep_numero",
        header: ({ column }) => <SortableHeader column={column} title="RECEP" />,
        size: 78, minSize: 78, maxSize: 78, enablePinning: true, enableResizing: false,
        cell: ({ getValue }) => <div className="text-zinc-900 font-medium px-2">{getValue() as string}</div>,
    },
    {
        accessorKey: "fecha_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nRECEPCION`} />,
        size: 100, minSize: 100, maxSize: 100, enablePinning: true, enableResizing: false,
        cell: EditableCell,
    },
    {
        accessorKey: "cliente_nombre",
        header: ({ column }) => <SortableHeader column={column} title="CLIENTE" />,
        size: 94, minSize: 94, maxSize: 94, enablePinning: true, enableResizing: false,
        cell: ({ getValue, row, column, table }) => (
            <div className="line-clamp-2 whitespace-normal leading-tight text-[12.5px]" title={getValue() as string}>
                <EditableCell getValue={getValue} row={row} column={column} table={table} className="text-[12.5px] leading-3" />
            </div>
        )
    },

    // ============================================
    // COLUMNAS COMERCIAL
    // ============================================
    {
        accessorKey: "cotizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="COTIZACION" />,
        size: 150, minSize: 120, maxSize: 300, enableResizing: true,
        cell: CotizacionCell,
    },
    {
        accessorKey: "fecha_inicio", // Mapped to FECHA SOLICITUD
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nSOLICITUD`} />,
        size: 100, minSize: 100, maxSize: 200, enableResizing: true,
        cell: EditableCell,
    },
    {
        accessorKey: "fecha_entrega_estimada",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nENTREGA`} />,
        size: 100, minSize: 100, maxSize: 200, enableResizing: true,
        cell: EditableCell,
    },
    {
        accessorKey: "evidencia_envio_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`EVIDENCIA SOLICITUD\nENVIO - ACEPTACION`} />,
        size: 200, minSize: 150, maxSize: 400, enableResizing: true,
        cell: EditableCell,
    },
    {
        accessorKey: "dias_atraso_lab",
        header: ({ column }) => <SortableHeader column={column} title={`DIAS ATRASO\nENVIO COTIZ`} />,
        size: 110, minSize: 90, maxSize: 150, enableResizing: true,
        cell: ({ row }) => {
            // Reusing same calculation logic for now as requested
            // Ideally this should use 'fecha_inicio' vs 'cotizacion_sent_date' if accessible?
            // Using generic logic for MVP
            const estimatedDateStr = row.original.fecha_entrega_estimada
            const realDateStr = row.original.entrega_real // This is likely wrong for Cotizacion delay, but I have no other fields.
            // Assuming this column in Comercial view intends to track Quote Delay.
            // If data is unavailable, it will show same as General Delay.
            if (!estimatedDateStr) return <div className="text-zinc-300 text-center">-</div>
            const estimated = new Date(estimatedDateStr)
            const real = realDateStr ? new Date(realDateStr) : new Date()
            estimated.setHours(0, 0, 0, 0); real.setHours(0, 0, 0, 0)
            if (!realDateStr && real <= estimated) return <div className="text-zinc-400 text-center font-mono">0</div>
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
        header: ({ column }) => <SortableHeader column={column} title="MOTIVO DIAS ATRASO" />,
        size: 200, minSize: 100, maxSize: 500, enableResizing: true,
        cell: EditableCell,
    }
]
