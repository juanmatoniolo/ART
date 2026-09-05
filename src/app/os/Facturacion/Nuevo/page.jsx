'use client';

import { ConvenioProvider } from '../components/ConvenioContext';
import FacturaContainer from '../components/FacturaContainer';
import styles from './nuevo.module.css';

export default function NuevoFacturaPage() {
    return (
        <div className={styles.container}>
            <ConvenioProvider>
                <FacturaContainer />
            </ConvenioProvider>
        </div>
    );
}
