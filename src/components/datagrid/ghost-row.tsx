import React from "react"
import { Table as TanStackTable } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { ProgramacionServicio } from "@/types/programacion"
import { z } from "zod"
import { StatusSelect } from "./status-select"

// Zod Schema for validation
const insertSchema = z.object({
    recep_numero: z.string().min(1, "Requerido"),
    ot: z.string().min(1, "Requerido"),
    // Add other validations as needed
})

interface GhostRowProps<TData> {
    table: TanStackTable<TData>
    onInsert: (data: Partial<TData>) => Promise<void>
}

export function GhostRow<TData>({ table, onInsert }: GhostRowProps<TData>) {
    const [newData, setNewData] = React.useState<Partial<TData>>({})
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const handleChange = (columnId: string, value: string) => {
        setNewData(prev => ({ ...prev, [columnId]: value }))
        // Clear error on change
        if (errors[columnId]) {
            setErrors(prev => {
                const newErrors = { ...prev }
                delete newErrors[columnId]
                return newErrors
            })
        }
    }

    const handleBlur = (columnId: string, value: string) => {
        // Auto-format logic
        if (!value) return

        let formatted = value.trim()

        if (columnId === 'recep_numero') {
            // Append -26 if only digits are entered
            if (/^\d+$/.test(formatted)) {
                formatted = `${formatted}-26`
            }
        }

        if (columnId === 'ot') {
            // Append -26 LEM if only digits are entered
            if (/^\d+$/.test(formatted)) {
                formatted = `${formatted}-26 LEM`
            }
        }

        if (columnId === 'cotizacion_lab') {
            // Append COTIZACION-XXX-26 if only digits are entered
            if (/^\d+$/.test(formatted)) {
                formatted = `COTIZACION-${formatted}-26`
            }
        }

        if (formatted !== value) {
            handleChange(columnId, formatted)
        }
    }

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()

            // Validation
            const validationPayload = {
                recep_numero: newData['recep_numero' as keyof TData],
                ot: newData['ot' as keyof TData]
            }

            // Only validate strict fields if they are entered (or make them required?)
            // Assuming required for Insert based on user plan
            // We can validate partial schema match
            try {
                // Manually checking specific fields for this specific row type
                // In a generic component we'd need column-specific validation rules passed in
                // For now, hardcoding as per "Specialized Ghost Row" plan
                const result = insertSchema.safeParse(validationPayload)

                if (!result.success) {
                    const formattedErrors: Record<string, string> = {}
                    result.error.issues.forEach(issue => {
                        formattedErrors[issue.path[0] as string] = issue.message
                    })
                    setErrors(formattedErrors)
                    return
                }

                // Submit
                setIsSubmitting(true)
                await onInsert(newData)
                setNewData({}) // Reset
                setErrors({})
            } catch (error) {
                console.error("Insert error", error)
            } finally {
                setIsSubmitting(false)
            }
        }
    }

    return (
        <tr className="bg-blue-50 border-b-2 border-blue-100 sticky top-[40px] z-30 shadow-sm">
            {table.getAllLeafColumns().map((column) => {
                const isPinned = column.getIsPinned()
                const isLastPinned = isPinned === "left" && column.id === "descripcion_servicio"
                const colId = column.id
                const value = (newData as Record<string, unknown>)[colId] as string || ""
                const error = errors[colId]

                // Read-only logic for IT
                const isReadOnly = colId === 'item_numero'
                const isNumeric = colId === 'dias_atraso_lab' || colId === 'dias_atraso_envio_coti'
                const isStatus = colId === 'estado_trabajo'
                const isAutorizacion = colId === 'autorizacion_lab'
                const isDate = colId.includes('fecha') || colId === 'entrega_real'

                if (isAutorizacion) {
                    // Skip rendering input for Autorizacion in Ghost Row (it's admin only later)
                    return (
                        <td
                            key={`ghost-${colId}`}
                            style={{
                                width: column.getSize(),
                                left: isPinned ? column.getStart("left") : undefined,
                                position: isPinned ? "sticky" : "relative",
                                zIndex: isPinned ? 35 : 0,
                            }}
                            className={cn(
                                "px-2 py-1.5 truncate p-0 bg-zinc-50/50 border-r border-zinc-100", // Greyed out
                            )}
                        >
                            <div className="w-full text-center text-zinc-300 text-[10px] select-none">BLOQUEADO</div>
                        </td>
                    )
                }

                return (
                    <td
                        key={`ghost-${colId}`}
                        style={{
                            width: column.getSize(),
                            left: isPinned ? column.getStart("left") : undefined,
                            position: isPinned ? "sticky" : "relative",
                            zIndex: isPinned ? 35 : 0, // Higher than rows, lower than header
                        }}
                        className={cn(
                            "px-2 py-1.5 truncate p-0",
                            isPinned
                                ? "bg-[#eff6ff] shadow-[inset_-1px_0_0_0_#93c5fd]" // explicit solid hex for blue-50
                                : "bg-[#eff6ff] border-r border-blue-100",
                            isLastPinned && "shadow-[inset_-1px_0_0_0_#93c5fd,4px_0_5px_-2px_rgba(0,0,0,0.05)]"
                        )}
                    >
                        {isReadOnly ? (
                            <div className="px-2 text-zinc-500 italic text-xs font-semibold">Auto</div>
                        ) : isStatus ? (
                            <div className="w-full h-full flex items-center justify-center p-1">
                                <StatusSelect value={value as string} onChange={(val) => handleChange(colId, val)} />
                            </div>
                        ) : (
                            <input
                                type={isNumeric ? "number" : isDate ? "date" : "text"}
                                className={cn(
                                    "w-full bg-transparent border-none focus:outline-none text-sm placeholder:text-zinc-400 h-full px-2 font-medium text-zinc-900", // Darker text, standard placeholder
                                    error && "bg-red-50 text-red-900 ring-1 ring-inset ring-red-500 placeholder:text-red-300",
                                    isSubmitting && "opacity-50 cursor-wait"
                                )}
                                placeholder={error ? error : "..."}
                                value={value}
                                onChange={(e) => handleChange(colId, e.target.value)}
                                onBlur={(e) => handleBlur(colId, e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isSubmitting}
                                title={error}
                            />
                        )}
                    </td>
                )
            })}
        </tr>
    )
}
