## AutoCRM - Used Car Dealership CRM

### Design
- **Mobile-first**, card-based UI with thumb-friendly touch targets
- **Color palette**: Deep navy primary (#1E3A5F), with semantic status colors for lead temperature (🔴 Hot: red-orange, 🟡 Warm: amber, 🔵 Cold: blue-gray)
- **Funnel colors**: Calling (blue), Walkin (purple), Booking (green), Delivery (emerald)
- Clean Inter font, rounded cards with subtle shadows
- Bottom navigation bar for mobile

### Database Schema (Lovable Cloud/Supabase)
1. **user_roles** - Role management (CEO, Manager, Team Member)
2. **showrooms** - Multiple showroom locations
3. **leads** - Core leads table (name, phone, source portal, showroom, assigned_to, funnel_stage, temperature, call_status, walkin_date, follow_up_date, notes)
4. **lead_activities** - Activity log for each lead

### Pages & Features
1. **Auth** - Login page with role-based redirects
2. **Dashboard** (CEO/Manager) - Funnel overview, showroom-wise stats, team performance
3. **Dashboard** (Team Member) - Today's tasks (walkins, follow-ups), my lead stats
4. **Leads List** - Filterable by funnel stage, temperature, source
5. **Lead Detail** - Quick action buttons for status updates, call outcomes
6. **Lead Import** - Manual form with source portal selection
7. **Lead Assignment** - CEO/Manager can assign leads to team members
8. **Bottom Nav** - Dashboard, Leads, Add Lead, Profile

### RLS Policies
- Team members see only their assigned leads
- CEO/Manager see all leads (optionally filtered by showroom)
- Role checks via security definer function

### Phase 1 (This implementation)
- Design system + all UI components
- Auth with role-based access
- Full lead management flow
- Quick action buttons for call outcomes
- Insights dashboard
- Daily tasks view
