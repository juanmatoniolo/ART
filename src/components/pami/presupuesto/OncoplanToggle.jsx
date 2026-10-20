"use client";
export default function OncoplanToggle({ checked, onChange, disabled = false }) {
    return (
        <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: 10,
            border: checked ? "2px solid #e11d48" : "1px solid #334155",
            background: checked ? "rgba(225, 29, 72, 0.12)" : "rgba(255,255,255,0.02)",
            display: "flex", alignItems: "center", gap: 12,
            transition: "all 0.2s ease",
        }}>
            <input
                id="oncoplan-toggle"
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                style={{ width: 20, height: 20, cursor: disabled ? "not-allowed" : "pointer", accentColor: "#e11d48" }}
            />
            <label
                htmlFor="oncoplan-toggle"
                style={{ cursor: disabled ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", gap: 2 }}
            >
                <strong style={{ fontSize: 14 }}>Oncoplan · PAMI oncológico</strong>
                <small style={{ opacity: 0.75, fontWeight: 400 }}>
                    Marcá si corresponde a PAMI cáncer. Sin marcar, se considera PAMI normal.
                </small>
            </label>
        </div>
    );
}