import { supabase, isConfigured } from '../lib/supabase';

export async function getProperties() {
  if (!isConfigured) return { data: [], error: null };
  
  // Get current month as YYYY-MM-01 for obligation lookup
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  
  const { data, error } = await supabase
    .from('properties')
    .select(`
      *,
      rooms(
        *,
        students(
          id, full_name, phone, national_id, status, check_in_date, check_out_date, notes, data_flags, payment_plan,
          monthly_obligations(amount_due, amount_paid, status, month),
          payments(id, amount, payment_date, payment_method, receipt_number, month_year, notes)
        )
      )
    `)
    .order('name');
  
  // Filter out inactive rooms in the application layer (until schema migration is run)
  if (data) {
    data.forEach(property => {
      if (property.rooms) {
        property.rooms = property.rooms.filter(room => room.is_active !== false);
      }
    });
  }
  
  return { data: data || [], error };
}

export async function getPropertyById(id) {
  if (!isConfigured) return { data: null, error: null };
  const { data, error } = await supabase
    .from('properties')
    .select(`*, rooms(*, students(id, full_name, status, check_in_date, check_out_date, notes, data_flags, phone, national_id, emergency_contact_name, emergency_contact_phone, payment_plan))`)
    .eq('id', id)
    .single();
  
  // Filter out inactive rooms in the application layer (until schema migration is run)
  if (data && data.rooms) {
    data.rooms = data.rooms.filter(room => room.is_active !== false);
  }
  
  return { data, error };
}

/**
 * Update a property's editable display fields (name, location).
 *
 * The property name/location are NOT coverage truth inputs — the engine keys off
 * payments, rooms.rent_per_bed, and students.status, never the property name — so
 * a rename can never change any tenant's balance, coverage, or status. No rebuild,
 * no migration: it's a pure label change. We allow ONLY name/location through, so
 * this can never accidentally write a structural/coverage column.
 *
 * @param {string} propertyId
 * @param {{ name?: string, location?: string }} updates
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function updateProperty(propertyId, updates) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };

  const allowed = {};
  if (typeof updates.name === 'string') {
    const name = updates.name.trim();
    if (!name) return { data: null, error: { message: 'Property name cannot be empty.' } };
    allowed.name = name;
  }
  if (typeof updates.location === 'string') {
    allowed.location = updates.location.trim();
  }
  if (Object.keys(allowed).length === 0) {
    return { data: null, error: { message: 'Nothing to update.' } };
  }

  const { data, error } = await supabase
    .from('properties')
    .update(allowed)
    .eq('id', propertyId)
    .select()
    .single();
  return { data, error };
}

export async function addRoom(propertyId, roomNumber, bedCapacity, rentPerBed, notes) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('rooms')
    .insert({ property_id: propertyId, room_number: roomNumber, bed_capacity: bedCapacity, rent_per_bed: rentPerBed, notes })
    .select()
    .single();
  return { data, error };
}

export async function updateRoom(roomId, updates) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };

  // Phase 4C-A #5: detect whether rent_per_bed is actually changing, so we only
  // fan out a (potentially large) coverage rebuild when the daily rate moves.
  let rentChanged = false;
  if (Object.prototype.hasOwnProperty.call(updates, 'rent_per_bed')) {
    const { data: existing } = await supabase
      .from('rooms')
      .select('rent_per_bed')
      .eq('id', roomId)
      .single();
    rentChanged = existing && Number(existing.rent_per_bed) !== Number(updates.rent_per_bed);
  }

  const { data, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', roomId)
    .select()
    .single();

  if (error) return { data, error, rebuildError: null };

  // Auto-reconcile: rent change => every ACTIVE student in the room is replayed.
  let rebuildError = null;
  if (rentChanged) {
    const { rebuildRoomCoverage } = await import('./coverageRepairService.js');
    const result = await rebuildRoomCoverage(roomId);
    if (!result.success) {
      rebuildError = new Error(
        `Room rent updated, but coverage rebuild failed for ${result.failed} student(s): ${result.errors.join('; ')}`
      );
    }
  }

  return { data, error: null, rebuildError };
}

/**
 * Add one bed to a room (increase bed_capacity by 1).
 *
 * bed_capacity is NOT a coverage truth input (rent_per_bed is), so adding a bed
 * never triggers a coverage rebuild — it only changes capacity, and every
 * occupancy/vacancy metric is derived from bed_capacity by buildProps, so the
 * dashboard updates on the next data refresh. Mirrors addRoom's shape.
 *
 * @param {string} roomId
 * @returns {Promise<{ data: object|null, error: object|null, bedCapacity?: number }>}
 */
export async function addBed(roomId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };

  const { data: room, error: rErr } = await supabase
    .from('rooms')
    .select('bed_capacity')
    .eq('id', roomId)
    .single();
  if (rErr) return { data: null, error: rErr };

  const next = Number(room.bed_capacity || 0) + 1;
  const { data, error } = await supabase
    .from('rooms')
    .update({ bed_capacity: next })
    .eq('id', roomId)
    .select()
    .single();
  return { data, error, bedCapacity: next };
}

/**
 * Remove one bed from a room (decrease bed_capacity by 1).
 *
 * Refuses to drop capacity below the number of occupying tenants (you can't have
 * fewer beds than people in them) or below 1 (remove the room instead). Like
 * addBed, this touches capacity only — no coverage rebuild.
 *
 * @param {string} roomId
 * @returns {Promise<{ data: object|null, error: object|null, bedCapacity?: number }>}
 */
export async function removeBed(roomId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };

  const { data: room, error: rErr } = await supabase
    .from('rooms')
    .select('bed_capacity')
    .eq('id', roomId)
    .single();
  if (rErr) return { data: null, error: rErr };

  const current = Number(room.bed_capacity || 0);

  // Anyone not VACATED is physically occupying a bed (matches transferService /
  // buildProps occupancy counting).
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id')
    .eq('room_id', roomId)
    .neq('status', 'VACATED');
  if (sErr) return { data: null, error: sErr };

  const occupied = (students || []).length;
  if (current - 1 < occupied) {
    return {
      data: null,
      error: {
        message: `Can't remove a bed — ${occupied} of ${current} bed${current === 1 ? '' : 's'} occupied. Vacate or transfer a tenant first.`,
      },
    };
  }
  if (current - 1 < 1) {
    return {
      data: null,
      error: { message: 'A room must keep at least one bed. Remove the room instead.' },
    };
  }

  const next = current - 1;
  const { data, error } = await supabase
    .from('rooms')
    .update({ bed_capacity: next })
    .eq('id', roomId)
    .select()
    .single();
  return { data, error, bedCapacity: next };
}

export async function deleteRoom(roomId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId);
  return { data, error };
}

export async function removeRoom(roomId, userId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  
  // Check for active students
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id')
    .eq('room_id', roomId)
    .eq('status', 'ACTIVE');
  
  if (studentsError) return { data: null, error: studentsError };
  
  if (students && students.length > 0) {
    return { 
      data: null, 
      error: { message: `Cannot remove room — ${students.length} active student${students.length > 1 ? 's' : ''} assigned. Remove or relocate students first.` }
    };
  }
  
  // Hard delete: remove from database
  const { data, error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId)
    .select()
    .single();
  
  return { data, error };
}
