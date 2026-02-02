
"use client"

import { Column, ColumnDef } from "@tanstack/react-table"
import { ProgramacionServicio } from "@/types/programacion"
import React from "react"
import { ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Import shared smart cells from the main columns file
import {
    EditableCell,
    OTCell,
    SmartDateCell,
    CotizacionCell,
    AutorizacionCell,
    PaymentStatusCell
} from "./columns"

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

export const columnsComercial: ColumnDef<ProgramacionServicio>[] = [
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
        cell: (props: any) => <EditableCell {...props} className="text-zinc-900 font-medium" />,
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
        cell: (props: any) => <EditableCell {...props} className="text-zinc-800 text-[12px] text-center" />,
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
        cell: (props: any) => <EditableCell {...props} className="text-zinc-800 text-[12px]" />,
    },
    {
        accessorKey: "estado_pago",
        header: ({ column }) => <SortableHeader column={column} title={`ESTADO\nPAGO`} className="text-emerald-700" />,
        size: 130, minSize: 100, maxSize: 200, enableResizing: true,
        cell: PaymentStatusCell,
    },
    {
        accessorKey: "autorizacion_lab",
        header: ({ column }) => <SortableHeader column={column} title="AUTORIZADO" className="bg-indigo-50/50 text-indigo-900" />,
        size: 180, minSize: 120, maxSize: 300, enableResizing: true,
        cell: AutorizacionCell,
    },
]
