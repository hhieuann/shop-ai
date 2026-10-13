import { Outlet, useMatches } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import styles from './RootLayout.module.css';

/** Thông tin route khai báo trong router.tsx (`handle`) để đổi khung chung của trang */
export interface RouteHandle {
  /**
   * 'plain': vùng giữa header và footer nền trắng cả bề ngang, nội dung sát header và footer
   * (trang danh sách, design-system §1). Mặc định: nền xám, cách footer 32px.
   */
  surface?: 'plain';
}

export function RootLayout() {
  const plain = useMatches().some(
    (m) => (m.handle as RouteHandle | undefined)?.surface === 'plain',
  );
  return (
    <div className={`${styles.shell} ${plain ? styles.plain : ''}`}>
      <Header />
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <Footer flush={plain} />
    </div>
  );
}
