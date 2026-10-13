import { useCallback, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type OrderFulfillmentStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

type AdminCustomer = {
	full_name?: string;
	email?: string;
	phone?: string;
	address?: string;
	country?: string;
	state_region?: string;
	postal_code?: string;
	device_model?: string;
};

type AdminOrderItem = {
	id?: string;
	kind?: string;
	name?: string;
	unit_price?: number | string | null;
	identifier?: string | null;
};

type AdminOrder = {
	id: string;
	user_id?: string;
	items: AdminOrderItem[] | string | null;
	customer: AdminCustomer | string | null;
	total: number | string | null;
	currency?: string | null;
	payment_method?: string | null;
	status?: string | null;
	fulfillment_status?: string | null;
	payment_reference?: string | null;
	crypto_txid?: string | null;
	created_at: string;
};

type AdminPanelProps = {
	onBackToStore?: () => void;
};

const FULFILLMENT_STATUSES: OrderFulfillmentStatus[] = ['pending', 'in_progress', 'completed', 'failed'];

const statusStyles: Record<OrderFulfillmentStatus, string> = {
	pending: 'border-amber-500/40 bg-amber-950/40 text-amber-100',
	in_progress: 'border-sky-500/40 bg-sky-950/40 text-sky-100',
	completed: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100',
	failed: 'border-rose-500/40 bg-rose-950/40 text-rose-100',
};

const displayError = (error: unknown) => (error instanceof Error ? error.message : 'The request could not be completed.');

const currency = (amount: number | string | null, code = 'USD') =>
	amount === null || amount === ''
		? 'TBC'
		: new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(Number(amount));

const dateTime = (value: string) =>
	new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const labelStatus = (status: OrderFulfillmentStatus) => status.replace('_', ' ');

function parseJsonValue<T>(value: T | string | null | undefined): T | null {
	if (value == null) return null;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as T;
		} catch {
			return null;
		}
	}
	return value;
}

function mapPaymentStatus(status: string | null | undefined): OrderFulfillmentStatus {
	switch (status) {
		case 'pending':
		case 'pending_verification':
		case 'requested':
			return 'pending';
		case 'paid':
		case 'in_progress':
			return 'in_progress';
		case 'completed':
			return 'completed';
		case 'cancelled':
		case 'failed':
			return 'failed';
		default:
			return 'pending';
	}
}

function orderFulfillmentStatus(order: AdminOrder): OrderFulfillmentStatus {
	const raw = order.fulfillment_status || order.status;
	return FULFILLMENT_STATUSES.includes(raw as OrderFulfillmentStatus)
		? (raw as OrderFulfillmentStatus)
		: mapPaymentStatus(order.status);
}

function customerOf(order: AdminOrder): AdminCustomer {
	return parseJsonValue<AdminCustomer>(order.customer) ?? {};
}

function itemsOf(order: AdminOrder): AdminOrderItem[] {
	const items = parseJsonValue<AdminOrderItem[]>(order.items);
	return Array.isArray(items) ? items : [];
}

export default function AdminPanel({ onBackToStore }: AdminPanelProps) {
	const [orders, setOrders] = useState<AdminOrder[]>([]);
	const [loading, setLoading] = useState(true);
	const [updatingId, setUpdatingId] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState('');
	const [notice, setNotice] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | OrderFulfillmentStatus>('all');
	const [searchQuery, setSearchQuery] = useState('');
	const [signedIn, setSignedIn] = useState<boolean | null>(null);

	const loadOrders = useCallback(async () => {
		if (!supabase) {
			throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
		}

		const { data: sessionData } = await supabase.auth.getSession();
		const isSignedIn = Boolean(sessionData.session?.user);
		setSignedIn(isSignedIn);
		if (!isSignedIn) {
			setOrders([]);
			return;
		}

		const listed = await supabase.rpc('admin_list_orders');
		if (!listed.error) {
			setOrders((listed.data as AdminOrder[]) ?? []);
			return;
		}
		if (/admin access required|sign in required/i.test(listed.error.message)) {
			throw new Error(listed.error.message);
		}

		const withFulfillment = await supabase
			.from('wallet_orders')
			.select('id,user_id,items,customer,total,currency,payment_method,status,fulfillment_status,payment_reference,crypto_txid,created_at')
			.order('created_at', { ascending: false });

		if (!withFulfillment.error) {
			setOrders((withFulfillment.data as AdminOrder[]) ?? []);
			return;
		}

		const fallback = await supabase
			.from('wallet_orders')
			.select('id,user_id,items,customer,total,currency,payment_method,status,payment_reference,crypto_txid,created_at')
			.order('created_at', { ascending: false });

		if (fallback.error) {
			throw new Error(listed.error?.message || withFulfillment.error.message || fallback.error.message);
		}

		setOrders((fallback.data as AdminOrder[]) ?? []);
	}, []);

	useEffect(() => {
		if (!isSupabaseConfigured) {
			setLoading(false);
			setErrorMessage('Account features are unavailable until Supabase is configured.');
			return;
		}

		let active = true;
		setLoading(true);
		setErrorMessage('');
		void loadOrders()
			.catch((error: unknown) => {
				if (active) setErrorMessage(displayError(error));
			})
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [loadOrders]);

	const updateStatus = async (orderId: string, nextStatus: OrderFulfillmentStatus) => {
		if (!supabase) return;
		setUpdatingId(orderId);
		setErrorMessage('');
		setNotice('');
		try {
			const rpcResult = await supabase.rpc('admin_set_order_fulfillment_status', {
				p_order_id: orderId,
				p_status: nextStatus,
			});

			if (!rpcResult.error && rpcResult.data) {
				const updated = rpcResult.data as AdminOrder;
				setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, ...updated, fulfillment_status: nextStatus } : order)));
				setNotice(`Order ${orderId.slice(0, 8)} marked ${labelStatus(nextStatus)}.`);
				return;
			}

			const fulfillmentUpdate = await supabase
				.from('wallet_orders')
				.update({ fulfillment_status: nextStatus })
				.eq('id', orderId)
				.select('id,user_id,items,customer,total,currency,payment_method,status,fulfillment_status,payment_reference,crypto_txid,created_at')
				.single();

			if (!fulfillmentUpdate.error && fulfillmentUpdate.data) {
				setOrders((current) => current.map((order) => (order.id === orderId ? (fulfillmentUpdate.data as AdminOrder) : order)));
				setNotice(`Order ${orderId.slice(0, 8)} marked ${labelStatus(nextStatus)}.`);
				return;
			}

			const statusUpdate = await supabase
				.from('wallet_orders')
				.update({ status: nextStatus })
				.eq('id', orderId)
				.select('id,user_id,items,customer,total,currency,payment_method,status,payment_reference,crypto_txid,created_at')
				.single();

			if (statusUpdate.error || !statusUpdate.data) {
				throw new Error(rpcResult.error?.message || fulfillmentUpdate.error?.message || statusUpdate.error?.message || 'Could not update order status.');
			}

			setOrders((current) => current.map((order) => (order.id === orderId ? { ...statusUpdate.data, fulfillment_status: nextStatus } as AdminOrder : order)));
			setNotice(`Order ${orderId.slice(0, 8)} marked ${labelStatus(nextStatus)}.`);
		} catch (error) {
			setErrorMessage(displayError(error));
		} finally {
			setUpdatingId(null);
		}
	};

	const filteredOrders = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		return orders.filter((order) => {
			const status = orderFulfillmentStatus(order);
			if (statusFilter !== 'all' && status !== statusFilter) return false;
			if (!query) return true;
			const customer = customerOf(order);
			const items = itemsOf(order).map((item) => item.name ?? '').join(' ');
			const haystack = [
				order.id,
				customer.full_name,
				customer.email,
				customer.phone,
				customer.address,
				order.payment_method,
				items,
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return haystack.includes(query);
		});
	}, [orders, searchQuery, statusFilter]);

	const totals = useMemo(() => {
		const counts = { pending: 0, in_progress: 0, completed: 0, failed: 0, amount: 0 };
		for (const order of orders) {
			counts[orderFulfillmentStatus(order)] += 1;
			counts.amount += Number(order.total ?? 0);
		}
		return counts;
	}, [orders]);

	return (
		<main className="min-h-screen bg-[#050d22] text-[#f4f7fc]">
			<header className="sticky top-0 z-10 border-b border-blue-300/15 bg-[#050d22]/95 backdrop-blur">
				<div className="mx-auto flex min-h-[76px] w-[min(100%-2rem,1160px)] items-center justify-between gap-4">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-[.18em] text-sky-300">Operations</p>
						<h1 className="font-['Barlow_Condensed',sans-serif] text-2xl font-extrabold tracking-wide">Admin order control</h1>
					</div>
					<button
						className="min-h-10 rounded-lg border border-sky-700 px-3 text-xs font-bold text-sky-200 transition hover:border-sky-400 hover:bg-sky-950/50 sm:px-4 sm:text-sm"
						type="button"
						onClick={() => {
							if (onBackToStore) onBackToStore();
							else window.location.assign('/');
						}}
					>
						Back to store
					</button>
				</div>
			</header>

			<section className="mx-auto grid w-[min(100%-2rem,1160px)] gap-4 py-6">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					{[
						{ label: 'Pending', value: totals.pending, key: 'pending' as const },
						{ label: 'In progress', value: totals.in_progress, key: 'in_progress' as const },
						{ label: 'Completed', value: totals.completed, key: 'completed' as const },
						{ label: 'Failed', value: totals.failed, key: 'failed' as const },
					].map((card) => (
						<button
							key={card.key}
							className={`rounded-xl border p-4 text-left transition ${statusFilter === card.key ? 'border-sky-400 bg-[#0b1a36]' : 'border-blue-300/15 bg-[#07142e] hover:border-sky-700'}`}
							type="button"
							onClick={() => setStatusFilter((current) => (current === card.key ? 'all' : card.key))}
						>
							<p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
							<p className="mt-1 text-2xl font-bold">{card.value}</p>
						</button>
					))}
					<div className="rounded-xl border border-blue-300/15 bg-[#07142e] p-4">
						<p className="text-xs uppercase tracking-wide text-slate-400">Listed amount</p>
						<p className="mt-1 text-2xl font-bold">{currency(totals.amount)}</p>
					</div>
				</div>

				<div className="flex flex-col gap-3 rounded-xl border border-blue-300/15 bg-[#07142e] p-4 sm:flex-row sm:items-center">
					<input
						className="min-h-10 flex-1 rounded-lg border border-blue-300/20 bg-[#050d22] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400"
						type="search"
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						placeholder="Search name, email, phone, order ID, or item"
						aria-label="Search orders"
					/>
					<select
						className="min-h-10 rounded-lg border border-blue-300/20 bg-[#050d22] px-3 text-sm text-slate-100 outline-none focus:border-sky-400"
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderFulfillmentStatus)}
						aria-label="Filter by status"
					>
						<option value="all">All statuses</option>
						{FULFILLMENT_STATUSES.map((status) => (
							<option key={status} value={status}>{labelStatus(status)}</option>
						))}
					</select>
					<button
						className="min-h-10 rounded-lg border border-sky-700 px-4 text-sm font-semibold text-sky-200 hover:border-sky-400"
						type="button"
						onClick={() => {
							setLoading(true);
							setErrorMessage('');
							void loadOrders()
								.catch((error: unknown) => setErrorMessage(displayError(error)))
								.finally(() => setLoading(false));
						}}
					>
						Refresh
					</button>
				</div>

				{errorMessage && <p className="rounded-lg bg-rose-950/50 p-3 text-sm text-rose-100" role="alert">{errorMessage}</p>}
				{notice && <p className="rounded-lg bg-emerald-950/40 p-3 text-sm text-emerald-100" role="status">{notice}</p>}
				{signedIn === false && (
					<p className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-sm text-amber-100">
						Sign in from the store, then return to /admin. Listing all customer orders also requires an admin profile (`is_admin = true`) after applying the admin orders migration.
					</p>
				)}

				<div className="overflow-x-auto rounded-xl border border-blue-300/15 bg-[#07142e]">
					<table className="min-w-full text-left text-sm">
						<thead className="border-b border-blue-300/15 text-xs uppercase tracking-wide text-slate-400">
							<tr>
								<th className="px-4 py-3 font-medium">Order</th>
								<th className="px-4 py-3 font-medium">Customer</th>
								<th className="px-4 py-3 font-medium">Items</th>
								<th className="px-4 py-3 font-medium">Amount</th>
								<th className="px-4 py-3 font-medium">Payment</th>
								<th className="px-4 py-3 font-medium">Status</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td className="px-4 py-8 text-slate-400" colSpan={6}>Loading orders…</td>
								</tr>
							) : filteredOrders.length === 0 ? (
								<tr>
									<td className="px-4 py-8 text-slate-400" colSpan={6}>No orders match the current filters.</td>
								</tr>
							) : (
								filteredOrders.map((order) => {
									const customer = customerOf(order);
									const items = itemsOf(order);
									const fulfillment = orderFulfillmentStatus(order);
									return (
										<tr key={order.id} className="border-t border-blue-300/10 align-top">
											<td className="px-4 py-3">
												<p className="font-mono text-xs text-sky-200">{order.id.slice(0, 8)}</p>
												<p className="mt-1 text-xs text-slate-400">{dateTime(order.created_at)}</p>
											</td>
											<td className="px-4 py-3">
												<p className="font-semibold text-slate-100">{customer.full_name || 'Unnamed customer'}</p>
												<p className="text-xs text-slate-400">{customer.email || 'No email'}</p>
												<p className="text-xs text-slate-400">{customer.phone || 'No phone'}</p>
												{(customer.address || customer.country) && (
													<p className="mt-1 text-xs text-slate-500">
														{[customer.address, customer.country, customer.state_region, customer.postal_code].filter(Boolean).join(', ')}
													</p>
												)}
											</td>
											<td className="px-4 py-3">
												{items.length ? (
													<ul className="grid gap-1">
														{items.map((item, index) => (
															<li key={`${order.id}-${item.id ?? index}`}>
																{item.name || item.id || 'Item'}
																{item.identifier ? <span className="text-slate-500"> · {item.identifier}</span> : null}
																{item.unit_price != null ? <span className="text-slate-500"> · {currency(item.unit_price, order.currency || 'USD')}</span> : null}
															</li>
														))}
													</ul>
												) : (
													<span className="text-slate-500">No line items</span>
												)}
											</td>
											<td className="px-4 py-3 font-semibold">{currency(order.total, order.currency || 'USD')}</td>
											<td className="px-4 py-3">
												<p className="capitalize">{order.payment_method || '—'}</p>
												<p className="text-xs text-slate-500">{order.status || 'unknown'}</p>
											</td>
											<td className="px-4 py-3">
												<select
													className={`min-h-10 w-full rounded-lg border px-2 text-sm outline-none ${statusStyles[fulfillment]}`}
													value={fulfillment}
													disabled={updatingId === order.id}
													aria-label={`Update status for order ${order.id.slice(0, 8)}`}
													onChange={(event) => {
														void updateStatus(order.id, event.target.value as OrderFulfillmentStatus);
													}}
												>
													{FULFILLMENT_STATUSES.map((status) => (
														<option key={status} value={status}>{labelStatus(status)}</option>
													))}
												</select>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</section>
		</main>
	);
}
