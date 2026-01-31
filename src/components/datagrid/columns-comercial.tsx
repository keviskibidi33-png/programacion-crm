"use client"

import { Column, ColumnDef, RowData, Table } from "@tanstack/react-table"
import { ProgramacionServicio } from "@/types/programacion"
import React from "react"
import { ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusSelect } from "./status-select"
import { AuthorizationSelect } from "./authorization-select"

// Helper Components (Duplicated for isolation as requested)

interface EditableCellProps<TData> {
    getValue: () => unknown
    row: { index: number, original: TData }
    column: { id: string }
    table: Table<TData>
    className?: string
}

const EditableCell = React.memo(({ getValue, row, column: { id }, table, className }: EditableCellProps<ProgramacionServicio>) => {
    const { index, original } = row
    const initialValue = getValue()
    const [value, setValue] = React.useState(initialValue)
    const [isFocused, setIsFocused] = React.useState(false)

    React.useEffect(() => { setValue(initialValue) }, [initialValue])

    const onBlur = () => {
        setIsFocused(false)
        if (value !== initialValue) {
            table.options.meta?.updateData((original as any).id, id, value)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
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

    const isDate = id.includes('fecha') || id === 'entrega_real'
    const textSize = className?.includes('text-') ? '' : 'text-sm'

    // For Comercial view, we might prefer SmartDateCell, but if basic date is needed fallback here.
    if (isDate) {
        return (
            <input
                type="date"
                value={(value as string)?.split('T')[0] ?? ""}
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
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
            onKeyDown={onKeyDown}
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

const SmartDateCell = React.memo(({ getValue, row: { index, original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const rawValue = getValue() as string
    const formatDisplay = (val: string) => {
        if (!val) return ""
        try {
            const date = new Date(val)
            if (isNaN(date.getTime())) return val
            const d = String(date.getUTCDate()).padStart(2, '0')
            const m = String(date.getUTCMonth() + 1).padStart(2, '0')
            const y = String(date.getUTCFullYear()).slice(-2)
            return `${d}/${m}/${y}`
        } catch { return val }
    }

    const [inputValue, setInputValue] = React.useState(formatDisplay(rawValue))
    const [isEditing, setIsEditing] = React.useState(false)

    React.useEffect(() => { setInputValue(formatDisplay(rawValue)) }, [rawValue])

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
            table.options.meta?.updateData((original as any).id, id, isoDate)
            setInputValue(formatDisplay(isoDate))
        } else if (inputValue === "") {
            table.options.meta?.updateData((original as any).id, id, null)
        } else {
            setInputValue(formatDisplay(rawValue))
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
        return (
            <input autoFocus type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} placeholder="dd/mm" className="w-full bg-white border border-blue-400 rounded px-1 -mx-1 h-full text-zinc-900 font-medium" />
        )
    }
    return (
        <div onClick={() => { setIsEditing(true); }} className="w-full h-full cursor-pointer hover:bg-zinc-100/50 flex items-center px-1 text-zinc-900">
            {inputValue || <span className="text-zinc-300">--/--</span>}
        </div>
    )
})
SmartDateCell.displayName = "SmartDateCell"

const OTCell = React.memo(({ getValue, row, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const { index, original } = row
    const rawValue = getValue() as string
    const initialDisplayValue = rawValue ? rawValue.replace(/LEM/i, '').trim() : ""
    const [value, setValue] = React.useState(initialDisplayValue)

    React.useEffect(() => { setValue(rawValue ? rawValue.replace(/LEM/i, '').trim() : "") }, [rawValue])

    const onBlur = () => {
        const finalValue = value.trim()
        if (finalValue !== initialDisplayValue) table.options.meta?.updateData((original as any).id, id, finalValue)
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
    return <input value={value} onChange={e => setValue(e.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} className="w-full bg-white border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 -mx-1 h-full text-zinc-900 font-medium" placeholder="OT #" />
})
OTCell.displayName = "OTCell"

const CotizacionCell = React.memo(({ getValue, row, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const { index, original } = row
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    // Permission check: only Admin, Comercial or Administracion can edit
    const userRole = (table.options.meta as any)?.userRole?.toLowerCase() || ''
    // const canEdit = userRole === 'admin' || userRole.includes('comercial') || userRole.includes('administracion')
    const canEdit = true // DEV MODE: UNRESTRICTED

    const onBlur = () => {
        setIsEditing(false)
        let finalValue = inputValue.trim()
        if (finalValue && /^\d+$/.test(finalValue)) {
            finalValue = `COTIZ.N-${finalValue}-26`
        } else if (finalValue.startsWith("COTIZACION-")) {
            finalValue = finalValue.replace("COTIZACION-", "COTIZ.N-")
        }
        if (finalValue !== value) {
            table.options.meta?.updateData((original as any).id, id, finalValue)
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

    if (isEditing && canEdit) {
        return (
            <input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} className="w-full h-full bg-white border border-blue-300 rounded text-sm p-1 text-zinc-900 font-medium" placeholder="Ej: 123" />
        )
    }

    return (
        <div
            onClick={() => {
                if (!canEdit) return
                setInputValue(value || "");
                setIsEditing(true);
            }}
            className={cn(
                "w-full h-full flex items-center px-1 text-sm truncate",
                canEdit ? "cursor-pointer hover:bg-slate-50 text-zinc-900" : "cursor-not-allowed text-zinc-500 opacity-70"
            )}
            title={!canEdit ? "No tienes permisos para editar cotizaciones" : (value || "Click para editar")}
        >
            {value || <span className="text-zinc-300 italic">...</span>}
        </div>
    )
})
CotizacionCell.displayName = "CotizacionCell"

const CodigoMuestraCell = React.memo(({ getValue, row, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const { index, original } = row
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    const onBlur = () => {
        setIsEditing(false)
        if (inputValue !== value) {
            table.options.meta?.updateData((original as any).id, id, inputValue)
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
        <div onClick={() => { setInputValue(value || ""); setIsEditing(true); }} className="w-full h-full cursor-pointer bg-white hover:bg-slate-50 flex items-center px-1 text-sm truncate text-zinc-900 font-medium whitespace-nowrap overflow-hidden" title={value || "Click para editar"}>
            {value || <span className="text-zinc-300 italic">...</span>}
        </div>
    )
})
CodigoMuestraCell.displayName = "CodigoMuestraCell"


const SortableHeader = ({ column, title, className }: { column: Column<ProgramacionServicio, unknown>, title: string, className?: string }) => {
    return (
        <div
            className={cn("flex items-center justify-center space-x-1 cursor-pointer select-none group hover:bg-slate-100/50 p-1.5 rounded w-full h-full min-h-[40px]", className)}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            <span className={cn("font-bold whitespace-pre-line text-center leading-tight text-[11px] uppercase tracking-tight", className ? "text-current" : "text-zinc-700")}>{title}</span>
            <ArrowUpDown className={cn("ml-1 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity", className ? "text-indigo-400" : "text-zinc-400")} />
        </div>
    )
}

// Autorizacion Cell (Dropdown)
// LOCKED unless user is Admin, Comercial or Administracion
const AutorizacionCell = React.memo(({ getValue, row, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const { index, original } = row
    const value = getValue() as string

    // Permission check: Laboratorio CANNOT edit authorization
    const userRole = (table.options.meta as any)?.userRole?.toLowerCase() || ''
    // const canEdit = userRole === 'admin' || userRole.includes('administracion') || userRole.includes('comercial')
    const canEdit = true // DEV MODE: UNRESTRICTED

    const handleChange = (newValue: string) => {
        if (!canEdit) return
        table.options.meta?.updateData((original as any).id, id, newValue)
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
        size: 70, minSize: 70, maxSize: 70, enablePinning: true, enableResizing: false,
        cell: info => <div className="text-zinc-400 font-mono text-sm text-center bg-white h-full flex items-center justify-center border-r border-zinc-100">{info.getValue() as string}</div>
    },
    {
        accessorKey: "recep_numero",
        header: ({ column }) => <SortableHeader column={column} title="RECEP. N" />,
        size: 85, minSize: 85, maxSize: 85, enablePinning: true, enableResizing: false,
        cell: ({ getValue }) => <div className="text-zinc-900 font-bold px-2 text-center">{getValue() as string}</div>,
    },
    {
        accessorKey: "fecha_recepcion",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nRECEPCIÓN`} />,
        size: 110, minSize: 110, maxSize: 110,
        cell: SmartDateCell,
    },
    {
        accessorKey: "cliente_nombre",
        header: ({ column }) => <SortableHeader column={column} title="CLIENTE" />,
        size: 200, minSize: 150, maxSize: 400, enableResizing: true,
        cell: ({ getValue, row, column, table }) => (
            <div className="line-clamp-2 whitespace-normal leading-tight text-[12px] font-bold" title={getValue() as string}>
                <EditableCell getValue={getValue} row={row} column={column} table={table} className="text-[12px] leading-3 font-bold uppercase" />
            </div>
        )
    },
    {
        accessorKey: "proyecto",
        header: ({ column }) => <SortableHeader column={column} title="PROYECTO" />,
        size: 200, minSize: 150, maxSize: 500, enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-zinc-900 font-medium" />,
    },
    {
        accessorKey: "cotizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="COTIZACION" />,
        size: 160, minSize: 140, maxSize: 300, enableResizing: true,
        cell: CotizacionCell,
    },
    {
        accessorKey: "fecha_solicitud_com",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nSOLICITUD`} />,
        size: 110, minSize: 110, maxSize: 110,
        cell: SmartDateCell,
    },
    {
        accessorKey: "fecha_entrega_com",
        header: ({ column }) => <SortableHeader column={column} title={`FECHA\nENTREGA`} />,
        size: 110, minSize: 110, maxSize: 110,
        cell: SmartDateCell,
    },
    {
        accessorKey: "evidencia_solicitud_envio",
        header: ({ column }) => <SortableHeader column={column} title={`EVIDENCIA SOLICITUD - ENVIO\n- ACEPTACION COTIZ`} />,
        size: 250, minSize: 200, maxSize: 500, enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-zinc-800 text-[12px] text-center" />,
    },
    {
        accessorKey: "dias_atraso_envio_coti",
        header: ({ column }) => <SortableHeader column={column} title={`DIAS ATRASO\nENVIO COTIZ.`} />,
        size: 110, minSize: 100, maxSize: 150, enableResizing: true,
        cell: ({ row }) => {
            const estimatedDateStr = row.original.fecha_entrega_com
            const realDateStr = row.original.entrega_real

            if (!estimatedDateStr) return <div className="text-zinc-300 text-center">-</div>

            const estimated = new Date(estimatedDateStr)
            const real = realDateStr ? new Date(realDateStr) : new Date()

            estimated.setHours(0, 0, 0, 0)
            real.setHours(0, 0, 0, 0)

            const diffTime = real.getTime() - estimated.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            if (!realDateStr && diffDays <= 0) {
                return <div className="text-center font-mono text-zinc-900 text-sm">0</div>
            }

            return (
                <div className={`text-center font-mono text-sm ${diffDays > 0 ? "text-red-600 font-bold" : "text-zinc-900"}`}>
                    {diffDays > 0 ? `+${diffDays}` : diffDays}
                </div>
            )
        }
    },
    {
        accessorKey: "motivo_dias_atraso_com",
        header: ({ column }) => <SortableHeader column={column} title={`MOTIVO\nDIAS ATRASO`} />,
        size: 200, minSize: 150, maxSize: 600, enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-zinc-800 text-[12px]" />,
    }
]
