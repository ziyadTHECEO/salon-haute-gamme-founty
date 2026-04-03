/* ================================================================
   SUPABASE CONFIG — Salon Haute Gamme Founty
   Remplacez les valeurs ci-dessous par vos clés Supabase.
   ================================================================ */

var SUPABASE_URL  = 'https://bzaupcoirtzekpsmfvhy.supabase.co';
var SUPABASE_ANON = 'sb_publishable_ZQxzKw8XyrN-IefhpEjN9g_HLzalSd9';
/* Note : la clé service_role ne peut PAS être utilisée dans le navigateur.
   L'accès admin passe par la session authentifiée + policy RLS "auth_full_access". */

var _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
