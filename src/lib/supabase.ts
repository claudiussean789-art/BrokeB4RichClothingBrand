import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function isUsableSupabaseConfig(url: string | undefined, key: string | undefined): url is string {
	if (!url || !key || /your_actual_|placeholder|replace_me/i.test(`${url} ${key}`)) return false;
	try {
		const parsedUrl = new URL(url);
		return (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') && Boolean(parsedUrl.hostname);
	} catch {
		return false;
	}
}

export const isSupabaseConfigured = isUsableSupabaseConfig(supabaseUrl, supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
	? createClient(supabaseUrl!, supabaseAnonKey!)
	: null;

export type WalletProfile = {
	id: string;
	email: string;
	full_name: string;
	username: string;
	phone: string;
	address: string;
	credit_balance: number | string;
};

export type WalletTopup = {
	id: string;
	amount: number | string;
	currency: string;
	method: 'paypal' | 'manual';
	status: 'pending' | 'completed' | 'cancelled';
	receipt_path: string | null;
	created_at: string;
};

export type WalletOrderItem = {
	id: string;
	kind: 'devices' | 'repairs' | 'credits' | 'wholesale';
	name: string;
	unit_price: number | string | null;
	identifier?: string | null;
};

export type WalletOrder = {
	id: string;
	items: WalletOrderItem[];
	total: number | string | null;
	currency: string;
	payment_method: string;
	status: 'paid' | 'requested' | 'pending' | 'pending_verification' | 'cancelled';
	payment_reference: string | null;
	crypto_txid: string | null;
	fulfillment_status?: string | null;
	tracking_number?: string | null;
	created_at: string;
};

export function orderDisplayStatus(trackingNumber?: string | null, fulfillmentStatus?: string | null): 'processing' | 'shipped' | 'completed' | 'cancelled' {
	if (fulfillmentStatus === 'failed') return 'cancelled';
	if (trackingNumber?.trim()) return 'shipped';
	if (fulfillmentStatus === 'completed') return 'completed';
	return 'processing';
}

export type WalletTransaction = {
	id: string;
	amount: number | string;
	kind: 'deposit' | 'spend';
	description: string;
	created_at: string;
};

export function getSupabase(): SupabaseClient {
	if (!supabase) {
		throw new Error('Account and wallet features are unavailable until Supabase is configured.');
	}
	return supabase;
}

export function getWalletBalance(profile: WalletProfile | null): number {
	return Number(profile?.credit_balance ?? 0);
}
