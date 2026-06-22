"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import LoadingScreen from "@/app/components/ui/LoadingScreen";
import { progress } from "@/app/components/ui/TopProgressBar";
import {
  StatGridSkeleton,
  ChartSkeleton,
  CardSkeleton,
} from "@/app/components/ui/Skeleton";
import {
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Globe,
  ChefHat,
  TrendingUp,
  Timer,
  Activity,
  Zap,
  Calendar,
  ArrowRight,
  Download,
  RefreshCw,
  PieChart as PieIcon,
  LineChart as LineIcon,
  MapPin,
  Building,
  Mail,
  Phone,
  ChevronDown,
  FilterX,
  Layers,
  Wallet,
  IndianRupee,
  Sparkles,
  ShoppingBag as BagIcon,
  Target,
  Cpu,
} from "lucide-react";
import Modal from "../../../../components/ui/Modal";
import {
  PageTransition,
  SlideIn,
  CardHover,
} from "../../../../components/ui/AnimatedContainer";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../../context/AuthContext";
import api from "../../../../services/api";
import toast from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Sector,
} from "recharts";
import UniversalDateFilter from "../../../../components/ui/UniversalDateFilter";
import ExportActions from "../../../../components/ui/ExportActions";

export default function OrderAnalyticsDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [locations, setLocations] = useState([]);
  const [selectedBranchDetails, setSelectedBranchDetails] = useState(null);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);

  const fetchAnalytics = useCallback(async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const branchQuery =
        branchFilter !== "all" ? `&branchId=${branchFilter}` : "";
      const dateQuery = `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
      const [analyticsRes, locRes] = await Promise.all([
        api.get(`/orders/analytics?${branchQuery}${dateQuery}`),
        api.get("/locations"),
      ]);
      setData(analyticsRes.data.data);
      setLocations(locRes.data.data);
    } catch (error) {
      toast.error("Could not load analytics. Please try again.");
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  }, [branchFilter, dateRange]);

  useEffect(() => {
    if (user?.role === "branch_admin" && user?.assignedLocation) {
      setBranchFilter(user.assignedLocation._id || user.assignedLocation);
    }
  }, [user]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const sectorColumns = [
    { header: "Branch Name", key: "name" },
    { header: "City", key: "city" },
    { header: "Total Orders", key: "totalOrders" },
    { header: "Avg Prep Time (m)", key: "avgPrepTime" },
  ];

  const chefColumns = [
    { header: "Chef Name", key: "name" },
    { header: "Total Orders", key: "total" },
    { header: "Avg Prep Time (m)", key: "avgTime" },
  ];

  const resetFilters = () => {
    setBranchFilter(
      user?.role === "branch_admin"
        ? user.assignedLocation?._id || user.assignedLocation
        : "all",
    );
    setDateRange({ start: "", end: "" });
    toast.success("Filters cleared");
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="relative space-y-12 pb-24">
        {/* Background */}
        <div
          className="fixed inset-0 pointer-events-none z-[-1] opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(var(--color-primary) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="fixed inset-0 pointer-events-none z-[-1] bg-gradient-to-b from-transparent via-[var(--color-bg-base)]/50 to-[var(--color-bg-base)]" />

        {/* Futuristic Command Header */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-white shadow-sm  relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <TrendingUp size={36} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-2">
                Order <span className="text-[var(--color-primary)]">Analytics</span>
              </h1>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-[var(--color-success)]/10 text-[var(--color-success)] text-[10px] font-bold uppercase tracking-normal rounded-full border border-[var(--color-success)]/20 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                  Live Data
                </div>
                <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">
                  {user?.role === "branch_admin"
                    ? "Showing your branch"
                    : "Showing all branches"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-bold uppercase text-[var(--color-text-muted)] mr-2">
                Export Data:
              </p>
              <ExportActions
                data={data?.charts?.branchPerformance || []}
                columns={sectorColumns}
                filename="Sector_Performance_Report"
                hasCharts={true}
              />
              <ExportActions
                data={data?.charts?.chefPerformance || []}
                columns={chefColumns}
                filename="Chef_Performance_Report"
              />
            </div>
            <button
              onClick={fetchAnalytics}
              className="p-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Modular Command Console (Filters) */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-[var(--color-primary)]/20 to-[var(--color-primary)]/20 hidden opacity-10 -z-10 rounded-xl" />
          <div className="bg-[var(--color-surface)] p-2 rounded-xl border border-[var(--color-border)] shadow-sm space-y-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
              {/* Branch Selector */}
              <div className="lg:col-span-4 bg-[var(--color-surface-soft)] rounded-xl p-1.5 border border-[var(--color-border)] relative">
                {user?.role === "branch_admin" ? (
                  <div className="h-12 w-full flex items-center px-8 text-[var(--color-primary)] gap-3">
                    <Building size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-normal">
                      {locations.find((l) => l._id === branchFilter)?.name ||
                        "Your Branch"}
                    </span>
                  </div>
                ) : (
                  <div className="relative h-full">
                    <button
                      onClick={() =>
                        setIsBranchDropdownOpen(!isBranchDropdownOpen)
                      }
                      className="w-full h-12 flex items-center justify-between px-8 text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Globe
                          size={16}
                          className={
                            branchFilter === "all"
                              ? "text-[var(--color-primary)]"
                              : "text-[var(--color-primary)]"
                          }
                        />
                        <span className="text-[10px] font-bold uppercase tracking-normal">
                          {branchFilter === "all"
                            ? "All Branches"
                            : locations.find((l) => l._id === branchFilter)
                                ?.name}
                        </span>
                      </div>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-300 ${isBranchDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {isBranchDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute top-full left-0 right-0 mt-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm z-[100] p-3 overflow-hidden"
                        >
                          <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                            {user?.role !== "branch_admin" && (
                              <>
                                <button
                                  onClick={() => {
                                    setBranchFilter("all");
                                    setIsBranchDropdownOpen(false);
                                  }}
                                  className={`w-full p-4 rounded-xl text-left text-[10px] font-bold uppercase tracking-normal flex items-center gap-3 transition-all ${branchFilter === "all" ? "bg-[var(--color-primary)] text-white" : "hover:bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]"}`}
                                >
                                  <Globe size={14} /> All Branches
                                </button>
                                <div className="h-px bg-[var(--color-border)] my-2" />
                              </>
                            )}
                            {locations.map((loc) => (
                              <button
                                key={loc._id}
                                onClick={() => {
                                  setBranchFilter(loc._id);
                                  setIsBranchDropdownOpen(false);
                                }}
                                className={`w-full p-4 rounded-xl text-left text-[10px] font-bold uppercase tracking-normal flex items-center gap-3 transition-all ${branchFilter === loc._id ? "bg-[var(--color-primary)] text-white" : "hover:bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]"}`}
                              >
                                <Building size={14} /> {loc.name}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Temporal Controller */}
              <div className="lg:col-span-6  flex items-center px-6">
                <UniversalDateFilter
                  onFilterChange={({ startDate, endDate }) =>
                    setDateRange({ start: startDate, end: endDate })
                  }
                  loading={loading}
                  className="w-full"
                />
              </div>

              {/* Reset Command */}
              <div className="lg:col-span-2">
                <button
                  onClick={resetFilters}
                  className="w-full h-full min-h-[60px] bg-[var(--color-surface-soft)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/30 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] font-bold text-[10px] uppercase tracking-normal transition-all flex items-center justify-center gap-3 group"
                >
                  <FilterX
                    size={18}
                    className="group-hover:rotate-12 transition-transform"
                  />{" "}
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {refetching ? (
          <div className="space-y-12">
            <StatGridSkeleton count={5} />
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-8">
                <ChartSkeleton />
              </div>
              <div className="xl:col-span-4">
                <ChartSkeleton />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : (
          <>
        {/* Tactical Metrics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <MetricCard
            label="Total Orders"
            value={data?.metrics?.totalOrders}
            icon={BagIcon}
            color="blue"
          />
          <MetricCard
            label="Avg Prep Time"
            value={`${data?.metrics?.avgPrepTime}m`}
            icon={Timer}
            color="indigo"
          />
          <MetricCard
            label="Cancel Rate"
            value={`${(((data?.metrics?.cancelledOrders + data?.metrics?.rejectedOrders) / (data?.metrics?.totalOrders || 1)) * 100).toFixed(1)}%`}
            icon={AlertCircle}
            color="rose"
          />
          <MetricCard
            label="Busiest Hour"
            value={data?.metrics?.peakHour}
            icon={Target}
            color="amber"
          />
          <MetricCard
            label="Active Chefs"
            value={data?.charts?.chefPerformance?.length}
            icon={Cpu}
            color="emerald"
          />
        </div>

        {/* High-Fidelity Data Visualization */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Main Distribution Chart */}
          <div className="xl:col-span-8 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
              <LineIcon size={200} />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)] flex items-center gap-3">
                  <Activity size={18} className="text-[var(--color-primary)]" /> Orders by Hour
                </h3>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-tight">
                  How many orders come in each hour
                </p>
              </div>
              <div className="px-4 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[9px] font-bold uppercase tracking-normal rounded-full border border-[var(--color-primary)]/20">
                Busiest Hour:{" "}
                {Math.max(
                  ...(data?.charts?.ordersPerHour?.map((d) => d.count) || [0]),
                )}{" "}
                Orders
              </div>
            </div>
            <div className="h-[350px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts?.ordersPerHour}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    stroke="var(--color-text-muted)"
                    fontSize={10}
                    fontWeight={900}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--color-text-muted)"
                    fontSize={10}
                    fontWeight={900}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "1.5rem",
                      border: "1px solid #27272a",
                    }}
                    itemStyle={{
                      color: "#3b82f6",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown Pie */}
          <div className="xl:col-span-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-10 shadow-sm flex flex-col relative overflow-hidden group">
            <h3 className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-10 flex items-center gap-3">
              <PieIcon size={18} className="text-[var(--color-primary)]" /> Orders by Status
            </h3>
            <div className="flex-1 min-h-[300px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.charts?.ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {data?.charts?.ordersByStatus.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          [
                            "#3b82f6",
                            "#6366f1",
                            "#10b981",
                            "#f43f5e",
                            "#71717a",
                          ][index % 5]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "1rem",
                      border: "1px solid #27272a",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">
                  Total
                </p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
                  {data?.metrics?.totalOrders}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8 relative z-10">
              {data?.charts?.ordersByStatus.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-[var(--color-surface-soft)] rounded-xl border border-[var(--color-border)]"
                >
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: [
                        "#3b82f6",
                        "#6366f1",
                        "#10b981",
                        "#f43f5e",
                        "#71717a",
                      ][i % 5],
                    }}
                  />
                  <span className="text-[9px] font-bold uppercase tracking-tight truncate flex-1">
                    {s.name}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--color-primary)]">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Sector Grid (Branch List) */}
          <div className="xl:col-span-12 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-normal text-[var(--color-primary)] flex items-center gap-3 mb-4">
                  <div className="h-1 w-8 bg-[var(--color-primary)] rounded-full" />
                  Branches
                </h3>
                <h2 className="text-4xl font-bold text-[var(--color-text-primary)] tracking-tight">
                  Branch <span className="text-[var(--color-primary)]">Breakdown</span>
                </h2>
                <p className="text-sm font-bold text-[var(--color-text-muted)] mt-2 max-w-xl">
                  See how each branch is performing.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
              {/* Global Command Hub Card - Only for Super Admin */}
              {user?.role !== "branch_admin" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setBranchFilter("all")}
                  className={`group relative p-8 rounded-xl border overflow-hidden cursor-pointer transition-all duration-500 ${
                    branchFilter === "all"
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm "
                      : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40 shadow-sm"
                  }`}
                >
                  <div
                    className={`absolute -bottom-10 -right-10 w-40 h-40 rounded-full hidden transition-opacity duration-700 ${branchFilter === "all" ? "bg-white/20 opacity-100" : "bg-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100"}`}
                  />

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                      <div
                        className={`h-14 w-14 rounded-xl flex items-center justify-center transition-all duration-500 ${branchFilter === "all" ? "bg-[var(--color-surface)] text-[var(--color-primary)]" : "bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]"}`}
                      >
                        <Globe size={24} strokeWidth={2.5} />
                      </div>
                      {branchFilter === "all" && (
                        <div className="px-3 py-1 bg-white/20 rounded-full text-[9px] font-bold uppercase tracking-normal ">
                          Selected
                        </div>
                      )}
                    </div>
                    <h4 className="text-2xl font-bold tracking-tight mb-1">
                      All Branches
                    </h4>
                    <p
                      className={`text-[10px] font-bold uppercase tracking-normal ${branchFilter === "all" ? "opacity-80" : "text-[var(--color-text-muted)]"}`}
                    >
                      Combined totals
                    </p>

                    <div className="mt-10 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-normal opacity-60 mb-1">
                          Total Orders
                        </p>
                        <p className="text-2xl font-bold tracking-tight">
                          {data?.metrics?.totalOrders}
                        </p>
                      </div>
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center border ${branchFilter === "all" ? "border-[var(--color-border)] bg-white/10" : "border-[var(--color-border)] bg-[var(--color-surface-soft)]"}`}
                      >
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Individual Sector Cards - Filtered for Branch Admin */}
              {data?.charts?.branchPerformance
                .filter(
                  (b) =>
                    user?.role !== "branch_admin" ||
                    b.id ===
                      (user?.assignedLocation?._id || user?.assignedLocation),
                )
                .map((branch, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setBranchFilter(branch.id)}
                    className={`group relative p-8 rounded-xl border overflow-hidden cursor-pointer transition-all duration-500 ${
                      branchFilter === branch.id
                        ? "bg-[var(--color-text-primary)] text-[var(--color-bg-base)] border-[var(--color-text-primary)] shadow-sm"
                        : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40 shadow-sm"
                    }`}
                  >
                    <div
                      className={`absolute -bottom-10 -right-10 w-40 h-40 rounded-full hidden transition-opacity duration-700 ${branchFilter === branch.id ? "bg-[var(--color-primary)]/10 opacity-100" : "bg-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100"}`}
                    />

                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-8">
                        <div
                          className={`h-14 w-14 rounded-xl flex items-center justify-center transition-all duration-500 ${branchFilter === branch.id ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]"}`}
                        >
                          <Building size={24} strokeWidth={2.5} />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBranchDetails(
                              locations.find((l) => l._id === branch.id),
                            );
                          }}
                          className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${branchFilter === branch.id ? "bg-white/10 text-white hover:bg-white/20" : "bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"}`}
                        >
                          <Zap size={16} />
                        </button>
                      </div>

                      <h4 className="text-2xl font-bold tracking-tight mb-1 truncate">
                        {branch.name}
                      </h4>
                      <p
                        className={`text-[10px] font-bold uppercase tracking-normal ${branchFilter === branch.id ? "opacity-80" : "text-[var(--color-text-muted)]"}`}
                      >
                        {branch.city} Area
                      </p>

                      <div className="mt-10 grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-normal opacity-60 mb-1">
                            Orders
                          </p>
                          <p className="text-xl font-bold tracking-tight">
                            {branch.totalOrders}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-normal opacity-60 mb-1">
                            Avg Prep
                          </p>
                          <p className="text-xl font-bold tracking-tight text-[var(--color-primary)]">
                            {branch.avgPrepTime}m
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>

          {/* Culinary Intelligence (Chef Leaderboard) */}
          <div className="xl:col-span-12 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-12 relative overflow-hidden group">
            <div className="absolute top-0 left-0 p-20 opacity-[0.01] group-hover:opacity-[0.03] transition-opacity">
              <ChefHat size={300} />
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12 relative z-10">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-normal text-[var(--color-primary)] flex items-center gap-3 mb-4">
                  <div className="h-1 w-10 bg-[var(--color-primary)] rounded-full" />
                  Chef Performance
                </h3>
                <h2 className="text-4xl font-bold text-[var(--color-text-primary)] tracking-tight">
                  Kitchen <span className="text-[var(--color-primary)]">Leaderboard</span>
                </h2>
                <p className="text-sm font-bold text-[var(--color-text-muted)] mt-2">
                  See how fast each chef prepares orders.
                </p>
              </div>
              <button className="h-14 px-10 bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white text-[10px] font-bold uppercase tracking-normal rounded-[1.5rem] shadow-sm  active:scale-95 transition-all flex items-center gap-4">
                <Download size={18} strokeWidth={3} /> Download Report
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
              {data?.charts?.chefPerformance
                .sort((a, b) => a.avgTime - b.avgTime)
                .map((chef, i) => (
                  <div
                    key={i}
                    className="relative p-8 bg-[var(--color-surface-soft)] rounded-xl border border-[var(--color-border)] overflow-hidden group/chef hover:border-[var(--color-primary)]/30 transition-all"
                  >
                    <div className="absolute -top-4 -right-4 h-24 w-24 bg-[var(--color-primary)]/5 rounded-full hidden group-hover/chef:bg-[var(--color-primary)]/10 transition-colors" />

                    <div className="flex items-center justify-between mb-8">
                      <div className="h-12 w-12 rounded-xl bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-primary)] border border-[var(--color-border)] shadow-sm">
                        <ChefHat size={22} />
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-normal">
                          Rank #{i + 1}
                        </span>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] mt-0.5">
                          {chef.total} Orders
                        </span>
                      </div>
                    </div>

                    <h4 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6 tracking-tight">
                      {chef.name}
                    </h4>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
                          Avg Prep Time
                        </span>
                        <span className="text-xl font-bold text-[var(--color-primary)] tracking-tight">
                          {chef.avgTime}m
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-border)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.max(10, 100 - chef.avgTime * 2)}%`,
                          }}
                          className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)] rounded-full "
                        />
                      </div>
                    </div>
                  </div>
                ))}
              {(!data?.charts?.chefPerformance ||
                data.charts.chefPerformance.length === 0) && (
                <div className="lg:col-span-4 h-60 flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-xl opacity-30 italic text-[10px] font-bold uppercase tracking-normal">
                  Not enough data to show rankings
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        )}

        {/* Branch Detail Modal */}
        <Modal
          isOpen={!!selectedBranchDetails}
          onClose={() => setSelectedBranchDetails(null)}
          title="Branch Details"
          maxWidth="max-w-4xl"
        >
          {selectedBranchDetails && (
            <div className="space-y-10 p-4">
              <div className="flex items-center gap-8 p-10 bg-[var(--color-text-primary)] text-[var(--color-surface)] rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/10 rounded-full blur-[100px]" />
                <div className="h-28 w-28 rounded-xl bg-white/5 border border-[var(--color-border)] flex items-center justify-center text-[var(--color-primary)] shadow-sm relative z-10 ">
                  <Building size={56} strokeWidth={1} />
                </div>
                <div className="relative z-10 flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="px-3 py-1 bg-[var(--color-primary)] rounded-full text-[9px] font-bold uppercase tracking-normal">
                      Active Branch
                    </div>
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-normal">
                      ID: {selectedBranchDetails._id.substring(0, 12)}
                    </span>
                  </div>
                  <h3 className="text-4xl font-bold tracking-tight leading-none mb-4">
                    {selectedBranchDetails.name}
                  </h3>
                  <p className="text-sm font-medium text-white/60 flex items-center gap-2">
                    <MapPin size={16} className="text-[var(--color-primary)]" />{" "}
                    {selectedBranchDetails.address}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col gap-6 group hover:border-[var(--color-primary)]/30 transition-all shadow-sm">
                  <div className="h-14 w-14 rounded-xl bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-all">
                    <Mail size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-1">
                      Email
                    </p>
                    <p className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">
                      {selectedBranchDetails.contactEmail ||
                        "Not added"}
                    </p>
                  </div>
                </div>
                <div className="p-8 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col gap-6 group hover:border-[var(--color-primary)]/30 transition-all shadow-sm">
                  <div className="h-14 w-14 rounded-xl bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-all">
                    <Phone size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-1">
                      Phone
                    </p>
                    <p className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">
                      {selectedBranchDetails.contactPhone || "Not added"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-6 border-t border-[var(--color-border)]">
                <button
                  onClick={() => {
                    setBranchFilter(selectedBranchDetails._id);
                    setSelectedBranchDetails(null);
                  }}
                  className="w-full py-6 bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white rounded-xl text-xs font-bold uppercase tracking-normal  active:scale-95 transition-all shadow-sm  flex items-center justify-center gap-4"
                >
                  <Layers size={18} /> View This Branch's Analytics
                </button>
                <p className="text-center text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal opacity-40">
                  Admin access only
                </p>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}

function MetricCard({ label, value, icon: Icon, color }) {
  const themes = {
    blue: {
      base: "text-[var(--color-primary)] bg-[var(--color-primary)]/5 border-[var(--color-primary)]/20 ",
      glow: "bg-[var(--color-primary)]/10",
      accent: "border-[var(--color-primary)]/30",
    },
    indigo: {
      base: "text-[var(--color-primary)] bg-[var(--color-primary)]/5 border-[var(--color-primary)]/20 ",
      glow: "bg-[var(--color-primary)]/10",
      accent: "border-[var(--color-primary)]/30",
    },
    rose: {
      base: "text-[var(--color-danger)] bg-[var(--color-danger)]/5 border-[var(--color-danger)]/20 ",
      glow: "bg-[var(--color-danger)]/10",
      accent: "border-[var(--color-danger)]/30",
    },
    amber: {
      base: "text-[var(--color-warning)] bg-[var(--color-warning)]/5 border-[var(--color-warning)]/20 ",
      glow: "bg-[var(--color-warning)]/10",
      accent: "border-[var(--color-warning)]/30",
    },
    emerald: {
      base: "text-[var(--color-success)] bg-[var(--color-success)]/5 border-[var(--color-success)]/20 ",
      glow: "bg-[var(--color-success)]/10",
      accent: "border-[var(--color-success)]/30",
    },
  };

  const theme = themes[color];

  return (
    <CardHover>
      <div className="relative bg-[var(--color-surface)]/60  p-8 rounded-xl border border-[var(--color-border)] flex flex-col items-center text-center group hover:border-[var(--color-primary)]/40 transition-all duration-500 shadow-sm overflow-hidden h-full">
        {/* Animated Glow Backplate */}
        <div
          className={`absolute inset-0 ${theme.glow} opacity-0 group-hover:opacity-100 blur-[60px] transition-opacity duration-1000 -z-10`}
        />

        <div
          className={`h-16 w-16 rounded-xl ${theme.base} flex items-center justify-center mb-6 border-2 ${theme.accent} shadow-sm group-hover:rotate-6 transition-all duration-500 relative`}
        >
          <div className="absolute inset-0 bg-white/5 rounded-xl" />
          <Icon size={28} strokeWidth={2.5} className="relative z-10" />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-3 group-hover:text-[var(--color-text-primary)] transition-colors">
          {label}
        </p>
        <h4 className="text-4xl font-bold text-[var(--color-text-primary)] tracking-tight mb-1 relative">
          {value || "0"}
          <span className="absolute -top-1 -right-4 h-1.5 w-1.5 rounded-full bg-primary animate-ping opacity-0 group-hover:opacity-100 transition-opacity" />
        </h4>
        <div className="w-8 h-1 bg-[var(--color-border)] rounded-full mt-4 group-hover:w-16 group-hover:bg-primary transition-all duration-500" />
      </div>
    </CardHover>
  );
}
