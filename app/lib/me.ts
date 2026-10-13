// The logged-in account's own full row (private columns included), read
// through the database functions my_lawyer() / my_firm(). Other people's
// profiles only show their public columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function myLawyer(supabase: any): any {
  return supabase.rpc('my_lawyer')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function myFirm(supabase: any): any {
  return supabase.rpc('my_firm')
}
