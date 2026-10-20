"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WizardShell from "@/components/pami/wizard/WizardShell";
import Paso1Paciente from "@/components/pami/wizard/Paso1Paciente";
import Paso3TipoEvento from "@/components/pami/wizard/Paso3TipoEvento";
import PasoDetalle from "@/components/pami/wizard/PasoDetalle";
import Paso6Confirmar from "@/components/pami/wizard/Paso6Confirmar";

function NuevoPamiInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preDni = searchParams.get("pacienteKey");
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
                    nombreCompleto: [datos.apellido, datos.nombre].filter(Boolean).join(" ").trim(),
                    oncoplan: !!datos.oncoplan,
                };

                setEstadoInicial({
                    paciente,
                    tipoEvento: preTipo || undefined,
                });
            } catch (e) {
                console.warn("Prefill falló:", e);
            } finally {
                if (!cancel) setPrefillListo(true);
            }
        })();
        return () => { cancel = true; };
    }, [preDni, preTipo]);

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
            id: "tipo",
            label: "Tipo de registro",
            icon: "📋",
            render: (props) => <Paso3TipoEvento {...props} />,
            onNext: (estado) => {
                if (!estado.tipoEvento) {
                    alert("Elegí qué tipo de registro querés hacer.");
                    return false;
                }
                if ((estado.tipoEvento === "internacion" || estado.tipoEvento === "cirugia") && !estado.opVinculada) {
                    alert("Para internaciones o cirugías, es obligatorio vincular una OP existente.");
                    return false;
                }
            },
        },
        {
            id: "detalle",
            label: "Detalle",
            icon: "📝",
            render: (props) => <PasoDetalle {...props} />,
            hideShellNav: true,
        },
        {
            id: "confirmar",
            label: "Confirmar",
            icon: "✓",
            render: ({ estado }) => (
                <Paso6Confirmar
                    estado={estado}
                    onFinish={() => router.push(`/administrador/pami`)}
                />
            ),
            hideShellNav: true,
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