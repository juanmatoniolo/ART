"use client";
export default function OncoplanBadge({ small }) {
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
            verticalAlign: "middle",
        }}>
            ONCOPLAN
        </span>
    );
}