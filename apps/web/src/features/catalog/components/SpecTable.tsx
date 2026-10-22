import { specRows } from '../lib/specLabels';
import styles from './SpecTable.module.css';

/** Khối "Thông số kỹ thuật" của trang chi tiết. Không có dòng nào thì không render cả khối. */
export function SpecTable({ specs }: { specs: Readonly<Record<string, unknown>> | undefined }) {
  const rows = specRows(specs);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="specs-heading" className={styles.section}>
      <h2 id="specs-heading" className={styles.heading}>
        Thông số kỹ thuật
      </h2>
      <table className={styles.table}>
        <caption className="sr-only">Thông số kỹ thuật</caption>
        <tbody>
          {rows.map(({ label, value }) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
