"use client"

import React, { useState, useEffect, useRef } from "react"
import { ShieldAlert, AlertTriangle, CheckCircle2, X } from "lucide-react"
import { createPortal } from "react-dom"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

interface RecepNumeroModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (newCode: string) => Promise<void> | void
    currentValue: string
    itemNumero: number | string | null
    rowId: string
    userEmail?: string
    existingCodes: string[]
}

export function RecepNumeroModal({
    isOpen,
    onClose,
    onConfirm,
    currentValue,
    itemNumero,
    rowId,
    userEmail,
    existingCodes,
}: RecepNumeroModalProps) {
    const [mounted, setMounted] = useState(false)
    const [newCode, setNewCode] = useState("")
    const [confirmCode, setConfirmCode] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isOpen) {
            setNewCode("")
            setConfirmCode("")
            setIsSubmitting(false)
            setTimeout(() => {
                inputRef.current?.focus()
            }, 50)
        }
    }, [isOpen])

    if (!mounted || !isOpen) return null

    const formatCode = (val: string) => {
        const trimmed = val.trim()
        if (/^\d+$/.test(trimmed)) {
            return `${trimmed}-26`
        }
        return trimmed
    }

    const formattedNewCode = formatCode(newCode)
    const formattedConfirmCode = formatCode(confirmCode)

    const isDuplicate = existingCodes.some(
        c => c.trim().toLowerCase() === formattedNewCode.toLowerCase() && c.trim().toLowerCase() !== currentValue.trim().toLowerCase()
    )

    const isSameAsCurrent = formattedNewCode.toLowerCase() === currentValue.trim().toLowerCase()
    const codesMatch = formattedNewCode !== "" && formattedNewCode === formattedConfirmCode
    const isValid = formattedNewCode !== "" && codesMatch && !isDuplicate && !isSameAsCurrent

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isValid || isSubmitting) return

        setIsSubmitting(true)
        try {
            const supabase = createClient()
            
            // 1. Log to auditoria table
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("auditoria") as any).insert({
                    user_id: userEmail || "usuario_laboratorio",
                    user_name: userEmail || "Laboratorio",
                    action: "MODIFICACION_RECEP_NUMERO",
                    module: "PROGRAMACION_LAB",
                    details: {
                        row_id: rowId,
                        item_numero: itemNumero,
                        valor_anterior: currentValue,
                        valor_nuevo: formattedNewCode,
                        mensaje: "Modificación de N° de Recepción confirmada mediante doble verificación",
                        fecha_registro: new Date().toISOString(),
                    },
                    severity: "warning",
                })
            } catch (auditErr) {
                console.warn("No se pudo registrar log en auditoria (continuando con actualización):", auditErr)
            }

            // 2. Perform the update
            await onConfirm(formattedNewCode)
            toast.success("N° de Recepción actualizado y auditado con éxito", {
                description: `Item #${itemNumero}: de "${currentValue}" a "${formattedNewCode}"`,
            })
            onClose()
        } catch (err) {
            console.error("Error al actualizar recep_numero:", err)
            toast.error("Error al actualizar el N° de Recepción")
        } finally {
            setIsSubmitting(false)
        }
    }

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div
                className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-lg w-full overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-amber-500/10 border-b border-amber-200/60 px-5 py-4 flex items-start gap-3">
                    <div className="p-2 bg-amber-500 text-white rounded-lg shrink-0 shadow-xs">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-zinc-900 leading-tight">
                            Modificar N° de Recepción (ITEM #{itemNumero ?? "-"})
                        </h3>
                        <p className="text-xs text-zinc-600 mt-0.5">
                            Valor actual registrado: <span className="font-mono font-bold text-zinc-800 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">{currentValue || "SIN ASIGNAR"}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Audit Warning Box */}
                <div className="p-5 space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex gap-3 text-red-900 text-xs leading-relaxed">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                        <div>
                            <span className="font-bold block uppercase tracking-wide text-[11px] text-red-700">
                                Advertencia de Seguridad y Auditoría
                            </span>
                            Modificar el N° de Recepción altera la trazabilidad histórica de los ensayos y controles en Laboratorio, Comercial y Administración.
                            <strong className="block mt-1 font-semibold text-red-800">
                                Todo cambio queda auditado en el sistema con su usuario, fecha y hora.
                            </strong>
                        </div>
                    </div>

                    <form onSubmit={handleConfirm} className="space-y-4">
                        {/* Input 1 */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 mb-1">
                                1. Ingrese el nuevo N° de Recepción:
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={newCode}
                                onChange={e => setNewCode(e.target.value)}
                                onBlur={() => setNewCode(formattedNewCode)}
                                placeholder="Ej: 2454-26"
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all font-mono"
                                required
                            />
                        </div>

                        {/* Input 2: Confirmation Repeat */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 mb-1">
                                2. Repita el nuevo código una vez más para confirmar:
                            </label>
                            <input
                                type="text"
                                value={confirmCode}
                                onChange={e => setConfirmCode(e.target.value)}
                                onBlur={() => setConfirmCode(formattedConfirmCode)}
                                placeholder="Repita el código exacto"
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all font-mono"
                                required
                            />
                        </div>

                        {/* Status Messages */}
                        {confirmCode && (
                            <div className="text-xs">
                                {!codesMatch ? (
                                    <span className="text-red-600 flex items-center gap-1.5 font-medium">
                                        <X className="w-3.5 h-3.5" /> Los códigos no coinciden. Verifique antes de continuar.
                                    </span>
                                ) : isDuplicate ? (
                                    <span className="text-red-600 flex items-center gap-1.5 font-medium">
                                        <AlertTriangle className="w-3.5 h-3.5" /> El código &quot;{formattedNewCode}&quot; ya existe en otra fila. No se permiten recepciones duplicadas.
                                    </span>
                                ) : isSameAsCurrent ? (
                                    <span className="text-amber-600 flex items-center gap-1.5 font-medium">
                                        <AlertTriangle className="w-3.5 h-3.5" /> El código ingresado es igual al valor actual.
                                    </span>
                                ) : (
                                    <span className="text-emerald-700 flex items-center gap-1.5 font-medium">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Códigos coinciden y están disponibles.
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={!isValid || isSubmitting}
                                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                            >
                                {isSubmitting ? "Guardando..." : "Confirmar Modificación Auditada"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}
