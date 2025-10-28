import "./loading.css";

export default function Loading() {
    return (
        <div
            style={{
                display: "flex",
                height: "100vh",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--background)",
                flexDirection: "column",
            }}
        >
            <div className="progress">
                <div className="bar"></div>
            </div>
            <p className="mt-3 text-secondary fw-semibold">Cargando datos...</p>
        </div>
    );
}
