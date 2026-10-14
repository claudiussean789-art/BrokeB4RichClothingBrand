export interface WholesaleProduct {
	id: string;
	name: string;
	description: string;
	category: 'Tees' | 'Hoodies' | 'Female Wears' | 'Rich Off Effort Cotton Shorts' | 'Crewneck Sweater';
	priceUSD: number;
	priceJMD: number;
	sizes: string[];
	madeToOrderSizes?: string[];
	colors?: { name: string; image: string }[];
	image: string;
	inStock: boolean;
	featured?: boolean;
}

export const wholesaleServices: WholesaleProduct[] = [
	{
		id: 'b4r-tee-01',
		name: 'BrokeB4Rich Heavyweight Graphic Tee',
		description: '100% premium ring-spun cotton heavyweight streetwear tee with custom front and back puff print branding.',
		category: 'Tees',
		priceUSD: 35,
		priceJMD: 5550,
		sizes: ['S', 'M', 'L', 'XL', 'XXL'],
		image: '/images/brokeb4rich-tee-design.jpg',
		inStock: true,
		featured: true,
	},
	{
		id: 'b4r-hoodie-01',
		name: 'B4R Signature Oversized Hoodie',
		description: 'Ultra-plush fleece lined oversized hoodie designed for maximum comfort and signature aesthetic drip.',
		category: 'Hoodies',
		priceUSD: 75,
		priceJMD: 11900,
		sizes: ['M', 'L', 'XL', 'XXL'],
		colors: [
			{ name: 'Blue', image: '/images/brokeb4rich-hoodie-blue.jpg' },
			{ name: 'Grey', image: '/images/brokeb4rich-hoodie-grey.jpg' },
			{ name: 'Black', image: '/images/brokeb4rich-hoodie-black.jpg' },
			{ name: 'Red', image: '/images/brokeb4rich-hoodie-red.jpg' },
		],
		image: '/images/brokeb4rich-hoodie-blue.jpg',
		inStock: true,
		featured: true,
	},
	{
		id: 'b4r-female-wear-01',
		name: 'BrokeB4Rich Women\'s 32 Tee and Shorts Set',
		description: 'Matching BrokeB4Rich 32 tee and shorts set, available with black or white logo print.',
		category: 'Female Wears',
		priceUSD: 65,
		priceJMD: 10335,
		sizes: ['S', 'M', 'L', 'XL'],
		colors: [
			{ name: 'Teal with Black Logo', image: '/images/brokeb4rich-female-wear-black-logo.jpg' },
			{ name: 'Teal with White Logo', image: '/images/brokeb4rich-female-wear-white-logo.jpg' },
		],
		image: '/images/brokeb4rich-female-wear-black-logo.jpg',
		inStock: true,
		featured: true,
	},
	{
		id: 'b4r-shorts-01',
		name: 'Rich Off Effort Cotton Shorts',
		description: 'BrokeB4Rich cotton shorts. XL size is made to order.',
		category: 'Rich Off Effort Cotton Shorts',
		priceUSD: 45,
		priceJMD: 7150,
		sizes: ['S', 'M', 'L', 'XL'],
		madeToOrderSizes: ['XL'],
		colors: [
			{ name: 'Orange and Royal Blue', image: '/images/rich-off-effort-orange-royal-blue.jpg' },
			{ name: 'Purple and Black', image: '/images/rich-off-effort-purple-black.jpg' },
			{ name: 'Yellow and Black', image: '/images/rich-off-effort-yellow-black.jpg' },
			{ name: 'Black', image: '/images/rich-off-effort-black.jpg' },
			{ name: 'Royal Blue and Neon Green', image: '/images/rich-off-effort-royal-blue-neon-green.jpg' },
		],
		image: '/images/brokeb4rich-logo.jpg',
		inStock: true,
		featured: true,
	},
	{
		id: 'b4r-crewneck-01',
		name: 'BrokeB4Rich Crewneck Sweater',
		description: 'BrokeB4Rich crewneck sweater with a Royal Blue body and Yellow logo.',
		category: 'Crewneck Sweater',
		priceUSD: 50,
		priceJMD: 7950,
		sizes: ['S', 'M', 'L'],
		colors: [
			{ name: 'Royal Blue with Yellow Logo', image: '/images/brokeb4rich-crewneck-reference.png' },
		],
		image: '/images/brokeb4rich-crewneck-reference.png',
		inStock: true,
		featured: true,
	},
];
