"use client"

import React, { useRef } from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
// import { Button } from "@/components/ui/button" 
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Loader2
} from "lucide-react"
import { GhostRow } from "./ghost-row"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    loading?: boolean
    onUpdate?: (rowId: string, field: string, value: unknown) => void
    onInsert?: (data: Partial<TData>) => Promise<void>
}

export function DataTable<TData, TValue>({
    columns,
    data,
    loading,
    onUpdate,
    onInsert
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [globalFilter, setGlobalFilter] = React.useState("")

    // Pagination for High Volume: Default 500
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: 500,
    })

    const table = useReactTable({
        data,
        columns,
        columnResizeMode: "onChange",
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
            pagination,
        },
        initialState: {
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
                ]
            }
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        meta: {
            updateData: (rowIndex: number, columnId: string, value: unknown) => {
                // Call Hybrid Hook via prop
                const row = data[rowIndex] as { id: string }
                if (row?.id && onUpdate) {
                    onUpdate(row.id, columnId, value)
                }
            },
        },
    })

    // --- Virtualization ---
    const tableContainerRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 40, // Base row height
        overscan: 20, // Buffer rows
    })

    return (
        <div className="flex flex-col h-full bg-white font-sans text-sm">
            {/* Toolbar Area */}
            <div className="flex items-center justify-between p-2 border-b border-zinc-200 bg-white gap-2">
                <div className="flex items-center gap-2 flex-1">
                    <input
                        placeholder="Buscar en todo..."
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="h-8 w-[200px] lg:w-[300px] border border-zinc-200 rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400"
                    />

                    {/* Status Filter */}
                    {table.getAllColumns().find(c => c.id === "estado_trabajo") && (
                        <select
                            className="h-8 border border-zinc-200 rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-zinc-900"
                            onChange={e => table.getColumn("estado_trabajo")?.setFilterValue(e.target.value === "TODOS" ? "" : e.target.value)}
                        >
                            <option value="TODOS">Estado: Todos</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="PROCESO">En Proceso</option>
                            <option value="COMPLETADO">Completado</option>
                        </select>
                    )}

                    {/* Delay Filter - More robust check */}
                    {table.getAllColumns().find(c => c.id === "dias_atraso_lab") && (
                        <div className="flex items-center gap-1.5 px-2 bg-red-50/50 border border-red-100 rounded-md h-8 cursor-pointer hover:bg-red-50"
                            onClick={() => {
                                const col = table.getColumn("dias_atraso_lab")
                                const current = col?.getFilterValue() as boolean
                                col?.setFilterValue(current ? undefined : true) // Toggle
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={!!table.getColumn("dias_atraso_lab")?.getFilterValue()}
                                readOnly
                                className="accent-red-500 w-3.5 h-3.5"
                            />
                            <span className="text-xs font-medium text-red-700 select-none">Con Atraso</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Table Area with Virtualization */}
            {/* Height must be fixed for virtualization. h-full takes parent's flex-1 height */}
            <div
                ref={tableContainerRef}
                className="flex-1 overflow-auto relative bg-zinc-50 border-b border-zinc-200 scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent"
                style={{ height: '100%', contain: 'strict', zoom: '85%' }}
            >
                <table
                    className="border-separate border-spacing-0"
                    style={{ width: table.getTotalSize() }}
                >
                    <thead className="sticky top-0 z-40 bg-white shadow-sm h-10 text-sm">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="border-b border-zinc-200">
                                {headerGroup.headers.map((header) => {
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
                                                "px-2 py-2 text-left bg-[#f4f4f5] select-none relative group", // Explicit bg-zinc-100 hex
                                                isPinned
                                                    ? "shadow-[inset_-1px_0_0_0_#e4e4e7]"
                                                    : "border-r border-zinc-200",
                                                isLastPinned && "shadow-[inset_-1px_0_0_0_#d4d4d8,4px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                            )}
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    )
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="bg-white">
                        {/* Ghost Row - Always at top of body */}
                        {onInsert && <GhostRow table={table} onInsert={onInsert} />}

                        {/* Virtual Items */}
                        {rowVirtualizer.getVirtualItems().length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {/* Top Spacer */}
                                {rowVirtualizer.getVirtualItems()[0].index > 0 && (
                                    <tr>
                                        <td style={{ height: `${rowVirtualizer.getVirtualItems()[0].start - 0}px` }} />
                                    </tr>
                                )}

                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const row = rows[virtualRow.index]
                                    return (

                                        <tr
                                            key={row.id}
                                            data-index={virtualRow.index}
                                            ref={rowVirtualizer.measureElement} // Enable dynamic measurement
                                            className="hover:bg-blue-100/50 transition-colors group" // Removed row striping, kept hover
                                            style={{
                                                // Removed fixed height logic, let content drive height
                                            }}
                                        >
                                            {row.getVisibleCells().map((cell, cellIndex) => { // Added cellIndex
                                                const isPinned = cell.column.getIsPinned()
                                                const isLastPinned = isPinned === "left" && cell.column.id === "descripcion_servicio"
                                                const isEvenCol = cellIndex % 2 === 0

                                                return (
                                                    <td
                                                        key={cell.id}
                                                        style={{
                                                            width: cell.column.getSize(),
                                                            left: isPinned ? cell.column.getStart("left") : undefined, // Must match header
                                                            position: isPinned ? "sticky" : "relative",
                                                            zIndex: isPinned ? 10 : 0,
                                                        }}
                                                        className={cn(
                                                            "px-2 py-1.5 align-middle border-b border-zinc-100", // Centered content + row border
                                                            // Column Striping Logic
                                                            isPinned
                                                                ? (isEvenCol ? "bg-blue-50 hover:!bg-blue-200" : "bg-white hover:!bg-blue-200") // Solid for pinned + Cell Hover
                                                                : (isEvenCol ? "bg-blue-50/80 hover:!bg-blue-200" : "bg-white hover:!bg-blue-200"), // Slightly translucent + Cell Hover
                                                            "border-r border-zinc-100",
                                                            isLastPinned && "shadow-[inset_-1px_0_0_0_#e4e4e7,4px_0_5px_-2px_rgba(0,0,0,0.05)]"
                                                        )}
                                                    >
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })}

                                {/* Bottom Spacer */}
                                {rowVirtualizer.getVirtualItems().length > 0 && (
                                    <tr>
                                        <td style={{
                                            height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px`
                                        }} />
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2 py-2 border-t border-zinc-200 bg-white">
                <div className="text-xs text-zinc-500">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                        className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-zinc-600">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()}
                    </span>
                    <button
                        className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                        className="p-1 rounded hover:bg-zinc-100 disabled:opacity-50"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </button>
                    <select
                        value={table.getState().pagination.pageSize}
                        onChange={e => {
                            table.setPageSize(Number(e.target.value))
                        }}
                        className="h-6 w-16 text-xs border border-zinc-200 rounded"
                    >
                        {[100, 500, 1000, 2000, 5000, 8000].map(pageSize => (
                            <option key={pageSize} value={pageSize}>
                                {pageSize}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
            )}
        </div>
    )
}
