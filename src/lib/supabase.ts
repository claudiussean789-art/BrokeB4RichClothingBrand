import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
	? createClient(supabaseUrl!, supabaseAnonKey!)
	: null;

export type WalletProfile = {
	id: string;
	email: string;
	full_name: string;
	credit_balance: number | string;
};

export type WalletTopup = {
	id: string;
	amount: number | string;
	currency: string;
	method: 'paypal' | 'manual';
	status: 'pending' | 'completed' | 'cancelled';
	created_at: string;
};

export type WalletOrderItem = {
	id: string;
	kind: 'devices' | 'repairs' | 'credits';
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
	status: 'paid' | 'requested';
	created_at: string;
};

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
