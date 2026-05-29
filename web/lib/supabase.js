/**
 * Supabase client for the iOS App Factory platform.
 * Used by the server for auth, data, and storage operations.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
 * (service key for server-side operations that bypass RLS).
 */

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  process.stderr.write('[supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — falling back to local store\n');
}

const admin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const anon = url && anonKey
  ? createClient(url, anonKey)
  : null;

function isConfigured() { return !!admin; }

module.exports = { admin, anon, isConfigured };
