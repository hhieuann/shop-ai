import { Outlet, useMatches } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { MiniHeader, type MiniHeaderBack } from './MiniHeader';
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
  /**
   * true: `main` không có khoảng đệm trên, nội dung tự lo khoảng cách với header (trang chi tiết:
   * padding của Breadcrumb là toàn bộ khoảng cách, pages/chi-tiet-san-pham.md §2).
   */
  flushTop?: boolean;
  /**
   * 'focus': bố cục tập trung (design-system §9.16), vẽ `MiniHeader` thay header đầy đủ: chỉ logo
   * và một link quay lại, không ô tìm kiếm, Danh mục, hàng 2, tài khoản, giỏ (trang đặt hàng).
   * Mặc định: header đầy đủ.
   */
  chrome?: 'focus';
  /** Link quay lại bên phải `MiniHeader` khi `chrome` là 'focus', vd. về giỏ hàng */
  back?: MiniHeaderBack;
}

export function RootLayout() {
  const handles = useMatches().map((m) => m.handle as RouteHandle | undefined);
  const plain = handles.some((h) => h?.surface === 'plain');
  const collapseNeeds = handles.some((h) => h?.headerNeeds === 'collapse');
  const flushTop = handles.some((h) => h?.flushTop);
  const focus = handles.find((h) => h?.chrome === 'focus');
  return (
    <div className={`${styles.shell} ${plain ? styles.plain : ''}`}>
      {focus ? <MiniHeader back={focus.back} /> : <Header collapseNeeds={collapseNeeds} />}
      <main id="main" className={`${styles.main} ${flushTop ? styles.flushTop : ''}`}>
        <Outlet />
      </main>
      <Footer flush={plain} />
    </div>
  );
}
