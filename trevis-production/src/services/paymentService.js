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
  
  // Get student ID before update (needed for coverage recalculation)
  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('student_id')
    .eq('id', paymentId)
    .single();

  if (fetchErr) {
    return { data: null, error: fetchErr };
  }

  // If payment_date is updated, recalculate month_year
  if (updates.payment_date) {
    updates.month_year = updates.payment_date.substring(0, 7); // 'YYYY-MM'
  }
  
  // Build clean update payload — only include fields that exist in the payments table
  const payload = {};
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.payment_method !== undefined) payload.payment_method = updates.payment_method;
  if (updates.receipt_number !== undefined) payload.receipt_number = updates.receipt_number;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.payment_date !== undefined) payload.payment_date = updates.payment_date;
  if (updates.month_year !== undefined) payload.month_year = updates.month_year;
  
  const { error } = await supabase
    .from('payments')
    .update(payload)
    .eq('id', paymentId);
  
  if (error) {
    return { data: null, error };
  }

  // Phase 4B.3: Rebuild coverage from payment history after update
  try {
    const { rebuildStudentCoverage } = await import('./coverageDatabaseService.js');
    await rebuildStudentCoverage(payment.student_id);
  } catch (rebuildErr) {
    console.error('[Phase4B.3] Coverage rebuild failed after payment update:', rebuildErr);
    // Don't fail the update if coverage rebuild fails - log and continue
  }

  return { data: true, error: null };
}

export async function deletePayment(paymentId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  
  // Get student ID before delete (needed for coverage recalculation)
  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('student_id')
    .eq('id', paymentId)
    .single();

  if (fetchErr) {
    return { data: null, error: fetchErr };
  }

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId);
  
  if (error) {
    return { data: null, error };
  }

  // Phase 4B.3: Rebuild coverage from payment history after delete
  try {
    const { rebuildStudentCoverage } = await import('./coverageDatabaseService.js');
    await rebuildStudentCoverage(payment.student_id);
  } catch (rebuildErr) {
    console.error('[Phase4B.3] Coverage rebuild failed after payment delete:', rebuildErr);
    // Don't fail the delete if coverage rebuild fails - log and continue
  }

  return { data: true, error: null };
}

/**
 * Update student profile field
 * @param {string} studentId - UUID of the student
 * @param {string} field - Field name to update
 * @param {any} value - New value
 * @param {string} userId - User performing the update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateStudentField(studentId, field, value, userId) {
  if (!isConfigured) return { success: false, error: 'Not configured' };
  
  try {
    // Validate field is allowed to be updated
    const allowedFields = ['full_name', 'phone', 'national_id', 'emergency_contact_name', 'emergency_contact_phone', 'notes', 'check_in_date'];
    if (!allowedFields.includes(field)) {
      return { success: false, error: 'Field not allowed to be updated' };
    }
    
    const { error } = await supabase
      .from('students')
      .update({ 
        [field]: value,
        updated_at: new Date().toISOString()
      })
      .eq('id', studentId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Recalculate balances and statuses for all students
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function recalculateBalances() {
  if (!isConfigured) return { success: false, error: 'Not configured' };
  
  try {
    const { error } = await supabase.rpc('recalculate_all_balances');
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
