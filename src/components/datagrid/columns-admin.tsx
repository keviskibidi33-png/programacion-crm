"use client"

import { Column, ColumnDef, RowData, Table } from "@tanstack/react-table"
import { ProgramacionServicio } from "@/types/programacion"
import React from "react"
import { ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Helper Components (Duplicated for isolation)
import { StatusSelect } from "./status-select"
import { AuthorizationSelect } from "./authorization-select"
import { PaymentSelect } from "./payment-select"

declare module "@tanstack/react-table" {
    interface TableMeta<TData extends RowData> {
        updateData: (rowId: string, columnId: string, value: unknown) => void
    }
}

interface EditableCellProps<TData> {
    getValue: () => unknown
    row: { index: number, original: TData }
    column: { id: string }
    table: Table<TData>
    className?: string
}

const EditableCell = React.memo(({ getValue, row: { index, original }, column: { id }, table, className }: EditableCellProps<ProgramacionServicio>) => {
    const initialValue = getValue()
    const [value, setValue] = React.useState(initialValue)
    const [isFocused, setIsFocused] = React.useState(false)

    React.useEffect(() => { setValue(initialValue) }, [initialValue])

    const canWrite = (table.options.meta as any)?.canWrite ?? false

    const onBlur = () => {
        setIsFocused(false)
        if (!canWrite) return
        if (value !== initialValue) {
            table.options.meta?.updateData((original as any).id, id, value)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
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

    const isDate = id.includes('fecha') || id === 'entrega_real'
    const textSize = className?.includes('text-') ? '' : 'text-sm'

    if (!canWrite) {
        return (
            <div className={cn("px-1 py-1 truncate cursor-not-allowed opacity-70", textSize, className)} title="Vista Solo Lectura">
                {isDate ? (value ? new Date(value as string).toLocaleDateString() : "-") : (value as string || "-")}
            </div>
        )
    }

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
        return (<input autoFocus type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} placeholder="dd/mm" className="w-full bg-white border border-blue-400 rounded px-1 -mx-1 h-full text-zinc-900 font-medium" />)
    }
    return (
        <div onClick={() => { setIsEditing(true); }} className="w-full h-full cursor-pointer hover:bg-zinc-100/50 flex items-center px-1 text-zinc-900">
            {inputValue || <span className="text-zinc-300">--/--</span>}
        </div>
    )
})
SmartDateCell.displayName = "SmartDateCell"

const OTCell = React.memo(({ getValue, row: { index, original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
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

const FacturacionCell = React.memo(({ getValue, row: { index, original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const [isEditing, setIsEditing] = React.useState(false)
    const [inputValue, setInputValue] = React.useState(value || "")

    const onBlur = () => {
        setIsEditing(false)
        let finalValue = inputValue.trim()
        if (finalValue) {
            if (/^\d+$/.test(finalValue)) {
                // If only digits, pad to at least 4 digits for the number part
                const paddedNum = finalValue.length < 4 ? finalValue.padStart(4, '0') : finalValue
                finalValue = `F001-${paddedNum}`
            } else if (/^(\d+)-(\d+)$/.test(finalValue)) {
                const match = finalValue.match(/^(\d+)-(\d+)$/)
                if (match) {
                    finalValue = `F${match[1].padStart(3, '0')}-${match[2].padStart(4, '0')}`
                }
            } else if (/^[fF]\d+$/.test(finalValue)) {
                // If starts with F but no dash, e.g. F123 -> F001-0123
                const nums = finalValue.slice(1)
                const paddedNum = nums.length < 4 ? nums.padStart(4, '0') : nums
                finalValue = `F001-${paddedNum}`
            }
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

    if (isEditing) {
        return <input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} className="w-full h-full bg-white border border-blue-300 rounded text-sm p-1 text-zinc-900 font-medium" placeholder="Ej: 1234 o 002-5678" />
    }

    return (
        <div onClick={() => { setInputValue(value || ""); setIsEditing(true); }} className="w-full h-full cursor-pointer hover:bg-slate-50 flex items-center px-1 text-sm truncate text-zinc-900 font-medium" title={value || "Click para editar"}>
            {value || <span className="text-zinc-300 italic">...</span>}
        </div>
    )
})
FacturacionCell.displayName = "FacturacionCell"

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

const AutorizacionCell = React.memo(({ getValue, row: { index, original }, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const userRole = (table.options.meta as any)?.userRole?.toLowerCase() || ''
    const canWrite = (table.options.meta as any)?.canWrite ?? false
    const isAdmin = canWrite && (userRole.includes('admin') || userRole.includes('administracion'))
    const handleChange = (newValue: string) => { table.options.meta?.updateData((original as any).id, id, newValue) }

    const ADMIN_OPTIONS = [
        { value: "ENTREGAR", label: "ENTREGAR", color: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200" },
        { value: "NO ENTREGAR", label: "NO ENTREGAR", color: "bg-red-50 text-red-800 border-red-100 hover:bg-red-100" }
    ]

    return (
        <div className={cn("w-full h-full flex items-center justify-center p-1", !isAdmin && "cursor-not-allowed")}>
            <AuthorizationSelect value={value} onChange={handleChange} disabled={!isAdmin} options={ADMIN_OPTIONS} />
        </div>
    )
})
AutorizacionCell.displayName = "AutorizacionCell"

const PaymentStatusCell = React.memo(({ getValue, row, column: { id }, table }: EditableCellProps<ProgramacionServicio>) => {
    const value = getValue() as string
    const canWrite = (table.options.meta as any)?.canWrite ?? false
    const onStatusChange = (newValue: string) => {
        if (!canWrite) return
        table.options.meta?.updateData((row.original as any).id, id, newValue)
    }
    return (
        <div className={cn("w-full h-full flex items-center justify-center p-1", !canWrite && "cursor-not-allowed")}>
            <PaymentSelect value={value} onChange={onStatusChange} disabled={!canWrite} />
        </div>
    )
})
PaymentStatusCell.displayName = "PaymentStatusCell"

export const columns: ColumnDef<ProgramacionServicio>[] = [
    {
        accessorKey: "item_numero",
        header: ({ column }) => <SortableHeader column={column} title="ITEM" />,
        size: 69, minSize: 69, maxSize: 69, enablePinning: true, enableResizing: false,
        cell: info => <div className="text-zinc-400 font-mono text-sm text-center bg-white h-full flex items-center justify-center">{info.getValue() as string}</div>
    },
    {
        accessorKey: "recep_numero",
        header: ({ column }) => <SortableHeader column={column} title="RECEP" />,
        size: 78, minSize: 78, maxSize: 78, enablePinning: true, enableResizing: false,
        cell: ({ getValue }) => <div className="text-zinc-900 font-medium px-2">{getValue() as string}</div>,
    },
    {
        accessorKey: "ot",
        header: ({ column }) => <SortableHeader column={column} title="OT" />,
        size: 125, minSize: 125, maxSize: 125, enablePinning: true, enableResizing: false,
        cell: OTCell,
    },
    {
        accessorKey: "cliente_nombre",
        header: ({ column }) => <SortableHeader column={column} title="CLIENTE" />,
        size: 200, minSize: 150, maxSize: 400, enableResizing: true,
        cell: ({ getValue, row, column, table }) => (
            <div className="line-clamp-2 whitespace-normal leading-tight text-[12.5px]" title={getValue() as string}>
                <EditableCell getValue={getValue} row={row} column={column} table={table} className="text-[12.5px] leading-3" />
            </div>
        )
    },
    {
        accessorKey: "proyecto",
        header: ({ column }) => <SortableHeader column={column} title="PROYECTO" />,
        size: 150, minSize: 100, maxSize: 400, enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-zinc-900" />,
    },
    {
        accessorKey: "descripcion_servicio",
        header: ({ column }) => <SortableHeader column={column} title="DESCRIPCION DEL SERVICIO" />,
        size: 157, minSize: 157, maxSize: 400, enableResizing: true,
        cell: (props) => <EditableCell {...props} className="text-zinc-900" />,
    },
    {
        accessorKey: "cotizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="COTIZACION" />,
        size: 160, minSize: 120, maxSize: 300, enableResizing: true,
        cell: (props: any) => {
            // Re-implementing CotizacionCell inline to avoid duplicate definitions if needed or just use current
            const value = props.getValue() as string
            const [isEditing, setIsEditing] = React.useState(false)
            const [inputValue, setInputValue] = React.useState(value || "")
            const onBlur = () => {
                setIsEditing(false)
                let finalValue = inputValue.trim()
                if (finalValue && /^\d+$/.test(finalValue)) finalValue = `COTIZ.N-${finalValue}-26`
                if (finalValue !== value) props.table.options.meta?.updateData((props.row.original as any).id, props.column.id, finalValue)
            }
            if (isEditing) return <input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={onBlur} onKeyDown={props.onKeyDown} className="w-full h-full bg-white border border-blue-300 rounded text-sm p-1 text-zinc-900 font-medium" />
            return <div onClick={() => { setInputValue(value || ""); setIsEditing(true); }} className="w-full h-full cursor-pointer hover:bg-slate-50 flex items-center px-1 text-sm text-zinc-900 font-medium truncate">{value || <span className="text-zinc-300 italic">...</span>}</div>
        },
    },
    {
        accessorKey: "numero_factura",
        header: ({ column }) => <SortableHeader column={column} title="FACTURACION" className="text-blue-700" />,
        size: 160, minSize: 120, maxSize: 250, enableResizing: true,
        cell: FacturacionCell,
    },
    {
        accessorKey: "estado_pago",
        header: ({ column }) => <SortableHeader column={column} title="ESTADO PAGO" className="text-emerald-700" />,
        size: 130, minSize: 100, maxSize: 200, enableResizing: true,
        cell: PaymentStatusCell,
    },
    {
        accessorKey: "autorizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="AUTORIZADO" className="bg-indigo-50/50 text-indigo-900" />,
        size: 180, minSize: 120, maxSize: 300, enableResizing: true,
        cell: AutorizacionCell,
    },
    {
        accessorKey: "dias_atraso_lab",
        header: ({ column }) => <SortableHeader column={column} title={`DIAS ATRASO\nENVIO COTIZ`} />,
        size: 110, minSize: 90, maxSize: 150, enableResizing: true,
        cell: ({ row }) => {
            const estimatedDateStr = row.original.fecha_entrega_estimada
            const realDateStr = row.original.entrega_real

            if (!estimatedDateStr) return <div className="text-zinc-300 text-center">-</div>
            const estimated = new Date(estimatedDateStr)
            const real = realDateStr ? new Date(realDateStr) : new Date()
            estimated.setHours(0, 0, 0, 0); real.setHours(0, 0, 0, 0)

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
        accessorKey: "nota_lab",
        header: ({ column }) => <SortableHeader column={column} title="NOTA" />,
        size: 250, minSize: 150, maxSize: 600, enableResizing: true,
        cell: EditableCell,
    }
]
