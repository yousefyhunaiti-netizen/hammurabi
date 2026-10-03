// Where a new lawyer or firm account is in sign-up:
//   info      → required details still missing
//   review    → details sent, waiting for the Hammurabi team to approve
//   subscribe → approved, no subscription yet
//   ready     → everything done
// Accounts created before this flow (needs_onboarding = false) are always 'ready',
// so nothing changes for them.

export type AccountStage = 'info' | 'review' | 'subscribe' | 'ready'

type LawyerRow = {
  needs_onboarding?: boolean | null
  bar_certificate_number?: string | null
  specialty_id?: number | null
  city?: string | null
  is_approved?: boolean | null
  is_active?: boolean | null
  is_comped?: boolean | null
}

type FirmRow = {
  needs_onboarding?: boolean | null
  city?: string | null
  address?: string | null
  phone?: string | null
  is_approved?: boolean | null
  is_active?: boolean | null
  is_comped?: boolean | null
}

function filled(value: string | null | undefined) {
  return !!value && value.trim() !== ''
}

// The columns these checks need. Queries spell them out in full (joining
// strings with + makes the database types unknown and fails the build).
export const LAWYER_STAGE_COLUMNS = 'needs_onboarding, bar_certificate_number, specialty_id, city, is_approved, is_active, is_comped'
export const FIRM_STAGE_COLUMNS = 'needs_onboarding, city, address, phone, is_approved, is_active, is_comped'

export function lawyerInfoComplete(l: LawyerRow) {
  return filled(l.bar_certificate_number) && !!l.specialty_id && filled(l.city)
}

export function firmInfoComplete(f: FirmRow) {
  return filled(f.city) && filled(f.address) && filled(f.phone)
}

export function lawyerStage(l: LawyerRow): AccountStage {
  if (!l.needs_onboarding) return 'ready'
  if (!lawyerInfoComplete(l)) return 'info'
  if (!l.is_approved) return 'review'
  if (!l.is_active && !l.is_comped) return 'subscribe'
  return 'ready'
}

export function firmStage(f: FirmRow): AccountStage {
  if (!f.needs_onboarding) return 'ready'
  if (!firmInfoComplete(f)) return 'info'
  if (!f.is_approved) return 'review'
  if (!f.is_active && !f.is_comped) return 'subscribe'
  return 'ready'
}

// The page each stage lives on.
export function stagePath(accountType: 'lawyer' | 'firm', stage: AccountStage) {
  if (stage === 'info') return accountType === 'firm' ? '/firm-dashboard' : '/lawyer-dashboard'
  if (stage === 'review') return '/account-review'
  if (stage === 'subscribe') return '/subscription'
  return accountType === 'firm' ? '/firm-dashboard' : '/lawyer-tools'
}
