import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getUserSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error signing out:', error);
  window.location.reload();
}
