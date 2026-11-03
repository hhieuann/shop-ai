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
  /**
   * 'collapse': từ 1280px hàng 2 của header thu lại khi cuộn (trang chi tiết sản phẩm,
   * design-system §9.1 "Hàng 2 thu lại khi cuộn"). Mặc định: hai hàng cùng dính.
   */
  headerNeeds?: 'collapse';
}

export function RootLayout() {
  const handles = useMatches().map((m) => m.handle as RouteHandle | undefined);
  const plain = handles.some((h) => h?.surface === 'plain');
  const collapseNeeds = handles.some((h) => h?.headerNeeds === 'collapse');
  return (
    <div className={`${styles.shell} ${plain ? styles.plain : ''}`}>
      <Header collapseNeeds={collapseNeeds} />
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <Footer flush={plain} />
    </div>
  );
}
