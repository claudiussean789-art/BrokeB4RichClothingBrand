import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import AccountPanel from './components/AccountPanel';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { cryptoPayment } from './data/cryptoPayment';
import { highlightedWholesaleTags, wholesaleServices, wholesaleTags } from './data/wholesaleServices';

type OrderType = 'devices' | 'repairs' | 'wholesale';
type CartKind = OrderType | 'credits';
type PaymentMethod = 'local' | 'payoneer' | 'wipay' | 'paypal' | 'wallet' | 'crypto';
type LocalRail = 'lynk' | 'ncb' | 'scotiabank';

type Device = {
	id: string;
	name: string;
	price: number | null;
};

type DeviceBrand = {
	name: string;
	devices: Device[];
};

type RepairService = {
	id: string;
	name: string;
	category: string;
	price: number | null;
};

type CartItem = {
	id: string;
	name: string;
	kind: CartKind;
	price: number | null;
	deviceFamily?: string;
	identifier?: string;
};

type ServerCreditService = {
	id: string;
	name: string;
	logo?: string;
	selectionType: 'duration' | 'quantity' | 'request';
	requestDescription?: string;
	options?: string[];
	products?: { id: string; name: string; description: string; price: number; icon: string; image: string; deliveryTime: string; summary: string; fullDescription: string; highlighted?: boolean }[];
	targetLabel: string;
	requiresToolEmail?: boolean;
};

const serverCreditServices: ServerCreditService[] = [
	{
		id: 'eft-tool',
		name: 'EFT Tool',
		logo: '/images/tools/eft-pro.svg',
		selectionType: 'duration',
		requiresToolEmail: true,
		products: [
			{ id: 'eft-1-month', name: '1 Month Activation (30 Days)', description: 'EFT Tool Activation – Official Reseller', price: 20, icon: 'EFT', image: '/images/tools/eft-pro.svg', deliveryTime: '5–15 Minutes', summary: 'EFT Tool 1 Month / 30 Days account activation for supported GSM servicing operations. Check current device support before ordering.', fullDescription: 'Activate your EFT Tool account with the 1 Month Activation (30 Days) license for supported mobile servicing work.' },
			{ id: 'eft-3-months', name: '3 Months Activation (90 Days)', description: 'EFT Tool Activation – Official Reseller', price: 18, icon: 'EFT', image: '/images/tools/eft-pro.svg', deliveryTime: '5–15 Minutes', summary: 'EFT Tool 3 Months / 90 Days account activation for supported GSM servicing operations. Check current device support before ordering.', fullDescription: 'Activate your EFT Tool account with the 3 Months Activation (90 Days) license for supported mobile servicing work.' },
			{ id: 'eft-6-months', name: '6 Months Activation (180 Days)', description: 'EFT Tool Activation – Official Reseller', price: 27, icon: 'EFT', image: '/images/tools/eft-pro.svg', deliveryTime: '5–15 Minutes', summary: 'EFT Tool 6 Months / 180 Days account activation for supported GSM servicing operations. Check current device support before ordering.', fullDescription: 'Activate your EFT Tool account with the 6 Months Activation (180 Days) license for supported mobile servicing work.' },
			{ id: 'eft-12-months', name: '12 Months Activation (360 Days)', description: 'EFT Tool Activation – Official Reseller', price: 45, icon: 'EFT', image: '/images/tools/eft-pro.svg', deliveryTime: '5–15 Minutes', summary: 'EFT Tool 12 Months / 360 Days account activation for supported GSM servicing operations. Check current device support before ordering.', fullDescription: 'Activate your EFT Tool account with the 12 Months Activation (360 Days) license for supported mobile servicing work.', highlighted: true },
		],
		targetLabel: 'Tool account email',
	},
	{
		id: 'unlock-tool',
		name: 'Unlock Tool',
		logo: '/images/tools/unlocktool.svg',
		selectionType: 'duration',
		requiresToolEmail: true,
		products: [
			{ id: 'unlock-3-months', name: '3 Months Activation (90 Days)', description: 'UnlockTool Activation – Official Reseller', price: 18, icon: 'UT', image: '/images/tools/unlocktool.svg', deliveryTime: '5–15 Minutes', summary: 'UnlockTool 3 Months / 90 Days account activation for supported GSM servicing operations. Check current device support before ordering.', fullDescription: 'Activate your UnlockTool account with the 3 Months Activation (90 Days) license for supported mobile servicing work.' },
			{ id: 'unlock-6-months', name: '6 Months Activation (180 Days)', description: 'UnlockTool Activation – Official Reseller', price: 27, icon: 'UT', image: '/images/tools/unlocktool.svg', deliveryTime: '5–15 Minutes', summary: 'UnlockTool 6 Months / 180 Days account activation for supported GSM servicing operations. Check current device support before ordering.', fullDescription: 'Activate your UnlockTool account with the 6 Months Activation (180 Days) license for supported mobile servicing work.' },
			{ id: 'unlock-12-months', name: '12 Months Activation (360 Days)', description: 'UnlockTool Activation – Official Reseller', price: 45, icon: 'UT', image: '/images/tools/unlocktool.svg', deliveryTime: '5–15 Minutes', summary: 'UnlockTool 12 Months / 360 Days account activation for supported GSM servicing operations. Check current device support before ordering.', fullDescription: 'Activate your UnlockTool account with the 12 Months Activation (360 Days) license for supported mobile servicing work.', highlighted: true },
			{ id: 'unlock-rent-6-hours', name: 'Rent [6 Hours] – Instant Auto API', description: 'All GSM Tools Rent Service – Instant Auto API', price: 1.2, icon: 'RENT', image: '/images/tools/unlocktool.svg', deliveryTime: 'Instant', summary: 'UnlockTool 6 Hours rent service with instant auto API distribution.', fullDescription: 'Temporary six-hour access to UnlockTool for quick servicing jobs.' },
		],
		targetLabel: 'Tool account email',
	},
	{
		id: 'dft-pro',
		name: 'DFT Pro',
		logo: '/images/tools/dft-pro.svg',
		selectionType: 'request',
		requestDescription: 'Submit a DFT Pro service request. The team will confirm supported services and pricing.',
		targetLabel: 'Device model / service details',
	},
	{
		id: 'global-unlocker-pro',
		name: 'Global Unlocker Pro',
		logo: '/images/tools/global-unlocker-pro.svg',
		selectionType: 'request',
		requestDescription: 'Submit a Global Unlocker Pro service request. The team will confirm supported services and pricing.',
		targetLabel: 'Device model / service details',
	},
	{ id: 'samkey', name: 'Samkey Server Credits', selectionType: 'quantity', targetLabel: 'Device serial / username / account email' },
	{ id: 'samtmo', name: 'SamTMO', selectionType: 'quantity', targetLabel: 'Device serial / username / account email' },
	{ id: 'sammtk', name: 'SamMTK', selectionType: 'quantity', targetLabel: 'Device serial / username / account email' },
];

const deviceBrands: DeviceBrand[] = [
	{
		name: 'iPhone',
		devices: [
			{ id: 'ip-se-2', name: 'iPhone SE 2', price: 30 },
			{ id: 'ip-xs', name: 'iPhone XS', price: 35 },
			{ id: 'ip-xs-max', name: 'iPhone XS Max', price: 40 },
			{ id: 'ip-xr', name: 'iPhone XR', price: 35 },
			{ id: 'ip-11', name: 'iPhone 11', price: null },
			{ id: 'ip-11-pro', name: 'iPhone 11 Pro', price: null },
			{ id: 'ip-11-pro-max', name: 'iPhone 11 Pro Max', price: null },
			{ id: 'ip-12', name: 'iPhone 12', price: null },
			{ id: 'ip-12-mini', name: 'iPhone 12 mini', price: null },
			{ id: 'ip-12-pro', name: 'iPhone 12 Pro', price: null },
			{ id: 'ip-12-pro-max', name: 'iPhone 12 Pro Max', price: null },
			{ id: 'ip-13', name: 'iPhone 13 - Grade A', price: 480 },
			{ id: 'ip-13-mini', name: 'iPhone 13 mini', price: null },
			{ id: 'ip-13-pro', name: 'iPhone 13 Pro', price: null },
			{ id: 'ip-13-pro-max', name: 'iPhone 13 Pro Max', price: null },
			{ id: 'ip-14', name: 'iPhone 14', price: null },
			{ id: 'ip-14-plus', name: 'iPhone 14 Plus', price: null },
			{ id: 'ip-14-pro', name: 'iPhone 14 Pro', price: 650 },
			{ id: 'ip-14-pro-max', name: 'iPhone 14 Pro Max', price: null },
			{ id: 'ip-15', name: 'iPhone 15', price: null },
			{ id: 'ip-15-plus', name: 'iPhone 15 Plus', price: null },
			{ id: 'ip-15-pro', name: 'iPhone 15 Pro', price: null },
			{ id: 'ip-15-pro-max', name: 'iPhone 15 Pro Max', price: null },
			{ id: 'ip-16e', name: 'iPhone 16e', price: null },
			{ id: 'ip-16', name: 'iPhone 16', price: null },
			{ id: 'ip-16-plus', name: 'iPhone 16 Plus', price: null },
			{ id: 'ip-16-pro', name: 'iPhone 16 Pro', price: null },
			{ id: 'ip-16-pro-max', name: 'iPhone 16 Pro Max', price: null },
			{ id: 'ip-17', name: 'iPhone 17', price: null },
			{ id: 'ip-17-pro', name: 'iPhone 17 Pro', price: null },
			{ id: 'ip-17-pro-max', name: 'iPhone 17 Pro Max', price: null },
			{ id: 'ip-17-air', name: 'iPhone Air', price: null },
		],
	},
	{
		name: 'iPad',
		devices: [
			{ id: 'ipad-mini-5', name: 'iPad mini (5th Generation)', price: 30 },
			{ id: 'ipad-air-3', name: 'iPad Air (3rd Gen)', price: 38 },
			{ id: 'ipad-8', name: 'iPad (8th Generation)', price: 100 },
			{ id: 'ipad-9', name: 'iPad (9th Generation)', price: 100 },
			{ id: 'ipad-standard', name: 'iPad', price: 100 },
			{ id: 'ipad-mini-6', name: 'iPad mini (6th Generation)', price: 100 },
			{ id: 'ipad-mini-7', name: 'iPad mini (7th Generation)', price: 100 },
			{ id: 'ipad-air-11', name: 'iPad Air 11-inch', price: 100 },
			{ id: 'ipad-air-13', name: 'iPad Air 13-inch', price: 100 },
			{ id: 'ipad-pro-11', name: 'iPad Pro 11-inch', price: 100 },
			{ id: 'ipad-pro-13', name: 'iPad Pro 13-inch', price: 100 },
		],
	},
	{
		name: 'Apple Watch',
		devices: [
			{ id: 'watch-series-1', name: 'Apple Watch Series 1', price: null },
			{ id: 'watch-series-2', name: 'Apple Watch Series 2', price: null },
			{ id: 'watch-series-3', name: 'Apple Watch Series 3', price: null },
			{ id: 'watch-series-4', name: 'Apple Watch Series 4', price: null },
			{ id: 'watch-series-5', name: 'Apple Watch Series 5', price: null },
			{ id: 'watch-series-6', name: 'Apple Watch Series 6', price: null },
			{ id: 'watch-series-7', name: 'Apple Watch Series 7', price: null },
			{ id: 'watch-series-8', name: 'Apple Watch Series 8', price: null },
			{ id: 'watch-series-9', name: 'Apple Watch Series 9', price: null },
			{ id: 'watch-series-10', name: 'Apple Watch Series 10', price: null },
			{ id: 'watch-series-11', name: 'Apple Watch Series 11', price: null },
			{ id: 'watch-se-1', name: 'Apple Watch SE (1st Generation)', price: null },
			{ id: 'watch-se-2', name: 'Apple Watch SE (2nd Generation)', price: null },
			{ id: 'watch-se-3', name: 'Apple Watch SE (3rd Generation)', price: null },
			{ id: 'watch-ultra-1', name: 'Apple Watch Ultra', price: null },
			{ id: 'watch-ultra-2', name: 'Apple Watch Ultra 2', price: null },
			{ id: 'watch-ultra-3', name: 'Apple Watch Ultra 3', price: null },
		],
	},
	{
		name: 'Samsung',
		devices: [
			{ id: 'sam-s22', name: 'Galaxy S22 Ultra', price: 550 },
		],
	},
	{
		name: 'Samsung JDM Devices',
		devices: [
			{ id: 'jdm-a02', name: 'Galaxy A02', price: 40 },
			{ id: 'jdm-a02s', name: 'Galaxy A02s', price: 40 },
			{ id: 'jdm-a03-core', name: 'Galaxy A03 Core', price: 40 },
			{ id: 'jdm-a03', name: 'Galaxy A03', price: 40 },
			{ id: 'jdm-a03s', name: 'Galaxy A03s', price: 40 },
			{ id: 'jdm-a04e', name: 'Galaxy A04e', price: 40 },
			{ id: 'jdm-a04', name: 'Galaxy A04', price: 40 },
			{ id: 'jdm-a04s', name: 'Galaxy A04s', price: 40 },
			{ id: 'jdm-a05', name: 'Galaxy A05', price: 40 },
			{ id: 'jdm-a05s', name: 'Galaxy A05s', price: 40 },
			{ id: 'jdm-a06', name: 'Galaxy A06', price: 40 },
			{ id: 'jdm-a06-5g', name: 'Galaxy A06 5G', price: 40 },
			{ id: 'jdm-a07', name: 'Galaxy A07', price: 40 },
			{ id: 'jdm-a07-5g', name: 'Galaxy A07 5G', price: 40 },
			{ id: 'jdm-a10', name: 'Galaxy A10', price: 40 },
			{ id: 'jdm-a10s', name: 'Galaxy A10s', price: 40 },
			{ id: 'jdm-a11', name: 'Galaxy A11', price: 40 },
			{ id: 'jdm-a12', name: 'Galaxy A12', price: 40 },
			{ id: 'jdm-a12-nacho', name: 'Galaxy A12 Nacho', price: 40 },
			{ id: 'jdm-a13-4g', name: 'Galaxy A13 4G', price: 40 },
			{ id: 'jdm-a13-5g', name: 'Galaxy A13 5G', price: 40 },
			{ id: 'jdm-a14-4g', name: 'Galaxy A14 4G', price: 40 },
			{ id: 'jdm-a14-5g', name: 'Galaxy A14 5G', price: 40 },
			{ id: 'jdm-a15-4g', name: 'Galaxy A15 4G', price: 40 },
			{ id: 'jdm-a15-5g', name: 'Galaxy A15 5G', price: 40 },
			{ id: 'jdm-a16-4g', name: 'Galaxy A16 4G', price: 40 },
			{ id: 'jdm-a16-5g', name: 'Galaxy A16 5G', price: 40 },
			{ id: 'jdm-a17-4g', name: 'Galaxy A17 4G', price: 40 },
			{ id: 'jdm-a17-5g', name: 'Galaxy A17 5G', price: 40 },
			{ id: 'jdm-a20s', name: 'Galaxy A20s', price: 40 },
			{ id: 'jdm-a21s', name: 'Galaxy A21s', price: 40 },
			{ id: 'jdm-a22-4g', name: 'Galaxy A22 4G', price: 40 },
			{ id: 'jdm-a22-5g', name: 'Galaxy A22 5G', price: 40 },
			{ id: 'jdm-a23-4g', name: 'Galaxy A23 4G', price: 40 },
			{ id: 'jdm-a23-5g', name: 'Galaxy A23 5G', price: 40 },
			{ id: 'jdm-a24', name: 'Galaxy A24', price: 40 },
			{ id: 'jdm-a25', name: 'Galaxy A25', price: 40 },
			{ id: 'jdm-a30s', name: 'Galaxy A30s', price: 40 },
			{ id: 'jdm-a31', name: 'Galaxy A31', price: 40 },
			{ id: 'jdm-a32-4g', name: 'Galaxy A32 4G', price: 40 },
			{ id: 'jdm-a32-5g', name: 'Galaxy A32 5G', price: 40 },
			{ id: 'jdm-a33-5g', name: 'Galaxy A33 5G', price: 40 },
			{ id: 'jdm-a34-5g', name: 'Galaxy A34 5G', price: 40 },
			{ id: 'jdm-a35-5g', name: 'Galaxy A35 5G', price: 40 },
			{ id: 'jdm-a36-5g', name: 'Galaxy A36 5G', price: 40 },
			{ id: 'jdm-a50', name: 'Galaxy A50', price: 40 },
			{ id: 'jdm-a51', name: 'Galaxy A51', price: 40 },
			{ id: 'jdm-a52', name: 'Galaxy A52', price: 40 },
			{ id: 'jdm-a53-5g', name: 'Galaxy A53 5G', price: 40 },
			{ id: 'jdm-a54-5g', name: 'Galaxy A54 5G', price: 40 },
		],
	},
	{
		name: 'Tecno',
		devices: [
			{ id: 'tec-camon-20', name: 'Tecno Camon 20 Pro', price: 220 },
			{ id: 'tec-spark-10', name: 'Tecno Spark 10 Pro', price: 160 },
		],
	},
	{
		name: 'Xiaomi',
		devices: [
			{ id: 'xiaomi-redmi-12', name: 'Xiaomi Redmi Note 12', price: 190 },
			{ id: 'xiaomi-13-pro', name: 'Xiaomi 13 Pro', price: 580 },
		],
	},
];

const repairServices: RepairService[] = [
	{ id: 'screen', name: 'Screen Replacement', category: 'Displays', price: 40 },
	{ id: 'board', name: 'Board Repair / Micro-soldering', category: 'Logic Board', price: 65 },
	{ id: 'software', name: 'Software Flash', category: 'Software', price: 25 },
	{ id: 'galaxy-a54-frp', name: 'Galaxy A54 5G FRP Service', category: 'Samsung FRP', price: 35 },
	{ id: 'samsung-frp-other', name: 'Samsung Galaxy FRP Service (Other Models)', category: 'Samsung FRP', price: 35 },
	{ id: 'ps4-repair', name: 'PS4 Repair / Diagnostic', category: 'Game Repair', price: 60 },
	{ id: 'ps5-repair', name: 'PS5 Repair / Diagnostic', category: 'Game Repair', price: 75 },
	{ id: 'xbox-repair', name: 'Xbox Repair / Diagnostic', category: 'Game Repair', price: 60 },
	{ id: 'nintendo-repair', name: 'Nintendo Repair / Diagnostic', category: 'Game Repair', price: 60 },
	{ id: 'controller-repair', name: 'Controller Repair for All Systems', category: 'Game Repair', price: 35 },
	{ id: 'console-cleaning', name: 'Console Cleaning / Fan Service', category: 'Game Repair', price: 30 },
	{ id: 'pc-repair', name: 'PC Repair / Diagnostic', category: 'Computer Repair', price: 65 },
	{ id: 'laptop-repair', name: 'Laptop Repair / Diagnostic', category: 'Computer Repair', price: 70 },
	{ id: 'camera-installation', name: 'Security Camera Installation', category: 'Camera Services', price: null },
	{ id: 'camera-troubleshooting', name: 'Security Camera Troubleshooting', category: 'Camera Services', price: null },
	{ id: 'port', name: 'Charging Port', category: 'Hardware', price: 30 },
	{ id: 'battery', name: 'Battery Replacement', category: 'Hardware', price: 35 },
];

const whatsappNumber = '2034235212';

const countries = [
	'Jamaica',
	'United States',
	'Canada',
	'United Kingdom',
	'Antigua and Barbuda',
	'Bahamas',
	'Barbados',
	'Belize',
	'Bermuda',
	'Cayman Islands',
	'Dominica',
	'Dominican Republic',
	'Grenada',
	'Guyana',
	'Haiti',
	'India',
	'Ireland',
	'Japan',
	'Mexico',
	'Montserrat',
	'Netherlands',
	'Nigeria',
	'Panama',
	'Saint Kitts and Nevis',
	'Saint Lucia',
	'Saint Vincent and the Grenadines',
	'Trinidad and Tobago',
	'Turks and Caicos Islands',
	'Other',
];

const formatPrice = (price: number) =>
	new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(price);
const formatWalletBalance = (balance: number) =>
	new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(balance);

function SearchIcon() {
	return (
		<svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
			<circle cx="10.8" cy="10.8" r="6.8" />
			<path strokeLinecap="round" d="m16 16 4.5 4.5" />
		</svg>
	);
}

function DeviceIcon({ className = 'h-5 w-5' }: { className?: string }) {
	return (
		<svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
			<rect x="6.5" y="2.5" width="11" height="19" rx="2" />
			<path strokeLinecap="round" d="M10 5h4M11 18.5h2" />
		</svg>
	);
}

function BrandLogo() {
	return (
		<a className="inline-flex items-center" href="#top" aria-label="Exclusive Mobile Solutions home">
			<picture>
				<source media="(max-width: 639px)" srcSet="/logo-mobile-icon.svg" />
				<img src="/logo-desktop-horizontal.svg" alt="Exclusive Mobile Solutions" className="h-9 w-auto sm:h-12" />
			</picture>
		</a>
	);
}

function WrenchIcon({ className = 'h-5 w-5' }: { className?: string }) {
	return (
		<svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
			<path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a5 5 0 0 0-6.6 6.6L3.5 17.5a2.1 2.1 0 0 0 3 3l4.6-4.6a5 5 0 0 0 6.6-6.6l-3 3-3.1-3.1 3.1-2.9Z" />
		</svg>
	);
}

function ArrowIcon() {
	return (
		<svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
			<path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
		</svg>
	);
}

function TrashIcon() {
	return (
		<svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
			<path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />
		</svg>
	);
}

export default function App() {
	const [orderType, setOrderType] = useState<OrderType>('devices');
	const [searchQuery, setSearchQuery] = useState('');
	const [cart, setCart] = useState<CartItem[]>([]);
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('crypto');
	const [user, setUser] = useState<User | null>(null);
	const [authLoading, setAuthLoading] = useState(true);
	const [walletBalance, setWalletBalance] = useState(0);
	const [accountOpen, setAccountOpen] = useState(false);
	const [accountNotice, setAccountNotice] = useState('');
	const [accountRefreshKey, setAccountRefreshKey] = useState(0);
	const [checkoutNotice, setCheckoutNotice] = useState('');
	const [checkoutBusy, setCheckoutBusy] = useState(false);
	const [guestCheckout, setGuestCheckout] = useState(false);
	const [navigationOpen, setNavigationOpen] = useState(false);
	const paypalReturnHandled = useRef(false);
	const [localRail, setLocalRail] = useState<LocalRail>('lynk');
	const [customerName, setCustomerName] = useState('');
	const [customerEmail, setCustomerEmail] = useState('');
	const [customerPhone, setCustomerPhone] = useState('');
	const [cryptoTxid, setCryptoTxid] = useState('');
	const [address, setAddress] = useState('');
	const [country, setCountry] = useState('');
	const [stateRegion, setStateRegion] = useState('');
	const [postalCode, setPostalCode] = useState('');
	const [deviceModel, setDeviceModel] = useState('');
	const [deviceIdentifiers, setDeviceIdentifiers] = useState<Record<string, string>>({});
	const [creditSelections, setCreditSelections] = useState<Record<string, string>>({});
	const [creditQuantities, setCreditQuantities] = useState<Record<string, string>>({});
	const [creditTargets, setCreditTargets] = useState<Record<string, string>>({});
	const [wholesaleTag, setWholesaleTag] = useState<string | null>(null);
	const [wholesaleSearch, setWholesaleSearch] = useState('');

	const refreshWalletBalance = useCallback(async (userId: string) => {
		if (!supabase) return;
		const { data, error } = await supabase.from('profiles').select('credit_balance').eq('id', userId).single();
		if (error) throw error;
		setWalletBalance(Number(data.credit_balance));
	}, []);

	useEffect(() => {
		if (user?.email) setCustomerEmail((current) => current || user.email || '');
	}, [user?.email]);

	useEffect(() => {
		if (!supabase) {
			setAuthLoading(false);
			return;
		}
		let active = true;
		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			if (active) setUser(session?.user ?? null);
		});
		void supabase.auth.getSession().then(({ data, error }) => {
			if (!active) return;
			if (error) setAccountNotice(error.message);
			setUser(data.session?.user ?? null);
			setAuthLoading(false);
		}).catch((error: unknown) => {
			if (active) {
				setAccountNotice(error instanceof Error ? error.message : 'Could not restore your sign-in session.');
				setAuthLoading(false);
			}
		});
		return () => {
			active = false;
			subscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		if (!user || !isSupabaseConfigured) {
			setWalletBalance(0);
			return;
		}
		void refreshWalletBalance(user.id).catch((error: unknown) => {
			setAccountNotice(error instanceof Error ? error.message : 'Could not load your wallet balance.');
		});
	}, [user, refreshWalletBalance]);

	useEffect(() => {
		const currentUrl = new URL(window.location.href);
		if (currentUrl.searchParams.has('wallet_topup_cancelled')) {
			currentUrl.searchParams.delete('wallet_topup_cancelled');
			currentUrl.searchParams.delete('wallet_topup');
			currentUrl.searchParams.delete('token');
			currentUrl.searchParams.delete('PayerID');
			window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
			setAccountNotice('PayPal checkout was cancelled. No wallet credit was added; the pending request can be retried.');
			setAccountOpen(true);
			paypalReturnHandled.current = true;
			return;
		}

		if (currentUrl.searchParams.has('paypal_order_cancelled')) {
			currentUrl.searchParams.delete('paypal_order_cancelled');
			window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
			setCheckoutNotice('PayPal checkout was cancelled. No payment was captured. Rebuild your cart to start another checkout.');
			paypalReturnHandled.current = true;
			return;
		}

		const orderId = currentUrl.searchParams.get('paypal_order');
		const paypalOrderId = currentUrl.searchParams.get('token');
		if (orderId && paypalOrderId && user && supabase && !paypalReturnHandled.current) {
			paypalReturnHandled.current = true;
			currentUrl.searchParams.delete('paypal_order');
			currentUrl.searchParams.delete('token');
			currentUrl.searchParams.delete('PayerID');
			window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
			setCheckoutNotice('Verifying PayPal payment…');
			void supabase.functions.invoke('capture-paypal-order-checkout', {
				body: { orderId, paypalOrderId },
			}).then(({ data, error }) => {
				if (error) throw error;
				if (data?.status !== 'completed') throw new Error('PayPal payment was not confirmed. The order remains unpaid.');
				setCart([]);
				setCheckoutNotice(`PayPal payment confirmed. Order ${String(data.orderId).slice(0, 8)} is paid.`);
				setAccountNotice('Your PayPal order payment is confirmed and recorded in account activity.');
				setAccountOpen(true);
				setAccountRefreshKey((key) => key + 1);
			}).catch((error: unknown) => {
				setCheckoutNotice(error instanceof Error ? error.message : 'Could not verify the PayPal payment. The order remains unpaid.');
			});
			return;
		}

		const topupId = currentUrl.searchParams.get('wallet_topup');
		const paypalTopupOrderId = currentUrl.searchParams.get('token');
		if (!topupId || !paypalTopupOrderId || !user || !supabase || paypalReturnHandled.current) return;
		paypalReturnHandled.current = true;
		currentUrl.searchParams.delete('wallet_topup');
		currentUrl.searchParams.delete('token');
		currentUrl.searchParams.delete('PayerID');
		window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
		setAccountOpen(true);
		setAccountNotice('Verifying PayPal payment…');
		void supabase.functions.invoke('capture-paypal-topup', {
			body: { topupId, paypalOrderId: paypalTopupOrderId },
		}).then(async ({ data, error }) => {
			if (error) throw error;
			if (data?.status !== 'completed') throw new Error('PayPal payment was not confirmed. No wallet credit was added.');
			await refreshWalletBalance(user.id);
			setAccountNotice('PayPal payment verified. Your wallet has been credited.');
			setAccountRefreshKey((key) => key + 1);
		}).catch((error: unknown) => {
			setAccountNotice(error instanceof Error ? error.message : 'Could not verify the PayPal payment. No wallet credit was added.');
			setAccountRefreshKey((key) => key + 1);
		});
	}, [user, refreshWalletBalance]);

	const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
	const filteredBrands = deviceBrands
		.map((brand) => ({
			...brand,
			devices: brand.devices.filter((device) =>
				`${brand.name} ${device.name}`.toLocaleLowerCase().includes(normalizedQuery),
			),
		}))
		.filter((brand) => brand.devices.length > 0);
	const filteredServices = repairServices.filter((service) =>

		`${service.name} ${service.category}`.toLocaleLowerCase().includes(normalizedQuery),

	);
	const filteredSamsungFrpServices = filteredServices.filter((service) => service.category === 'Samsung FRP');
	const filteredGameRepairServices = filteredServices.filter((service) => service.category === 'Game Repair');
	const filteredComputerRepairServices = filteredServices.filter((service) => service.category === 'Computer Repair');
	const filteredCameraServices = filteredServices.filter((service) => service.category === 'Camera Services');
	const filteredOtherServices = filteredServices.filter((service) => !['Samsung FRP', 'Game Repair', 'Computer Repair', 'Camera Services'].includes(service.category));
	const filteredWholesaleServices = wholesaleServices.filter((service) => {
		const query = wholesaleSearch.trim().toLocaleLowerCase();
		const matchesQuery = !query || `${service.title} ${service.description} ${service.category} ${service.tags.join(' ')}`
			.toLocaleLowerCase()
			.includes(query);
		return matchesQuery && (!wholesaleTag || service.tags.includes(wholesaleTag));
	});

	const hasRepairs = cart.some((item) => item.kind === 'repairs');
	const hasDevices = cart.some((item) => item.kind === 'devices');
	const hasCredits = cart.some((item) => item.kind === 'credits');
	const hasWholesale = cart.some((item) => item.kind === 'wholesale');
	const hasUnpricedCredits = cart.some((item) => item.kind === 'credits' && item.price === null);
	const hasUnpricedDevices = cart.some((item) => item.kind === 'devices' && item.price === null);
	const hasUnpricedRepairs = cart.some((item) => item.kind === 'repairs' && item.price === null);
	const unpricedDeviceCount = cart.filter((item) => item.kind === 'devices' && item.price === null).length;
	const deviceTotal = cart.reduce((sum, item) => sum + (item.kind === 'devices' ? item.price ?? 0 : 0), 0);
	const repairTotal = cart.reduce((sum, item) => sum + (item.kind === 'repairs' ? item.price ?? 0 : 0), 0);
	const creditTotal = cart.reduce((sum, item) => sum + (item.kind === 'credits' ? item.price ?? 0 : 0), 0);
	const wholesaleTotal = cart.reduce((sum, item) => sum + (item.kind === 'wholesale' ? item.price ?? 0 : 0), 0);
	const orderTotal = deviceTotal + repairTotal + creditTotal + wholesaleTotal;

	const addDevice = (brand: string, device: Device) =>
		setCart((current) => [...current, {
			id: device.id,
			name: device.name,
			kind: 'devices',
			price: device.price,
			deviceFamily: brand,
			identifier: deviceIdentifiers[device.id]?.trim() || undefined,
		}]);

	const updateDeviceIdentifier = (deviceId: string, identifier: string) => {
		setDeviceIdentifiers((current) => ({ ...current, [deviceId]: identifier }));
		setCart((current) => current.map((item) =>
			item.kind === 'devices' && item.id === deviceId
				? { ...item, identifier: identifier.trim() || undefined }
				: item,
		));
	};

	const addRepair = (service: RepairService) =>

		setCart((current) => [...current, {

			id: service.id,

			name: service.name,

			kind: 'repairs',

			price: service.price,

		}]);

	const addWholesaleService = (service: (typeof wholesaleServices)[number]) =>
		setCart((current) => [...current, {
			id: service.id,
			name: service.title,
			kind: 'wholesale',
			price: service.price,
		}]);

	const renderRepairServices = (services: RepairService[]) => (
		<div className="divide-y divide-blue-300/10">
			{services.map((service) => (
				<article className="flex min-h-[82px] items-center gap-3 py-3" key={service.id}>
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#16466d] bg-[#0a1d3a] text-sky-400">
						<WrenchIcon />
					</span>
					<div className="min-w-0 flex-1">
						<p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">{service.category}</p>
						<h3 className="mt-1 text-sm font-semibold text-slate-100 sm:text-base">{service.name}</h3>
					</div>
					<div className="flex shrink-0 flex-col items-end gap-2">
						<strong className="text-right text-sm">{service.price === null ? 'Contact for quote' : `${formatPrice(service.price)} USD`}</strong>
						<button
							className="min-h-8 rounded-lg border border-sky-800 bg-[#092342] px-3 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-[#0d3458]"
							type="button"
							onClick={() => addRepair(service)}
							aria-label={`Add ${service.name}${service.price === null ? '' : ` for ${formatPrice(service.price)}`}`}
						>
							Add service
						</button>
					</div>
				</article>
			))}
		</div>
	);

	const addServerCredit = (service: ServerCreditService) => {
		const selection = creditSelections[service.id] ?? '';
		const product = service.products?.find((item) => item.id === selection);
		const description = product?.name ?? (service.selectionType === 'quantity'
			? `${creditQuantities[service.id] || '1'} credit${creditQuantities[service.id] === '1' ? '' : 's'}`
			: service.selectionType === 'request' ? 'Service request' : selection);
		if (!description) return;
		if (service.requiresToolEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creditTargets[service.id]?.trim() ?? '')) return;

		const targetDetails = [
			creditTargets[service.id]?.trim() ? `Email: ${creditTargets[service.id].trim()}` : '',
		].filter(Boolean).join(' | ');

		setCart((current) => [...current, {
			id: product?.id ?? service.id,
			name: `${service.name} — ${description}`,
			kind: 'credits',
			price: product?.price ?? null,
			identifier: targetDetails || creditTargets[service.id]?.trim() || undefined,
		}]);
	};

	const removeFromCart = (index: number) =>
		setCart((current) => current.filter((_, itemIndex) => itemIndex !== index));

	const continueAsGuest = () => {
		setGuestCheckout(true);
		setCheckoutNotice(cart.length ? '' : 'Choose one or more items, then complete the customer information to send your request as a guest.');
		document.getElementById(cart.length ? 'checkout-summary' : 'catalog-title')?.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
		});
	};

	const handleWhatsAppCheckout = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setCheckoutNotice('');
		if (paymentMethod === 'wallet') {
			if (!user) {
				setCheckoutNotice('Sign in to pay with wallet credit.');
				setAccountOpen(true);
				return;
			}
			if (!supabase) {
				setCheckoutNotice('Wallet checkout is unavailable until Supabase is configured.');
				return;
			}
			const hasWalletIneligibleItems = cart.some((item) =>
				!['devices', 'repairs', 'wholesale', 'credits'].includes(item.kind) || item.price === null,
			);
			if (cart.length === 0 || hasWalletIneligibleItems) {
				setCheckoutNotice('Wallet checkout requires every selected device or service to have a confirmed price. Remove unpriced items or request a quote separately.');
				return;
			}
			setCheckoutBusy(true);
			try {
				const { data: order, error } = await supabase.rpc('create_wallet_order', {
					p_items: cart.map((item) => ({
						id: item.id,
						kind: item.kind,
						identifier: item.identifier ?? null,
					})),
					p_customer: {
						full_name: customerName.trim(),
						address: address.trim(),
						country,
						state_region: stateRegion.trim(),
						postal_code: postalCode.trim(),
						device_model: deviceModel.trim(),
						email: customerEmail.trim() || user.email || '',
						phone: customerPhone.trim(),
					},
				});
				if (error) throw error;
				if (!order) throw new Error('The wallet order was not created.');
				await refreshWalletBalance(user.id);
				setCart([]);
				setCheckoutNotice(`Order ${String(order.id).slice(0, 8)} paid successfully with wallet credit.`);
				setAccountNotice('Your wallet payment and order are recorded in account activity.');
				setAccountRefreshKey((key) => key + 1);
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Wallet checkout failed. No payment was taken.';
				setCheckoutNotice(/INSUFFICIENT_CREDIT|insufficient (wallet )?(credit|funds|balance)/i.test(message)
					? 'Insufficient wallet credit. Add funds in My account and try again.'
					: message);
			} finally {
				setCheckoutBusy(false);
			}
			return;
		}

		if (paymentMethod === 'crypto') {
			if (!user) {
				setCheckoutNotice('Sign in or create an account to submit a crypto payment for verification.');
				setAccountOpen(true);
				return;
			}
			if (!supabase) {
				setCheckoutNotice('Crypto checkout requires a configured Supabase project. No order was submitted.');
				return;
			}
			if (cryptoPayment.usdtAddress.startsWith('YOUR_') || cryptoPayment.binancePayId.startsWith('YOUR_')) {
				setCheckoutNotice('Crypto payment details are still placeholders. Update src/data/cryptoPayment.ts before accepting payments.');
				return;
			}
			const txid = cryptoTxid.trim();
			if (txid.length < 6 || txid.length > 200) {
				setCheckoutNotice('Enter a valid transaction ID or Binance Pay ID (6–200 characters).');
				return;
			}
			if (cart.some((item) => item.price === null)) {
				setCheckoutNotice('Crypto payment requires a confirmed price for every cart item. Remove unpriced items and request a quote separately.');
				return;
			}
			setCheckoutBusy(true);
			try {
				const { data: order, error } = await supabase.rpc('submit_crypto_order', {
					p_items: cart.map((item) => ({
						id: item.id,
						kind: item.kind,
						name: item.name,
						identifier: item.identifier ?? null,
					})),
					p_customer: {
						full_name: customerName.trim(),
						address: address.trim(),
						country,
						state_region: stateRegion.trim(),
						postal_code: postalCode.trim(),
						device_model: deviceModel.trim(),
						email: customerEmail.trim() || user.email || '',
						phone: customerPhone.trim(),
					},
					p_txid: txid,
				});
				if (error) throw error;
				if (!order?.id) throw new Error('The crypto payment order was not submitted.');
				setCart([]);
				setCryptoTxid('');
				setCheckoutNotice(`Order ${String(order.id).slice(0, 8)} submitted. Status: Pending Verification. We will verify the transfer before processing your order.`);
				setAccountNotice('Your crypto order is pending payment verification. The transaction ID is saved in your account history.');
				setAccountRefreshKey((key) => key + 1);
			} catch (error) {
				setCheckoutNotice(error instanceof Error ? error.message : 'Could not submit the crypto order for verification.');
			} finally {
				setCheckoutBusy(false);
			}
			return;
		}

		if (paymentMethod === 'paypal') {
			if (!user) {
				setCheckoutNotice('Sign in or create an account before starting PayPal checkout.');
				setAccountOpen(true);
				return;
			}
			if (!supabase) {
				setCheckoutNotice('PayPal checkout is unavailable until Supabase is configured.');
				return;
			}
			setCheckoutBusy(true);
			try {
				const { data: order, error: orderError } = await supabase.rpc('create_order_request', {
					p_items: cart.map((item) => ({
						id: item.id,
						kind: item.kind,
						name: item.name,
						identifier: item.identifier ?? null,
					})),
					p_customer: {
						full_name: customerName.trim(),
						address: address.trim(),
						country,
						state_region: stateRegion.trim(),
						postal_code: postalCode.trim(),
						device_model: deviceModel.trim(),
						email: customerEmail.trim() || user.email || '',
						phone: customerPhone.trim(),
					},
					p_payment_method: 'paypal',
				});
				if (orderError) throw orderError;
				if (!order) throw new Error('The PayPal order request was not created.');
				const { data, error } = await supabase.functions.invoke('create-paypal-order-checkout', {
					body: { orderId: order.id },
				});
				if (error) throw error;
				if (typeof data?.approvalUrl !== 'string') throw new Error(data?.error ?? 'PayPal did not return an approval link.');
				window.location.assign(data.approvalUrl);
			} catch (error) {
				setCheckoutNotice(error instanceof Error ? error.message : 'Could not start PayPal checkout. No payment was taken.');
			} finally {
				setCheckoutBusy(false);
			}
			return;
		}

		const devices = cart.filter((item) => item.kind === 'devices');
		const repairs = cart.filter((item) => item.kind === 'repairs');
		const credits = cart.filter((item) => item.kind === 'credits');
		const wholesale = cart.filter((item) => item.kind === 'wholesale');
		const payment = paymentMethod === 'local'
			? `Local Transfer (${localRail.toUpperCase()})`
			: paymentMethod === 'payoneer'
				? 'Payoneer — please send a current payment link'
				: paymentMethod === 'wipay'
					? 'WiPay — please send current payment instructions'
					: 'PayPal';
						const messageLines = [
							devices.length && repairs.length && wholesale.length
								? '*EXCLUSIVE MOBILE SOLUTIONS - DEVICE, REPAIR AND WHOLESALE REQUEST*'
								: devices.length && repairs.length
								? '*EXCLUSIVE MOBILE SOLUTIONS - DEVICE PURCHASE AND REPAIR REQUEST*'
								: devices.length && wholesale.length
									? '*EXCLUSIVE MOBILE SOLUTIONS - DEVICE AND WHOLESALE REQUEST*'
									: repairs.length && wholesale.length
										? '*EXCLUSIVE MOBILE SOLUTIONS - REPAIR AND WHOLESALE REQUEST*'
										: devices.length
									? '*EXCLUSIVE MOBILE SOLUTIONS - DEVICE PURCHASE*'
									: repairs.length
						? '*EXCLUSIVE MOBILE SOLUTIONS - REPAIR SERVICE ORDER*'
						: wholesale.length
							? '*EXCLUSIVE MOBILE SOLUTIONS - WHOLESALE SERVICES REQUEST*'
							: '*EXCLUSIVE MOBILE SOLUTIONS - SERVER CREDITS REQUEST*',
			`Customer Name: ${customerName}`,
			...(customerEmail.trim() ? [`Customer Email: ${customerEmail.trim()}`] : []),
			...(customerPhone.trim() ? [`Customer Phone: ${customerPhone.trim()}`] : []),
			`Address: ${address}`,
			`Country: ${country}`,
			`State / Parish / Province: ${stateRegion}`,
			`ZIP / Postal Code / PO Box: ${postalCode}`,
		];

		if (deviceModel.trim()) messageLines.push(`Device model / notes: ${deviceModel.trim()}`);
		if (devices.length) {
			messageLines.push(
				'',
				'Selected devices:',
				...devices.map((item) =>
					`- ${item.name} (${item.price === null ? 'price to be confirmed' : `${formatPrice(item.price)} USD`})${item.identifier ? ` — IMEI / Serial: ${item.identifier}` : ''}`,
				),
			);
		}
		if (repairs.length) {
			messageLines.push('', 'Repair services:', ...repairs.map((item) => `- ${item.name} (${item.price === null ? 'price to be confirmed' : `${formatPrice(item.price)} USD`})`));
		}
		if (credits.length) {
			messageLines.push(
				'',
				'Server Credits for Box/Dongle:',
				...credits.map((item) => `- ${item.name} (${item.price === null ? 'price to be confirmed' : `${formatPrice(item.price)} USD`})${item.identifier ? ` — Account details: ${item.identifier}` : ''}`),
			);
			if (hasUnpricedCredits) messageLines.push('Pricing and payment for unpriced server credit services will be confirmed by the team.');
		}
		if (wholesale.length) {
			messageLines.push(
				'',
				'Wholesale services:',
				...wholesale.map((item) => `- ${item.name} (${formatPrice(item.price ?? 0)} USD)`),
			);
		}
		if (repairs.length) messageLines.push('', 'Appointment schedule: Monday–Saturday. Sunday emergency appointments only, 11:00 PM–3:00 AM.');
		if (repairs.some((item) => item.id === 'camera-installation' || item.id === 'camera-troubleshooting')) {
			messageLines.push('Camera service area requested: Montego Bay, Hopewell, Sandy Bay, and Lucea.');
		}
		messageLines.push('', `Device total: ${formatPrice(deviceTotal)} USD`, `Repair services total: ${formatPrice(repairTotal)} USD`, `Priced server credits total: ${formatPrice(creditTotal)} USD`, `Wholesale services total: ${formatPrice(wholesaleTotal)} USD`);
		if (hasUnpricedDevices) messageLines.push('Note: device total excludes devices whose price is to be confirmed.');
		if (hasUnpricedRepairs) messageLines.push('Note: repair service prices pending confirmation are excluded from the repair total.');
		messageLines.push(
			`Total amount: ${formatPrice(orderTotal)} USD${hasUnpricedCredits ? ' (unpriced server credits excluded until confirmed)' : ''}`,
			`Payment method: ${payment}`,
		);
		const whatsappUrl =
			`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageLines.join('\n'))}`;
		window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

		if (user && supabase) {
			setCheckoutBusy(true);
			try {
				const { error } = await supabase.rpc('create_order_request', {
					p_items: cart.map((item) => ({
		id: item.id,
		kind: item.kind,
		name: item.name,
		identifier: item.identifier ?? null,
					})),
					p_customer: {
		full_name: customerName.trim(),
		email: customerEmail.trim() || user.email || '',
		phone: customerPhone.trim(),
		address: address.trim(),
		country,
		state_region: stateRegion.trim(),
		postal_code: postalCode.trim(),
		device_model: deviceModel.trim(),
					},
					p_payment_method: paymentMethod,
				});
				if (error) throw error;
				setCheckoutNotice('Your order request was saved to account history and sent to WhatsApp.');
				setAccountRefreshKey((key) => key + 1);
			} catch (error) {
				setCheckoutNotice(error instanceof Error
					? `WhatsApp opened, but the order could not be saved to account history: ${error.message}`
					: 'WhatsApp opened, but the order could not be saved to account history.');
			} finally {
				setCheckoutBusy(false);
			}
		}
	};

	return (
		<main className="min-h-screen bg-[#050d22] text-[#f4f7fc]">
			<div className="promo-ticker-bar" aria-label="Announcements">
				<a
					className="ticker-content"
					href="https://t.me/techfix_pro"
					target="_blank"
					rel="noopener noreferrer"
				>
					🔥 <span className="promo-highlight">SPECIAL PROMO:</span> Fast Carrier Unlocks &amp; Digital Tool Credits | Get 5% Off First Order | Contact Us on Telegram!
				</a>
			</div>
			<header className="sticky top-0 z-10 border-b border-blue-300/15 bg-[#050d22]/95 backdrop-blur">
				<div className="mx-auto flex min-h-[76px] w-[min(100%-2rem,1160px)] items-center justify-between gap-4">
					<BrandLogo />
					<div className="flex items-center gap-3">
						<span className="hidden text-xs font-bold tracking-[.15em] text-slate-400 sm:block">DEVICE CARE, DONE RIGHT</span>
						<button
							className="grid h-10 w-10 place-items-center rounded-lg border border-white/25 text-xl text-white transition hover:border-sky-400 hover:text-sky-200"
							type="button"
							aria-label={navigationOpen ? 'Close navigation menu' : 'Open navigation menu'}
							aria-expanded={navigationOpen}
							aria-controls="site-navigation"
							onClick={() => setNavigationOpen((open) => !open)}
						>
							{navigationOpen ? '×' : '☰'}
						</button>
						<button
							className="min-h-10 rounded-lg border border-sky-700 px-3 text-xs font-bold text-sky-200 transition hover:border-sky-400 hover:bg-sky-950/50 sm:px-4 sm:text-sm"
							type="button"
							onClick={() => { setAccountNotice(''); setAccountOpen(true); }}
							aria-label={user ? `My account, wallet balance ${formatWalletBalance(walletBalance)}` : 'Sign in or create an account'}
						>
							{authLoading ? 'Loading…' : user ? `My account · ${formatWalletBalance(walletBalance)}` : 'Sign in'}
						</button>
					</div>
				</div>
				{navigationOpen && (
					<nav className="border-t border-blue-300/15 bg-[#091835]" id="site-navigation" aria-label="Main navigation">
						<div className="mx-auto grid w-[min(100%-2rem,1160px)] gap-1 py-2 sm:grid-cols-2 lg:grid-cols-4">
							<a className="rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 hover:text-sky-300" href="#top" onClick={() => setNavigationOpen(false)}>Home</a>
							<a className="rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 hover:text-sky-300" href="#checkout-summary" onClick={() => setNavigationOpen(false)}>Place Order</a>
							<a className="rounded-lg px-4 py-3 text-sm font-medium text-sky-200 hover:bg-white/5 hover:text-sky-100" href="#catalog-title" aria-current="page" onClick={() => setNavigationOpen(false)}>Products &amp; Services</a>
							<button
								className="rounded-lg px-4 py-3 text-left text-sm font-medium text-slate-200 hover:bg-white/5 hover:text-sky-300"
								type="button"
								onClick={() => { setNavigationOpen(false); setGuestCheckout(false); setAccountNotice(''); setAccountOpen(true); }}
							>
								Add Credit
							</button>
							<button
								className="rounded-lg px-4 py-3 text-left text-sm font-medium text-slate-200 hover:bg-white/5 hover:text-sky-300"
								type="button"
								onClick={() => { setNavigationOpen(false); setGuestCheckout(false); setAccountNotice(''); setAccountOpen(true); }}
							>
								My Account
							</button>
						</div>
					</nav>
				)}
			</header>
			{accountOpen && (
				<AccountPanel
					key={accountRefreshKey}
					user={user}
					notice={accountNotice}
					onClose={() => setAccountOpen(false)}
					onBalanceChange={setWalletBalance}
					onUserChange={setUser}
				/>
			)}

			<div className="mx-auto w-[min(100%-2rem,1120px)] pb-8" id="top">
				<div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-blue-300/15 py-3 text-xs text-slate-400">
					<p className="font-semibold text-slate-300">
						<a className="hover:text-sky-300" href="#top">Home</a>
						<span aria-hidden="true" className="mx-2 text-slate-600">/</span>
						<span>Products &amp; Services</span>
					</p>
					<p className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<span>{user ? `Welcome, ${user.user_metadata.full_name || user.email || 'customer'}` : 'Welcome, Guest'}</span>
						<button
							className="font-semibold text-sky-300 hover:text-white"
							type="button"
							onClick={() => { setGuestCheckout(false); setAccountNotice(''); setAccountOpen(true); }}
						>
							{user ? 'My Account' : 'Sign In'}
						</button>
						{!user && (
							<button className="font-semibold text-emerald-300 hover:text-emerald-200" type="button" onClick={continueAsGuest}>
								Checkout as Guest
							</button>
						)}
					</p>
				</div>
				<div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Popular service filters">
					{['Google Pixel', 'FMI OFF for iPad WiFi', 'AT&T', 'T-Mobile — PRO', 'Mexico Nextel', 'iCloud'].map((tag) => (
						<button
							className="shrink-0 rounded-full border border-[#294572] bg-[#091835] px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:border-sky-400 hover:bg-sky-950"
							key={tag}
							type="button"
							onClick={() => {
								setOrderType('wholesale');
								setWholesaleSearch('');
								setWholesaleTag(tag);
								document.getElementById('catalog-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
							}}
						>
							{tag}
						</button>
					))}
				</div>
				<section className="py-12 sm:py-16" aria-labelledby="page-title">
					<p className="mb-4 text-xs font-bold tracking-[.2em] text-sky-400">YOUR LOCAL MOBILE SPECIALISTS</p>
					<h1 className="max-w-3xl text-5xl font-extrabold leading-[.98] sm:text-7xl" id="page-title">
						Devices and repairs,<br /><span className="text-sky-400">made simple.</span>
					</h1>
					<p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
						Choose a device or a repair service, then send your request straight to our team.
					</p>
				</section>

				<div className="mb-7 grid w-full max-w-3xl grid-cols-1 gap-1.5 rounded-xl border border-blue-300/20 bg-[#091835] p-1.5 sm:grid-cols-3" role="group" aria-label="Choose order type">
					<button
						className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors sm:text-base ${orderType === 'devices' ? 'bg-sky-500 text-[#03142a]' : 'text-slate-300 hover:bg-white/5'}`}
						type="button"
						aria-pressed={orderType === 'devices'}
						onClick={() => setOrderType('devices')}
					>
						<DeviceIcon className="h-[18px] w-[18px]" /> Device Purchases
					</button>
					<button
						className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors sm:text-base ${orderType === 'repairs' ? 'bg-sky-500 text-[#03142a]' : 'text-slate-300 hover:bg-white/5'}`}
						type="button"
						aria-pressed={orderType === 'repairs'}
						onClick={() => setOrderType('repairs')}
					>
						<WrenchIcon className="h-[18px] w-[18px]" /> Repair Services
					</button>
					<button
						className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors sm:text-base ${orderType === 'wholesale' ? 'bg-sky-500 text-[#03142a]' : 'text-slate-300 hover:bg-white/5'}`}
						type="button"
						aria-pressed={orderType === 'wholesale'}
						onClick={() => setOrderType('wholesale')}
					>
						Wholesale Services
					</button>
				</div>

				<form onSubmit={handleWhatsAppCheckout}>
					<div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_350px]">
						<section aria-labelledby="catalog-title">
							<div className="mb-5 flex items-end justify-between gap-4">
								<div>
									<p className="mb-2 text-[11px] font-bold tracking-[.17em] text-sky-400">{orderType === 'devices' ? 'SHOP DEVICES' : orderType === 'repairs' ? 'BOOK A REPAIR' : 'WHOLESALE CATALOG'}</p>
									<h2 className="text-3xl font-bold leading-tight sm:text-4xl" id="catalog-title">
										{orderType === 'devices' ? 'Find your next phone' : orderType === 'repairs' ? 'What can we fix?' : 'Products & services'}
									</h2>
								</div>
								<span className="hidden text-sm text-slate-500 sm:block">{orderType === 'devices' ? 'Browse by brand' : orderType === 'repairs' ? `${filteredServices.length} services` : `${filteredWholesaleServices.length} services`}</span>
							</div>
							{orderType === 'repairs' && (
								<div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs leading-5 text-sky-100">
									<p>Appointment schedule: Monday–Saturday. Sunday emergency appointments only, 11:00 PM–3:00 AM.</p>
									<p className="mt-1">Security camera installation and troubleshooting available in Montego Bay, Hopewell, Sandy Bay, and Lucea.</p>
								</div>
							)}

							<label className="mb-7 flex min-h-12 items-center gap-3 rounded-xl border border-[#294572] bg-[#07142e] px-4 text-slate-400 transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/15">
								<SearchIcon />
								<input
									className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 sm:text-base"
									type="search"
									value={orderType === 'wholesale' ? wholesaleSearch : searchQuery}
									onChange={(event) => orderType === 'wholesale' ? setWholesaleSearch(event.target.value) : setSearchQuery(event.target.value)}
									placeholder={orderType === 'devices' ? 'Search all brands and models...' : orderType === 'repairs' ? 'Search repair services...' : 'Search services, carriers or device models...'}
									aria-label={orderType === 'devices' ? 'Search device brands and models' : orderType === 'repairs' ? 'Search repair services' : 'Search wholesale services'}
								/>
								{(orderType === 'wholesale' ? wholesaleSearch : searchQuery) && (
									<button className="text-xs font-semibold text-sky-400 hover:text-white" type="button" onClick={() => orderType === 'wholesale' ? setWholesaleSearch('') : setSearchQuery('')}>
										Clear
									</button>
								)}
							</label>

							{orderType === 'wholesale' ? (
								<div className="rounded-2xl border border-[#243f70] bg-[#091835] p-4 sm:p-6">
									<div className="mb-5 flex flex-col gap-3 border-b border-blue-300/15 pb-4 sm:flex-row sm:items-end sm:justify-between">
										<div>
											<p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-sky-400">Official unlock & service portal</p>
											<h3 className="text-xl font-bold text-white">Available models &amp; services</h3>
											<p className="mt-1 text-xs text-slate-400">Search the catalog or choose a tag to narrow the results.</p>
										</div>
										<span className="w-fit rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
											{filteredWholesaleServices.length} {filteredWholesaleServices.length === 1 ? 'service' : 'services'}
										</span>
									</div>
									<div className="mb-5">
										<div className="mb-2 flex items-center justify-between gap-3">
											<p className="text-[10px] font-bold tracking-wider text-slate-400">FILTER BY MODEL OR SERVICE</p>
											<button
												className="text-xs font-semibold text-sky-300 hover:text-white"
												type="button"
												onClick={() => { setWholesaleTag(null); setWholesaleSearch(''); }}
											>
												Reset filters
											</button>
										</div>
										<div className="flex flex-wrap gap-2">
											{wholesaleTags.map((tag) => {
												const isHighlighted = highlightedWholesaleTags.has(tag);
												const isSelected = wholesaleTag === tag;
												return (
													<button
														className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${isSelected ? 'border-sky-400 bg-sky-500 text-[#03142a]' : isHighlighted ? 'border-amber-400/50 bg-amber-400/10 text-amber-100 hover:border-amber-300' : 'border-[#294572] bg-[#07142e] text-slate-300 hover:border-sky-400 hover:text-white'}`}
														key={tag}
														type="button"
														aria-pressed={isSelected}
														onClick={() => setWholesaleTag(isSelected ? null : tag)}
													>
														{tag}
													</button>
												);
											})}
										</div>
									</div>
									{filteredWholesaleServices.length ? (
										<div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
											{filteredWholesaleServices.map((service) => (
												<article className="flex min-w-0 flex-col rounded-xl border border-[#294572] bg-[#07142e] p-4 transition hover:border-sky-500/60" key={service.id}>
													{service.logo && (
														<div className="mb-3 flex h-20 items-center justify-center rounded-lg border border-[#16466d] bg-[#050d22] p-2">
															<img src={service.logo} alt={`${service.title} logo`} className="h-full w-full object-contain" loading="lazy" />
														</div>
													)}
													<div className="mb-2 flex items-center justify-between gap-3">
														<span className={`rounded px-2 py-1 text-[9px] font-extrabold tracking-wide ${service.status === 'INSTANT' ? 'bg-emerald-400/15 text-emerald-200' : service.status === 'EXPRESS' ? 'bg-sky-400/15 text-sky-200' : service.status === 'HOT' ? 'bg-amber-400/15 text-amber-200' : service.status === 'SPECIAL' ? 'bg-rose-400/15 text-rose-200' : 'bg-violet-400/15 text-violet-200'}`}>
															{service.status}
														</span>
														<span className="text-[11px] text-slate-400">{service.time}</span>
													</div>
													<p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{service.category}</p>
													<h4 className="text-sm font-bold leading-snug text-slate-100">{service.title}</h4>
													<p className="mt-2 flex-1 text-xs leading-5 text-slate-400">{service.description}</p>
													<div className="mt-3 flex flex-wrap gap-1.5 border-t border-blue-300/10 pt-3">
														{service.tags.map((tag) => (
															<span className="rounded bg-white/5 px-1.5 py-1 text-[9px] text-slate-400" key={tag}>{tag}</span>
														))}
													</div>
													<div className="mt-3 flex items-center justify-between gap-3">
														<span className="text-xs font-semibold text-slate-300">
															{service.requestOnly
																? <>Price <strong className="text-sky-300">{service.price.toFixed(4)} USD / check</strong></>
																: <>Price <strong className="text-sky-300">{formatPrice(service.price)} USD</strong></>}
														</span>
														{service.requestOnly ? (
															<a
																className="inline-flex min-h-9 items-center rounded-lg border border-sky-500 px-3 text-xs font-bold text-sky-200 transition hover:bg-sky-500/10"
																href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hello, I would like to request a Google Pixel information check. Listed price: $${service.price.toFixed(4)} per check.`)}`}
																target="_blank"
																rel="noopener noreferrer"
															>
																Request check
															</a>
														) : (
															<button
																className="min-h-9 rounded-lg bg-sky-500 px-3 text-xs font-bold text-[#03142a] transition hover:bg-sky-300"
																type="button"
																onClick={() => addWholesaleService(service)}
															>
																Add to cart
															</button>
														)}
													</div>
												</article>
											))}
										</div>
									) : (
										<div className="rounded-xl border border-blue-300/15 bg-[#07142e] p-7 text-center" role="status">
											<p className="text-sm font-semibold text-slate-200">No matching models or services found</p>
											<p className="mt-1 text-xs text-slate-400">Try another search or reset your filters.</p>
										</div>
									)}
								</div>
							) : orderType === 'devices' ? (
								filteredBrands.length ? (
									<div className="space-y-7" aria-live="polite">
										{filteredBrands.map((brand) => {
											const isDropdownModelGroup = ['iPhone', 'iPad', 'Apple Watch', 'Samsung', 'Samsung JDM Devices', 'Tecno', 'Xiaomi'].includes(brand.name);
											const deviceRows = (
												<div className="divide-y divide-blue-300/10">
													{brand.devices.map((device) => (
														<article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3" key={device.id}>
															<div className="min-w-0">
																<h4 className="font-semibold text-slate-100">{device.name}</h4>
																<p className="mt-1 text-xs text-slate-400">
																	{device.price === null ? 'Contact for price' : `${formatPrice(device.price)} USD`}
																</p>
															</div>
															<button
																className="row-span-2 min-h-9 shrink-0 rounded-lg border border-sky-800 bg-[#092342] px-3 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-[#0d3458] sm:px-4 sm:text-sm"
																type="button"
																onClick={() => addDevice(brand.name, device)}
																aria-label={`Add ${brand.name} ${device.name}${device.price === null ? '' : ` for ${formatPrice(device.price)}`}`}
															>
																+ Add to cart
															</button>
															<label className="col-span-2 grid gap-1 text-[11px] font-medium text-slate-400">
																IMEI / Serial number
																<input
																	className="h-9 w-full rounded-lg border border-[#294572] bg-[#07142e] px-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
																	autoComplete="off"
																	name={`identifier-${device.id}`}
																	placeholder={`Enter ${device.name} IMEI or serial number (optional)`}
																	value={deviceIdentifiers[device.id] ?? ''}
																	onChange={(event) => updateDeviceIdentifier(device.id, event.target.value)}
																/>
															</label>
														</article>
													))}
												</div>
											);

											return (
												<div key={brand.name}>
													{isDropdownModelGroup ? (
														<details className="group" open={normalizedQuery.length > 0}>
															<summary className="mb-2 flex cursor-pointer items-center justify-between border-b border-blue-300/15 pb-2 text-lg font-bold marker:text-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
																<span>{brand.name}</span>
																<span className="text-xs font-normal text-slate-500">{brand.devices.length} models</span>
															</summary>
															{deviceRows}
														</details>
													) : (
														<>
															<div className="mb-2 flex items-center justify-between border-b border-blue-300/15 pb-2">
																<h3 className="text-lg font-bold">{brand.name}</h3>
																<span className="text-xs text-slate-500">{brand.devices.length} models</span>
															</div>
															{deviceRows}
														</>
													)}
												</div>
											);
										})}
									</div>
								) : (
									<p className="rounded-xl border border-blue-300/15 bg-[#091835] p-6 text-center text-sm text-slate-400" role="status">
										No devices match “{searchQuery}”. Try another brand or model.
									</p>
								)
							) : filteredServices.length ? (
								<div className="space-y-8" aria-live="polite">
									{filteredSamsungFrpServices.length > 0 && (
										<section aria-labelledby="samsung-frp-title" className="space-y-2">
											<div className="border-b border-blue-300/15 pb-2">
												<p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Dedicated</p>
												<h3 className="text-base font-bold" id="samsung-frp-title">Samsung FRP</h3>
											</div>
											{renderRepairServices(filteredSamsungFrpServices)}
										</section>
									)}
									{filteredGameRepairServices.length > 0 && (
										<section aria-labelledby="game-repair-title" className="space-y-2">
											<div className="border-b border-blue-300/15 pb-2">
												<p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Console</p>
												<h3 className="text-base font-bold" id="game-repair-title">Game & Controller Repair</h3>
											</div>
											{renderRepairServices(filteredGameRepairServices)}
										</section>
									)}
									{filteredComputerRepairServices.length > 0 && (
										<section aria-labelledby="computer-repair-title" className="space-y-2">
											<div className="border-b border-blue-300/15 pb-2">
												<p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Computer</p>
												<h3 className="text-base font-bold" id="computer-repair-title">PC & Laptop Repair</h3>
											</div>
											{renderRepairServices(filteredComputerRepairServices)}
										</section>
									)}
									{filteredCameraServices.length > 0 && (
										<section aria-labelledby="camera-repair-title" className="space-y-2">
											<div className="border-b border-blue-300/15 pb-2">
												<p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Local service</p>
												<h3 className="text-base font-bold" id="camera-repair-title">Security Camera Services</h3>
												<p className="mt-1 text-xs text-slate-400">Montego Bay · Hopewell · Sandy Bay · Lucea</p>
											</div>
											{renderRepairServices(filteredCameraServices)}
										</section>
									)}
									{filteredOtherServices.length > 0 && (
										<section aria-labelledby="other-repairs-title" className="space-y-2">
											<h3 className="border-b border-blue-300/15 pb-2 text-base font-bold" id="other-repairs-title">Other Services</h3>
											{renderRepairServices(filteredOtherServices)}
										</section>
									)}
								</div>) : (
								<p className="rounded-xl border border-blue-300/15 bg-[#091835] p-6 text-center text-sm text-slate-400" role="status">
									No repair services match “{searchQuery}”.
								</p>
							)}

							<section className="mt-12 border-t border-blue-300/15 pt-8" aria-labelledby="server-credits-title">
								<div className="mb-5">
									<p className="mb-2 text-[11px] font-bold tracking-[.17em] text-sky-400">SOFTWARE & LICENSES</p>
									<h2 className="text-2xl font-bold leading-tight sm:text-3xl" id="server-credits-title">Server Credits for Box/Dongle</h2>
									<p className="mt-2 text-sm leading-6 text-slate-400">Choose an offer to view its details. EFT Tool and UnlockTool prices are shown up front; other service pricing is confirmed by our team.</p>
								</div>
								<div className="grid gap-3">
									{serverCreditServices.map((service) => {
										const selectedDuration = creditSelections[service.id] ?? '';
										const quantity = creditQuantities[service.id] ?? '1';
										const quantityValue = Number(quantity);
										const toolEmail = creditTargets[service.id]?.trim() ?? '';
										const selectedProduct = service.products?.find((product) => product.id === selectedDuration);
										const validToolEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toolEmail);
										const canAddSelection = service.selectionType === 'duration'
											? selectedDuration.length > 0
											: service.selectionType === 'quantity'
												? Number.isInteger(quantityValue) && quantityValue > 0
												: true;
										const canAdd = canAddSelection
											&& (!service.requiresToolEmail || validToolEmail);

										return (
											<article className="rounded-xl border border-[#243f70] bg-[#091835] p-4" key={service.id}>
												<div className="mb-4 flex items-center gap-3">
													{service.logo ? (
														<img src={service.logo} alt={`${service.name} logo`} className="h-12 w-12 shrink-0 rounded-lg border border-[#16466d] bg-[#07142e] p-1 object-contain" />
													) : (
														<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#16466d] bg-[#0a1d3a] text-xs font-bold tracking-wide text-sky-300" aria-hidden="true">
															{service.name.split(' ').map((word) => word[0]).join('').slice(0, 3).toUpperCase()}
														</span>
													)}
													<h3 className="font-semibold text-slate-100">{service.name}</h3>
												</div>
												<div className="grid grid-cols-1 gap-3">
													{service.products ? (
														selectedProduct ? (
															<div className="overflow-hidden rounded-xl border border-[#294572] bg-[#07142e]">
																<button
																	className="flex items-center gap-2 border-b border-[#294572] px-4 py-3 text-sm font-semibold text-slate-300 transition hover:text-white"
																	type="button"
																	onClick={() => setCreditSelections((current) => ({ ...current, [service.id]: '' }))}
																>
																	<span aria-hidden="true">←</span> Back to Products
																</button>
																<div className="relative overflow-hidden bg-black">
																	<img src={selectedProduct.image} alt={`${service.name} logo`} className="mx-auto h-56 w-full bg-[#07142e] p-5 object-contain sm:h-72" loading="lazy" />
																</div>
																<div className="grid gap-4 p-4">
																	<div className="flex items-start justify-between gap-3">
																		<div>
																			<h4 className="text-xl font-semibold leading-tight text-white">{selectedProduct.name}</h4>
																			<p className="mt-2 text-sm text-slate-400">{selectedProduct.description}</p>
																		</div>
																	</div>
																	<div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
																		<span className="rounded bg-orange-500 px-2.5 py-1 text-white">Server Service</span>
																		<span className="rounded border border-[#294572] px-2.5 py-1 text-slate-300">Digital</span>
																		<span className="rounded border border-emerald-500/70 px-2.5 py-1 text-emerald-300">In Stock</span>
																	</div>
																	<div className="flex items-center gap-2 text-xs text-slate-400">
																		<svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
																			<path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v10H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
																		</svg>
																		<span>Delivery Time: {selectedProduct.deliveryTime}</span>
																	</div>
																	<p className="text-3xl font-bold text-white">{formatPrice(selectedProduct.price)} USD</p>
																	<p className="text-sm leading-relaxed text-slate-300">{selectedProduct.summary}</p>
																	<div className="flex items-center gap-3 pt-2">
																		<button
																			className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-sky-500 text-sky-300 transition hover:bg-sky-500/10"
																			type="button"
																			aria-label={`Add ${selectedProduct.name} to cart`}
																			onClick={() => addServerCredit(service)}
																		>
																			<svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
																				<path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.2 11h10.9l2-8H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
																			</svg>
																		</button>
																		<button
																			className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-sky-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
																			type="button"
																			onClick={() => {
																				addServerCredit(service);
																				document.getElementById('summary-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
																			}}
																		>
																			<svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
																				<path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.2 11h10.9l2-8H6M9 20a1 1 0 1 0 0-2 2 2 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 2 2 0 0 0 0 2Z" />
																			</svg>
																			Buy Now
																		</button>
																	</div>
																	<div className="mt-2 flex flex-col gap-3 border-t border-[#294572] pt-5">
																		<h5 className="text-lg font-bold text-sky-300">Description</h5>
																		<h6 className="text-xl font-bold text-white">{selectedProduct.name}</h6>
																		<p className="text-sm leading-relaxed text-slate-300">{selectedProduct.fullDescription}</p>
																	</div>
																</div>
															</div>
														) : (
															<div className="grid gap-3">
																<h4 className="text-lg font-bold text-slate-100">{service.name} Services</h4>
																{service.products.map((product) => (
																	<button
																		className={`flex min-h-24 items-center gap-4 rounded-xl border p-3 text-left transition hover:border-sky-400 hover:bg-white/5 ${product.highlighted ? 'border-slate-400 bg-slate-200/10' : 'border-[#294572] bg-[#07142e]'}`}
																		type="button"
																		key={product.id}
																		onClick={() => setCreditSelections((current) => ({ ...current, [service.id]: product.id }))}
																	>
																		<img src={product.image} alt={`${service.name} logo`} className="h-16 w-16 shrink-0 rounded-lg border border-[#16466d] bg-[#07142e] p-1 object-contain" loading="lazy" />
																		<span className="min-w-0 flex-1">
																			<span className="block truncate text-sm font-bold text-white">{product.name}</span>
																			<span className="my-0.5 block truncate text-xs text-slate-400">{product.description}</span>
																			<strong className="block text-base text-sky-300">{formatPrice(product.price)} USD</strong>
																		</span>
																		<span aria-hidden="true" className="text-xl text-slate-400">›</span>
																	</button>
																))}
															</div>
														)
													) : service.selectionType === 'duration' ? (
														<label className="grid gap-1.5 text-xs font-medium text-slate-300">
															Duration / license type
															<select
																className="h-10 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none focus:border-sky-400"
																value={selectedDuration}
																onChange={(event) => setCreditSelections((current) => ({ ...current, [service.id]: event.target.value }))}
															>
																<option value="">Select duration / license type</option>
																{service.options?.map((option) => <option key={option} value={option}>{option}</option>)}
															</select>
														</label>
													) : service.selectionType === 'quantity' ? (
														<label className="grid gap-1.5 text-xs font-medium text-slate-300">
															Credit quantity
															<input
																className="h-10 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none focus:border-sky-400"
																type="number"
																min="1"
																step="1"
																inputMode="numeric"
																value={quantity}
																onChange={(event) => setCreditQuantities((current) => ({ ...current, [service.id]: event.target.value }))}
															/>
														</label>
													) : (
														<p className="rounded-lg border border-[#294572] bg-[#07142e] px-3 py-2.5 text-sm text-slate-400">
															{service.requestDescription ?? 'Submit a service request. The team will confirm availability and pricing.'}
														</p>
													)}
													{!service.products && (
														<label className="grid gap-1.5 text-xs font-medium text-slate-300">
															{service.targetLabel}{service.requiresToolEmail && <span className="text-red-300">Required</span>}
															<input
																className="h-10 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
																type={service.requiresToolEmail ? 'email' : 'text'}
																autoComplete={service.requiresToolEmail ? 'email' : 'off'}
																placeholder={service.requiresToolEmail ? 'Enter the email registered to this tool' : 'Enter target details (optional)'}
																required={service.requiresToolEmail}
																value={creditTargets[service.id] ?? ''}
																onChange={(event) => setCreditTargets((current) => ({ ...current, [service.id]: event.target.value }))}
															/>
														</label>
													)}
												</div>
												{!service.products && <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
													<p className={`text-sm font-semibold ${service.products ? 'text-sky-300' : 'text-amber-200'}`}>
														{service.products ? (selectedProduct ? `${formatPrice(selectedProduct.price)} USD selected` : 'Select an offer to see details') : 'Contact for price/payment'}
													</p>
													<button
														className="min-h-9 rounded-lg border border-sky-800 bg-[#092342] px-4 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-[#0d3458] disabled:cursor-not-allowed disabled:opacity-50"
														type="button"
														disabled={!canAdd}
														onClick={() => addServerCredit(service)}
													>
														Add to cart
													</button>
												</div>}
											</article>
										);
									})}
								</div>
							</section>
						</section>

						<aside id="checkout-summary" className="rounded-2xl border border-[#243f70] bg-[#091835] p-5 shadow-xl lg:sticky lg:top-24" aria-labelledby="summary-title">
							<div className="flex items-center justify-between">
								<div>
									<p className="mb-1 text-[10px] font-bold tracking-[.16em] text-sky-400">YOUR REQUEST</p>
									<h2 className="text-xl font-bold" id="summary-title">Order summary</h2>
								</div>
								<span className="grid h-9 min-w-9 place-items-center rounded-lg border border-[#16466d] bg-[#071a34] px-2 text-sm font-bold text-sky-400" aria-label={`${cart.length} items`}>
									{cart.length.toString().padStart(2, '0')}
								</span>
							</div>

							{cart.length === 0 ? (
								<div className="grid min-h-32 place-items-center py-5 text-center text-sm leading-6 text-slate-500">
									<div><span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border border-[#243f70] text-slate-400"><DeviceIcon /></span>
										Your selected devices and<br />services will appear here.
									</div>
								</div>
							) : (
								<ul className="my-4 max-h-60 divide-y divide-blue-300/10 overflow-y-auto">
									{cart.map((item, index) => (
										<li className="flex items-center justify-between gap-3 py-3" key={`${item.kind}-${item.id}-${index}`}>
											<div className="min-w-0">
												<p className="break-words text-sm text-slate-200">{item.name}</p>
												<p className="mt-1 text-xs text-slate-500">{item.price === null ? 'Contact for price' : `${formatPrice(item.price)} USD`}</p>
												{item.identifier && <p className="mt-1 break-all text-xs text-slate-500">{item.kind === 'credits' ? 'Account details: ' : 'IMEI / Serial: '}{item.identifier}</p>}
											</div>
											<button
												className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#294572] text-slate-400 transition hover:border-red-400 hover:text-red-300"
												type="button"
												onClick={() => removeFromCart(index)}
												aria-label={`Remove ${item.name}`}
											>
												<TrashIcon />
											</button>
										</li>
									))}
								</ul>
							)}

							{hasRepairs && (
								<div className="flex items-center justify-between border-t border-blue-300/15 py-4">
									<span className="text-sm text-slate-400">Repair services total</span>
									<strong>{formatPrice(repairTotal)} <small className="text-xs font-normal text-slate-500">USD</small></strong>
								</div>
							)}
							{hasDevices && (
								<div className={`flex items-center justify-between ${hasRepairs ? '' : 'border-t border-blue-300/15'} py-4`}>
									<span className="text-sm text-slate-400">Device total</span>
									<strong>{formatPrice(deviceTotal)} <small className="text-xs font-normal text-slate-500">USD</small></strong>
								</div>
							)}
							{hasWholesale && (
								<div className={`flex items-center justify-between ${hasDevices || hasRepairs ? '' : 'border-t border-blue-300/15'} py-4`}>
									<span className="text-sm text-slate-400">Wholesale services total</span>
									<strong>{formatPrice(wholesaleTotal)} <small className="text-xs font-normal text-slate-500">USD</small></strong>
								</div>
							)}
							{(hasDevices || hasRepairs || hasCredits || hasWholesale) && (
								<>
									<div className="my-2 flex items-center justify-between gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-4" aria-live="polite">
										<span className="text-sm font-semibold text-slate-100">
											Checkout total <small className="mt-1 block text-xs font-normal text-slate-400">{cart.length} {cart.length === 1 ? 'item' : 'items'}</small>
										</span>
										<strong className="text-right text-xl text-sky-300">
											{formatPrice(orderTotal)}
											<small className="text-xs font-normal text-slate-400"> USD</small>
										</strong>
									</div>
									{hasUnpricedDevices && (
										<p className="mb-3 text-xs leading-5 text-amber-200" role="status">
											{unpricedDeviceCount} device {unpricedDeviceCount === 1 ? 'price is' : 'prices are'} pending confirmation and {unpricedDeviceCount === 1 ? 'is' : 'are'} not included in this total.
										</p>
									)}
									{hasUnpricedRepairs && (
										<p className="mb-3 text-xs leading-5 text-amber-200" role="status">
											Repair service prices pending confirmation are excluded from the checkout total.
										</p>
									)}
									{hasCredits && (
										<p className="mb-3 text-xs leading-5 text-amber-200" role="status">
											{hasUnpricedCredits ? 'Unpriced server-credit requests need a separate price confirmation. Priced tool-credit packages are included in the total.' : 'Priced tool-credit packages are included in the checkout total.'}
										</p>
									)}
								</>
							)}

							{cart.length > 0 && (
								<div className="grid gap-2">
									<label className="text-xs font-semibold text-slate-300" htmlFor="paymentMethod">Select payment method</label>
									<select
										className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none focus:border-sky-400"
										id="paymentMethod"
										name="paymentMethod"
										value={paymentMethod}
										onChange={(event) => {
											const value = event.target.value;
											setPaymentMethod(value === 'payoneer' || value === 'wipay' || value === 'paypal' || value === 'wallet' || value === 'crypto' ? value : 'local');
										}}
									>
										<option value="local">Local transfer</option>
										<option value="crypto">USDT / Binance Pay (Pending Verification)</option>
										<option value="payoneer">Payoneer payment link</option>
										<option value="wipay">WiPay</option>
										<option value="paypal">PayPal</option>
										<option value="wallet">Wallet credit</option>
									</select>
									{paymentMethod === 'crypto' && (
										<div className="grid gap-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
											<div>
												<p className="text-sm font-bold text-amber-100">Crypto payment — manual verification</p>
										<p className="mt-1 text-xs leading-5 text-amber-100/80">Send <strong>{formatPrice(orderTotal)} USDT</strong> using TRC20 or Binance Pay, then enter the transaction ID below. Orders remain Pending Verification until payment is checked. A submitted TXID is not proof of payment.</p>
											</div>
											<div className="grid gap-2 rounded-lg border border-amber-300/15 bg-[#07142e] p-3 text-xs">
												<p><span className="text-slate-400">USDT network:</span> <strong className="text-white">{cryptoPayment.usdtNetwork}</strong></p>
												<p className="break-all"><span className="text-slate-400">USDT address:</span> <strong className="text-white">{cryptoPayment.usdtAddress}</strong></p>
												<p className="break-all"><span className="text-slate-400">Binance Pay ID:</span> <strong className="text-white">{cryptoPayment.binancePayId}</strong></p>
											</div>
											{!cryptoPayment.qrImagePath.includes('UPDATE_WITH') && (
												<img className="mx-auto max-h-48 rounded-lg bg-white p-2" src={cryptoPayment.qrImagePath} alt="USDT TRC20 payment QR code" />
											)}
											{cryptoPayment.qrImagePath.includes('UPDATE_WITH') && (
												<p className="text-center text-xs text-slate-400">Add your QR image in src/data/cryptoPayment.ts to display it here.</p>
											)}
											{(cryptoPayment.usdtAddress.startsWith('YOUR_') || cryptoPayment.binancePayId.startsWith('YOUR_')) && (
												<p className="rounded border border-amber-500/30 p-2 text-xs text-amber-100" role="status">Replace the crypto payment placeholders in src/data/cryptoPayment.ts before accepting payment.</p>
											)}
											{cart.some((item) => item.price === null) && (
												<p className="rounded border border-amber-500/30 p-2 text-xs text-amber-100" role="status">One or more cart items need a confirmed price before crypto payment can be submitted.</p>
											)}
											<label className="grid gap-2 text-xs font-semibold text-slate-300">
												Transaction ID (TXID) / Binance Pay ID
												<input
													className="h-11 rounded-lg border border-[#294572] bg-[#081630] px-3 text-sm text-white outline-none focus:border-sky-400"
													autoComplete="off"
													maxLength={200}
													minLength={6}
													required
													value={cryptoTxid}
													onChange={(event) => setCryptoTxid(event.target.value)}
													placeholder="Enter the transaction reference after sending payment"
												/>
											</label>
										</div>
									)}
										{paymentMethod === 'paypal' && (
											<p className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs leading-5 text-blue-100" role="status">
												Sign in or create an account here so your order can be saved. Then continue to PayPal to sign in or create a PayPal account and approve payment. You’ll return here after approval.
											</p>
										)}
										{paymentMethod === 'payoneer' && (
											<p className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-xs leading-5 text-orange-100" role="status">
												Payoneer links can expire. Send your order request and we’ll provide a current payment link. No payment is collected here.
											</p>
										)}
										{paymentMethod === 'wipay' && (
											<p className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs leading-5 text-sky-100" role="status">
												Select WiPay to request current payment instructions after you send your order. No payment is collected here.
											</p>
										)}
										{paymentMethod === 'wallet' && (
										<p className="rounded-lg border border-sky-800/70 bg-sky-950/30 p-3 text-xs leading-5 text-sky-100" role="status">
											{user
												? `Available balance: ${formatWalletBalance(walletBalance)}. The server will verify catalog prices and balance before payment.`
												: 'Sign in to pay from your wallet.'}
												{(hasUnpricedDevices || hasUnpricedRepairs || hasUnpricedCredits) && ' Items without confirmed prices cannot be paid from the wallet; request a quote separately.'}
										</p>
									)}
									{paymentMethod === 'local' && (
										<div className="flex gap-2" aria-label="Choose local transfer method">
											{(['lynk', 'ncb', 'scotiabank'] as const).map((rail) => (
												<button
													className={`min-h-8 rounded-md border px-3 text-xs font-semibold ${localRail === rail ? 'border-sky-600 bg-sky-950 text-sky-200' : 'border-[#294572] text-slate-400 hover:text-white'}`}
													key={rail}
													type="button"
													aria-pressed={localRail === rail}
													onClick={() => setLocalRail(rail)}
												>
													{rail === 'scotiabank' ? 'Scotia' : rail.toUpperCase()}
												</button>
											))}
										</div>
									)}
								</div>
							)}
							{guestCheckout && !user && (
								<p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-100" role="status">
									Guest checkout sends your request to WhatsApp and does not save it to account history. PayPal, crypto, and wallet payments require sign-in.
								</p>
							)}
							<fieldset className="mb-5 grid gap-3 rounded-xl border border-blue-300/15 p-3">
								<legend className="px-1 text-sm font-bold text-slate-100">Customer information</legend>
								<label className="grid gap-2 text-xs font-semibold text-slate-300">
									Full name
									<input
										className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
										autoComplete="name"
										name="customerName"
										placeholder="e.g. Jordan Brown"
										required
										value={customerName}
										onChange={(event) => setCustomerName(event.target.value)}
									/>
								</label>
								{paymentMethod === 'payoneer' && (
									<>
										<label className="grid gap-2 text-xs font-semibold text-slate-300">
											Email address for Payoneer
											<input
												className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
												autoComplete="email"
												name="customerEmail"
												type="email"
												placeholder="you@example.com"
												required
												value={customerEmail}
												onChange={(event) => setCustomerEmail(event.target.value)}
											/>
										</label>
										<label className="grid gap-2 text-xs font-semibold text-slate-300">
											Phone number for Payoneer
											<input
												className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
												autoComplete="tel"
												name="customerPhone"
												type="tel"
												placeholder="+1 876 555 0123"
												required
												value={customerPhone}
												onChange={(event) => setCustomerPhone(event.target.value)}
											/>
										</label>
									</>
								)}
								<label className="grid gap-2 text-xs font-semibold text-slate-300">
									Street address
									<input
										className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
										autoComplete="street-address"
										name="address"
										placeholder="Street address, apartment or unit"
										required
										value={address}
										onChange={(event) => setAddress(event.target.value)}
									/>
								</label>
								<label className="grid gap-2 text-xs font-semibold text-slate-300">
									Country
									<select
										className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none focus:border-sky-400"
										autoComplete="country-name"
										name="country"
										required
										value={country}
										onChange={(event) => setCountry(event.target.value)}
									>
										<option value="" disabled>Select your country</option>
										{countries.map((countryName) => <option key={countryName} value={countryName}>{countryName}</option>)}
									</select>
								</label>
								<label className="grid gap-2 text-xs font-semibold text-slate-300">
									State / Parish / Province
									<input
										className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
										autoComplete="address-level1"
										name="stateRegion"
										placeholder="State, parish or province"
										required
										value={stateRegion}
										onChange={(event) => setStateRegion(event.target.value)}
									/>
								</label>
								<label className="grid gap-2 text-xs font-semibold text-slate-300">
									ZIP / Postal code or PO Box
									<input
										className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
										autoComplete="postal-code"
										name="postalCode"
										placeholder="ZIP code, postal code or PO Box"
										required
										value={postalCode}
										onChange={(event) => setPostalCode(event.target.value)}
									/>
								</label>
							</fieldset>

							<label className="mb-4 grid gap-2 text-xs font-semibold text-slate-300">
								{hasRepairs
									? cart.some((item) => item.id === 'camera-installation' || item.id === 'camera-troubleshooting')
										? 'Camera system details / issue'
										: 'Device model for repair'
									: 'Custom notes / specifications'}
								<input
									className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
									name="deviceModel"
									placeholder={cart.some((item) => item.id === 'camera-installation' || item.id === 'camera-troubleshooting')
										? 'Camera brand, number of cameras, or issue to troubleshoot'
										: hasRepairs ? 'e.g. iPhone 13 Pro' : 'e.g. preferred color or storage'}
									required={hasRepairs}
									value={deviceModel}
									onChange={(event) => setDeviceModel(event.target.value)}
								/>
							</label>



							<button
								className={`mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 ${paymentMethod === 'wallet' ? 'bg-sky-500 text-[#03142a] hover:bg-sky-300' : 'bg-[#27ce79] text-[#032216] hover:bg-[#43e28f]'}`}
								type="submit"
								disabled={cart.length === 0 || checkoutBusy}
							>
								<span>{checkoutBusy ? 'Processing…' : paymentMethod === 'wallet' ? 'Pay with wallet credit' : paymentMethod === 'crypto' ? 'Submit for payment verification' : paymentMethod === 'payoneer' ? 'Request Payoneer payment link' : paymentMethod === 'wipay' ? 'Request WiPay payment instructions' : hasWholesale ? 'Send service request' : hasDevices && hasRepairs ? 'Send combined request' : hasDevices ? 'Enquire on WhatsApp' : 'Send repair request'}</span>
								<ArrowIcon />
							</button>
							{checkoutNotice && (
								<p className={`mt-3 rounded-lg p-3 text-center text-xs leading-5 ${checkoutNotice.includes('successfully') || checkoutNotice.includes('saved to account') ? 'bg-emerald-950/40 text-emerald-200' : 'bg-amber-950/40 text-amber-100'}`} role="status">
									{checkoutNotice}
								</p>
							)}
							<p className="mt-3 text-center text-[11px] text-slate-500">
								{paymentMethod === 'wallet' ? 'Wallet orders are priced and charged securely on the server.' : paymentMethod === 'crypto' ? 'Crypto orders remain pending until an administrator verifies the transaction.' : paymentMethod === 'payoneer' ? 'A current Payoneer link will be provided after you send your order request.' : paymentMethod === 'wipay' ? 'Current WiPay payment instructions will be provided after you send your order request.' : 'No payment is collected here.'}
							</p>
						</aside>
					</div>
				</form>

				<section className="mt-16 grid gap-8 rounded-2xl border border-blue-300/15 bg-[#091835] p-8 md:grid-cols-2">
					<div>
						<p className="mb-1 text-xs font-bold tracking-[.16em] text-sky-400">ABOUT US</p>
						<h2 className="mb-4 text-2xl font-bold">Exclusive Mobile Solutions</h2>
						<p className="leading-relaxed text-slate-400">
							We're your trusted local mobile specialists. From brand-new devices to professional repair services and software tools, we deliver comprehensive mobile solutions with expert support and competitive pricing. Device care, done right.
						</p>
					</div>
					<div>
						<p className="mb-1 text-xs font-bold tracking-[.16em] text-sky-400">GET IN TOUCH</p>
						<h3 className="mb-4 text-xl font-bold">Contact Us</h3>
						<div className="space-y-3">
							<div>
								<p className="text-xs font-semibold text-slate-300">Email</p>
								<a
									href="mailto:info@exclusivemobilesolutions.com"
									className="text-sm text-sky-400 transition hover:text-sky-300"
								>
									info@exclusivemobilesolutions.com
								</a>
							</div>
							<div>
								<p className="text-xs font-semibold text-slate-300">WhatsApp Support</p>
								<a
									href={`https://wa.me/${whatsappNumber}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm text-sky-400 transition hover:text-sky-300"
								>
									Chat with us on WhatsApp
								</a>
							</div>
							<div>
								<p className="text-xs font-semibold text-slate-300">Telegram</p>
								<a
									href="https://t.me/techfix_pro"
									target="_blank"
									rel="noopener noreferrer"
									className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#229ED9] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1b85b8] focus:outline-none focus:ring-2 focus:ring-sky-300"
								>
									<svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
										<path strokeLinecap="round" strokeLinejoin="round" d="M21.8 4.2 18.5 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 13.5l-5-1.6c-1.1-.3-1.1-1.1.2-1.6L20.7 3c.9-.3 1.6.2 1.1 1.2Z" />
									</svg>
									Chat with us on Telegram
								</a>
							</div>
						</div>
					</div>
				</section>

				<footer className="pt-16 text-center text-[10px] font-bold tracking-[.16em] text-slate-600">
					EXCLUSIVE MOBILE SOLUTIONS <span className="px-2 text-sky-400">·</span> DEVICE CARE, DONE RIGHT
				</footer>
			</div>
			<a
				href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hello, I have a question about your services.')}`}
				target="_blank"
				rel="noopener noreferrer"
				className="fixed bottom-5 left-5 z-50 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-xl transition hover:scale-105 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-[#050d22]"
				aria-label="Chat with support on WhatsApp"
				title="Chat with support on WhatsApp"
			>
				<svg aria-hidden="true" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
					<path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
				</svg>
			</a>
			<a
				href="https://t.me/techfix_pro"
				target="_blank"
				rel="noopener noreferrer"
				className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#229ED9] text-white shadow-xl transition hover:scale-105 hover:bg-[#1b85b8] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-[#050d22]"
				aria-label="Chat with support on Telegram"
				title="Chat with support on Telegram"
			>
				<svg aria-hidden="true" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
					<path d="M21.8 4.2 18.5 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 13.5l-5-1.6c-1.1-.3-1.1-1.1.2-1.6L20.7 3c.9-.3 1.6.2 1.1 1.2Z" />
				</svg>
			</a>
		</main>
		);
}
