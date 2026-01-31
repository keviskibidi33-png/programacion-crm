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
        updateData: (rowId: string, columnId: string, value: unknown) => void
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
const EditableCell = React.memo(({ getValue, row: { index, original }, column: { id }, table, className }: EditableCellProps<ProgramacionServicio>) => {
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
            table.options.meta?.updateData(original.id, id, value)
        }
    }

    // Navigation Logic
    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()

            // Wait for blur to process, then move focus
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentElement = e.target as HTMLElement;
                const currentIndex = allInputs.indexOf(currentElement);

                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    // Select all text if it's an input
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) {
                        (allInputs[currentIndex + 1] as HTMLInputElement).select();
                    }
                }
            }, 0)
        }
    }

    const isDate = id.includes('fecha') || id === 'entrega_real'

    // Force black text color for better contrast
    const colorClass = "text-zinc-900"
    const textSize = className?.includes('text-') ? '' : 'text-sm'

    if (isDate) {
        // Fallback for dates if strict Date input is preferred, but SmartDateCell handles most
        return (
            <input
                type="date"
                value={(value as string)?.split('T')[0] ?? ""} // Ensure YYYY-MM-DD
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
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
            onKeyDown={onKeyDown}
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

// OT Cell (Auto-adds -26 when user enters just digits)
const OTCell = React.memo(({ getValue, row: { index, original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const rawValue = getValue() as string
    // Strip "LEM" (case insensitive) and "-26" for display/edit
    const cleanValue = (val: string) => val ? val.replace(/LEM/i, '').replace(/-26$/, '').trim() : ""

    const [value, setValue] = React.useState(cleanValue(rawValue))

    // Sync if external data changes
    React.useEffect(() => {
        setValue(cleanValue(rawValue))
    }, [rawValue])

    const onBlur = () => {
        let finalValue = value.trim()

        // Auto-add -26 if user enters just digits
        if (finalValue && /^\d+$/.test(finalValue)) {
            finalValue = `${finalValue}-26`
        } else if (finalValue && !finalValue.includes('-26')) {
            // If they entered something like "558-" or "558", ensure -26 is added
            finalValue = finalValue.replace(/-$/, '') // remove trailing dash if any
            if (/^\d+$/.test(finalValue)) {
                finalValue = `${finalValue}-26`
            }
        }

        // Only update if changed
        if (finalValue !== rawValue) {
            table.options.meta?.updateData(original.id, id, finalValue)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentElement = e.target as HTMLElement;
                const currentIndex = allInputs.indexOf(currentElement);
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) {
                        (allInputs[currentIndex + 1] as HTMLInputElement).select();
                    }
                }
            }, 0)
        }
    }

    return (
        <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 -mx-1 h-full text-zinc-900 font-medium"
            placeholder="OT #"
        />
    )
})
OTCell.displayName = "OTCell"

// Smart Date Cell (DD/MM -> YYYY-MM-DD)
const SmartDateCell = React.memo(({ getValue, row: { index, original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const rawValue = getValue() as string
    // Format for display: YYYY-MM-DD -> DD/MM/YY
    const formatDisplay = (val: string) => {
        if (!val) return ""
        try {
            const date = new Date(val)
            if (isNaN(date.getTime())) return val
            const d = String(date.getUTCDate()).padStart(2, '0') // Use UTC to avoid timezone shifts on simple dates
            const m = String(date.getUTCMonth() + 1).padStart(2, '0')
            const y = String(date.getUTCFullYear()).slice(-2)
            return `${d}/${m}/${y}`
        } catch { return val }
    }

    const [inputValue, setInputValue] = React.useState(formatDisplay(rawValue))
    const [isEditing, setIsEditing] = React.useState(false)

    React.useEffect(() => {
        setInputValue(formatDisplay(rawValue))
    }, [rawValue])

    const onBlur = () => {
        setIsEditing(false)
        let finalVal = inputValue.trim()

        // Smart Parsing Logic
        let valToParse = finalVal
        if (/^\d{3}$/.test(valToParse)) {
            valToParse = "0" + valToParse
        }
        const shortDateRegex = /^(\d{1,2})[./-](\d{1,2})$/
        const numericMatch = valToParse.match(/^(\d{2})(\d{2})(\d{2}|\d{4})?$/)
        const match = valToParse.match(shortDateRegex)

        let isoDate = null

        if (numericMatch) {
            const day = numericMatch[1]
            const month = numericMatch[2]
            let year = numericMatch[3] || "2026"
            if (year.length === 2) year = "20" + year
            isoDate = `${year}-${month}-${day}`
            const testDate = new Date(isoDate)
            if (isNaN(testDate.getTime())) isoDate = null
        } else if (match) {
            const day = match[1].padStart(2, '0')
            const month = match[2].padStart(2, '0')
            const year = "2026"
            isoDate = `${year}-${month}-${day}`
            const testDate = new Date(isoDate)
            if (isNaN(testDate.getTime())) isoDate = null
        } else {
            const fullDateRegex = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})$/
            const fullMatch = finalVal.match(fullDateRegex)
            if (fullMatch) {
                const d = fullMatch[1].padStart(2, '0')
                const m = fullMatch[2].padStart(2, '0')
                let y = fullMatch[3]
                if (y.length === 2) y = "20" + y
                isoDate = `${y}-${m}-${d}`
            }
        }

        if (isoDate) {
            table.options.meta?.updateData(original.id, id, isoDate)
            setInputValue(formatDisplay(isoDate)) // Update display immediately
        } else {
            // Revert if invalid or unchanged
            if (inputValue === "") {
                table.options.meta?.updateData(original.id, id, null)
            } else {
                setInputValue(formatDisplay(rawValue))
            }
        }
    }

    // Check key down (navigation)
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentElement = e.target as HTMLElement;
                const currentIndex = allInputs.indexOf(currentElement);
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    // Select all text
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) {
                        (allInputs[currentIndex + 1] as HTMLInputElement).select();
                    }
                }
            }, 0)
        }
    }


    if (isEditing) {
        return (
            <input
                autoFocus
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                placeholder="dd/mm"
                className="w-full bg-white border border-blue-400 rounded px-1 -mx-1 h-full text-zinc-900 font-medium"
            />
        )
    }

    return (
        <div
            onClick={() => { setIsEditing(true); }}
            className="w-full h-full cursor-pointer hover:bg-zinc-100/50 flex items-center px-1 text-zinc-900"
        >
            {inputValue || <span className="text-zinc-300">--/--</span>}
        </div>
    )
})
SmartDateCell.displayName = "SmartDateCell"

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

// Codigo Muestra Cell (Wraps text, multi-line display)
const CodigoMuestraCell = React.memo(({ getValue, row: { index, original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    const onBlur = () => {
        setIsEditing(false)
        if (inputValue !== value) {
            table.options.meta?.updateData(original.id, id, inputValue)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault(); e.currentTarget.blur()
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentElement = e.target as HTMLElement;
                const currentIndex = allInputs.indexOf(currentElement);
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) {
                        (allInputs[currentIndex + 1] as HTMLInputElement).select();
                    }
                }
            }, 0)
        }
    }

    if (isEditing) {
        return <input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} className="w-full h-full bg-white border border-blue-300 rounded text-sm px-1 font-medium text-zinc-900" />
    }

    return (
        <div
            onClick={() => { setInputValue(value || ""); setIsEditing(true); }}
            className="w-full h-full cursor-pointer hover:bg-slate-50 flex items-center px-1 text-sm text-zinc-900 font-medium leading-tight break-words"
            title={value || "Click para editar"}
        >
            <span className="line-clamp-3">{value || <span className="text-zinc-300 italic">...</span>}</span>
        </div>
    )
})
CodigoMuestraCell.displayName = "CodigoMuestraCell"

const SortableHeader = ({ column, title, className }: { column: Column<ProgramacionServicio, unknown>, title: string, className?: string }) => {
    return (
        <div
            className={cn("flex items-center justify-center space-x-1 cursor-pointer select-none group hover:bg-slate-100/50 px-2 py-1.5 rounded", className)}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            <span className={cn("font-semibold whitespace-pre-line text-center leading-tight text-zinc-800", className)}>{title}</span>
            <ArrowUpDown className={cn("h-3 w-3 shrink-0 text-zinc-400 group-hover:text-zinc-700")} />
        </div>
    )
}

// Cotizacion Cell (Auto-formats number to COTIZ.N-XXX-26)
// LOCKED for Laboratorio view - only Comercial/Admin can edit
const CotizacionCell = React.memo(({ getValue, row: { index, original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    // Permission check: Laboratorio cannot edit COTIZACION
    const userRole = (table.options.meta as any)?.userRole?.toLowerCase() || ''
    // const canEdit = !userRole.includes('laboratorio')
    const canEdit = true // DEV MODE: UNRESTRICTED

    const onBlur = () => {
        setIsEditing(false)
        if (!canEdit) return

        let finalValue = inputValue.trim()

        // Auto-complete logic: number -> COTIZ.N-XXX-26
        if (finalValue && /^\d+$/.test(finalValue)) {
            finalValue = `COTIZ.N-${finalValue}-26`
        } else if (finalValue.startsWith("COTIZACION-")) {
            finalValue = finalValue.replace("COTIZACION-", "COTIZ.N-")
        }

        if (finalValue !== value) {
            table.options.meta?.updateData(original.id, id, finalValue)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')) as HTMLElement[];
                const currentElement = e.target as HTMLElement;
                const currentIndex = allInputs.indexOf(currentElement);
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                    if (allInputs[currentIndex + 1] instanceof HTMLInputElement) {
                        (allInputs[currentIndex + 1] as HTMLInputElement).select();
                    }
                }
            }, 0)
        }
    }

    // Read-only display for Laboratorio
    if (!canEdit) {
        return (
            <div className="w-full h-full flex items-center px-1 text-sm text-zinc-500 bg-zinc-50/50" title="Solo Comercial puede editar">
                {value || <span className="text-zinc-300 italic">-</span>}
            </div>
        )
    }

    if (isEditing) {
        return (
            <input
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                className="w-full h-full bg-white border border-blue-300 rounded text-sm p-1 text-zinc-900 font-medium"
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
// LOCKED unless user is Admin or Administracion
const AutorizacionCell = React.memo(({ getValue, row: { index, original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string

    // Permission check: only Admin or Administracion can edit
    const userRole = (table.options.meta as any)?.userRole?.toLowerCase() || ''
    // const canEdit = userRole === 'admin' || userRole.includes('administracion')
    const canEdit = true // DEV MODE: UNRESTRICTED

    const handleChange = (newValue: string) => {
        if (!canEdit) return
        table.options.meta?.updateData(original.id, id, newValue)
    }

    return (
        <div className="w-full h-full flex items-center justify-center p-1">
            <AuthorizationSelect
                value={value}
                onChange={handleChange}
                disabled={!canEdit}
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
        cell: info => <div className="text-zinc-600 font-mono text-sm text-center bg-white h-full flex items-center justify-center">{info.getValue() as string}</div>
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
        size: 125,
        minSize: 125,
        maxSize: 125,
        enablePinning: true,
        enableResizing: false,
        cell: OTCell,
    },
    {
        accessorKey: "codigo_muestra",
        header: ({ column }) => <SortableHeader column={column} title="CODIGO MUESTRA" />,
        size: 140,
        minSize: 140,
        maxSize: 140,
        enablePinning: true,
        enableResizing: false,
        cell: CodigoMuestraCell,
    },
    {
        accessorKey: "fecha_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nRECEPCION`} />,
        size: 115,
        minSize: 115,
        maxSize: 115,
        enablePinning: true,
        enableResizing: false,
        cell: SmartDateCell,
    },
    {
        accessorKey: "fecha_inicio",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nINICIO`} />,
        size: 110,
        minSize: 110,
        maxSize: 110,
        enablePinning: true,
        enableResizing: false,
        cell: SmartDateCell,
    },
    {
        accessorKey: "fecha_entrega_estimada",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nENTREGA`} />,
        size: 110,
        minSize: 110,
        maxSize: 110,
        enablePinning: true,
        enableResizing: false,
        cell: SmartDateCell,
    },
    {
        accessorKey: "cliente_nombre",
        header: ({ column }) => <SortableHeader column={column} title="CLIENTE" />,
        size: 160,
        minSize: 160,
        maxSize: 160,
        enablePinning: true,
        enableResizing: false,
        cell: (props) => (
            <div className="line-clamp-2 leading-tight">
                <EditableCell {...props} className="text-[12.5px] leading-3 text-zinc-900 font-medium" />
            </div>
        )
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
        accessorKey: "entrega_real",
        header: ({ column }) => <SortableHeader column={column} title={`ENTREGA\nREAL`} />,
        size: 130,
        minSize: 100,
        maxSize: 300,
        enableResizing: true,
        cell: SmartDateCell,
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
                    if (newValue !== getValue()) table.options.meta?.updateData(row.original.id, column.id, newValue)
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
        size: 80,
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
                return <div className="text-center font-mono text-zinc-900">0</div>
            }

            return (
                <div className={`text-center font-mono ${diffDays > 0 ? "text-red-600 font-bold" : "text-zinc-900"}`}>
                    {diffDays > 0 ? `+${diffDays}` : diffDays}
                </div>
            )
        }
    },
    {
        accessorKey: "motivo_dias_atraso_lab",
        header: ({ column }) => <SortableHeader column={column} title={`MOTIVO\nATRASO`} />,
        size: 140,
        minSize: 120,
        maxSize: 300,
        enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-zinc-900" />,
    },
    {
        accessorKey: "evidencia_envio_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`EVID.\nRECEP.`} />,
        size: 70,
        minSize: 50,
        maxSize: 70,
        enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-center text-[11px] font-bold text-zinc-900 uppercase" />,
    },
    {
        accessorKey: "envio_informes",
        header: ({ column }) => <SortableHeader column={column} title={`ENVIO\nINF.`} />,
        size: 70,
        minSize: 50,
        maxSize: 70,
        enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-center text-[11px] font-bold text-zinc-900 uppercase" />,
    },
]
