"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WizardShell from "@/components/pami/wizard/WizardShell";
import Paso1Paciente from "@/components/pami/wizard/Paso1Paciente";
import Paso2Oncoplan from "@/components/pami/wizard/Paso2Oncoplan";
import Paso3TipoEvento from "@/components/pami/wizard/Paso3TipoEvento";
import Paso4OP from "@/components/pami/wizard/Paso4OP";
import PasoInternacion from "@/components/pami/wizard/PasoInternacion";
import PasoCirugia from "@/components/pami/wizard/PasoCirugia";
import Paso6Confirmar from "@/components/pami/wizard/Paso6Confirmar";

// Helper para saltear el paso de evento si es solo OP
function AutoSkipPaso({ avanzar }) {
    useEffect(() => {
        avanzar();
    }, [avanzar]);
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Cargando...</div>;
}

function NuevoPamiInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const preDni = searchParams.get("pacienteKey");
    const preOpId = searchParams.get("opId");
    const preTipo = searchParams.get("tipo");

    const [estadoInicial, setEstadoInicial] = useState({});
    const [prefillListo, setPrefillListo] = useState(!preDni);

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
                    nombreCompleto: [datos.apellido, datos.nombre]
                        .filter(Boolean)
                        .join(" "),
                    oncoplan: !!datos.oncoplan,
                };

                let op = null;
                if (preOpId && ops?.[preOpId]) {
                    op = { id: preOpId, ...ops[preOpId] };
                }

                const internacionesList = Object.entries(internaciones || {}).map(
                    ([id, v]) => ({ id, ...v })
                );

                setEstadoInicial({
                    paciente,
                    op: op || undefined,
                    tipoEvento: preTipo || undefined,
                    internaciones: internacionesList,
                });
            } catch (e) {
                console.warn("Prefill falló:", e);
            } finally {
                if (!cancel) setPrefillListo(true);
            }
        })();
        return () => {
            cancel = true;
        };
    }, [preDni, preOpId, preTipo]);

    const pasos = [
        {
            id: "paciente",
            label: "Paciente",
            icon: "👤",
            render: (props) => <Paso1Paciente {...props} />,
            onNext: (estado) => {
                if (!estado.paciente) {
                    alert("Elegí un paciente antes de continuar.");
                    return false;
                }
                if (estado.paciente.estado === "fallecido") {
                    alert("Este paciente está marcado como fallecido. No se pueden generar nuevas OP.");
                    return false;
                }
            },
        },
        {
            id: "oncoplan",
            label: "Oncoplan",
            icon: "🏥",
            render: (props) => <Paso2Oncoplan {...props} />,
            onNext: () => {
                // Ya no bloquea si no está confirmado por PAMI
                return true;
            },
        },
        {
            id: "tipo",
            label: "Tipo de registro",
            icon: "📋",
            render: (props) => <Paso3TipoEvento {...props} />,
            onNext: (estado) => {
                if (!estado.tipoEvento) {
                    alert("Elegí qué tipo de registro querés hacer.");
                    return false;
                }
            },
        },
        {
            id: "op",
            label: "Orden de prestación",
            icon: "📄",
            render: (props) => <Paso4OP {...props} />,
            hideShellNav: true,
        },
        {
            id: "evento",
            label: "Detalle",
            icon: "🏨",
            render: ({ estado, actualizar, avanzar, volver }) => {
                // Si es solo solicitud de OP, salta este paso automáticamente
                if (estado.tipoEvento === "op") {
                    return <AutoSkipPaso avanzar={avanzar} />;
                }

                if (estado.tipoEvento === "cirugia") {
                    return <PasoCirugia estado={estado} actualizar={actualizar} avanzar={avanzar} volver={volver} />;
                }

                if (estado.tipoEvento === "internacion") {
                    return <PasoInternacion estado={estado} actualizar={actualizar} avanzar={avanzar} volver={volver} />;
                }

                // Fallback por si elige estudio (que aún no está implementado)
                return (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                        <h2 className="text-xl font-bold mb-2">Estudios / Prácticas</h2>
                        <p>Este formulario estará disponible próximamente.</p>
                        <button type="button" onClick={avanzar} className="mt-4 px-4 py-2 bg-[#4f9e74] text-white rounded">
                            Continuar al resumen →
                        </button>
                    </div>
                );
            },
            hideShellNav: true,
        },
        {
            id: "confirmar",
            label: "Confirmar",
            icon: "✓",
            render: ({ estado }) => (
                <Paso6Confirmar
                    estado={estado}
                    onFinish={() => router.push(`/administrador/pami/pacientes/${estado.paciente?.dni || ""}`)}
                />
            ),
            hideShellNav: true,
        },
    ];

    if (!prefillListo) {
        return (
            <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#9aa4b2", background: "#0d1117" }}>
                Cargando datos del paciente…
            </div>
        );
    }

    return <WizardShell pasos={pasos} estadoInicial={estadoInicial} />;
}

export default function NuevoPamiPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#9aa4b2", background: "#0d1117" }}>Cargando…</div>}>
            <NuevoPamiInner />
        </Suspense>
    );
}