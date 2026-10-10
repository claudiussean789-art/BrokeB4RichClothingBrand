import { useState, type FormEvent } from 'react';

type OrderType = 'devices' | 'repairs';
type PaymentMethod = 'local' | 'payoneer';
type LocalRail = 'lynk' | 'ncb' | 'scotiabank';

type Device = {
	id: string;
	name: string;
	price: number;
};

type DeviceBrand = {
	name: string;
	devices: Device[];
};

type RepairService = {
	id: string;
	name: string;
	category: string;
	price: number;
};

type CartItem = {
	id: string;
	name: string;
	kind: OrderType;
	price: number;
	deviceFamily?: string;
};

const deviceBrands: DeviceBrand[] = [
	{
		name: 'iPhone',
		devices: [
			{ id: 'ip-14-pro', name: 'iPhone 14 Pro', price: 650 },
			{ id: 'ip-13', name: 'iPhone 13 - Grade A', price: 480 },
		],
	},
	{
		name: 'iPad',
		devices: [
			{ id: 'ipad-pro-13', name: 'iPad Pro 13-inch', price: 100 },
			{ id: 'ipad-pro-11', name: 'iPad Pro 11-inch', price: 100 },
			{ id: 'ipad-air-3', name: 'iPad Air (3rd Gen)', price: 38 },
			{ id: 'ipad-air-13', name: 'iPad Air 13-inch', price: 100 },
			{ id: 'ipad-air-11', name: 'iPad Air 11-inch', price: 100 },
			{ id: 'ipad-standard', name: 'iPad', price: 100 },
			{ id: 'ipad-mini-5', name: 'iPad mini 5', price: 30 },
		],
	},
	{
		name: 'Samsung',
		devices: [
			{ id: 'sam-s22', name: 'Galaxy S22 Ultra', price: 550 },
			{ id: 'sam-a54', name: 'Galaxy A54 5G', price: 310 },
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
	{ id: 'software', name: 'Software Flash / FRP', category: 'Software', price: 25 },
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
	new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);

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
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('local');
	const [localRail, setLocalRail] = useState<LocalRail>('lynk');
	const [customerName, setCustomerName] = useState('');
	const [address, setAddress] = useState('');
	const [country, setCountry] = useState('');
	const [postalCode, setPostalCode] = useState('');
	const [deviceModel, setDeviceModel] = useState('');
	const [ipadIdentifier, setIpadIdentifier] = useState('');

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

	const hasRepairs = cart.some((item) => item.kind === 'repairs');
	const hasDevices = cart.some((item) => item.kind === 'devices');
	const hasIpad = cart.some((item) => item.kind === 'devices' && item.deviceFamily === 'iPad');
	const deviceTotal = cart.reduce((sum, item) => sum + (item.kind === 'devices' ? item.price : 0), 0);
	const repairTotal = cart.reduce((sum, item) => sum + (item.kind === 'repairs' ? item.price : 0), 0);
	const orderTotal = deviceTotal + repairTotal;

	const addDevice = (brand: string, device: Device) =>
		setCart((current) => [...current, {
			id: device.id,
			name: device.name,
			kind: 'devices',
			price: device.price,
			deviceFamily: brand,
		}]);

	const addRepair = (service: RepairService) =>
		setCart((current) => [...current, {
			id: service.id,
			name: service.name,
			kind: 'repairs',
			price: service.price,
		}]);

	const removeFromCart = (index: number) =>
		setCart((current) => current.filter((_, itemIndex) => itemIndex !== index));

	const handleWhatsAppCheckout = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const devices = cart.filter((item) => item.kind === 'devices');
		const repairs = cart.filter((item) => item.kind === 'repairs');
		const payment = paymentMethod === 'local'
			? `Local Transfer (${localRail.toUpperCase()})`
			: 'Payoneer Link';
		const messageLines = [
			devices.length && repairs.length
				? '*EXCLUSIVE MOBILE SOLUTIONS - DEVICE PURCHASE AND REPAIR REQUEST*'
				: devices.length
					? '*EXCLUSIVE MOBILE SOLUTIONS - DEVICE PURCHASE*'
					: '*EXCLUSIVE MOBILE SOLUTIONS - REPAIR SERVICE ORDER*',
			`Customer Name: ${customerName}`,
					`Address: ${address}`,
					`Country: ${country}`,
					`ZIP / Postal Code / PO Box: ${postalCode}`,
		];

		if (deviceModel.trim()) messageLines.push(`Device model / notes: ${deviceModel.trim()}`);
		if (devices.length) {
			messageLines.push('', 'Selected devices:', ...devices.map((item) => `- ${item.name} (${formatPrice(item.price)} USD)`));
		}
		if (hasIpad && ipadIdentifier.trim()) {
			messageLines.push(`iPad IMEI / Serial number: ${ipadIdentifier.trim()}`);
		}
		if (repairs.length) {
			messageLines.push('', 'Repair services:', ...repairs.map((item) => `- ${item.name} (${formatPrice(item.price)} USD)`));
		}
		messageLines.push('', `Device total: ${formatPrice(deviceTotal)} USD`, `Repair services total: ${formatPrice(repairTotal)} USD`);
		messageLines.push(`Total amount: ${formatPrice(orderTotal)} USD`, `Payment method: ${payment}`);

		window.open(
			`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageLines.join('\n'))}`,
			'_blank',
			'noopener,noreferrer',
		);
	};

	return (
		<main className="min-h-screen bg-[#050d22] text-[#f4f7fc]">
			<header className="sticky top-0 z-10 border-b border-blue-300/15 bg-[#050d22]/95 backdrop-blur">
				<div className="mx-auto flex min-h-[76px] w-[min(100%-2rem,1160px)] items-center justify-between gap-4">
					<a className="flex items-center gap-3 text-sm font-bold tracking-wide text-white no-underline sm:text-base" href="#top">
						<span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-800 bg-[#071b39] text-sky-400">
							<WrenchIcon />
						</span>
						<span>EXCLUSIVE <strong className="text-sky-400">MOBILE SOLUTIONS</strong></span>
					</a>
					<span className="hidden text-xs font-bold tracking-[.15em] text-slate-400 sm:block">DEVICE CARE, DONE RIGHT</span>
				</div>
			</header>

			<div className="mx-auto w-[min(100%-2rem,1120px)] pb-8" id="top">
				<section className="py-12 sm:py-16" aria-labelledby="page-title">
					<p className="mb-4 text-xs font-bold tracking-[.2em] text-sky-400">YOUR LOCAL MOBILE SPECIALISTS</p>
					<h1 className="max-w-3xl text-5xl font-extrabold leading-[.98] sm:text-7xl" id="page-title">
						Devices and repairs,<br /><span className="text-sky-400">made simple.</span>
					</h1>
					<p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
						Choose a device or a repair service, then send your request straight to our team.
					</p>
				</section>

				<div className="mb-7 inline-flex w-full max-w-xl rounded-xl border border-blue-300/20 bg-[#091835] p-1.5" role="group" aria-label="Choose order type">
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
				</div>

				<form onSubmit={handleWhatsAppCheckout}>
					<div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_350px]">
						<section aria-labelledby="catalog-title">
							<div className="mb-5 flex items-end justify-between gap-4">
								<div>
									<p className="mb-2 text-[11px] font-bold tracking-[.17em] text-sky-400">{orderType === 'devices' ? 'SHOP DEVICES' : 'BOOK A REPAIR'}</p>
									<h2 className="text-3xl font-bold leading-tight sm:text-4xl" id="catalog-title">
										{orderType === 'devices' ? 'Find your next phone' : 'What can we fix?'}
									</h2>
								</div>
								<span className="hidden text-sm text-slate-500 sm:block">{orderType === 'devices' ? 'Browse by brand' : `${filteredServices.length} services`}</span>
							</div>

							<label className="mb-7 flex min-h-12 items-center gap-3 rounded-xl border border-[#294572] bg-[#07142e] px-4 text-slate-400 transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/15">
								<SearchIcon />
								<input
									className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 sm:text-base"
									type="search"
									value={searchQuery}
									onChange={(event) => setSearchQuery(event.target.value)}
									placeholder={orderType === 'devices' ? 'Search all brands and models...' : 'Search repair services...'}
									aria-label={orderType === 'devices' ? 'Search device brands and models' : 'Search repair services'}
								/>
								{searchQuery && (
									<button className="text-xs font-semibold text-sky-400 hover:text-white" type="button" onClick={() => setSearchQuery('')}>
										Clear
									</button>
								)}
							</label>

							{orderType === 'devices' ? (
								filteredBrands.length ? (
									<div className="space-y-7" aria-live="polite">
										{filteredBrands.map((brand) => (
											<div key={brand.name}>
												<div className="mb-2 flex items-center justify-between border-b border-blue-300/15 pb-2">
													<h3 className="text-lg font-bold">{brand.name}</h3>
													<span className="text-xs text-slate-500">{brand.devices.length} models</span>
												</div>
												<div className="divide-y divide-blue-300/10">
													{brand.devices.map((device) => (
														<article className="flex min-h-[76px] items-center gap-3 py-3" key={device.id}>
															<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#16466d] bg-[#0a1d3a] text-sky-400">
																<DeviceIcon />
															</span>
															<div className="min-w-0 flex-1">
																<h4 className="font-semibold text-slate-100">{device.name}</h4>
																<p className="mt-1 text-xs text-slate-500">{formatPrice(device.price)} USD</p>
															</div>
															<button
																className="min-h-9 shrink-0 rounded-lg border border-sky-800 bg-[#092342] px-3 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-[#0d3458] sm:px-4 sm:text-sm"
																type="button"
																onClick={() => addDevice(brand.name, device)}
																aria-label={`Add ${brand.name} ${device.name} for ${formatPrice(device.price)}`}
															>
																+ Add to cart
															</button>
														</article>
													))}
												</div>
											</div>
										))}
									</div>
								) : (
									<p className="rounded-xl border border-blue-300/15 bg-[#091835] p-6 text-center text-sm text-slate-400" role="status">
										No devices match “{searchQuery}”. Try another brand or model.
									</p>
								)
							) : filteredServices.length ? (
								<div className="divide-y divide-blue-300/10" aria-live="polite">
									{filteredServices.map((service) => (
										<article className="flex min-h-[82px] items-center gap-3 py-3" key={service.id}>
											<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#16466d] bg-[#0a1d3a] text-sky-400">
												<WrenchIcon />
											</span>
											<div className="min-w-0 flex-1">
												<p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">{service.category}</p>
												<h3 className="mt-1 text-sm font-semibold text-slate-100 sm:text-base">{service.name}</h3>
											</div>
											<div className="flex shrink-0 flex-col items-end gap-2">
												<strong className="text-sm">{formatPrice(service.price)}</strong>
												<button
													className="min-h-8 rounded-lg border border-sky-800 bg-[#092342] px-3 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-[#0d3458]"
													type="button"
													onClick={() => addRepair(service)}
													aria-label={`Add ${service.name} for ${formatPrice(service.price)}`}
												>
													Add service
												</button>
											</div>
										</article>
									))}
								</div>
							) : (
								<p className="rounded-xl border border-blue-300/15 bg-[#091835] p-6 text-center text-sm text-slate-400" role="status">
									No repair services match “{searchQuery}”.
								</p>
							)}
						</section>

						<aside className="rounded-2xl border border-[#243f70] bg-[#091835] p-5 shadow-xl lg:sticky lg:top-24" aria-labelledby="summary-title">
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
												<p className="mt-1 text-xs text-slate-500">{formatPrice(item.price)} USD</p>
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
							{(hasDevices || hasRepairs) && (
								<div className="flex items-center justify-between border-t border-blue-300/15 py-4">
									<span className="text-sm text-slate-300">Order total</span>
									<strong className="text-lg">{formatPrice(orderTotal)} <small className="text-xs font-normal text-slate-500">USD</small></strong>
								</div>
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
								{hasRepairs ? 'Device model for repair' : 'Custom notes / specifications'}
								<input
									className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
									name="deviceModel"
									placeholder={hasRepairs ? 'e.g. iPhone 13 Pro' : 'e.g. preferred color or storage'}
									required={hasRepairs}
									value={deviceModel}
									onChange={(event) => setDeviceModel(event.target.value)}
								/>
							</label>

							{hasIpad && (
								<label className="mb-4 grid gap-2 text-xs font-semibold text-slate-300">
									iPad IMEI / Serial number (optional)
									<input
										className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
										name="ipadIdentifier"
										placeholder="Enter the iPad IMEI or serial number"
										value={ipadIdentifier}
										onChange={(event) => setIpadIdentifier(event.target.value)}
									/>
									<span className="font-normal text-slate-500">Only share this identifier if you’re comfortable including it in your WhatsApp request.</span>
								</label>
							)}

							{cart.length > 0 && (
								<fieldset className="grid gap-2 border-0 p-0">
									<legend className="mb-2 text-xs font-semibold text-slate-300">Select payment method</legend>
									<label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-slate-200 has-[:checked]:border-sky-700">
										<input className="accent-sky-400" type="radio" name="paymentMethod" value="local" checked={paymentMethod === 'local'} onChange={() => setPaymentMethod('local')} />
										Local transfer
									</label>
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
									<label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-slate-200 has-[:checked]:border-sky-700">
										<input className="accent-sky-400" type="radio" name="paymentMethod" value="payoneer" checked={paymentMethod === 'payoneer'} onChange={() => setPaymentMethod('payoneer')} />
										Payoneer payment link
									</label>
								</fieldset>
							)}

							<button
								className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#27ce79] px-4 text-sm font-bold text-[#032216] transition hover:bg-[#43e28f] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
								type="submit"
								disabled={cart.length === 0}
							>
								<span>{hasDevices && hasRepairs ? 'Send combined request' : hasDevices ? 'Enquire on WhatsApp' : 'Send repair request'}</span>
								<ArrowIcon />
							</button>
							<p className="mt-3 text-center text-[11px] text-slate-500">
								No payment is collected here.
							</p>
						</aside>
					</div>
				</form>

				<footer className="pt-16 text-center text-[10px] font-bold tracking-[.16em] text-slate-600">
					EXCLUSIVE MOBILE SOLUTIONS <span className="px-2 text-sky-400">·</span> DEVICE CARE, DONE RIGHT
				</footer>
			</div>
		</main>
	);
}
