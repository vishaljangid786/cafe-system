'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import { routeForPage } from '@/app/config/routes';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { PageTransition, SlideIn } from '@/app/components/ui/AnimatedContainer';
import {
  Store, MapPin, Users, Shield, ChefHat, User, ChevronRight, ChevronDown,
  Search, Network, Award, RefreshCw, UsersRound, ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react';

const ROLE_META = {
  admin: { label: 'Admin', icon: Shield, tint: 'text-primary bg-primary/10' },
  branch_admin: { label: 'Branch Admin', icon: Shield, tint: 'text-secondary bg-secondary/10' },
  location_admin: { label: 'Branch Admin', icon: Shield, tint: 'text-secondary bg-secondary/10' },
  chef: { label: 'Chef', icon: ChefHat, tint: 'text-amber-500 bg-amber-500/10' },
  staff: { label: 'Staff', icon: User, tint: 'text-(--color-text-secondary) bg-(--color-surface-soft)' },
};

// Every branch a user touches: their assigned branch plus any linked branches.
const branchIdsOf = (u) => {
  const ids = [];
  if (u?.assignedLocation) ids.push((u.assignedLocation._id || u.assignedLocation).toString());
  (u?.accessibleLocations || []).forEach((l) => ids.push((l._id || l).toString()));
  return [...new Set(ids.filter(Boolean))];
};
const cafeIdOf = (loc) => String(loc?.cafe?._id || loc?.cafe || '');
const userCafeIds = (u) => (u?.cafes || []).map((c) => (c._id || c).toString());

export default function BranchHierarchy() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cafes, setCafes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const staffReportsBase = routeForPage(currentUser?.role, 'page_staffreports');

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    try {
      const [cf, loc, us] = await Promise.allSettled([
        api.get('/cafes'),
        api.get('/locations'),
        api.get('/users', { params: { limit: 1000 } }),
      ]);
      if (cf.status === 'fulfilled') setCafes(cf.value.data?.data || cf.value.data || []);
      if (loc.status === 'fulfilled') setLocations(loc.value.data?.data || loc.value.data || []);
      if (us.status === 'fulfilled') setUsers(us.value.data?.data || us.value.data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  // Build the Cafe → Branch → People tree.
  const { tree, counts } = useMemo(() => {
    const branchAdmins = users.filter((u) => ['branch_admin', 'location_admin'].includes(u.role));
    const opsStaff = users.filter((u) => ['staff', 'chef'].includes(u.role));
    const admins = users.filter((u) => u.role === 'admin');

    const personNode = (u) => ({
      id: `person_${u._id}`,
      type: 'person',
      name: u.name || 'Unnamed',
      role: u.role,
      email: u.email,
      userId: u._id,
      children: [],
    });

    const buildBranch = (loc) => {
      const bid = loc._id.toString();
      const bAdmins = branchAdmins.filter((ba) => branchIdsOf(ba).includes(bid)).map(personNode);
      const bStaff = opsStaff
        .filter((s) => (s.assignedLocation?._id || s.assignedLocation)?.toString() === bid)
        .map(personNode);
      return {
        id: `branch_${bid}`,
        type: 'branch',
        name: loc.name,
        city: loc.city,
        status: loc.status || 'active',
        dietaryType: loc.dietaryType || 'both',
        peopleCount: bAdmins.length + bStaff.length,
        children: [...bAdmins, ...bStaff],
      };
    };

    let peopleTotal = 0;
    const branchIdsSeen = new Set();

    const cafeNodes = cafes.map((cafe) => {
      const cid = cafe._id.toString();
      const cafeBranches = locations.filter((l) => cafeIdOf(l) === cid);
      cafeBranches.forEach((b) => branchIdsSeen.add(b._id.toString()));
      const branchNodes = cafeBranches.map(buildBranch);

      // Cafe-level admins: those whose tenant includes this cafe, or who link a
      // branch of it. Shown once at the cafe level (not repeated per branch).
      const cafeBranchIds = new Set(cafeBranches.map((b) => b._id.toString()));
      const cafeAdmins = admins
        .filter((a) => userCafeIds(a).includes(cid) || branchIdsOf(a).some((id) => cafeBranchIds.has(id)))
        .map(personNode);

      const people = cafeAdmins.length + branchNodes.reduce((n, b) => n + b.peopleCount, 0);
      peopleTotal += people;

      return {
        id: `cafe_${cid}`,
        type: 'cafe',
        name: cafe.name,
        branchCount: cafeBranches.length,
        peopleCount: people,
        children: [...cafeAdmins, ...branchNodes],
      };
    });

    // Branches whose cafe isn't in the accessible cafe list → group as "Other".
    const orphanBranches = locations.filter((l) => !branchIdsSeen.has(l._id.toString()));
    if (orphanBranches.length) {
      const branchNodes = orphanBranches.map(buildBranch);
      const people = branchNodes.reduce((n, b) => n + b.peopleCount, 0);
      peopleTotal += people;
      cafeNodes.push({
        id: 'cafe_unassigned',
        type: 'cafe',
        name: 'Unassigned branches',
        branchCount: orphanBranches.length,
        peopleCount: people,
        children: branchNodes,
      });
    }

    return {
      tree: cafeNodes,
      counts: { cafes: cafes.length, branches: locations.length, people: peopleTotal },
    };
  }, [cafes, locations, users]);

  // Collect every node id (for expand-all).
  const allIds = useMemo(() => {
    const ids = [];
    const walk = (nodes) => nodes.forEach((n) => { if (n.children?.length) { ids.push(n.id); walk(n.children); } });
    walk(tree);
    return ids;
  }, [tree]);

  // Default: expand all cafes on first load.
  useEffect(() => {
    if (tree.length && expanded.size === 0) {
      setExpanded(new Set(tree.map((c) => c.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  // When searching, auto-expand everything so matches are visible.
  const q = query.trim().toLowerCase();
  const effectiveExpanded = q ? new Set(allIds) : expanded;

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const matches = (node) => {
    if (!q) return true;
    if (node.name?.toLowerCase().includes(q)) return true;
    if (node.city?.toLowerCase().includes(q)) return true;
    if (node.email?.toLowerCase().includes(q)) return true;
    return (node.children || []).some(matches);
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <SlideIn direction="down">
          <div className="bg-(--color-surface) rounded-xl border border-(--color-border) p-5 md:p-6 shadow-sm flex flex-col gap-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Network size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight">
                    Org <span className="text-primary">Hierarchy</span>
                  </h1>
                  <p className="text-sm text-(--color-text-muted) mt-1">Cafes, their branches, and the people at each one.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setExpanded(new Set(allIds))} title="Expand all"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-semibold text-(--color-text-secondary) hover:text-(--color-text-primary)">
                  <ChevronsUpDown size={14} /> Expand all
                </button>
                <button onClick={() => setExpanded(new Set())} title="Collapse all"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-semibold text-(--color-text-secondary) hover:text-(--color-text-primary)">
                  <ChevronsDownUp size={14} /> Collapse all
                </button>
                <button onClick={() => load(false)} title="Refresh" disabled={refreshing}
                  className="p-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text-primary) disabled:opacity-50">
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Search + summary */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cafe, branch, city or person…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-(--color-text-muted)">
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-(--color-surface-soft) border border-(--color-border)"><Store size={13} /> {counts.cafes} cafes</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-(--color-surface-soft) border border-(--color-border)"><MapPin size={13} /> {counts.branches} branches</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-(--color-surface-soft) border border-(--color-border)"><UsersRound size={13} /> {counts.people} people</span>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Tree */}
        <div className="space-y-3">
          {tree.length === 0 && (
            <div className="py-24 bg-(--color-surface) rounded-xl border-2 border-dashed border-(--color-border) flex flex-col items-center justify-center text-(--color-text-muted)">
              <Network size={48} className="opacity-20 mb-4" />
              <p className="text-sm font-medium">Nothing to show yet.</p>
            </div>
          )}
          {tree.map((node) => (
            <HierNode key={node.id} node={node} expanded={effectiveExpanded} toggle={toggle}
              q={q} matches={matches} staffReportsBase={staffReportsBase} router={router} level={0} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

function HierNode({ node, expanded, toggle, q, matches, staffReportsBase, router, level }) {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children?.length > 0;
  const dimmed = q && !matches(node);

  if (node.type === 'person') {
    const meta = ROLE_META[node.role] || ROLE_META.staff;
    const Icon = meta.icon;
    return (
      <div className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-(--color-surface) border border-(--color-border) ${dimmed ? 'opacity-30' : ''}`}
        style={{ marginLeft: `${level * 24}px` }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0 ${meta.tint}`}>
            {node.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-(--color-text-primary) truncate">{node.name}</p>
            <span className="text-[11px] font-medium text-(--color-text-muted) inline-flex items-center gap-1">
              <Icon size={11} /> {meta.label}{node.email ? ` · ${node.email}` : ''}
            </span>
          </div>
        </div>
        {staffReportsBase && (
          <button onClick={() => router.push(`${staffReportsBase}/${node.userId}`)} title="View report"
            className="p-2 rounded-lg text-(--color-text-muted) hover:text-primary hover:bg-(--color-surface-soft) shrink-0">
            <Award size={15} />
          </button>
        )}
      </div>
    );
  }

  const isCafe = node.type === 'cafe';
  const Icon = isCafe ? Store : MapPin;
  return (
    <div className="space-y-3" style={{ marginLeft: `${level * 24}px` }}>
      <div
        onClick={() => hasChildren && toggle(node.id)}
        className={`group flex items-center justify-between gap-3 p-4 rounded-xl border transition-all ${hasChildren ? 'cursor-pointer' : ''} ${
          isOpen ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-(--color-surface) border-(--color-border) hover:border-primary/20'
        } ${dimmed ? 'opacity-30' : ''}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${isCafe ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
            <Icon size={19} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-(--color-text-primary) truncate">{node.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {isCafe ? (
                <span className="text-[11px] font-medium text-(--color-text-muted) inline-flex items-center gap-1">
                  <MapPin size={10} /> {node.branchCount} branch{node.branchCount === 1 ? '' : 'es'} · <UsersRound size={10} /> {node.peopleCount} people
                </span>
              ) : (
                <>
                  {node.city && <span className="text-[11px] font-medium text-(--color-text-muted) inline-flex items-center gap-1"><MapPin size={10} /> {node.city}</span>}
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${node.status === 'active' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{node.status}</span>
                  <span className="text-[11px] font-medium text-(--color-text-muted)">{node.peopleCount} people</span>
                </>
              )}
            </div>
          </div>
        </div>
        {hasChildren && (isOpen ? <ChevronDown size={18} className="text-primary shrink-0" /> : <ChevronRight size={18} className="text-(--color-text-muted) shrink-0" />)}
      </div>

      {isOpen && hasChildren && (
        <div className="space-y-3 border-l-2 border-primary/10 pl-3">
          {node.children.map((child) => (
            <HierNode key={child.id} node={child} expanded={expanded} toggle={toggle}
              q={q} matches={matches} staffReportsBase={staffReportsBase} router={router} level={0} />
          ))}
        </div>
      )}
    </div>
  );
}
