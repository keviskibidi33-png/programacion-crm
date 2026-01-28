import { Suspense } from "react";
import { DatagridEditor } from "@/components/DatagridEditor";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Suspense fallback={<div className="p-4">Cargando...</div>}>
        <DatagridEditor />
      </Suspense>
    </main>
  );
}
