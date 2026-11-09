import { formatDateTime } from '../../../shared/lib/format';
import { STATUS_LABEL, type OrderStatus } from '../types';
import styles from './OrderStatusSteps.module.css';

/** Trạng thái vẽ được trên thanh: đơn huỷ không biết bị huỷ ở bước nào nên không dùng thanh này */
export type StepStatus = Exclude<OrderStatus, 'CANCELLED'>;

const STEPS: readonly StepStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

interface OrderStatusStepsProps {
  status: StepStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Thanh 4 bước trạng thái đơn (design-system §9.26). API không lưu giờ từng bước, nên chỉ bước đầu
 * (createdAt) và bước hiện tại (updatedAt) có giờ; giờ bước hiện tại trùng phút với bước đầu thì bỏ.
 */
export function OrderStatusSteps({ status, createdAt, updatedAt }: OrderStatusStepsProps) {
  const current = STEPS.indexOf(status);
  const created = formatDateTime(createdAt);
  const updated = formatDateTime(updatedAt);

  return (
    <ol className={styles.steps}>
      {STEPS.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        let time: string | undefined;
        if (index === 0) time = created;
        else if (index === current && updated !== created) time = updated;
        return (
          <li
            key={step}
            className={`${styles.step} ${styles[state]}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.text}>
              <span className={styles.label}>{STATUS_LABEL[step]}</span>{' '}
              {/* Ô giờ luôn có để các nhãn thẳng hàng (máy tính giữ chỗ 18px) */}
              <span className={styles.time}>
                {time && <time dateTime={index === 0 ? createdAt : updatedAt}>{time}</time>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
