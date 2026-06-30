"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PacienteForm, { emptyFormData } from "../../_shared/PacienteForm";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

export default function EditarPacientePage() {
  const { id } = useParams();
  const router = useRouter();
  const [paciente, setPaciente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    const fetchPaciente = async () => {
      try {
        const res = await fetch(`${FIREBASE_URL}/pacientes/${id}.json`);
        if (!res.ok) throw new Error("No encontrado");
        const data = await res.json();
        if (!data) throw new Error("Paciente no existe");
        setPaciente({ id, ...data });
      } catch (err) {
        setError("No se pudo cargar el paciente.");
      } finally {
        setLoading(false);
      }
    };
    fetchPaciente();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh", gap: "1rem", color: "#6b7280" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#44794d", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        Cargando paciente...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "#dc2626" }}>
        <p>{error}</p>
        <button
          onClick={() => router.push("/admin/pacientes")}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#44794d", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600 }}
        >
          Volver a pacientes
        </button>
      </div>
    );
  }

  const empty = emptyFormData();
  const initialData = {
    ...empty,
    ...paciente,
    ART: { ...empty.ART, ...(paciente.ART || {}) },
    empleador: { ...empty.empleador, ...(paciente.empleador || {}) },
    trabajador: { ...empty.trabajador, ...(paciente.trabajador || {}) },
    consulta: { ...empty.consulta, ...(paciente.consulta || {}) },
    fechaIngreso: { ...empty.fechaIngreso, ...(paciente.fechaIngreso || {}) },
    fechaDenuncia: { ...empty.fechaDenuncia, ...(paciente.fechaDenuncia || {}) },
    prestador: paciente.prestador || {},
    estado: paciente.estado || "activo",
    createdAt: paciente.createdAt,
  };

  return (
    <PacienteForm
      mode="editar"
      initialData={initialData}
      pacienteId={id}
    />
  );
}