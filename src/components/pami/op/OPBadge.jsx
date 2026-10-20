"use client";
import { ESTADOS_OP } from "@/lib/pami/op";

export function OncoplanBadge({ small }) {
    return (
        <span style={{
            display: "inline-block",
            padding: small ? "1px 6px" : "3px 8px",
            borderRadius: 4,
            background: "#e11d48",
            color: "#fff",
            fontWeight: 700,
            fontSize: small ? 10 : 11,
            letterSpacing: 0.6,
            lineHeight: 1.2,
        }}>
            ONCOPLAN
        </span>
    );
}

export default function OPBadge({ estado, oncoplan, small }) {
    const def = ESTADOS_OP.find((e) => e.id === estado) || ESTADOS_OP[0];
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: small ? "1px 6px" : "3px 8px",
            borderRadius: 999,
            border: `1px solid ${def.color}`,
            color: def.color,
            fontWeight: 700,
            fontSize: small ? 10 : 11,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: def.color }} />
            {def.label}
            {oncoplan && <OncoplanBadge small={small} />}
        </span>
    );
}