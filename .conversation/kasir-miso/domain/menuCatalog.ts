import type { ConsignmentItem, MenuItem, MenuVariant } from '@/context/WarungContext';

export type CatalogItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUri?: string;
  isConsignment?: boolean;
  variants?: MenuVariant[];
};

const consignmentKey = (id: string) => `consignment:${id}`;

export function buildCatalogItems(menus: MenuItem[], consignments: ConsignmentItem[]): CatalogItem[] {
  return [
    ...menus.map((menu) => ({ ...menu, category: menu.category || 'Lainnya' })),
    ...consignments.map((item) => ({
      id: consignmentKey(item.id),
      name: item.name,
      price: item.sellPrice,
      category: 'Titipan',
      imageUri: item.imageUri,
      isConsignment: true,
    })),
  ];
}