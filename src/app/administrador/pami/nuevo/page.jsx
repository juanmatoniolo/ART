"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import WizardShell from "@/components/pami/wizard/WizardShell";
import Paso1Paciente from "@/components/pami/wizard/Paso1Paciente";
import Paso3TipoEvento from "@/components/pami/wizard/Paso3TipoEvento";
import PasoInternacion from "@/components/pami/wizard/PasoInternacion";
import PasoCirugia from "@/components/pami/wizard/PasoCirugia";
import Paso6Confirmar from "@/components/pami/wizard/Paso6Confirmar";

function AutoSkipPaso({ avanzar }) {
    useEffect(() => { avanzar(); }, [avanzar]);
    return <div style={{ padding: "2rem", textAlign: "center" }}>Cargando...</div>;
}

function NuevoPamiInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const preDni = searchParams.get("pacienteKey");
    const preOpId = searchParams.get("opId");
    const preTipo = searchParams.get("tipo");

    const [estadoInicial, setEstadoInicial] = useState({});
    const [prefillListo, setPrefillListo] = useState(!preDni);
    const [items, setItems] = useState([]);

    // Cargar catálogo para el borrador de medicamentos (opcional en el paso)
    useEffect(() => {
        const unsub = onValue(ref(db, "medydescartables"), (snap) => {
            if (!snap.exists()) return setItems([]);
            const data = snap.val();
            const lista = [];
            for (const categoria of ["medicamentos", "descartables"]) {
                Object.entries(data[categoria] || {}).forEach(([key, d]) => {
                    lista.push({ key, categoria, nombre: d.nombre || key.replace(/_/g, " "), precioFacturacion: d.precioFacturacion ?? 0, presentacion: d.presentacion || "unidad", tipo: categoria === "medicamentos" ? "medicamento" : "descartable", activo: d.activo !== false });
                });
            }
            setItems(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!preDni) return;
        let cancel = false;
        (async () => {
            try {
                const { obtenerPacientePami } = await import("@/lib/pami");
                const data = await obtenerPacientePami(preDni);
                if (!data || cancel) return;

                const { medicamentos, ops, internaciones, cirugias, ...datos } = data;
                const paciente = {
                    ...datos,
                    dni: preDni,
                    nombreCompleto: [datos.apellido, datos.nombre].filter(Boolean).join(" ").trim(),
                    oncoplan: !!datos.oncoplan,
                };

                let op = null;
                if (preOpId && ops?.[preOpId]) {
                    op = { id: preOpId, ...ops[preOpId] };
                }

                setEstadoInicial({
                    paciente,
                    tipoEvento: preTipo || undefined,
                    op: op || undefined,
                    opVinculada: op || undefined,
                });
            } catch (e) {
                console.warn("Prefill falló:", e);
            } finally {
                if (!cancel) setPrefillListo(true);
            }
        })();
        return () => { cancel = true; };
    }, [preDni, preTipo, preOpId]);

    const pasos = [
        {
            id: "paciente",
            label: "Paciente",
            icon: "👤",
            render: (props) => <Paso1Paciente {...props} />,
            onNext: (estado) => {
                if (!estado.paciente || !estado.paciente.dni) {
                    alert("Seleccioná o cargá un paciente antes de continuar.");
                    return false;
                }
            },
        },
        {
            id: "registro",
            label: "Registro",
            icon: "📋",
            hideShellNav: true,
            render: (props) => <Paso3TipoEvento {...props} items={items} />,
        },
        {
            id: "detalle",
            label: "Detalle",
            icon: "🏥",
            hideShellNav: true,
            render: ({ estado, actualizar, avanzar, volver }) => {
                if (estado.tipoEvento === "op" || estado.tipoEvento === "material") {
                    return <AutoSkipPaso avanzar={avanzar} />;
                }
                if (estado.tipoEvento === "internacion") {
                    return <PasoInternacion estado={estado} actualizar={actualizar} avanzar={avanzar} volver={volver} />;
                }
                if (estado.tipoEvento === "cirugia") {
                    return <PasoCirugia estado={estado} actualizar={actualizar} avanzar={avanzar} volver={volver} />;
                }
                return null;
            },
        },
        {
            id: "confirmar",
            label: "Confirmar",
            icon: "✓",
            hideShellNav: true,
            render: ({ estado }) => (
                <Paso6Confirmar
                    estado={estado}
                    onFinish={() => router.push(`/administrador/pami`)}
                />
            ),
        },
    ];

    if (!prefillListo) return <div style={{ padding: "2rem", textAlign: "center" }}>Cargando...</div>;

    return <WizardShell pasos={pasos} estadoInicial={estadoInicial} />;
}

export default function NuevoPamiPage() {
    return (
        <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Cargando…</div>}>
            <NuevoPamiInner />
        </Suspense>
    );
}