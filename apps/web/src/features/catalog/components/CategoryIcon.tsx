import {
  Backpack,
  CircuitBoard,
  Cpu,
  Fan,
  Gpu,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  MemoryStick,
  Monitor,
  Mouse,
  PlugZap,
  type LucideIcon,
} from 'lucide-react';
import type { ProductCategory } from '../lib/productFilters';

/** Một icon cho mỗi loại hàng; Record buộc đủ 13 loại như OpenAPI */
const ICONS: Record<ProductCategory, LucideIcon> = {
  laptop: Laptop,
  cpu: Cpu,
  gpu: Gpu,
  ram: MemoryStick,
  storage: HardDrive,
  mainboard: CircuitBoard,
  psu: PlugZap,
  cooling: Fan,
  keyboard: Keyboard,
  mouse: Mouse,
  monitor: Monitor,
  headset: Headphones,
  accessory: Backpack,
};

export function CategoryIcon({
  category,
  size = 24,
}: {
  category: ProductCategory;
  size?: number;
}) {
  const Icon = ICONS[category];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
