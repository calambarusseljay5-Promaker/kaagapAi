import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://gknygquumtlhasfsiusn.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrbnlncXV1bXRsaGFzZnNpdXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0OTYxNzksImV4cCI6MjA5NTA3MjE3OX0.EDe5Pr8FKO6FEU3pIuHP2ze_TiwuZfWtbravbNmkIso";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function list1to6() {
  const { data } = await supabase.from('ai_knowledge_items').select('*').order('created_at', { ascending: false });
  for (let i = 0; i < 6; i++) {
    const d = data[i];
    console.log(`\n================== [ITEM ${i+1}] ==================`);
    console.log(`ID: ${d.id}`);
    console.log(`Title: ${d.title} | Category: ${d.category} | Source: ${d.source_type}`);
    console.log(`Content:\n${d.content}\n`);
  }
}

list1to6();
