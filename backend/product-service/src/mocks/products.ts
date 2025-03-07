export interface Product {
  description: string;
  id: string;
  price: number;
  title: string;
  count: number;
}

export const mockProducts: Product[] = [
  {
    description: 'Short Product Description 1',
    id: '7567ec4b-b10c-48c5-9345-fc73c48a80aa',
    price: 24,
    title: 'Product One',
    count: 1,
  },
  {
    description: 'Short Product Description 2',
    id: '7567ec4b-b10c-48c5-9345-fc73c48a80a1',
    price: 15,
    title: 'Product Two',
    count: 2,
  },
  {
    description: 'Short Product Description 3',
    id: '7567ec4b-b10c-48c5-9345-fc73c48a80a3',
    price: 23,
    title: 'Product Three',
    count: 3,
  },
  {
    description: 'Short Product Description 4',
    id: '7567ec4b-b10c-48c5-9345-fc73348a80a1',
    price: 15,
    title: 'Product Four',
    count: 4,
  },
  {
    description: 'Short Product Description 5',
    id: '7567ec4b-b10c-48c5-9445-fc73c48a80a2',
    price: 23,
    title: 'Product Five',
    count: 5,
  },
  {
    description: 'Short Product Description 6',
    id: '7567ec4b-b10c-45c5-9345-fc73c48a80a1',
    price: 15,
    title: 'Product Six',
    count: 6,
  },
  {
    description: 'Short Product Description 7',
    id: '3d3909c0-ba48-42d4-a791-c56754386514',
    price: 24,
    title: 'Product Seven',
    count: 26,
  },
  {
    description: 'Short Product Description 8',
    id: '1b065af7-d6fb-44e5-9231-fcf5ec2b2bb6',
    price: 36,
    title: 'Product Eight',
    count: 12,
  },
];