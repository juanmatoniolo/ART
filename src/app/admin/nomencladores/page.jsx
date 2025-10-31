// page.jsx
"use client";
import { useState } from "react";
import NomencladorNacional from "../../../components/nacional/page";
import ConveniosArt from "../../../components/convenios/page";
import NomencladorBioq from "../../../components/bioquimica/page";
import NomencladorAoter from "../../../components/aoter/page";

export default function NomencladorGlobal() {
  const [activeTab, setActiveTab] = useState("nacional");

  return (
    <div className="container mt-4">
      <ul className="nav nav-tabs">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "nacional" ? "active" : ""}`}
            onClick={() => setActiveTab("nacional")}
          >
            Nomeclador Nacional
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "convenios" ? "active" : ""}`}
            onClick={() => setActiveTab("convenios")}
          >
            Convenios ART
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "bioq" ? "active" : ""}`}
            onClick={() => setActiveTab("bioq")}
          >
            Bioquímica
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "aoter" ? "active" : ""}`}
            onClick={() => setActiveTab("aoter")}
          >
            AOTER
          </button>
        </li>
      </ul>

      <div className="tab-content border p-4 rounded-bottom bg-dark text-light">
        {activeTab === "nacional" && <NomencladorNacional />}
        {activeTab === "convenios" && <ConveniosArt />}
        {activeTab === "bioq" && <NomencladorBioq />}
        {activeTab === "aoter" && <NomencladorAoter />}
      </div>
    </div>
  );
}
