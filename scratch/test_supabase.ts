
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tevtluhuznkovezjgohh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRsdWh1em5rb3Zlempnb2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzUwNzQsImV4cCI6MjA4OTk1MTA3NH0._2_hylQjLgPDdBZie6CaOCCKwUneb9oi8HQrRkbRFZ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('Testing connection to Supabase...');
  try {
    const { data, error } = await supabase.from('colleges').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Connection error:', error.message);
    } else {
      console.log('Connection successful! Colleges count:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testConnection();
