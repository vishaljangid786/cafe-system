'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import {
  UserPlus, User, MapPin, Shield, CreditCard,
  Image as ImageIcon, Check
} from 'lucide-react';
import { sanitizeEmail, sanitizeName, blockNonInteger, blockNegative } from '@/app/utils/inputValidation';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Button } from '@/app/components/ui/Button';
import { PageTransition } from '@/app/components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import toast from 'react-hot-toast';
import { PAGE_GROUPS, ROLE_DEFAULT_PAGES } from '@/app/config/pages';

// PAGE access is now chosen page-by-page (see PAGE_GROUPS -> allowedPages). What's
// left here are CAPABILITIES — non-page abilities that aren't "open a page".
const PERMISSION_LIST = [
  { key: 'viewRevenue', label: 'View Revenue' },
  { key: 'editRevenue', label: 'Edit Revenue (not just view)' },
  { key: 'viewOrders', label: 'View Orders' },
  { key: 'manageOrders', label: 'Manage Orders' },
  { key: 'forceComplete', label: 'Force-Complete Orders' },
  { key: 'exportReports', label: 'Export Reports' },
  { key: 'manageStaff', label: 'Manage Staff' },
  { key: 'manageNotifications', label: 'Manage Notifications' },
  { key: 'viewAnalytics', label: 'View Analytics' },
  { key: 'manageCoupons', label: 'Manage Offers / Coupons' },
  { key: 'manageBranches', label: 'Manage Branches' },
  { key: 'viewAuditLogs', label: 'View Security Logs' },
  { key: 'impersonateUsers', label: 'Login As Staff' },
  { key: 'viewAdminCenter', label: 'View Admin Center' },
  { key: 'manageGlobalMenu', label: 'Manage Global Menu' },
  { key: 'sendGlobalNotifications', label: 'Send Global Notifications' },
  { key: 'sendMessages', label: 'Send Messages' },
  { key: 'messageSuperAdmin', label: 'Message Super Admin' },
];

// Default CAPABILITIES per role (page defaults come from ROLE_DEFAULT_PAGES).
// sendMessages is ON for everyone so the messaging hierarchy works out of the box.
const ROLE_DEFAULT_CAPS = {
  admin: {
    viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
    forceComplete: true, exportReports: true, manageStaff: true,
    manageNotifications: true, viewAnalytics: true, manageCoupons: true,
    sendMessages: true, messageSuperAdmin: true,
  },
  branch_admin: {
    viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
    forceComplete: true, exportReports: true, manageStaff: true,
    viewAnalytics: true, sendMessages: true,
  },
  location_admin: {
    viewRevenue: true, viewOrders: true, manageOrders: true, exportReports: true,
    viewAnalytics: true, sendMessages: true,
  },
  staff: { viewOrders: true, manageOrders: true, sendMessages: true },
  chef: { viewOrders: true, manageOrders: true, sendMessages: true },
};

const emptyPerms = () => PERMISSION_LIST.reduce((acc, { key }) => ({ ...acc, [key]: false }), {});

const Field = ({ label, children, hint }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-(--color-text-muted) ml-1">{hint}</p>}
  </div>
);

const inputCls = "w-full px-5 py-3.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/30 transition-all";

const Section = ({ icon: Icon, title, desc, children }) => (
  <div className="bg-(--color-surface)/40 border border-(--color-border) rounded-2xl p-6 sm:p-8 space-y-6">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-sm font-bold text-(--color-text-primary)">{title}</h2>
        {desc && <p className="text-[11px] text-(--color-text-muted)">{desc}</p>}
      </div>
    </div>
    {children}
  </div>
);

export default function AddMemberPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [locations, setLocations] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [selectedCafeId, setSelectedCafeId] = useState('');
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [permissions, setPermissions] = useState(emptyPerms());
  const [selectedPages, setSelectedPages] = useState([]); // page-access keys (allowedPages)
  const [aadharImage, setAadharImage] = useState(null);
  const [aadharPreview, setAadharPreview] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', age: '', gender: 'Male',
    address1: '', address2: '', city: '', state: '', country: 'India', pincode: '',
    role: 'staff', assignedLocation: '', accessibleLocations: [],
    highestQualification: '12th Pass', monthlySalary: '', aadharNumber: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Access guard
  useEffect(() => {
    if (currentUser && !['super_admin', 'admin', 'branch_admin'].includes(currentUser.role)) {
      toast.error('Access denied. You cannot add members.');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Load branches, cafes and admins
  useEffect(() => {
    const load = async () => {
      try {
        const [locRes, cafeRes] = await Promise.all([
          api.get('/locations'),
          api.get('/cafes'),
        ]);
        setLocations(locRes.data?.data || locRes.data || []);
        setCafes(cafeRes.data?.data || cafeRes.data || []);
      } catch (e) { /* ignore */ }
      if (currentUser?.role === 'super_admin') {
        try {
          const res = await api.get('/users', { params: { role: 'admin', limit: 1000 } });
          setAdmins(res.data.data || []);
        } catch (e) { /* ignore */ }
      }
    };
    if (currentUser) load();
  }, [currentUser]);

  // Pre-select the chosen role's default capabilities AND default page access.
  useEffect(() => {
    setPermissions({ ...emptyPerms(), ...(ROLE_DEFAULT_CAPS[form.role] || {}) });
    setSelectedPages(ROLE_DEFAULT_PAGES[form.role] || []);
  }, [form.role]);

  // Image previews
  useEffect(() => {
    if (!aadharImage) { setAadharPreview(null); return; }
    const url = URL.createObjectURL(aadharImage);
    setAadharPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [aadharImage]);
  useEffect(() => {
    if (!profileImage) { setProfilePreview(null); return; }
    const url = URL.createObjectURL(profileImage);
    setProfilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [profileImage]);

  const availableRoles = useMemo(() => {
    switch (currentUser?.role) {
      case 'super_admin': return [
        { value: 'admin', label: 'Admin' },
        { value: 'branch_admin', label: 'Branch Admin' },
        { value: 'location_admin', label: 'Location Admin' },
        { value: 'staff', label: 'Staff' },
        { value: 'chef', label: 'Chef' },
      ];
      case 'admin': return [
        { value: 'branch_admin', label: 'Branch Admin' },
        { value: 'location_admin', label: 'Location Admin' },
        { value: 'staff', label: 'Staff' },
        { value: 'chef', label: 'Chef' },
      ];
      default: return [
        { value: 'staff', label: 'Staff' },
        { value: 'chef', label: 'Chef' },
      ];
    }
  }, [currentUser]);

  const myBranchIds = useMemo(() => {
    const ids = [];
    if (currentUser?.assignedLocation) ids.push(currentUser.assignedLocation._id || currentUser.assignedLocation);
    (currentUser?.accessibleLocations || []).forEach((l) => ids.push(l._id || l));
    return [...new Set(ids.filter(Boolean).map((x) => x.toString()))];
  }, [currentUser]);

  const cafeOptions = useMemo(() => cafes.map((c) => ({ label: c.name, value: c._id })), [cafes]);

  // Filter locations by selected cafe (if one is chosen); otherwise show all
  const locationsInCafe = useMemo(() => {
    if (!selectedCafeId) return locations;
    return locations.filter((l) => {
      const cid = l.cafe?._id || l.cafe;
      return cid && cid.toString() === selectedCafeId.toString();
    });
  }, [locations, selectedCafeId]);

  const allBranchOptions = useMemo(() => locationsInCafe.map((l) => ({ label: `${l.city} - ${l.name}`, value: l._id })), [locationsInCafe]);

  // Branches the creator may assign (super admin: all; admin/branch admin: their own)
  const myBranchOptions = useMemo(() => {
    if (currentUser?.role === 'super_admin') return allBranchOptions;
    return locationsInCafe.filter((l) => myBranchIds.includes(l._id.toString())).map((l) => ({ label: `${l.city} - ${l.name}`, value: l._id }));
  }, [currentUser, locationsInCafe, myBranchIds, allBranchOptions]);

  const adminOptions = useMemo(() => admins.map((a) => {
    const c = (a.accessibleLocations || []).length;
    return { label: `${a.name} — ${c} branch${c === 1 ? '' : 'es'}`, value: a._id };
  }), [admins]);

  // For a branch admin: the selected admin's branches (super admin) or the creator's own
  const branchAdminBranchOptions = useMemo(() => {
    if (currentUser?.role === 'super_admin') {
      const a = admins.find((x) => x._id === selectedAdminId);
      return (a?.accessibleLocations || []).map((b) => ({ label: `${b.city || ''} - ${b.name || 'Branch'}`, value: b._id || b }));
    }
    return myBranchOptions;
  }, [currentUser, admins, selectedAdminId, myBranchOptions]);

  const actorCanGrant = (key) => currentUser?.role === 'super_admin' || !!currentUser?.permissions?.[key];
  const togglePermission = (key) => {
    if (!actorCanGrant(key)) return;
    setPermissions((p) => ({ ...p, [key]: !p[key] }));
  };

  // You can only grant page access you yourself hold (super_admin grants anything).
  const actorCanGrantPage = (pageKey) =>
    currentUser?.role === 'super_admin' || (currentUser?.allowedPages || []).includes(pageKey);
  const togglePage = (pageKey) => {
    if (!actorCanGrantPage(pageKey)) return;
    setSelectedPages((prev) =>
      prev.includes(pageKey) ? prev.filter((k) => k !== pageKey) : [...prev, pageKey]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Light client-side validation (the backend validates fully)
    if (!form.name || !form.email || !form.password || !form.phone) {
      toast.error('Please fill name, email, password and phone.');
      return;
    }
    if (form.password.length < 10) {
      toast.error('Password must be at least 10 characters.');
      return;
    }
    if (!/^[0-9]{10}$/.test(form.phone || '')) {
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!form.address1 || !form.city) {
      toast.error('Please fill the address and city.');
      return;
    }
    if (form.role === 'branch_admin' && (form.accessibleLocations || []).length === 0) {
      toast.error('Please assign at least one branch to the branch admin.');
      return;
    }
    if (['location_admin', 'staff', 'chef'].includes(form.role) && !form.assignedLocation) {
      toast.error('Please select a branch for this member.');
      return;
    }
    if (!/^[0-9]{12}$/.test(form.aadharNumber || '')) {
      toast.error('Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    if (!aadharImage) {
      toast.error('Please upload the Aadhaar card image.');
      return;
    }
    // A member must be given access to at least one page — no zero-access accounts.
    // (Staff/Chef work from their own fixed menu, so they're exempt.)
    if (selectedPages.length === 0 && !Object.values(permissions).some(Boolean)) {
      toast.error('Select at least one page access or permission. Zero-access members cannot be created.');
      return;
    }

    const payload = { ...form };
    if (form.role === 'branch_admin') {
      const ids = form.accessibleLocations || [];
      payload.assignedLocation = ids[0] || '';
      payload.accessibleLocations = ids;
    } else if (form.role === 'admin') {
      payload.accessibleLocations = form.accessibleLocations || [];
      if (selectedCafeId) payload.cafes = [selectedCafeId];
      delete payload.assignedLocation;
    } else {
      payload.accessibleLocations = [];
    }

    const data = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((x) => data.append(k, x));
      else if (v !== '' && v != null) data.append(k, v);
    });
    if (aadharImage) data.append('aadharImage', aadharImage);
    if (profileImage) data.append('profileImage', profileImage);
    data.append('permissions', JSON.stringify(permissions));
    data.append('allowedPages', JSON.stringify(selectedPages));

    setSubmitting(true);
    const loadToast = toast.loading('Creating member...');
    try {
      await api.post('/auth/register', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Member created successfully', { id: loadToast });
      router.push(currentUser?.role === 'branch_admin' ? '/dashboard/branch-admin/staff' : '/dashboard/admin/staff');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create member. Please check the details.', { id: loadToast });
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8 pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <UserPlus size={22} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-(--color-text-primary)">Add Member</h1>
              <p className="text-sm text-(--color-text-muted)">Create a new team member and set their access.</p>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <Section icon={User} title="Basic Information" desc="Login and identity details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Full Name">
              <input required className={inputCls} value={form.name} onChange={(e) => set('name', sanitizeName(e.target.value))} placeholder="Rahul Sharma" />
            </Field>
            <Field label="Email Address">
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => set('email', sanitizeEmail(e.target.value))} placeholder="rahul@cafe.com" />
            </Field>
            <Field label="Password" hint="The member can change it after first login.">
              <input required type="text" minLength={10} className={inputCls} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 10 characters" />
            </Field>
            <Field label="Phone Number">
              <input required className={inputCls} value={form.phone} maxLength={10} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" />
            </Field>
            <Field label="Age">
              <input type="number" min="18" max="99" onKeyDown={blockNonInteger} className={inputCls} value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="24" />
            </Field>
            <Field label="Gender">
              <PremiumSelect value={form.gender} onChange={(v) => set('gender', v)} options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]} />
            </Field>
          </div>
        </Section>

        {/* Address */}
        <Section icon={MapPin} title="Address" desc="Where the member is based">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Address Line 1"><input className={inputCls} value={form.address1} onChange={(e) => set('address1', e.target.value)} placeholder="Building / Street" /></Field>
            <Field label="Address Line 2"><input className={inputCls} value={form.address2} onChange={(e) => set('address2', e.target.value)} placeholder="Locality / Landmark" /></Field>
            <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Mumbai" /></Field>
            <Field label="State"><input className={inputCls} value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="Maharashtra" /></Field>
            <Field label="Country"><input className={inputCls} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="India" /></Field>
            <Field label="Pincode"><input className={inputCls} value={form.pincode} maxLength={6} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="400001" /></Field>
          </div>
        </Section>

        {/* Role & Branch */}
        <Section icon={Shield} title="Role & Branch" desc="What this member is and where they work">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Role">
              <PremiumSelect
                value={form.role}
                onChange={(v) => { set('role', v); set('assignedLocation', ''); set('accessibleLocations', []); setSelectedAdminId(''); setSelectedCafeId(''); }}
                options={availableRoles}
              />
            </Field>
            <Field label="Highest Qualification">
              <PremiumSelect value={form.highestQualification} onChange={(v) => set('highestQualification', v)} options={[{ label: '10th Pass', value: '10th Pass' }, { label: '12th Pass', value: '12th Pass' }, { label: 'Diploma', value: 'Diploma' }, { label: 'Graduate', value: 'Graduate' }, { label: 'Post Graduate', value: 'Post Graduate' }]} />
            </Field>

            {/* Cafe selector — shown for admin and (for filtering) branch_admin / staff / chef */}
            {cafeOptions.length > 0 && (
              <Field
                label={form.role === 'admin' ? 'Cafe (Organization)' : 'Filter by Cafe'}
                hint={form.role === 'admin' ? 'The cafe this admin belongs to.' : 'Narrows down the branch list below.'}
              >
                <PremiumSelect
                  value={selectedCafeId}
                  onChange={(v) => { setSelectedCafeId(v); set('assignedLocation', ''); set('accessibleLocations', []); }}
                  options={cafeOptions}
                  placeholder="All cafes"
                />
              </Field>
            )}

            {/* Branch selection per role */}
            {['location_admin', 'staff', 'chef'].includes(form.role) && (
              <Field label="Branch">
                <PremiumSelect value={form.assignedLocation} onChange={(v) => set('assignedLocation', v)} options={myBranchOptions} placeholder="Select branch" />
              </Field>
            )}

            {form.role === 'branch_admin' && currentUser?.role === 'super_admin' && (
              <Field label="Admin (assign from their branches)">
                <PremiumSelect value={selectedAdminId} onChange={(v) => { setSelectedAdminId(v); set('accessibleLocations', []); }} options={adminOptions} placeholder={adminOptions.length ? 'Select an admin' : 'No admins found'} />
              </Field>
            )}

            {form.role === 'branch_admin' && (
              <Field label="Branches This Branch Admin Can Manage" hint="All branches must belong to a single admin.">
                <PremiumSelect
                  value={form.accessibleLocations}
                  onChange={(v) => set('accessibleLocations', v)}
                  options={branchAdminBranchOptions}
                  multiple
                  placeholder={currentUser?.role === 'super_admin' && !selectedAdminId ? 'Select an admin first' : (branchAdminBranchOptions.length ? 'Select one or more branches' : 'No branches')}
                />
              </Field>
            )}

            {form.role === 'admin' && (
              <Field label="Branches This Admin Can Manage">
                <PremiumSelect value={form.accessibleLocations} onChange={(v) => set('accessibleLocations', v)} options={allBranchOptions} multiple placeholder={selectedCafeId ? 'Select branches from this cafe' : 'Select branches'} />
              </Field>
            )}

            <Field label="Monthly Salary (₹)">
              <input type="number" min="0" onKeyDown={blockNegative} className={inputCls} value={form.monthlySalary} onChange={(e) => set('monthlySalary', e.target.value)} placeholder="28000" />
            </Field>
          </div>
        </Section>

        {/* Page Access — one toggle per page (this is what the member can open). */}
        <Section icon={Shield} title="Page Access" desc="Tick exactly the pages this member can open — they'll see ONLY these. The role's typical pages are pre-selected.">
          <>
              <div className="flex items-center justify-end -mt-2">
                <span className={`text-[10px] font-bold uppercase tracking-normal ${selectedPages.length === 0 ? 'text-danger' : 'text-(--color-text-muted)'}`}>
                  {selectedPages.length} page{selectedPages.length === 1 ? '' : 's'} selected
                </span>
              </div>
              <div className="space-y-4">
                {Object.entries(PAGE_GROUPS).map(([group, pages]) => (
                  <div key={group}>
                    <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {pages.map(({ key, label }) => {
                        const checked = selectedPages.includes(key);
                        const allowed = actorCanGrantPage(key);
                        return (
                          <button
                            type="button"
                            key={key}
                            onClick={() => togglePage(key)}
                            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold text-left transition-all ${checked ? 'border-primary/40 bg-primary/10 text-primary' : 'border-(--color-border) bg-(--color-surface-soft) text-(--color-text-muted)'} ${!allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span className="flex flex-col">
                              {label}
                              {!allowed && <span className="text-[9px] text-danger normal-case">You don&apos;t have this</span>}
                            </span>
                            <span className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary text-white' : 'border-(--color-border)'}`}>
                              {checked && <Check size={12} strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
          </>
        </Section>

        {/* Capabilities — non-page abilities (edit revenue, force-complete, messaging…). */}
        <Section icon={Check} title="Permissions" desc="Extra abilities that aren't a page. The role's defaults are pre-selected — add more if needed (only ones you have).">
          <div className="flex items-center justify-end -mt-2">
            <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">{Object.values(permissions).filter(Boolean).length} selected</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {PERMISSION_LIST.map(({ key, label }) => {
              const checked = !!permissions[key];
              const allowed = actorCanGrant(key);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => togglePermission(key)}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold text-left transition-all ${checked ? 'border-primary/40 bg-primary/10 text-primary' : 'border-(--color-border) bg-(--color-surface-soft) text-(--color-text-muted)'} ${!allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="flex flex-col">
                    {label}
                    {!allowed && <span className="text-[9px] text-danger normal-case">You don&apos;t have this</span>}
                  </span>
                  <span className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary text-white' : 'border-(--color-border)'}`}>
                    {checked && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Identity */}
        <Section icon={CreditCard} title="Identity Documents" desc="Aadhaar number & card image are required. Profile photo is optional.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={<>Aadhaar Number <span className="text-danger">*</span></>}>
              <input className={inputCls} value={form.aadharNumber} maxLength={12} onChange={(e) => set('aadharNumber', e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12-digit Aadhaar number" />
            </Field>
            <div />
            <Field label={<>Aadhaar Card Image <span className="text-danger">*</span></>}>
              <label className={`group relative flex items-center justify-center min-h-36 bg-(--color-bg-soft) border-2 border-dashed rounded-xl hover:border-primary transition-colors cursor-pointer overflow-hidden ${aadharImage ? 'border-(--color-border)' : 'border-danger/40'}`}>
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setAadharImage(e.target.files[0])} />
                {aadharPreview ? <img src={aadharPreview} alt="Aadhaar" className="w-full h-36 object-contain p-2" /> : <div className="flex flex-col items-center text-(--color-text-muted)"><ImageIcon size={28} className="mb-2 group-hover:text-primary" /><span className="text-xs font-bold">Upload Aadhaar photo</span></div>}
              </label>
            </Field>
            <Field label={<>Profile Photo <span className="text-(--color-text-muted) normal-case font-medium">(optional)</span></>}>
              <label className="group relative flex items-center justify-center min-h-36 bg-(--color-bg-soft) border-2 border-dashed border-(--color-border) rounded-xl hover:border-primary transition-colors cursor-pointer overflow-hidden">
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setProfileImage(e.target.files[0])} />
                {profilePreview ? <img src={profilePreview} alt="Profile" className="w-full h-36 object-contain p-2" /> : <div className="flex flex-col items-center text-(--color-text-muted)"><ImageIcon size={28} className="mb-2 group-hover:text-primary" /><span className="text-xs font-bold">Upload profile photo</span></div>}
              </label>
            </Field>
          </div>
        </Section>

        {/* Submit */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" variant="primary" icon={UserPlus} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Creating...' : 'Create Member'}
          </Button>
        </div>
      </form>
    </PageTransition>
  );
}

