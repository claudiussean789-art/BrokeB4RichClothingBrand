import { useState, type FormEvent } from 'react';
import { isSupabaseConfigured, orderDisplayStatus, supabase } from '../lib/supabase';

const statusBadgeStyles = {
	processing: 'bg-amber-950 text-amber-200',
	shipped: 'bg-sky-950 text-sky-200',
	completed: 'bg-emerald-950 text-emerald-300',
	cancelled: 'bg-rose-950 text-rose-200',
} as const;

export function OrderStatusBadge({ trackingNumber, fulfillmentStatus }: { trackingNumber?: string | null; fulfillmentStatus?: string | null }) {
	const status = orderDisplayStatus(trackingNumber, fulfillmentStatus);
	return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusBadgeStyles[status]}`}>{status}</span>;
}

type TrackedOrder = {
	id: string;
	created_at: string;
	total: number | string | null;
	payment_method: string;
	items: { name?: string }[] | null;
	tracking_number: string | null;
	tracking_carrier: string | null;
	display_status: keyof typeof statusBadgeStyles;
};

const knutsfordUrl = 'https://www.knutsfordexpress.com/';

export default function TrackOrder() {
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [orders, setOrders] = useState<TrackedOrder[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const lookup = async (event: FormEvent) => {
		event.preventDefault();
		if (!supabase) return;
		setBusy(true);
		setError('');
		const { data, error: rpcError } = await supabase.rpc('lookup_guest_orders', { p_email: email.trim(), p_phone: phone.trim() });
		setBusy(false);
		if (rpcError) {
			setError(rpcError.message);
			setOrders(null);
			return;
		}
		setOrders((data as TrackedOrder[]) ?? []);
	};

	if (!isSupabaseConfigured) return null;

	return (
		<section className="mt-12 rounded-2xl border border-blue-300/15 bg-[#091835] p-6 sm:p-8" id="track-order" aria-labelledby="track-order-title">
			<p className="mb-1 text-xs font-bold tracking-[.16em] text-sky-400">ORDER STATUS</p>
			<h2 className="mb-2 text-2xl font-bold" id="track-order-title">Track your order</h2>
			<p className="mb-4 text-sm text-slate-400">Enter the email and phone number you used at checkout. No account needed.</p>
			<form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={lookup}>
				<input className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none focus:border-sky-400" type="email" required placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
				<input className="h-11 rounded-lg border border-[#294572] bg-[#07142e] px-3 text-sm text-white outline-none focus:border-sky-400" type="tel" required placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
				<button className="h-11 rounded-lg bg-sky-500 px-5 text-sm font-bold text-[#03142a] disabled:opacity-60" type="submit" disabled={busy}>{busy ? 'Looking…' : 'Find orders'}</button>
			</form>
			{error && <p className="mt-3 text-sm text-rose-200" role="alert">{error}</p>}
			{orders && orders.length === 0 && <p className="mt-3 text-sm text-slate-400">No orders found for those details.</p>}
			{orders && orders.length > 0 && (
				<ul className="mt-4 grid gap-2">
					{orders.map((order) => (
						<li className="rounded-lg border border-blue-300/10 bg-[#07142e] p-3 text-sm" key={order.id}>
							<div className="flex justify-between gap-3">
								<strong>{order.total === null ? 'Price to be confirmed' : `$${Number(order.total).toFixed(2)} USD`}</strong>
								<span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusBadgeStyles[order.display_status]}`}>{order.display_status}</span>
							</div>
							<p className="mt-2 text-xs leading-5 text-slate-400">
								{Array.isArray(order.items) ? order.items.map((item) => item.name).join(', ') : 'Order items'} · {new Date(order.created_at).toLocaleDateString()}
							</p>
							{order.tracking_number && (
								<p className="mt-1 text-xs text-slate-300">
									{order.tracking_carrier ?? 'Knutsford Express'} tracking no.: <strong>{order.tracking_number}</strong>{' '}
									<a className="text-sky-300 hover:underline" href={knutsfordUrl} target="_blank" rel="noreferrer">Track shipment</a>
								</p>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
