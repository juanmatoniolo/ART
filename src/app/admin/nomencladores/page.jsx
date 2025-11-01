"use client";
import { useState } from "react";
import NomencladorNacional from "../../../components/nacional/page";
import ConveniosArt from "../../../components/convenios/page";
import NomencladorBioq from "../../../components/bioquimica/page";
import NomencladorAoter from "../../../components/aoter/page";
import styles from "./page.module.css"; // 👈 nuevo archivo de estilos

export default function NomencladorGlobal() {
  const [activeTab, setActiveTab] = useState("nacional");

  const tabs = [
    { key: "nacional", label: "Nomenclador Nacional" },
    { key: "convenios", label: "Convenios ART" },
    { key: "bioq", label: "Bioquímica" },
    { key: "aoter", label: "AOTER" },
  ];

  return (
    <div className={`${styles.wrapper} container-fluid py-4`}>
      <div className={`${styles.card} shadow-lg`}>
        <ul className={`nav nav-tabs ${styles.navTabs}`}>
          {tabs.map((tab) => (
            <li className="nav-item" key={tab.key}>
              <button
                className={`nav-link ${activeTab === tab.key ? styles.activeTab : styles.tab}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>

        <div className={`${styles.tabContent} border p-4 rounded-bottom`}>
          {activeTab === "nacional" && <NomencladorNacional />}
          {activeTab === "convenios" && <ConveniosArt />}
          {activeTab === "bioq" && <NomencladorBioq />}
          {activeTab === "aoter" && <NomencladorAoter />}
        </div>
      </div>
    </div>
  );
}
