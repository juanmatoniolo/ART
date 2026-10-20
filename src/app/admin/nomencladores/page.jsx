'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';

const NomencladorNacional = dynamic(
  () => import('@/components/nacional/page')
);
const ConveniosArt = dynamic(
  () => import('@/components/convenios/page')
);
const NomencladorBioq = dynamic(
  () => import('@/components/bioquimica/page')
);
const NomencladorAoter = dynamic(
  () => import('@/components/aoter/page')
);
const NomencladorPami = dynamic(
  () => import('@/components/pami/page')
);

const TABS = [
  {
    key: 'nacional',
    label: 'Nomenclador Nacional',
    Component: NomencladorNacional,
  },
  {
    key: 'convenios',
    label: 'Convenios ART',
    Component: ConveniosArt,
  },
  {
    key: 'bioq',
    label: 'Bioquímica',
    Component: NomencladorBioq,
  },
  {
    key: 'aoter',
    label: 'AOTER',
    Component: NomencladorAoter,
  },
  {
    key: 'pami',
    label: 'PAMI',
    Component: NomencladorPami,
  },
];

const variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function NomencladorGlobal() {
  const [activeTab, setActiveTab] = useState('nacional');

  const active = TABS.find((tab) => tab.key === activeTab);
  const Panel = active.Component;

  return (
    <main className={styles.wrapper}>
      <section
        className={styles.card}
        aria-label="Nomencladores"
      >
        <header className={styles.cardHeader}>
          <h1 className={styles.title}>Nomencladores</h1>

          <Link
            href="/admin/nomencladores/editar"
            className={styles.editButton}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </svg>
            <span>Editar</span>
          </Link>
        </header>

        <div className={styles.tabsWrap}>
          <ul
            className={styles.tabs}
            role="tablist"
            aria-label="Secciones de nomencladores"
          >
            {TABS.map((tab) => {
              const selected = activeTab === tab.key;

              return (
                <li key={tab.key} className={styles.tabItem}>
                  <button
                    type="button"
                    role="tab"
                    id={`tab-${tab.key}`}
                    aria-selected={selected}
                    aria-controls="panel-nomencladores"
                    tabIndex={selected ? 0 : -1}
                    className={`${styles.tabButton} ${selected ? styles.activeTab : ''
                      }`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div
          className={styles.tabContent}
          role="tabpanel"
          id="panel-nomencladores"
          aria-labelledby={`tab-${activeTab}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={variants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{
                duration: 0.22,
                ease: 'easeOut',
              }}
            >
              <Panel />
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}