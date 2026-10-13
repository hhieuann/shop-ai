import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AnnouncerContext, type Announcer } from '../hooks/useAnnounce';

interface Message {
  /** Tăng mỗi lần gửi: chữ được gắn vào phần tử mới nên trình đọc đọc cả khi trùng câu trước */
  id: number;
  text: string;
}

/**
 * Hai vùng thông báo ẩn cho trình đọc màn hình, đặt một lần ở cấp trang:
 * `aria-live="polite"` cho trạng thái, `role="alert"` cho lỗi. Component con gọi useAnnounce().
 */
export function LiveAnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState<Message | null>(null);
  const [alert, setAlert] = useState<Message | null>(null);
  const counter = useRef(0);

  const announcer = useMemo<Announcer>(
    () => ({
      polite: (text) => setPolite({ id: ++counter.current, text }),
      alert: (text) => setAlert({ id: ++counter.current, text }),
    }),
    [],
  );

  return (
    <AnnouncerContext.Provider value={announcer}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {polite && <span key={polite.id}>{polite.text}</span>}
      </div>
      <div className="sr-only" role="alert" aria-atomic="true">
        {alert && <span key={alert.id}>{alert.text}</span>}
      </div>
    </AnnouncerContext.Provider>
  );
}
