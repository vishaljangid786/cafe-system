'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import {
  UserPlus, User, Mail, Phone, MapPin, Shield, CreditCard,
  Image as ImageIcon, Check, ArrowLeft, Lock
} from 'lucide-react';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Button } from '@/app/components/ui/Button';
import { PageTransition } from '@/app/components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import toast from 'react-hot-toast';

const PERMISSION_LIST = [
  { key: 'viewRevenue', label: 'View Revenue' },
  { key: 'editRevenue', label: 'Edit Revenue' },
  { key: 'viewOrders', label: 'View Orders' },
  { key: 'manageOrders', label: 'Manage Orders' },
  { key: 'forceComplete', label: 'Force Complete Orders' },
  { key: 'exportReports', label: 'Export Reports' },
  { key: 'manageStaff', label: 'Manage Staff' },
  { key: 'manageNotifications', label: 'Manage Notifications' },
  { key: 'viewAnalytics', label: 'View Analytics' },
  { key: 'manageCoupons', label: 'Manage Coupons' },
  { key: 'manageBranches', label: 'Open Branches Page' },
  { key: 'viewAuditLogs', label: 'Open Security Logs' },
  { key: 'impersonateUsers', label: 'Login As Users' },
  { key: 'viewAdminCenter', label: 'Open Admin Center' },
  { key: 'manageGlobalMenu', label: 'Manage Global Menu' },
  { key: 'sendGlobalNotifications', label: 'Send Global Notifications' },
];

// Default permissions each role gets (mirrors the backend). Keys not listed default to false.
const ROLE_DEFAULTS = {
  admin: { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true },
  branch_admin: { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, viewAnalytics: true },
  location_admin: { viewRevenue: true, viewOrders: true, manageOrders: true, exportReports: true, viewAnalytics: true },
  staff: { viewOrders: true, manageOrders: true },
  chef: { viewOrders: true, manageOrders: true },
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
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [permissions, setPermissions] = useState(emptyPerms());
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

  // Load branches (+ admins for super admin)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/locations');
        setLocations(res.data.data || []);
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

  // Pre-select the chosen role's default permissions
  useEffect(() => {
    setPermissions({ ...emptyPerms(), ...(ROLE_DEFAULTS[form.role] || {}) });
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
        { value: 'staff', label: 'Staff' },
        { value: 'chef', label: 'Chef' },
      ];
      case 'admin': return [
        { value: 'branch_admin', label: 'Branch Admin' },
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

  const allBranchOptions = useMemo(() => locations.map((l) => ({ label: `${l.city} - ${l.name}`, value: l._id })), [locations]);

  // Branches the creator may assign (super admin: all; admin/branch admin: their own)
  const myBranchOptions = useMemo(() => {
    if (currentUser?.role === 'super_admin') return allBranchOptions;
    return locations.filter((l) => myBranchIds.includes(l._id.toString())).map((l) => ({ label: `${l.city} - ${l.name}`, value: l._id }));
  }, [currentUser, locations, myBranchIds, allBranchOptions]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Light client-side validation (the backend validates fully)
    if (!form.name || !form.email || !form.password || !form.phone) {
      toast.error('Please fill name, email, password and phone.');
      return;
    }
    if (form.role === 'branch_admin' && (form.accessibleLocations || []).length === 0) {
      toast.error('Please assign at least one branch to the branch admin.');
      return;
    }
    if (['staff', 'chef'].includes(form.role) && !form.assignedLocation) {
      toast.error('Please select a branch for this member.');
      return;
    }

    const payload = { ...form };
    if (form.role === 'branch_admin') {
      const ids = form.accessibleLocations || [];
      payload.assignedLocation = ids[0] || '';
      payload.accessibleLocations = ids;
    } else if (form.role === 'admin') {
      payload.accessibleLocations = form.accessibleLocations || [];
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
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8 pb-24">
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
          <Button type="button" variant="outline" icon={ArrowLeft} onClick={() => router.back()} className="w-full sm:w-auto">
            Back
          </Button>
        </div>

        {/* Basic Info */}
        <Section icon={User} title="Basic Information" desc="Login and identity details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Full Name">
              <input required className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Rahul Sharma" />
            </Field>
            <Field label="Email Address">
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="rahul@cafe.com" />
            </Field>
            <Field label="Password" hint="The member can change it after first login.">
              <input required type="text" className={inputCls} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 6 characters" />
            </Field>
            <Field label="Phone Number">
              <input required className={inputCls} value={form.phone} maxLength={10} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" />
            </Field>
            <Field label="Age">
              <input type="number" min="18" max="99" className={inputCls} value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="24" />
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
                onChange={(v) => { set('role', v); set('assignedLocation', ''); set('accessibleLocations', []); setSelectedAdminId(''); }}
                options={availableRoles}
              />
            </Field>
            <Field label="Highest Qualification">
              <PremiumSelect value={form.highestQualification} onChange={(v) => set('highestQualification', v)} options={[{ label: '10th Pass', value: '10th Pass' }, { label: '12th Pass', value: '12th Pass' }, { label: 'Diploma', value: 'Diploma' }, { label: 'Graduate', value: 'Graduate' }, { label: 'Post Graduate', value: 'Post Graduate' }]} />
            </Field>

            {/* Branch selection per role */}
            {['staff', 'chef'].includes(form.role) && (
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
                <PremiumSelect value={form.accessibleLocations} onChange={(v) => set('accessibleLocations', v)} options={allBranchOptions} multiple placeholder="Select branches" />
              </Field>
            )}

            <Field label="Monthly Salary (₹)">
              <input type="number" min="0" className={inputCls} value={form.monthlySalary} onChange={(e) => set('monthlySalary', e.target.value)} placeholder="28000" />
            </Field>
          </div>
        </Section>

        {/* Permissions */}
        <Section icon={Check} title="Permissions" desc="This role's defaults are pre-selected — add more if needed (only ones you have)">
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
                    {!allowed && <span className="text-[9px] text-danger normal-case">You don't have this</span>}
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
        <Section icon={CreditCard} title="Identity Documents" desc="Aadhaar and profile photo (optional)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Aadhaar Number">
              <input className={inputCls} value={form.aadharNumber} maxLength={12} onChange={(e) => set('aadharNumber', e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12-digit Aadhaar (optional)" />
            </Field>
            <div />
            <Field label="Aadhaar Card Image">
              <label className="group relative flex items-center justify-center min-h-36 bg-(--color-bg-soft) border-2 border-dashed border-(--color-border) rounded-xl hover:border-primary transition-colors cursor-pointer overflow-hidden">
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setAadharImage(e.target.files[0])} />
                {aadharPreview ? <img src={aadharPreview} alt="Aadhaar" className="w-full h-36 object-contain p-2" /> : <div className="flex flex-col items-center text-(--color-text-muted)"><ImageIcon size={28} className="mb-2 group-hover:text-primary" /><span className="text-xs font-bold">Upload Aadhaar photo</span></div>}
              </label>
            </Field>
            <Field label="Profile Photo">
              <label className="group relative flex items-center justify-center min-h-36 bg-(--color-bg-soft) border-2 border-dashed border-(--color-border) rounded-xl hover:border-primary transition-colors cursor-pointer overflow-hidden">
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setProfileImage(e.target.files[0])} />
                {profilePreview ? <img src={profilePreview} alt="Profile" className="w-full h-36 object-contain p-2" /> : <div className="flex flex-col items-center text-(--color-text-muted)"><ImageIcon size={28} className="mb-2 group-hover:text-primary" /><span className="text-xs font-bold">Upload profile photo</span></div>}
              </label>
            </Field>
          </div>
        </Section>

        {/* Submit */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 bg-(--color-bg-base)/80 backdrop-blur py-4 -mx-1 px-1">
          <Button type="button" variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" variant="primary" icon={UserPlus} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Creating...' : 'Create Member'}
          </Button>
        </div>
      </form>
    </PageTransition>
  );
}
