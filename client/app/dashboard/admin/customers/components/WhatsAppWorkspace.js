'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import { can } from '@/app/config/actions';
import toast from 'react-hot-toast';
import { Button } from '@/app/components/ui/Button';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import {
  MessageCircle, Send, Zap, History, CheckCircle2, AlertTriangle, Users,
  Cake, Heart, UserPlus, Sparkles, RefreshCw, Info,
} from 'lucide-react';

const SEGMENTS = [
  { value: 'all', label: 'Everyone' },
  { value: 'new', label: 'New customers' },
  { value: 'active', label: 'Active (last 30 days)' },
  { value: 'atrisk', label: 'At risk (inactive 30+ days)' },
  { value: 'birthday', label: 'Birthdays this month' },
];

const TRIGGERS = [
  { key: 'welcome', label: 'Welcome new customers', desc: 'Sent automatically right after someone signs up at the QR menu.', icon: UserPlus, kind: 'event' },
  { key: 'birthday', label: 'Birthday wishes', desc: "Sent on the customer's birthday. Runs once a day.", icon: Cake, kind: 'scheduled' },
  { key: 'winback', label: 'Win back inactive customers', desc: "Sent when a customer hasn't visited for a while. Runs once a day.", icon: Heart, kind: 'scheduled' },
  { key: 'thankyou', label: 'Thank you after an order', desc: 'Sent when a customer\'s order is completed.', icon: Sparkles, kind: 'event' },
];

const sameScope = (rule, s) =>
  String(rule.cafe || '') === String(s.cafeId || '') && String(rule.location || '') === String(s.locationId || '');

export default function WhatsAppWorkspace() {
  const { user, selectedCafe, selectedLocation } = useAuth();
  const canSend = can(user, 'customers.message');
  const canAuto = can(user, 'customers.automate');
  const isSuper = user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sub, setSub] = useState(canSend ? 'broadcast' : 'automations');

  const configured = status?.configured;
  const approved = useMemo(() => templates.filter((t) => t.status === 'APPROVED'), [templates]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, tpl, auto, camp, cf, loc] = await Promise.allSettled([
        api.get('/whatsapp/status'),
        api.get('/whatsapp/templates'),
        api.get('/whatsapp/automations'),
        api.get('/whatsapp/campaigns'),
        api.get('/cafes'),
        api.get('/locations'),
      ]);
      if (st.status === 'fulfilled') setStatus(st.value.data.data);
      if (tpl.status === 'fulfilled') setTemplates(tpl.value.data.data || []);
      if (auto.status === 'fulfilled') setAutomations(auto.value.data.data || []);
      if (camp.status === 'fulfilled') setCampaigns(camp.value.data.data || []);
      if (cf.status === 'fulfilled') setCafes(cf.value.data?.data || cf.value.data || []);
      if (loc.status === 'fulfilled') setLocations(loc.value.data?.data || loc.value.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen fullScreen={false} />;

  const cafeOptions = cafes.map((c) => ({ value: c._id, label: c.name }));

  return (
    <div className="space-y-6">
      {/* Header + connection status */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-[#25D366]/10 text-[#25D366]"><MessageCircle size={22} /></div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-(--color-text-primary)">WhatsApp</h2>
          <p className="text-xs text-(--color-text-muted)">Broadcast offers and automate messages over the official WhatsApp Business API.</p>
        </div>
        <button onClick={load} title="Refresh" className="p-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text-primary)">
          <RefreshCw size={15} />
        </button>
      </div>

      <ConnectionBanner status={status} />

      {/* Sub-tabs */}
      <div className="inline-flex flex-wrap gap-1 bg-(--color-surface) border border-(--color-border) rounded-xl p-1.5">
        {[
          canSend && { key: 'broadcast', label: 'Broadcast', icon: Send },
          canAuto && { key: 'automations', label: 'Automations', icon: Zap },
          { key: 'history', label: 'History', icon: History },
        ].filter(Boolean).map((t) => {
          const on = sub === t.key;
          return (
            <button key={t.key} onClick={() => setSub(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                on ? 'bg-primary text-(--color-on-primary) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-surface-soft)'
              }`}>
              <t.icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {sub === 'broadcast' && canSend && (
        <BroadcastPanel
          configured={configured} approved={approved} cafeOptions={cafeOptions}
          cafes={cafes} locations={locations} defaultCafe={selectedCafe} defaultLocation={selectedLocation}
          onSent={load}
        />
      )}
      {sub === 'automations' && canAuto && (
        <AutomationsPanel
          configured={configured} approved={approved} automations={automations}
          cafes={cafes} locations={locations} isSuper={isSuper} defaultCafe={selectedCafe}
          onSaved={load}
        />
      )}
      {sub === 'history' && <HistoryPanel campaigns={campaigns} />}
    </div>
  );
}

/* ─────────────────────────── Connection banner ─────────────────────────── */
function ConnectionBanner({ status }) {
  if (!status) return null;
  if (status.configured) {
    return (
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
        <CheckCircle2 size={18} className="text-success" />
        <div className="text-xs text-(--color-text-primary)">
          Connected{status.displayPhoneNumber ? <> as <span className="font-semibold">{status.displayPhoneNumber}</span></> : ''}
          {status.verifiedName ? <> · {status.verifiedName}</> : ''}
          {status.qualityRating ? <> · quality <span className="font-semibold">{status.qualityRating}</span></> : ''}
          {status.reachable === false && <span className="text-danger"> · token/keys look invalid</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-amber-600">
        <AlertTriangle size={16} /> WhatsApp is not connected yet
      </div>
      <p className="text-xs text-(--color-text-muted)">
        The messaging tools are ready — an admin just needs to add the API keys on the server.
        {status.missing?.length ? <> Missing: <span className="font-mono">{status.missing.join(', ')}</span>.</> : null}
        {' '}Ask your developer to set the WhatsApp environment variables, then hit refresh.
      </p>
    </div>
  );
}

/* ─────────────────────────── Broadcast panel ───────────────────────────── */
function BroadcastPanel({ configured, approved, cafeOptions, locations, defaultCafe, defaultLocation, onSent }) {
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('all');
  const [cafeId, setCafeId] = useState(defaultCafe && defaultCafe !== 'all' ? defaultCafe : '');
  const [locationId, setLocationId] = useState(defaultLocation?._id || '');
  const [templateName, setTemplateName] = useState('');
  const [vars, setVars] = useState([]);
  const [audience, setAudience] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const template = approved.find((t) => t.name === templateName);
  const branchOptions = locations
    .filter((l) => (cafeId ? String(l.cafe?._id || l.cafe) === String(cafeId) : true))
    .map((l) => ({ value: l._id, label: `${l.name}${l.city ? ` · ${l.city}` : ''}` }));

  // Preview the audience whenever the segment/scope changes.
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    setPreviewing(true);
    api.post('/whatsapp/audience/preview', { segment, cafeId: cafeId || undefined, locationId: locationId || undefined })
      .then((r) => { if (alive) setAudience(r.data.data); })
      .catch(() => { if (alive) setAudience(null); })
      .finally(() => { if (alive) setPreviewing(false); });
    return () => { alive = false; };
  }, [segment, cafeId, locationId, configured]);

  // Reset variable inputs when the template changes.
  useEffect(() => {
    setVars(template ? Array.from({ length: template.varCount }, () => '') : []);
  }, [templateName]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!templateName) return toast.error('Choose a message template');
    if (!audience?.total) return toast.error('No customers match this audience');
    if (!window.confirm(`Send this template to ${audience.total} customer(s) on WhatsApp?`)) return;
    setSending(true);
    const tId = toast.loading('Starting…');
    try {
      const r = await api.post('/whatsapp/broadcast', {
        name: name || undefined,
        template: templateName,
        language: template?.language || 'en',
        segment,
        cafeId: cafeId || undefined,
        locationId: locationId || undefined,
        variables: vars,
      });
      let { campaignId, total, sent, failed, remaining, done } = r.data.data;
      // The server sends only the first batch synchronously; drive the rest here,
      // one short request at a time, so a big list never times out on the server.
      let guard = 0;
      toast.loading(`Sending… ${total - remaining}/${total}`, { id: tId });
      while (!done && remaining > 0 && guard < 5000) {
        guard += 1;
        const rr = await api.post(`/whatsapp/campaigns/${campaignId}/resume`);
        sent += rr.data.data.sent;
        failed += rr.data.data.failed;
        remaining = rr.data.data.remaining;
        done = rr.data.data.done;
        toast.loading(`Sending… ${total - remaining}/${total}`, { id: tId });
      }
      if (remaining > 0) {
        toast.success(`Sent ${sent}. ${remaining} will finish automatically shortly.`, { id: tId });
      } else {
        toast.success(`Sent to ${sent}${failed ? `, ${failed} failed` : ''}`, { id: tId });
      }
      setName('');
      onSent?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not send the broadcast. Any remaining messages will finish automatically.', { id: tId });
      onSent?.();
    } finally {
      setSending(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: audience + template */}
      <div className="lg:col-span-3 space-y-4 glass-card p-6 rounded-xl">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Campaign name (internal)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali offer" className={`mt-1 ${inputCls}`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PremiumSelect label="Audience" value={segment} onChange={setSegment} options={SEGMENTS} />
          <PremiumSelect label="Cafe" value={cafeId} onChange={(v) => { setCafeId(v); setLocationId(''); }} options={[{ value: '', label: 'All my cafes' }, ...cafeOptions]} placeholder="All my cafes" />
          <PremiumSelect label="Branch" value={locationId} onChange={setLocationId} options={[{ value: '', label: 'All branches' }, ...branchOptions]} placeholder="All branches" />
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
          <Users size={16} className="text-primary" />
          <span className="text-sm font-semibold text-(--color-text-primary)">
            {previewing ? 'Counting…' : audience ? `${audience.total} customer${audience.total === 1 ? '' : 's'}` : '—'}
          </span>
          <span className="text-xs text-(--color-text-muted)">will receive this (opted-out customers are always excluded).</span>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Message template</label>
          <PremiumSelect
            value={templateName} onChange={setTemplateName}
            options={approved.map((t) => ({ value: t.name, label: `${t.name} · ${t.category?.toLowerCase()} · ${t.language}` }))}
            placeholder={configured ? (approved.length ? 'Choose an approved template' : 'No approved templates yet') : 'Connect WhatsApp first'}
          />
        </div>

        {template && template.varCount > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-(--color-text-muted) flex items-center gap-1"><Info size={12} /> Fill the template variables. Type <span className="font-mono">{'{name}'}</span> to insert each customer&apos;s first name.</p>
            {vars.map((v, i) => (
              <input key={i} value={v} onChange={(e) => setVars(vars.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Variable {{${i + 1}}}`} className={inputCls} />
            ))}
          </div>
        )}

        <Button variant="primary" icon={Send} onClick={send} disabled={!configured || sending || !templateName || !audience?.total} loading={sending} className="!rounded-xl">
          {sending ? 'Sending…' : `Send to ${audience?.total ?? 0}`}
        </Button>
      </div>

      {/* Right: live preview */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl bg-[#e5ddd5] dark:bg-[#0b141a] p-4 min-h-56 border border-(--color-border)">
          <p className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted) mb-3">Preview</p>
          {template ? (
            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white dark:bg-[#202c33] p-3 shadow-sm text-sm text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap">
              {renderPreview(template.bodyText, vars)}
              <div className="text-[10px] text-right text-black/40 dark:text-white/40 mt-1">12:00</div>
            </div>
          ) : (
            <p className="text-xs text-(--color-text-muted)">Pick a template to preview the message.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Substitute {{1}}, {{2}}… with the typed values for the preview ({name} shown literally).
function renderPreview(body, vars) {
  return (body || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => vars[Number(n) - 1] || `{{${n}}}`);
}

/* ─────────────────────────── Automations panel ─────────────────────────── */
function AutomationsPanel({ configured, approved, automations, cafes, locations, isSuper, defaultCafe, onSaved }) {
  const [cafeId, setCafeId] = useState(defaultCafe && defaultCafe !== 'all' ? defaultCafe : (isSuper ? '' : cafes[0]?._id || ''));
  const [locationId, setLocationId] = useState('');
  const [running, setRunning] = useState(false);
  const scope = { cafeId, locationId };

  const cafeOptions = cafes.map((c) => ({ value: c._id, label: c.name }));
  const branchOptions = locations
    .filter((l) => (cafeId ? String(l.cafe?._id || l.cafe) === String(cafeId) : true))
    .map((l) => ({ value: l._id, label: `${l.name}${l.city ? ` · ${l.city}` : ''}` }));

  const runNow = async () => {
    setRunning(true);
    try {
      await api.post('/whatsapp/automations/run');
      toast.success('Scheduled automations ran');
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not run automations');
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-4">
      {/* Scope selector */}
      <div className="glass-card p-4 rounded-xl flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <PremiumSelect label="Applies to" value={cafeId} onChange={(v) => { setCafeId(v); setLocationId(''); }}
            options={[...(isSuper ? [{ value: '', label: 'Whole organisation' }] : []), ...cafeOptions]}
            placeholder={isSuper ? 'Whole organisation' : 'Pick a cafe'} />
        </div>
        <div className="min-w-44">
          <PremiumSelect label="Branch (optional)" value={locationId} onChange={setLocationId}
            options={[{ value: '', label: 'All branches in cafe' }, ...branchOptions]} placeholder="All branches" />
        </div>
        {isSuper && (
          <Button variant="outline" icon={Zap} onClick={runNow} loading={running} disabled={!configured} className="!rounded-xl ml-auto">
            Run scheduled now
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TRIGGERS.map((t) => (
          <AutomationCard key={t.key} trigger={t} scope={scope} approved={approved} configured={configured}
            rule={automations.find((r) => r.trigger === t.key && sameScope(r, scope))} onSaved={onSaved} />
        ))}
      </div>

      <p className="text-[11px] text-(--color-text-muted) flex items-start gap-1.5">
        <Info size={13} className="mt-0.5 shrink-0" />
        Birthday and win-back run on a daily schedule. They fire when a cron calls the run endpoint once a day (your developer sets this up once) — or a super admin can trigger them with “Run scheduled now”.
      </p>
    </div>
  );
}

function AutomationCard({ trigger, scope, approved, configured, rule, onSaved }) {
  const [enabled, setEnabled] = useState(false);
  const [template, setTemplate] = useState('');
  const [inactiveDays, setInactiveDays] = useState(30);
  const [saving, setSaving] = useState(false);

  // Re-hydrate whenever the governing rule (scope) changes.
  useEffect(() => {
    setEnabled(!!rule?.enabled);
    setTemplate(rule?.template || '');
    setInactiveDays(rule?.inactiveDays || 30);
  }, [rule]);

  const save = async () => {
    setSaving(true);
    try {
      const tpl = approved.find((t) => t.name === template);
      await api.put('/whatsapp/automations', {
        trigger: trigger.key,
        enabled,
        template,
        language: tpl?.language || 'en',
        cafeId: scope.cafeId || undefined,
        locationId: scope.locationId || undefined,
        ...(trigger.key === 'winback' ? { inactiveDays } : {}),
      });
      toast.success(`${trigger.label} saved`);
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not save');
    } finally { setSaving(false); }
  };

  const Icon = trigger.icon;
  return (
    <div className="glass-card p-5 rounded-xl space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Icon size={18} /></div>
          <div>
            <p className="text-sm font-semibold text-(--color-text-primary)">{trigger.label}</p>
            <p className="text-[11px] text-(--color-text-muted)">{trigger.desc}</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
          <div className="w-10 h-6 bg-(--color-surface-soft) border border-(--color-border) peer-checked:bg-success rounded-full transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
        </label>
      </div>

      <PremiumSelect value={template} onChange={setTemplate}
        options={approved.map((t) => ({ value: t.name, label: `${t.name} · ${t.language}` }))}
        placeholder={configured ? 'Choose a template' : 'Connect WhatsApp first'} />

      {trigger.key === 'winback' && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-(--color-text-muted)">Inactive for</span>
          <input type="number" min="7" max="365" value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)}
            className="w-20 px-2 py-1.5 rounded-lg bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
          <span className="text-[11px] text-(--color-text-muted)">days</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-(--color-text-muted)">
          {rule?.lastRunAt ? `Last run ${new Date(rule.lastRunAt).toLocaleDateString()} · ${rule.lastRunCount || 0} sent` : 'Never run'}
        </span>
        <Button variant="primary" onClick={save} loading={saving} disabled={enabled && !template} className="!rounded-lg !py-2 !px-4 text-xs">
          Save
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── History panel ─────────────────────────────── */
function HistoryPanel({ campaigns }) {
  if (!campaigns.length) {
    return (
      <div className="glass-card p-10 rounded-xl flex flex-col items-center text-(--color-text-muted)">
        <History size={36} className="opacity-20 mb-3" />
        <p className="text-sm font-medium">No campaigns sent yet.</p>
      </div>
    );
  }
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/50 text-[11px] uppercase tracking-wide text-(--color-text-muted)">
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Sent</th>
              <th className="px-4 py-3 font-medium">Delivered</th>
              <th className="px-4 py-3 font-medium">Read</th>
              <th className="px-4 py-3 font-medium">Failed</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--color-border)">
            {campaigns.map((c) => (
              <tr key={c._id} className="hover:bg-primary/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium text-(--color-text-primary)">{c.name}</p>
                  <p className="text-[11px] text-(--color-text-muted)">
                    {c.source === 'automation' ? `automation · ${c.trigger}` : c.segment}
                  </p>
                </td>
                <td className="px-4 py-3 text-(--color-text-secondary) font-mono text-xs">{c.template}</td>
                <td className="px-4 py-3 font-semibold text-(--color-text-primary)">{c.counts?.sent ?? 0}</td>
                <td className="px-4 py-3 text-(--color-text-secondary)">{c.counts?.delivered ?? 0}</td>
                <td className="px-4 py-3 text-(--color-text-secondary)">{c.counts?.read ?? 0}</td>
                <td className={`px-4 py-3 ${c.counts?.failed ? 'text-danger font-semibold' : 'text-(--color-text-muted)'}`}>{c.counts?.failed ?? 0}</td>
                <td className="px-4 py-3 text-[11px] text-(--color-text-muted)">{new Date(c.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
