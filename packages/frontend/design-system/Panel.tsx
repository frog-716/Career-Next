import type { ReactNode } from 'react';
import styles from './panel.module.css';
export function Panel({children,label}:{children:ReactNode;label:string}){return <section className={styles.panel} aria-label={label}>{children}</section>;}
