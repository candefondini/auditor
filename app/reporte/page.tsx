import { Suspense } from "react";
import ClientPage from "./ClientPage";

export default function ReportePage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: "#9fb0d1" }}>Cargando reporte…</div>}>
      <ClientPage />
    </Suspense>
  );
}
