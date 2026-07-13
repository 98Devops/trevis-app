import { supabase } from './supabase';
import { localTodayISO } from './dateGuards';

/**
 * Read-only data-quality probes that live OUTSIDE the coverage engine.
 *
 * These never compute or mutate coverage — they only SELECT rows the operator
 * should review. Keeping them in lib/ (not services/) makes explicit that they
 * are not part of the billing single-source-of-truth; they are detection only.
 */

/**
 * Payments whose payment_date is in the future relative to today. A future date
 * is almost always a data-entry slip (it silently pushes a tenant's coverage
 * forward), so we surface them for review. Read-only: no coverage rebuild.
 *
 * @returns {Promise<{ data: Array<object>, error: object|null }>}
 */
export async function getFutureDatedPayments() {
  if (!supabase) return { data: [], error: null };
  const today = localTodayISO();
  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, amount, payment_date, payment_method, student_id, ' +
        'students ( full_name, rooms ( room_number, properties ( name ) ) )',
    )
    .gt('payment_date', today)
    .order('payment_date', { ascending: false });
  return { data: data ?? [], error };
}
