import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://gknygquumtlhasfsiusn.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrbnlncXV1bXRsaGFzZnNpdXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0OTYxNzksImV4cCI6MjA5NTA3MjE3OX0.EDe5Pr8FKO6FEU3pIuHP2ze_TiwuZfWtbravbNmkIso";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkConnection() {
  console.log('Checking Supabase connection...');
  try {
    const { data, error } = await supabase.from('announcements').select('id').limit(1);
    if (error) {
      console.warn('Supabase query returned:', error.message);
    } else {
      console.log('✅ Supabase connected successfully!');
    }
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
  }
}

checkConnection();
