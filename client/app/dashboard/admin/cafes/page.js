'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import { uploadImageFile } from '@/app/utils/imageUpload';
import { stateOptions } from '@/app/utils/indianStates';
import { digitsOnly, sanitizeEmail, sanitizeName, blockNonInteger, blockNegative } from '@/app/utils/inputValidation';
import {
  Store, Plus, Edit2, Trash2, MapPin, Users, ShieldCheck, X, UserPlus, Image as ImageIcon, Receipt, Mail, Phone, User, CreditCard, Check, ChevronLeft, ChevronRight, Lock, Unlock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import ImpactDeleteModal from '@/app/components/ui/ImpactDeleteModal';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import { can } from '@/app/config/actions';

// Full grantable permission set (mirrors the Add-Member page + User schema).
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
  { key: 'sendMessages', label: 'Send Messages' },
  { key: 'messageSuperAdmin', label: 'Message Super Admin' },
];

// A cafe admin (owner) gets full cafe control by default; platform-only powers
// (impersonateUsers, sendGlobalNotifications) stay OFF.
const ADMIN_DEFAULT_PERMS = {
  viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
  forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true,
  viewAnalytics: true, manageCoupons: true, manageBranches: true, viewAuditLogs: true,
  viewAdminCenter: true, manageGlobalMenu: true, sendMessages: true, messageSuperAdmin: true,
};
const emptyPerms = () => PERMISSION_LIST.reduce((acc, { key }) => ({ ...acc, [key]: false }), {});
const adminPerms = () => ({ ...emptyPerms(), ...ADMIN_DEFAULT_PERMS });

const EMPTY_ADMIN = {
  name: '', email: '', password: '', phone: '', age: '', gender: 'Male',
  address1: '', address2: '', city: '', state: '', country: 'India', pincode: '',
  highestQualification: '12th Pass', monthlySalary: '', aadharNumber: '',
  aadharImage: '', profileImageUrl: '',
};

const EMPTY_FORM = {
  name: '', logo: '', gstin: '',
  address: { line1: '', line2: '', city: '', state: '', country: 'India', pincode: '' },
  contact: { phone: '', email: '' },
  // Default to NO admin so creating a cafe is never blocked by admin validation.
  // Admins can be created here ('new'/'existing') or from the Add-Member page.
  adminMode: 'none',
  admin: { ...EMPTY_ADMIN },
  adminPermissions: adminPerms(),
  adminUserId: '',
};

const inputCls = 'w-full px-5 py-2.5 rounded-xl border border-(--color-border) bg-(--color-bg-soft) text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm';
const labelCls = 'block text-[11px] font-medium text-(--color-text-muted) mb-2 ml-1';

// Full new-admin form — same fields + permissions + identity docs as Add-Member.
// `only` renders a slice of the form so the create wizard can split it across steps:
//   'profile'  → identity + address    'permsdocs' → permissions + documents
//   undefined  → everything (used by the edit-mode "Add an admin" block).
function NewAdminFields({ admin, setAdmin, permissions, togglePerm, onImage, uploading, only }) {
  const showProfile = !only || only === 'profile';
  const showPermsDocs = !only || only === 'permsdocs';
  return (
    <div className="space-y-6">
      {showProfile && (<>
      {/* Identity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div><label className={labelCls}>Admin Name *</label><input className={inputCls} value={admin.name} onChange={(e) => setAdmin('name', sanitizeName(e.target.value))} placeholder="Enter admin name" /></div>
        <div><label className={labelCls}>Email *</label><input type="email" className={inputCls} value={admin.email} onChange={(e) => setAdmin('email', sanitizeEmail(e.target.value))} placeholder="Enter admin email" /></div>
        <div><label className={labelCls}>Password *</label><input type="password" autoComplete="new-password" className={inputCls} value={admin.password} onChange={(e) => setAdmin('password', e.target.value)} placeholder="At least 10 characters" /></div>
        <div><label className={labelCls}>Phone *</label><input type="tel" inputMode="numeric" className={inputCls} value={admin.phone} maxLength={10} onChange={(e) => setAdmin('phone', digitsOnly(e.target.value, 10))} placeholder="Enter phone number" /></div>
        <div><label className={labelCls}>Age</label><input type="number" min="18" max="99" onKeyDown={blockNonInteger} className={inputCls} value={admin.age} onChange={(e) => setAdmin('age', e.target.value)} placeholder="30" /></div>
        <div>
          <PremiumSelect label="Gender" value={admin.gender} onChange={(v) => setAdmin('gender', v)}
            options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]} />
        </div>
      </div>

      {/* Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div><label className={labelCls}>Address Line 1 *</label><input className={inputCls} value={admin.address1} onChange={(e) => setAdmin('address1', e.target.value)} placeholder="Building / Street" /></div>
        <div><label className={labelCls}>Address Line 2</label><input className={inputCls} value={admin.address2} onChange={(e) => setAdmin('address2', e.target.value)} placeholder="Locality / Landmark" /></div>
        <div><label className={labelCls}>City *</label><input className={inputCls} value={admin.city} onChange={(e) => setAdmin('city', e.target.value)} placeholder="Mumbai" /></div>
        <div>
          <PremiumSelect label="State" value={admin.state} onChange={(v) => setAdmin('state', v)}
            options={stateOptions(admin.state)} placeholder="Select state" />
        </div>
        <div><label className={labelCls}>Country</label><input className={inputCls} value={admin.country} onChange={(e) => setAdmin('country', e.target.value)} placeholder="India" /></div>
        <div><label className={labelCls}>Pincode</label><input type="text" inputMode="numeric" className={inputCls} value={admin.pincode} maxLength={6} onChange={(e) => setAdmin('pincode', digitsOnly(e.target.value, 6))} placeholder="400001" /></div>
        <div>
          <PremiumSelect label="Highest Qualification" value={admin.highestQualification} onChange={(v) => setAdmin('highestQualification', v)}
            options={[{ label: '10th Pass', value: '10th Pass' }, { label: '12th Pass', value: '12th Pass' }, { label: 'Diploma', value: 'Diploma' }, { label: 'Graduate', value: 'Graduate' }, { label: 'Post Graduate', value: 'Post Graduate' }]} />
        </div>
        <div><label className={labelCls}>Monthly Salary (₹)</label><input type="number" min="0" onKeyDown={blockNegative} className={inputCls} value={admin.monthlySalary} onChange={(e) => setAdmin('monthlySalary', e.target.value)} placeholder="60000" /></div>
      </div>
      </>)}

      {showPermsDocs && (<>
      {/* Permissions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-(--color-text-muted) flex items-center gap-2"><Check size={13} className="text-primary" /> Permissions</p>
          <span className="text-[11px] font-medium text-(--color-text-muted)">{Object.values(permissions).filter(Boolean).length} selected</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PERMISSION_LIST.map(({ key, label }) => {
            const checked = !!permissions[key];
            return (
              <button type="button" key={key} onClick={() => togglePerm(key)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-medium text-left transition-all ${checked ? 'border-primary/40 bg-primary/10 text-primary' : 'border-(--color-border) bg-(--color-surface-soft) text-(--color-text-muted)'}`}>
                <span>{label}</span>
                <span className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary text-white' : 'border-(--color-border)'}`}>{checked && <Check size={12} strokeWidth={3} />}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Identity documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}><CreditCard size={11} className="inline mr-1" /> Aadhaar Number *</label>
          <input type="text" inputMode="numeric" className={inputCls} value={admin.aadharNumber} maxLength={12} onChange={(e) => setAdmin('aadharNumber', digitsOnly(e.target.value, 12))} placeholder="12-digit Aadhaar number" />
        </div>
        <div />
        <div>
          <label className={labelCls}>Aadhaar Card Image *</label>
          <label className={`group relative flex items-center justify-center min-h-28 bg-(--color-bg-soft) border-2 border-dashed rounded-xl hover:border-primary transition-colors cursor-pointer overflow-hidden ${admin.aadharImage ? 'border-(--color-border)' : 'border-danger/40'}`}>
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading.aadhar} onChange={(e) => onImage(e.target.files?.[0], 'aadharImage')} />
            {admin.aadharImage ? <img src={admin.aadharImage} alt="Aadhaar" className="w-full h-28 object-contain p-2" /> : <div className="flex flex-col items-center text-(--color-text-muted)"><ImageIcon size={24} className="mb-1 group-hover:text-primary" /><span className="text-xs font-medium">{uploading.aadhar ? 'Uploading…' : 'Upload Aadhaar'}</span></div>}
          </label>
        </div>
        <div>
          <label className={labelCls}>Profile Photo <span className="text-(--color-text-muted) normal-case font-medium">(optional)</span></label>
          <label className="group relative flex items-center justify-center min-h-28 bg-(--color-bg-soft) border-2 border-dashed border-(--color-border) rounded-xl hover:border-primary transition-colors cursor-pointer overflow-hidden">
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading.profile} onChange={(e) => onImage(e.target.files?.[0], 'profileImageUrl')} />
            {admin.profileImageUrl ? <img src={admin.profileImageUrl} alt="Profile" className="w-full h-28 object-contain p-2" /> : <div className="flex flex-col items-center text-(--color-text-muted)"><ImageIcon size={24} className="mb-1 group-hover:text-primary" /><span className="text-xs font-medium">{uploading.profile ? 'Uploading…' : 'Upload photo'}</span></div>}
          </label>
        </div>
      </div>
      </>)}
    </div>
  );
}

// Compact step indicator for the create wizard.
function Stepper({ steps, current }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex items-center gap-2 min-w-0">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${active ? 'border-primary/40 bg-primary/10 text-primary' : done ? 'border-(--color-border) bg-(--color-surface-soft) text-(--color-text-secondary)' : 'border-(--color-border) bg-(--color-surface-soft) text-(--color-text-muted)'}`}>
              <span className={`h-5 w-5 rounded-md flex items-center justify-center text-[11px] font-semibold shrink-0 ${active || done ? 'bg-primary text-white' : 'bg-(--color-border) text-(--color-text-muted)'}`}>
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-normal hidden sm:inline truncate"><Icon size={11} className="inline mr-1" />{s.title}</span>
            </div>
            {i < steps.length - 1 && <span className={`h-px w-3 sm:w-5 shrink-0 ${done ? 'bg-primary/50' : 'bg-(--color-border)'}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function CafesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuper = user?.role === 'super_admin';

  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // cafe being edited (or null = create)
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // Cafe queued for deletion; drives the impact confirmation dialog.
  const [deleting, setDeleting] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({ aadhar: false, profile: false });
  const [step, setStep] = useState(0); // create-wizard step index

  // Gate: only super_admin and admins (cafe owners) may open this page.
  useEffect(() => {
    if (user && !['super_admin', 'admin'].includes(user.role) && !user.permissions?.manageBranches) {
      toast.error('Access denied.');
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchCafes = async () => {
    progress.start();
    try {
      const res = await api.get('/cafes');
      setCafes(res.data.data || []);
    } catch (e) {
      console.error('Failed to load cafes');
    } finally {
      setLoading(false);
      progress.done();
    }
  };

  // Only super_admins assign existing users as admins. Per the requirement, the
  // "existing user" picker lists ONLY admins (assign an admin to another cafe).
  const fetchUsers = async () => {
    if (!isSuper) return;
    try {
      const res = await api.get('/users', { params: { role: 'admin', limit: 1000 } });
      setUsers((res.data.data || []).filter((u) => u.role === 'admin'));
    } catch (e) {
      console.error('Failed to load users');
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchCafes();
      fetchUsers();
    }, 0);
    return () => clearTimeout(t);
  }, [isSuper]);

  const openCreate = () => {
    setEditing(null);
    setStep(0);
    setForm({ ...EMPTY_FORM, admin: { ...EMPTY_ADMIN }, adminPermissions: adminPerms() });
    setShowModal(true);
  };

  const openEdit = (cafe) => {
    setEditing(cafe);
    setForm({
      ...EMPTY_FORM,
      admin: { ...EMPTY_ADMIN },
      adminPermissions: adminPerms(),
      name: cafe.name || '',
      logo: cafe.logo || '',
      gstin: cafe.gstin || '',
      address: { ...EMPTY_FORM.address, ...(cafe.address || {}) },
      contact: { ...EMPTY_FORM.contact, ...(cafe.contact || {}) },
      adminMode: 'new',
    });
    setShowModal(true);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setAddress = (k, v) => setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }));
  const setContact = (k, v) => setForm((f) => ({ ...f, contact: { ...f.contact, [k]: v } }));
  const setAdmin = (k, v) => setForm((f) => ({ ...f, admin: { ...f.admin, [k]: v } }));
  const togglePerm = (key) => setForm((f) => ({ ...f, adminPermissions: { ...f.adminPermissions, [key]: !f.adminPermissions[key] } }));

  // Upload the chosen logo/icon image → store the returned hosted URL in form.logo.
  // The shared helper compresses large photos and retries a transient failure,
  // so a cold serverless function no longer means "upload failed, try again".
  const handleLogoFile = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    const t = toast.loading('Uploading logo…');
    try {
      const url = await uploadImageFile(file, { endpoint: '/cafes/upload-logo' });
      setField('logo', url);
      toast.success('Logo uploaded', { id: t });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Logo upload failed', { id: t });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Upload an admin image (Aadhaar card or profile photo) → store the hosted URL.
  const handleAdminImage = async (file, field) => {
    if (!file) return;
    const which = field === 'aadharImage' ? 'aadhar' : 'profile';
    setUploadingImg((u) => ({ ...u, [which]: true }));
    const t = toast.loading('Uploading image…');
    try {
      const url = await uploadImageFile(file, { endpoint: '/cafes/upload-image' });
      setAdmin(field, url);
      toast.success('Image uploaded', { id: t });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Image upload failed', { id: t });
    } finally {
      setUploadingImg((u) => ({ ...u, [which]: false }));
    }
  };

  // Client-side guard for the "new admin" path so the user gets instant, specific
  // feedback before the request (the server validates fully too).
  const validateNewAdmin = (a) => {
    if (!a.name?.trim()) return 'Admin name is required';
    if (!/^\S+@\S+\.\S+$/.test(a.email || '')) return 'A valid admin email is required';
    if ((a.password || '').length < 10) return 'Admin password must be at least 10 characters';
    if (!/^[0-9]{10}$/.test(a.phone || '')) return 'A valid 10-digit admin phone is required';
    if (!a.address1?.trim()) return 'Admin address is required';
    if (!a.city?.trim()) return 'Admin city is required';
    if (!/^[0-9]{12}$/.test(a.aadharNumber || '')) return 'A valid 12-digit Aadhaar number is required';
    if (!a.aadharImage) return 'Please upload the Aadhaar card image';
    return null;
  };

  const buildAdminPayload = () => ({ ...form.admin, permissions: form.adminPermissions });

  // --- Create wizard ---------------------------------------------------------
  // Steps are derived from adminMode: the two admin sub-steps only exist when the
  // super admin chooses to create a brand-new admin account.
  const createSteps = [
    { key: 'brand', title: 'Brand', icon: Store },
    { key: 'receipt', title: 'Receipt', icon: Receipt },
    { key: 'admin', title: 'Admin', icon: ShieldCheck },
    ...(form.adminMode === 'new'
      ? [
          { key: 'profile', title: 'Admin Profile', icon: User },
          { key: 'access', title: 'Access & Docs', icon: Check },
        ]
      : []),
  ];
  const curStep = Math.min(step, createSteps.length - 1);
  const isLastStep = curStep === createSteps.length - 1;

  // Per-step validation so the user can't advance with bad data; the final submit
  // re-validates everything server-side too.
  const validateStep = (key) => {
    if (key === 'brand') {
      if (!form.name.trim()) return 'Cafe name is required';
    }
    if (key === 'receipt') {
      if (form.contact.phone && !/^[0-9]{10}$/.test(form.contact.phone)) return 'Contact phone must be exactly 10 digits';
      if (form.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact.email)) return 'Invalid contact email';
    }
    if (key === 'admin') {
      if (form.adminMode === 'existing' && !form.adminUserId) return 'Select an admin to assign';
    }
    if (key === 'profile') {
      const a = form.admin;
      if (!a.name?.trim()) return 'Admin name is required';
      if (!/^\S+@\S+\.\S+$/.test(a.email || '')) return 'A valid admin email is required';
      if ((a.password || '').length < 10) return 'Admin password must be at least 10 characters';
      if (!/^[0-9]{10}$/.test(a.phone || '')) return 'A valid 10-digit admin phone is required';
      if (!a.address1?.trim()) return 'Admin address is required';
      if (!a.city?.trim()) return 'Admin city is required';
    }
    if (key === 'access') {
      const a = form.admin;
      if (!/^[0-9]{12}$/.test(a.aadharNumber || '')) return 'A valid 12-digit Aadhaar number is required';
      if (!a.aadharImage) return 'Please upload the Aadhaar card image';
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(createSteps[curStep].key);
    if (err) return toast.error(err);
    setStep(Math.min(curStep + 1, createSteps.length - 1));
  };
  const goBack = () => setStep(Math.max(0, curStep - 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Wizard guard: in create mode, Enter / early submit just advances a step.
    if (!editing && !isLastStep) return goNext();
    if (!form.name.trim()) return toast.error('Cafe name is required');
    if (form.contact.phone && !/^[0-9]{10}$/.test(form.contact.phone))
      return toast.error('Contact phone must be exactly 10 digits');
    if (form.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact.email))
      return toast.error('Invalid contact email');
    if (!editing && form.adminMode === 'new') {
      const adminErr = validateNewAdmin(form.admin);
      if (adminErr) return toast.error(adminErr);
    }
    if (!editing && form.adminMode === 'existing' && !form.adminUserId) {
      return toast.error('Select an admin to assign');
    }
    setSaving(true);
    const loadToast = toast.loading(editing ? 'Saving cafe...' : 'Creating cafe...');
    try {
      if (editing) {
        await api.patch(`/cafes/${editing._id}`, {
          name: form.name, logo: form.logo, gstin: form.gstin,
          address: form.address, contact: form.contact,
        });
      } else {
        const payload = {
          name: form.name, logo: form.logo, gstin: form.gstin,
          address: form.address, contact: form.contact,
          adminMode: form.adminMode,
        };
        if (form.adminMode === 'new') payload.admin = buildAdminPayload();
        if (form.adminMode === 'existing') payload.adminUserId = form.adminUserId;
        await api.post('/cafes', payload);
      }
      toast.success(editing ? 'Cafe updated' : 'Cafe created', { id: loadToast });
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      fetchCafes();
    } catch (err) {
      const d = err.response?.data;
      const fieldErrors = d?.errors?.map?.((o) => Object.values(o)[0]).filter(Boolean).join(', ');
      const msg = fieldErrors || d?.message || 'Something went wrong. Please try again.';
      toast.error(msg, { id: loadToast });
    } finally {
      setSaving(false);
    }
  };

  // Deletion always goes through the impact dialog now: a cafe can own branches,
  // menus, stock and staff, and a bare confirm() gave no hint of that.
  const handleDelete = (cafe) => setDeleting(cafe);

  const confirmDelete = async ({ force, staffMode, staffTargetLocationId, purgeKeys }) => {
    const cafe = deleting;
    if (!cafe) return;
    const loadToast = toast.loading('Deleting cafe...');
    try {
      const res = await api.delete(`/cafes/${cafe._id}`, {
        data: { force, staffMode, staffTargetLocationId, purgeKeys },
      });
      toast.success(res.data?.message || 'Cafe deleted', { id: loadToast, duration: 6000 });
      setDeleting(null);
      fetchCafes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete cafe', { id: loadToast });
    }
  };

  const handleToggleBlock = async (cafe) => {
    const blocking = cafe.status !== 'suspended';
    let reason = '';
    if (blocking) {
      reason = window.prompt(
        `Block "${cafe.name}"?\n\nEveryone in this cafe will be locked out immediately and its public ordering will stop.\n\nReason (shown to them):`,
        ''
      );
      // A null return is Cancel; an empty string is "block, no reason given".
      if (reason === null) return;
    } else if (!confirm(`Unblock "${cafe.name}"? Its staff will be able to log in again.`)) {
      return;
    }

    const loadToast = toast.loading(blocking ? 'Blocking cafe...' : 'Unblocking cafe...');
    try {
      const res = await api.patch(`/cafes/${cafe._id}/suspension`, { suspended: blocking, reason });
      toast.success(res.data?.message || 'Updated', { id: loadToast });
      fetchCafes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the cafe', { id: loadToast });
    }
  };

  const handleAddAdmin = async (cafe) => {
    if (form.adminMode === 'new') {
      const adminErr = validateNewAdmin(form.admin);
      if (adminErr) return toast.error(adminErr);
    }
    if (form.adminMode === 'existing' && !form.adminUserId) return toast.error('Select an admin to assign');
    const payload = { adminMode: form.adminMode };
    if (form.adminMode === 'new') payload.admin = buildAdminPayload();
    if (form.adminMode === 'existing') payload.adminUserId = form.adminUserId;
    const loadToast = toast.loading('Adding admin...');
    try {
      await api.post(`/cafes/${cafe._id}/admins`, payload);
      toast.success('Admin added', { id: loadToast });
      setForm((f) => ({ ...f, admin: { ...EMPTY_ADMIN }, adminPermissions: adminPerms(), adminUserId: '' }));
      fetchCafes();
      const fresh = await api.get(`/cafes/${cafe._id}`);
      if (fresh.data.data) setEditing(fresh.data.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.map((o) => Object.values(o)[0]).join(', ') || 'Could not add admin';
      toast.error(msg, { id: loadToast });
    }
  };

  const handleRemoveAdmin = async (cafe, adminId) => {
    const loadToast = toast.loading('Removing admin...');
    try {
      await api.delete(`/cafes/${cafe._id}/admins/${adminId}`);
      toast.success('Admin removed', { id: loadToast });
      fetchCafes();
      const fresh = await api.get(`/cafes/${cafe._id}`);
      if (fresh.data.data) setEditing(fresh.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove admin', { id: loadToast });
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  const adminModeSelect = (extra = []) => (
    <PremiumSelect
      label="How to assign the admin"
      value={form.adminMode}
      // Clamp the wizard back to the admin step so switching mode never leaves a
      // stale later-step index pointing past the (now changed) step list.
      onChange={(v) => { setField('adminMode', v); setStep((s) => Math.min(s, 2)); }}
      options={[
        { label: 'Create a new admin account', value: 'new' },
        { label: 'Assign an existing admin', value: 'existing' },
        ...extra,
      ]}
    />
  );

  const existingAdminSelect = () => (
    <PremiumSelect
      label="Select an admin to assign"
      placeholder={users.length ? 'Choose an admin' : 'No admins available'}
      value={form.adminUserId}
      onChange={(v) => setField('adminUserId', v)}
      options={users.map((u) => ({ label: `${u.name} — ${u.email}`, value: u._id }))}
    />
  );

  // Reusable sections — shared between the create wizard and the edit form.
  const renderBrandSection = () => (
    <section className="space-y-5">
      <h3 className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><Store size={14} className="text-primary" /> Brand Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Cafe Name *</label>
          <input className={inputCls} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Brew Haven" />
        </div>
        <div>
          <label className={labelCls}>GSTIN</label>
          <input className={inputCls} value={form.gstin} onChange={(e) => setField('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}><ImageIcon size={11} className="inline mr-1" /> Logo / Icon (shown on receipts)</label>
          <div className="flex items-center gap-4">
            <label className="relative h-20 w-20 shrink-0 rounded-xl border border-dashed border-(--color-border) bg-(--color-bg-soft) flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-all">
              {form.logo ? (
                <img src={form.logo} alt="logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={22} className="text-(--color-text-muted)" />
              )}
              {uploadingLogo && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[11px] font-medium uppercase">…</div>
              )}
              <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleLogoFile(e.target.files?.[0])} disabled={uploadingLogo} />
            </label>
            <div className="flex-1">
              <input className={inputCls} value={form.logo} onChange={(e) => setField('logo', e.target.value)} placeholder="Click the tile to upload, or paste an image URL" />
              <p className="text-[11px] text-(--color-text-muted) mt-1.5 ml-1">PNG/JPG up to 5MB. Upload replaces the URL automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderReceiptSection = () => (
    <section className="space-y-5">
      <h3 className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><Receipt size={14} className="text-primary" /> Receipt Address & Contact</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label className={labelCls}>Address Line 1</label>
          <input className={inputCls} value={form.address.line1} onChange={(e) => setAddress('line1', e.target.value)} />
        </div>
        <div><label className={labelCls}>City</label><input className={inputCls} value={form.address.city} onChange={(e) => setAddress('city', e.target.value)} /></div>
        <div>
          <PremiumSelect label="State" value={form.address.state} onChange={(v) => setAddress('state', v)}
            options={stateOptions(form.address.state)} placeholder="Select state" />
        </div>
        <div><label className={labelCls}>Pincode</label><input type="text" inputMode="numeric" maxLength={6} className={inputCls} value={form.address.pincode} onChange={(e) => setAddress('pincode', digitsOnly(e.target.value, 6))} /></div>
        <div><label className={labelCls}><Phone size={11} className="inline mr-1" /> Phone</label><input type="tel" inputMode="numeric" maxLength={10} className={inputCls} value={form.contact.phone} onChange={(e) => setContact('phone', digitsOnly(e.target.value, 10))} /></div>
        <div className="md:col-span-2"><label className={labelCls}><Mail size={11} className="inline mr-1" /> Email</label><input type="email" className={inputCls} value={form.contact.email} onChange={(e) => setContact('email', sanitizeEmail(e.target.value))} /></div>
      </div>
    </section>
  );

  // The admin step picks HOW to assign the owner. New-admin fields live on their
  // own steps; the existing-admin picker shows inline here.
  const renderAdminStep = () => (
    <section className="space-y-5">
      <h3 className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /> Cafe Admin (Owner)</h3>
      {adminModeSelect([{ label: 'No admin for now', value: 'none' }])}
      {form.adminMode === 'existing' && existingAdminSelect()}
      {form.adminMode === 'new' && (
        <p className="text-[11px] text-(--color-text-muted)">Continue to the next steps to fill in the new admin’s profile, permissions and documents.</p>
      )}
      {form.adminMode === 'none' && (
        <p className="text-[11px] text-(--color-text-muted)">You can add an admin later from this page or the Add-Member page.</p>
      )}
    </section>
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <SlideIn direction="down">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) flex items-center tracking-tight leading-none">
                <Store className="mr-3 text-primary" size={24} strokeWidth={2.5} /> Cafe <span className="ml-3 text-primary">Management</span>
              </h1>
              <p className="text-(--color-text-secondary) text-sm mt-3 font-medium">
                {isSuper ? 'Create and manage every cafe (brand). Each cafe owns its own branches and bills.' : 'Manage your cafe brand details shown on receipts.'}
              </p>
            </div>
            {can(user, 'cafes.add') && (
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={openCreate}
                className="flex items-center justify-center px-5 py-3 bg-primary text-(--color-on-primary) rounded-xl font-semibold uppercase tracking-normal text-[11px] shadow-sm hover:opacity-90 transition-all whitespace-nowrap"
              >
                <Plus className="mr-2" size={16} /> New Cafe
              </motion.button>
            )}
          </div>
        </SlideIn>

        {cafes.length === 0 ? (
          <div className="p-10 text-center text-(--color-text-muted) rounded-xl border border-dashed border-(--color-border)">
            <Store size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium uppercase tracking-normal">No cafes yet</p>
            {isSuper && <p className="text-xs mt-2">Click “New Cafe” to create your first brand.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {cafes.map((cafe, i) => (
              <SlideIn key={cafe._id} delay={i * 0.04} direction="up">
                <div className="h-full rounded-xl border border-(--color-border) bg-(--color-surface)/60 p-5 flex flex-col gap-5 hover:border-primary/30 transition-all shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                        {cafe.logo ? <img src={cafe.logo} alt={cafe.name} className="h-full w-full object-cover" /> : <Store size={24} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-base font-semibold text-(--color-text-primary) truncate">{cafe.name}</p>
                          {cafe.status === 'suspended' && (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-normal bg-danger/10 text-danger border border-danger/20">
                              <Lock size={10} /> Blocked
                            </span>
                          )}
                        </div>
                        {cafe.gstin ? (
                          <p className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal mt-0.5 truncate">GSTIN: {cafe.gstin}</p>
                        ) : (
                          <p className="text-[11px] font-medium text-(--color-text-muted) mt-0.5 truncate">{cafe.address?.city || 'No address set'}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEdit(cafe)} className="p-2.5 rounded-xl bg-(--color-surface-soft) text-(--color-text-secondary) border border-(--color-border) hover:text-primary transition-all" title="Edit">
                        <Edit2 size={15} />
                      </button>
                      {isSuper && (
                        <button
                          onClick={() => handleToggleBlock(cafe)}
                          className={`p-2.5 rounded-xl border transition-all ${
                            cafe.status === 'suspended'
                              ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-(--color-on-primary)'
                              : 'bg-(--color-surface-soft) text-(--color-text-secondary) border-(--color-border) hover:text-danger'
                          }`}
                          title={cafe.status === 'suspended' ? 'Unblock this cafe' : 'Block this cafe'}
                        >
                          {cafe.status === 'suspended' ? <Unlock size={15} /> : <Lock size={15} />}
                        </button>
                      )}
                      {can(user, 'cafes.delete') && (
                        <button onClick={() => handleDelete(cafe)} className="p-2.5 rounded-xl bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white transition-all" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-(--color-surface-soft) border border-(--color-border) p-3">
                      <div className="flex items-center gap-2 text-(--color-text-muted)"><MapPin size={13} /><span className="text-[11px] font-medium uppercase tracking-normal">Branches</span></div>
                      <p className="text-2xl font-semibold text-(--color-text-primary) mt-1">{cafe.branchCount ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-(--color-surface-soft) border border-(--color-border) p-3">
                      <div className="flex items-center gap-2 text-(--color-text-muted)"><Users size={13} /><span className="text-[11px] font-medium uppercase tracking-normal">Admins</span></div>
                      <p className="text-2xl font-semibold text-(--color-text-primary) mt-1">{cafe.admins?.length ?? 0}</p>
                    </div>
                  </div>

                  {cafe.admins?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {cafe.admins.slice(0, 3).map((a) => (
                        <span key={a._id} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                          <ShieldCheck size={11} /> {a.name}
                        </span>
                      ))}
                      {cafe.admins.length > 3 && (
                        <span className="text-[11px] font-medium px-2 py-1 text-(--color-text-muted)">+{cafe.admins.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </SlideIn>
            ))}
          </div>
        )}

        {/* Create / Edit modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/80" />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }}
                className="bg-(--color-surface) rounded-xl max-w-3xl w-full shadow-sm relative z-10 border border-(--color-border) max-h-[70vh] flex flex-col"
              >
                <div className="flex justify-between items-center px-6 py-4 border-b border-(--color-border) shrink-0">
                  <h2 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">
                    {editing ? 'Edit' : 'Create'} <span className="text-primary">Cafe</span>
                  </h2>
                  <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-(--color-surface-soft) text-(--color-text-muted)"><X size={22} /></button>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {editing ? (
                      <>
                        {renderBrandSection()}
                        {renderReceiptSection()}
                        <div className="flex gap-4 pt-2">
                          <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-5 py-3 rounded-xl text-xs font-medium uppercase tracking-normal text-(--color-text-muted) bg-(--color-surface-soft) hover:bg-(--color-bg-soft) transition-all">Cancel</button>
                          <button type="submit" disabled={saving} className="flex-1 px-5 py-3 rounded-xl text-xs font-semibold uppercase tracking-normal text-(--color-on-primary) bg-primary hover:opacity-90 shadow-sm transition-all disabled:opacity-50">Save Changes</button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Step indicator */}
                        <Stepper steps={createSteps} current={curStep} />

                        {/* Step content */}
                        <div className="min-h-48">
                          {createSteps[curStep].key === 'brand' && renderBrandSection()}
                          {createSteps[curStep].key === 'receipt' && renderReceiptSection()}
                          {createSteps[curStep].key === 'admin' && isSuper && renderAdminStep()}
                          {createSteps[curStep].key === 'admin' && !isSuper && (
                            <p className="text-[11px] text-(--color-text-muted)">Only a super admin can assign a cafe owner.</p>
                          )}
                          {createSteps[curStep].key === 'profile' && (
                            <section className="space-y-5">
                              <h3 className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><User size={14} className="text-primary" /> Admin Profile</h3>
                              <NewAdminFields only="profile" admin={form.admin} setAdmin={setAdmin} permissions={form.adminPermissions} togglePerm={togglePerm} onImage={handleAdminImage} uploading={uploadingImg} />
                            </section>
                          )}
                          {createSteps[curStep].key === 'access' && (
                            <section className="space-y-5">
                              <h3 className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><Check size={14} className="text-primary" /> Permissions & Documents</h3>
                              <NewAdminFields only="permsdocs" admin={form.admin} setAdmin={setAdmin} permissions={form.adminPermissions} togglePerm={togglePerm} onImage={handleAdminImage} uploading={uploadingImg} />
                            </section>
                          )}
                        </div>

                        {/* Wizard navigation */}
                        <div className="flex items-center gap-4 pt-2">
                          <button
                            type="button"
                            onClick={curStep === 0 ? () => setShowModal(false) : goBack}
                            className="px-5 py-3 rounded-xl text-xs font-medium uppercase tracking-normal text-(--color-text-muted) bg-(--color-surface-soft) hover:bg-(--color-bg-soft) transition-all inline-flex items-center gap-2"
                          >
                            {curStep === 0 ? 'Cancel' : (<><ChevronLeft size={15} /> Back</>)}
                          </button>
                          <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Step {curStep + 1} / {createSteps.length}</span>
                          {isLastStep ? (
                            <button type="submit" disabled={saving || uploadingImg.aadhar || uploadingImg.profile} className="flex-1 px-5 py-3 rounded-xl text-xs font-semibold uppercase tracking-normal text-(--color-on-primary) bg-primary hover:opacity-90 shadow-sm transition-all disabled:opacity-50">
                              {saving ? 'Creating…' : 'Create Cafe'}
                            </button>
                          ) : (
                            <button type="button" onClick={goNext} className="flex-1 px-5 py-3 rounded-xl text-xs font-semibold uppercase tracking-normal text-(--color-on-primary) bg-primary hover:opacity-90 shadow-sm transition-all inline-flex items-center justify-center gap-2">
                              Next <ChevronRight size={15} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </form>

                  {/* Admin management — edit mode (super_admin only) */}
                  {editing && isSuper && (
                    <section className="mt-10 pt-8 border-t border-(--color-border) space-y-5">
                      <h3 className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><Users size={14} className="text-primary" /> Cafe Admins</h3>
                      <div className="space-y-2">
                        {(editing.admins || []).length === 0 && (
                          <p className="text-xs text-(--color-text-muted)">No admins assigned yet.</p>
                        )}
                        {(editing.admins || []).map((a) => (
                          <div key={a._id} className="flex items-center justify-between p-3.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">{a.name?.charAt(0)}</div>
                              <div className="min-w-0"><p className="text-sm font-medium text-(--color-text-primary) truncate">{a.name}</p><p className="text-[11px] text-(--color-text-muted) truncate">{a.email}</p></div>
                            </div>
                            <button onClick={() => handleRemoveAdmin(editing, a._id)} className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-all shrink-0"><X size={14} /></button>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border border-dashed border-(--color-border) p-5 space-y-4">
                        <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><UserPlus size={13} /> Add an admin</p>
                        {adminModeSelect()}
                        {form.adminMode === 'new' ? (
                          <NewAdminFields admin={form.admin} setAdmin={setAdmin} permissions={form.adminPermissions} togglePerm={togglePerm} onImage={handleAdminImage} uploading={uploadingImg} />
                        ) : (
                          existingAdminSelect()
                        )}
                        <button type="button" onClick={() => handleAddAdmin(editing)} disabled={uploadingImg.aadhar || uploadingImg.profile} className="w-full px-5 py-3 rounded-xl text-xs font-semibold uppercase tracking-normal text-(--color-on-primary) bg-primary hover:opacity-90 transition-all disabled:opacity-50">Add Admin</button>
                      </div>
                    </section>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <ImpactDeleteModal
          isOpen={!!deleting}
          onClose={() => setDeleting(null)}
          entity="cafe"
          id={deleting?._id}
          name={deleting?.name}
          onConfirm={confirmDelete}
        />
      </div>
    </PageTransition>
  );
}
