import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://chanbvwgbqardsenvbub.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYW5idndnYnFhcmRzZW52YnViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTI1MDQsImV4cCI6MjA4NTUyODUwNH0.JH9UvegerVVW9xY9l7zIPrQ0HOVB4TeIyg03uFR3FVM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
