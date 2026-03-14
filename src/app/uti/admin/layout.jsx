import styles from './page.module.css';

export const metadata = {
    title: 'Dashboard UTI',
    description: 'Administración y seguimiento de pacientes UTI',
};

export default function AdminUtiLayout({ children }) {
    return (
        <div className={styles.layoutShell}>
            <div className={styles.layoutContainer}>
                {children}
            </div>
        </div>
    );
}