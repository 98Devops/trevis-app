import { supabase, isConfigured } from '../lib/supabase';

export async function getPaymentsByStudent(studentId) {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', studentId)
    .order('payment_date', { ascending: false });
  return { data: data || [], error };
}

export async function recordPayment({ studentId, amount, paymentDate, paymentMethod, receiptNumber, notes, recordedBy }) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const monthYear = paymentDate.substring(0, 7); // 'YYYY-MM'
  const { data, error } = await supabase
    .from('payments')
    .insert({
      student_id: studentId,
      amount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      receipt_number: receiptNumber,
      month_year: monthYear,
      notes,
      recorded_by: recordedBy
    })
    .select()
    .single();
  return { data, error };
}

export async function getPaymentsByPropertyMonth(propertyId, monthYear) {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('payments')
    .select(`*, students!inner(id, full_name, rooms!inner(id, room_number, property_id))`)
    .eq('students.rooms.property_id', propertyId)
    .eq('month_year', monthYear)
    .order('payment_date', { ascending: false });
  return { data: data || [], error };
}

export async function updatePayment(paymentId, updates, userId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  
  // If payment_date is updated, recalculate month_year
  if (updates.payment_date) {
    updates.month_year = updates.payment_date.substring(0, 7); // 'YYYY-MM'
  }
  
  const { data, error } = await supabase
    .from('payments')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      edited_by: userId
    })
    .eq('id', paymentId)
    .select()
    .single();
  
  return { data, error };
}

export async function deletePayment(paymentId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  
  const { data, error } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId)
    .select()
    .single();
  
  return { data, error };
}
