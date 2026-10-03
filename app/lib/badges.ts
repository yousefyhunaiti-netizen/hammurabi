import { createClient } from './supabase'

type SupabaseClient = ReturnType<typeof createClient>

// The number on the profile icon for lawyer and firm accounts:
// consultations still waiting for an answer
// + bookings made since the account last opened «المواعيد والاستشارات» (/lawyer-history)
// + answers waiting for a senior review (for the senior) or for a reviewer (for the firm)
// + unread «التنبيهات» that aren't already counted as work above
//   (an answer sent for review, approved, or a reply to a job application).

const INFO_KINDS = ['review_pending', 'review_approved', 'review_done', 'application_update']

async function countUnreadNotifications(supabase: SupabaseClient, column: 'lawyer_id' | 'firm_id', id: number) {
  const result = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq(column, id)
    .eq('is_read', false)
    .in('kind', INFO_KINDS)
  return result.count || 0
}

async function countNewAppointments(supabase: SupabaseClient, filter: string, lastSeen: string | null) {
  if (!lastSeen) return 0
  const result = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .or(filter)
    .gt('created_at', lastSeen)
  return result.count || 0
}

export async function getLawyerBadgeCount(supabase: SupabaseClient, lawyerId: number) {
  const lawyerResult = await supabase
    .from('lawyers')
    .select('firm_id, specialty_id, last_seen_appointments_at')
    .eq('id', lawyerId)
    .maybeSingle()
  const lawyer = lawyerResult.data

  const pendingResult = await supabase
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('lawyer_id', lawyerId)
    .eq('status', 'pending')

  // The same bookings /lawyer-history shows this lawyer: their own,
  // plus bookings made to their firm in their specialty without a named lawyer.
  let appointmentFilter = 'lawyer_id.eq.' + lawyerId
  if (lawyer && lawyer.firm_id && lawyer.specialty_id) {
    appointmentFilter = appointmentFilter + ',and(lawyer_id.is.null,firm_id.eq.' + lawyer.firm_id + ',specialty_id.eq.' + lawyer.specialty_id + ')'
  }

  const newAppointments = await countNewAppointments(supabase, appointmentFilter, lawyer ? lawyer.last_seen_appointments_at : null)

  // answers a firm asked this lawyer (as a senior) to review
  const reviewResult = await supabase
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('reviewer_id', lawyerId)
    .eq('status', 'in_review')

  const unreadNotifications = await countUnreadNotifications(supabase, 'lawyer_id', lawyerId)

  return (pendingResult.count || 0) + newAppointments + (reviewResult.count || 0) + unreadNotifications
}

export async function getFirmBadgeCount(supabase: SupabaseClient, firmId: number) {
  const firmResult = await supabase
    .from('firms')
    .select('last_seen_appointments_at')
    .eq('id', firmId)
    .maybeSingle()

  const rosterResult = await supabase.from('lawyers').select('id').eq('firm_id', firmId)
  const rosterIds = (rosterResult.data || []).map(function (l) { return l.id })

  let firmFilter = 'firm_id.eq.' + firmId
  if (rosterIds.length > 0) {
    firmFilter = firmFilter + ',lawyer_id.in.(' + rosterIds.join(',') + ')'
  }

  const pendingResult = await supabase
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .or(firmFilter)

  const newAppointments = await countNewAppointments(supabase, firmFilter, firmResult.data ? firmResult.data.last_seen_appointments_at : null)

  // answers waiting for the firm to pick a senior reviewer
  const reviewResult = await supabase
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'in_review')
    .is('reviewer_id', null)
    .or(firmFilter)

  const unreadNotifications = await countUnreadNotifications(supabase, 'firm_id', firmId)

  return (pendingResult.count || 0) + newAppointments + (reviewResult.count || 0) + unreadNotifications
}

// Called when /lawyer-history opens: bookings made before now stop counting as new.
// Uses the database clock, so a wrong clock on the user's device can't affect it.
export async function markAppointmentsSeen(supabase: SupabaseClient) {
  await supabase.rpc('mark_appointments_seen')
}
