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

// Utility to format date as DD/MM/YY
const formatDateToShort = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return dateStr
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = String(date.getFullYear()).slice(-2)
        return `${day}/${month}/${year}`
    } catch {
        return dateStr
    }
}

interface EditableCellProps<TData> {
    getValue: () => unknown
    row: { index: number; original: TData }
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

    // Force black text color for better contrast
    const colorClass = "text-zinc-900"
    const textSize = className?.includes('text-') ? '' : 'text-sm'

    if (isDate) {
        return (
            <input
                type="date"
                value={(value as string)?.split('T')[0] ?? ""} // Ensure YYYY-MM-DD
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                onFocus={() => setIsFocused(true)}
                className={cn(
                    "w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1 h-full placeholder:text-zinc-400",
                    colorClass,
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
                fieldSizing: "content",
                minHeight: "1.5em",
                resize: "none"
            }}
            className={cn(
                "w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1 resize-none overflow-hidden block leading-tight whitespace-pre-wrap py-1 placeholder:text-zinc-400",
                colorClass,
                textSize,
                className
            )}
        />
    )
})
EditableCell.displayName = "EditableCell"

// Date Display Component (Shows DD/MM/YY, becomes picker on click)
const DateDisplayCell = React.memo(({ getValue, row, column, table, className }: EditableCellProps<ProgramacionServicio>) => {
    const [isEditing, setIsEditing] = React.useState(false)
    const value = getValue() as string
    const formatted = formatDateToShort(value)

    if (isEditing) {
        return (
            <div onBlur={() => setIsEditing(false)}>
                <EditableCell getValue={getValue} row={row} column={column} table={table} className={className} />
            </div>
        )
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={cn("w-full h-full cursor-pointer hover:bg-zinc-100/50 flex items-center px-1 text-zinc-900", className)}
        >
            {formatted || <span className="text-zinc-300">--/--/--</span>}
        </div>
    )
})
DateDisplayCell.displayName = "DateDisplayCell"

// Helper for sortable header
const SortableHeader = ({ column, title, className }: { column: Column<ProgramacionServicio, unknown>, title: string, className?: string }) => {
    return (
        <div
            className={cn("flex items-center justify-center space-x-2 cursor-pointer select-none group hover:bg-slate-100/50 p-1 rounded", className)}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            <span className={cn("font-semibold whitespace-pre-line text-center leading-tight text-zinc-800", className)}>{title}</span>
            <ArrowUpDown className={cn("h-3.5 w-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-700")} />
        </div>
    )
}

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
                className="w-full h-full bg-white border border-blue-300 rounded text-sm p-1 text-zinc-900"
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
            className="w-full h-full cursor-pointer hover:bg-slate-50 flex items-center px-1 text-sm truncate text-zinc-900"
            title={value || "Click para editar"}
        >
            {value || <span className="text-zinc-300 italic">...</span>}
        </div>
    )
})
CotizacionCell.displayName = "CotizacionCell"

// Autorizacion Cell (Dropdown)
const AutorizacionCell = React.memo(({ getValue, row: { index }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const isAdmin = true // TODO: Connect real auth

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
    {
        accessorKey: "item_numero",
        header: ({ column }) => <SortableHeader column={column} title="ITEM" />,
        size: 69,
        minSize: 69,
        maxSize: 69,
        enablePinning: true,
        enableResizing: false,
        cell: info => <div className="text-zinc-600 font-mono text-sm text-center">{info.getValue() as string}</div>
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
        cell: DateDisplayCell,
    },
    {
        accessorKey: "fecha_inicio",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nINICIO`} />,
        size: 100,
        minSize: 100,
        maxSize: 100,
        enablePinning: true,
        enableResizing: false,
        cell: DateDisplayCell,
    },
    {
        accessorKey: "fecha_entrega_estimada",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nENTREGA`} />,
        size: 100,
        minSize: 100,
        maxSize: 100,
        enablePinning: true,
        enableResizing: false,
        cell: DateDisplayCell,
    },
    {
        accessorKey: "cliente_nombre",
        header: ({ column }) => <SortableHeader column={column} title="CLIENTE" />,
        size: 94,
        minSize: 94,
        maxSize: 94,
        enablePinning: true,
        enableResizing: false,
        cell: (props) => (
            <div className="line-clamp-2 leading-tight">
                <EditableCell {...props} className="text-[12.5px] leading-3 text-zinc-900 font-medium" />
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
        cell: (props) => <EditableCell {...props} className="text-zinc-900" />,
    },
    {
        accessorKey: "proyecto",
        header: ({ column }) => <SortableHeader column={column} title="PROYECTO" />,
        size: 150,
        minSize: 100,
        maxSize: 400,
        enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-zinc-900" />,
    },
    {
        accessorKey: "entrega_real",
        header: ({ column }) => <SortableHeader column={column} title={`ENTREGA\nREAL`} />,
        size: 130,
        minSize: 100,
        maxSize: 300,
        enableResizing: true,
        cell: DateDisplayCell,
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

            const diffTime = real.getTime() - estimated.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            if (!realDateStr && diffDays <= 0) {
                return <div className="text-zinc-600 text-center font-mono">0</div>
            }

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
        cell: (props) => <EditableCell {...props} className="text-zinc-900" />,
    },
    {
        accessorKey: "evidencia_envio_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`EVID.\nRECEP`} />,
        size: 55,
        minSize: 50,
        maxSize: 70,
        enableResizing: true,
        cell: ({ getValue }) => <div className="text-center text-xs font-semibold text-zinc-900">{(getValue() as string) || "..."}</div>,
    },
    {
        accessorKey: "envio_informes",
        header: ({ column }) => <SortableHeader column={column} title={`ENVIO\nINF.`} />,
        size: 55,
        minSize: 50,
        maxSize: 70,
        enableResizing: true,
        cell: ({ getValue }) => <div className="text-center text-xs font-semibold text-zinc-900">{(getValue() as string) || "..."}</div>,
    },
]
