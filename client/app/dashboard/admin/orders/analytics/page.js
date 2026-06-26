"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import LoadingScreen from "@/app/components/ui/LoadingScreen";
import { progress } from "@/app/components/ui/TopProgressBar";
import {
  StatGridSkeleton,
  ChartSkeleton,
  CardSkeleton,
} from "@/app/components/ui/Skeleton";
import {
  AlertCircle,
  Globe,
  ChefHat,
  TrendingUp,
  Timer,
  Activity,
  Zap,
  ArrowRight,
  Download,
  RefreshCw,
  PieChart as PieIcon,
  MapPin,
  Building,
  Mail,
  Phone,
  FilterX,
  Layers,
  ShoppingBag as BagIcon,
  Target,
  Cpu,
  Crown,
  Medal,
  Award,
  Gauge,
  Flame,
  CheckCircle2,
  XCircle,
  Hash,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Modal from "../../../../components/ui/Modal";
import { PageTransition } from "../../../../components/ui/AnimatedContainer";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../../context/AuthContext";
import api from "../../../../services/api";
import toast from "react-hot-toast";
import {
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
} from "recharts";
import UniversalDateFilter from "../../../../components/ui/UniversalDateFilter";
import ExportActions from "../../../../components/ui/ExportActions";
import useBranchScope from "../../../../hooks/useBranchScope";

const STATUS_COLORS = ["#3b82f6", "#6366f1", "#10b981", "#f43f5e", "#71717a"];

export default function OrderAnalyticsDashboard() {
  const { user, selectedLocationIds, switchLocation } = useAuth();
  const { singleBranchId, scopeKey } = useBranchScope();
  // The active branch is whatever the Navbar global filter resolves to
  // (a single branch id, or 'all' for "all branches" / a multi-branch subset).
  const activeBranchId = singleBranchId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [locations, setLocations] = useState([]);
  const [selectedBranchDetails, setSelectedBranchDetails] = useState(null);
  const [selectedChef, setSelectedChef] = useState(null);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);

  const userBranchIds = useMemo(() => {
    const ids = [];
    if (user?.assignedLocation)
      ids.push(user.assignedLocation._id || user.assignedLocation);
    if (Array.isArray(user?.accessibleLocations)) {
      user.accessibleLocations.forEach((loc) => ids.push(loc._id || loc));
    }
    return [...new Set(ids.filter(Boolean))];
  }, [user]);

  const fetchAnalytics = useCallback(async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const branchQuery =
        activeBranchId !== "all" ? `&branchId=${activeBranchId}` : "";
      const dateQuery = `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
      const [analyticsRes, locRes] = await Promise.all([
        api.get(`/orders/analytics?${branchQuery}${dateQuery}`),
        api.get("/locations"),
      ]);
      setData(analyticsRes.data?.data || analyticsRes.data);
      setLocations(locRes.data?.data || locRes.data || []);
    } catch (error) {
      toast.error("Could not load analytics. Please try again.");
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  }, [activeBranchId, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const sectorColumns = [
    { header: "Branch Name", key: "name" },
    { header: "City", key: "city" },
    { header: "Total Orders", key: "totalOrders" },
    { header: "Avg Prep Time (m)", key: "avgPrepTime" },
  ];

  // Chefs ranked fastest-first (the leaderboard order)
  const rankedChefs = useMemo(() => {
    return [...(data?.charts?.chefPerformance || [])].sort(
      (a, b) => Number(a.avgTime) - Number(b.avgTime),
    );
  }, [data]);

  const totalChefOrders = useMemo(
    () => rankedChefs.reduce((sum, c) => sum + (Number(c.total) || 0), 0),
    [rankedChefs],
  );

  const resetFilters = () => {
    setDateRange({ start: "", end: "" });
    toast.success("Date filter cleared");
  };

  const activeBranchName =
    activeBranchId === "all"
      ? selectedLocationIds.length > 1
        ? `${selectedLocationIds.length} Branches`
        : "All Branches"
      : locations.find((l) => l._id === activeBranchId)?.name ||
        "Selected Branch";

  // One-click PDF report for the kitchen leaderboard
  const downloadChefReport = () => {
    if (rankedChefs.length === 0) {
      toast.error("No chef data available to export");
      return;
    }
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Kitchen Leaderboard Report", 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(110);
      const range =
        dateRange.start && dateRange.end
          ? `${dateRange.start} to ${dateRange.end}`
          : "All time";
      doc.text(`Branch: ${activeBranchName}    Period: ${range}`, 14, 25);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);

      autoTable(doc, {
        head: [
          [
            "Rank",
            "Chef",
            "Total Orders",
            "Completed",
            "Served",
            "Cancelled",
            "Avg Prep (m)",
            "Fastest (m)",
            "Slowest (m)",
          ],
        ],
        body: rankedChefs.map((c, i) => [
          i + 1,
          c.name,
          c.total ?? "-",
          c.completed ?? "-",
          c.served ?? "-",
          c.cancelled ?? "-",
          c.avgTime ?? "-",
          c.fastest ?? "-",
          c.slowest ?? "-",
        ]),
        startY: 37,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [59, 130, 246], halign: "center" },
        columnStyles: { 0: { halign: "center" } },
      });

      doc.save(
        `Kitchen_Leaderboard_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      toast.success("Report downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate report");
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-6 w-6 rounded-2xl bg-primary flex items-center justify-center text-(--color-on-primary) shadow-sm shrink-0">
              <TrendingUp size={16} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-(--color-text-primary)">
                Order Analytics
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/10 text-success text-[11px] font-medium border border-success/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Live
                </span>
                <span className="text-xs text-(--color-text-muted)">
                  {user?.role === "branch_admin"
                    ? userBranchIds.length > 1
                      ? "Your assigned branches"
                      : "Your branch"
                    : "All branches"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ExportActions
              data={data?.charts?.branchPerformance || []}
              columns={sectorColumns}
              filename="Order_Analytics_Report"
              hasCharts={true}
            />
            <button
              onClick={fetchAnalytics}
              title="Refresh"
              className="h-11 w-11 shrink-0 rounded-xl bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center"
            >
              <RefreshCw size={18} className={refetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-(--color-surface) p-3 rounded-2xl border border-(--color-border) shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Date Filter (branch/cafe scope comes from the Navbar filter) */}
            <div className="lg:col-span-10 flex items-center">
              <UniversalDateFilter
                onFilterChange={({ startDate, endDate }) =>
                  setDateRange({ start: startDate, end: endDate })
                }
                loading={loading}
                className="w-full"
              />
            </div>

            {/* Reset */}
            <div className="lg:col-span-2">
              <button
                onClick={resetFilters}
                className="w-full h-12 bg-(--color-surface-soft) hover:bg-danger/10 hover:text-danger hover:border-danger/30 rounded-xl border border-(--color-border) text-(--color-text-muted) font-medium text-sm transition-colors flex items-center justify-center gap-2 group"
              >
                <FilterX size={16} />
                Clear
              </button>
            </div>
          </div>
        </div>

        {refetching ? (
          <div className="space-y-6">
            <StatGridSkeleton count={5} />
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8">
                <ChartSkeleton />
              </div>
              <div className="xl:col-span-4">
                <ChartSkeleton />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <MetricCard
                label="Total Orders"
                value={data?.metrics?.totalOrders}
                icon={BagIcon}
                color="blue"
              />
              <MetricCard
                label="Avg Prep Time"
                value={`${data?.metrics?.avgPrepTime ?? 0}m`}
                icon={Timer}
                color="indigo"
              />
              <MetricCard
                label="Cancel Rate"
                value={`${(
                  (((data?.metrics?.cancelledOrders || 0) +
                    (data?.metrics?.rejectedOrders || 0)) /
                    (data?.metrics?.totalOrders || 1)) *
                  100
                ).toFixed(1)}%`}
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
                value={rankedChefs.length}
                icon={Cpu}
                color="emerald"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Orders by Hour */}
              <div className="export-chart xl:col-span-8 bg-(--color-surface) rounded-2xl border border-(--color-border) p-6 shadow-sm">
                <div className="flex items-start justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-(--color-text-primary) flex items-center gap-2">
                      <Activity size={18} className="text-primary" /> Orders by
                      Hour
                    </h3>
                    <p className="text-xs text-(--color-text-muted) mt-1">
                      How many orders come in each hour
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20 whitespace-nowrap">
                    Peak:{" "}
                    {Math.max(
                      0,
                      ...(data?.charts?.ordersPerHour?.map((d) => d.count) || [
                        0,
                      ]),
                    )}{" "}
                    orders
                  </span>
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.charts?.ordersPerHour}>
                      <defs>
                        <linearGradient
                          id="colorCount"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
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
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--color-text-muted)"
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface)",
                          borderRadius: "0.75rem",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-primary)",
                        }}
                        itemStyle={{ color: "#3b82f6", fontWeight: 600 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorCount)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Orders by Status */}
              <div className="export-chart xl:col-span-4 bg-(--color-surface) rounded-2xl border border-(--color-border) p-6 shadow-sm flex flex-col">
                <h3 className="text-base font-semibold text-(--color-text-primary) mb-6 flex items-center gap-2">
                  <PieIcon size={18} className="text-primary" /> Orders by Status
                </h3>
                <div className="flex-1 min-h-[240px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.charts?.ordersByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={64}
                        outerRadius={92}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {(data?.charts?.ordersByStatus || []).map(
                          (entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                            />
                          ),
                        )}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface)",
                          borderRadius: "0.75rem",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-primary)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-xs text-(--color-text-muted)">Total</p>
                    <p className="text-2xl font-semibold text-(--color-text-primary)">
                      {data?.metrics?.totalOrders ?? 0}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-5">
                  {(data?.charts?.ordersByStatus || []).map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2.5 bg-(--color-surface-soft) rounded-lg border border-(--color-border)"
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[i % STATUS_COLORS.length],
                        }}
                      />
                      <span className="text-[11px] font-medium text-(--color-text-secondary) capitalize truncate flex-1">
                        {String(s.name).toLowerCase()}
                      </span>
                      <span className="text-xs font-semibold text-primary">
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Branch Breakdown */}
            <section className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-(--color-text-primary)">
                  Branch Breakdown
                </h2>
                <p className="text-sm text-(--color-text-muted) mt-1">
                  See how each branch is performing. Click a card to filter.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {user?.role !== "branch_admin" && (
                  <button
                    onClick={() => switchLocation("all")}
                    className={`text-left p-6 rounded-2xl border transition-all ${
                      activeBranchId === "all"
                        ? "bg-primary text-(--color-on-primary) border-primary shadow-sm"
                        : "bg-(--color-surface) border-(--color-border) hover:border-primary/40 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div
                        className={`h-6 w-6 rounded-xl flex items-center justify-center ${activeBranchId === "all" ? "bg-white/15 text-(--color-on-primary)" : "bg-(--color-surface-soft) text-primary"}`}
                      >
                        <Globe size={16} strokeWidth={2.5} />
                      </div>
                      {activeBranchId === "all" && (
                        <span className="px-2.5 py-1 bg-white/20 rounded-full text-[11px] font-medium tracking-wide">
                          Selected
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-semibold mb-0.5">All Branches</h4>
                    <p
                      className={`text-xs ${activeBranchId === "all" ? "opacity-80" : "text-(--color-text-muted)"}`}
                    >
                      Combined totals
                    </p>
                    <div className="mt-6 flex items-end justify-between">
                      <div>
                        <p
                          className={`text-[11px] font-medium mb-0.5 ${activeBranchId === "all" ? "opacity-70" : "text-(--color-text-muted)"}`}
                        >
                          Total Orders
                        </p>
                        <p className="text-2xl font-semibold">
                          {data?.metrics?.totalOrders ?? 0}
                        </p>
                      </div>
                      <ArrowRight size={18} className="opacity-60" />
                    </div>
                  </button>
                )}

                {(data?.charts?.branchPerformance || [])
                  .filter(
                    (b) =>
                      user?.role !== "branch_admin" ||
                      userBranchIds.includes(b.id),
                  )
                  .map((branch, i) => {
                    const selected = activeBranchId === branch.id;
                    return (
                      <motion.div
                        key={branch.id || i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() =>
                          switchLocation(
                            locations.find((l) => l._id === branch.id) ||
                              branch.id,
                          )
                        }
                        className={`p-6 rounded-2xl border cursor-pointer transition-all ${
                          selected
                            ? "bg-(--color-text-primary) text-(--color-bg-base) border-(--color-text-primary) shadow-sm"
                            : "bg-(--color-surface) border-(--color-border) hover:border-primary/40 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div
                            className={`h-6 w-6 rounded-xl flex items-center justify-center ${selected ? "bg-primary text-(--color-on-primary)" : "bg-(--color-surface-soft) text-primary"}`}
                          >
                            <Building size={16} strokeWidth={2.5} />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBranchDetails(
                                locations.find((l) => l._id === branch.id),
                              );
                            }}
                            title="Branch details"
                            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${selected ? "bg-white/10 hover:bg-white/20" : "bg-(--color-surface-soft) text-(--color-text-muted) hover:text-primary"}`}
                          >
                            <Zap size={16} />
                          </button>
                        </div>
                        <h4 className="text-lg font-semibold truncate">
                          {branch.name}
                        </h4>
                        <p
                          className={`text-xs ${selected ? "opacity-80" : "text-(--color-text-muted)"}`}
                        >
                          {branch.city || "—"}
                        </p>
                        <div className="mt-6 grid grid-cols-2 gap-4">
                          <div>
                            <p
                              className={`text-[11px] font-medium mb-0.5 ${selected ? "opacity-70" : "text-(--color-text-muted)"}`}
                            >
                              Orders
                            </p>
                            <p className="text-xl font-semibold">
                              {branch.totalOrders}
                            </p>
                          </div>
                          <div>
                            <p
                              className={`text-[11px] font-medium mb-0.5 ${selected ? "opacity-70" : "text-(--color-text-muted)"}`}
                            >
                              Avg Prep
                            </p>
                            <p
                              className={`text-xl font-semibold ${selected ? "" : "text-primary"}`}
                            >
                              {branch.avgPrepTime}m
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            </section>

            {/* Kitchen Leaderboard */}
            <section className="bg-(--color-surface) rounded-2xl border border-(--color-border) p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-(--color-text-primary) flex items-center gap-2">
                    <ChefHat size={20} className="text-primary" /> Kitchen
                    Leaderboard
                  </h2>
                  <p className="text-sm text-(--color-text-muted) mt-1">
                    Ranked by average prep speed. Click a chef for full details.
                  </p>
                </div>
                <button
                  onClick={downloadChefReport}
                  className="h-11 px-5 bg-primary hover:bg-(--color-primary-hover) text-(--color-on-primary) text-sm font-semibold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  <Download size={16} strokeWidth={2.5} /> Download Report
                </button>
              </div>

              {rankedChefs.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center border-2 border-dashed border-(--color-border) rounded-2xl text-(--color-text-muted)">
                  <ChefHat size={32} className="mb-3 opacity-40" />
                  <p className="text-sm font-medium">
                    Not enough data to show rankings
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {rankedChefs.map((chef, i) => (
                    <ChefCard
                      key={chef.id || i}
                      chef={chef}
                      rank={i + 1}
                      onClick={() => setSelectedChef({ ...chef, rank: i + 1 })}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Branch Detail Modal */}
        <Modal
          isOpen={!!selectedBranchDetails}
          onClose={() => setSelectedBranchDetails(null)}
          title="Branch Details"
          maxWidth="max-w-2xl"
        >
          {selectedBranchDetails && (
            <div className="space-y-6">
              <div className="flex items-center gap-5 p-6 bg-(--color-surface-soft) rounded-2xl border border-(--color-border)">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Building size={36} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <span className="inline-block px-2.5 py-0.5 bg-success/10 text-success rounded-full text-[11px] font-medium tracking-wide mb-2">
                    Active Branch
                  </span>
                  <h3 className="text-2xl font-semibold tracking-tight text-(--color-text-primary) truncate">
                    {selectedBranchDetails.name}
                  </h3>
                  <p className="text-sm text-(--color-text-muted) flex items-center gap-1.5 mt-1">
                    <MapPin size={14} className="text-primary shrink-0" />
                    {[
                      selectedBranchDetails.city,
                      selectedBranchDetails.state,
                      selectedBranchDetails.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ") || "No address"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoTile
                  icon={Mail}
                  label="Email"
                  value={
                    selectedBranchDetails.email ||
                    selectedBranchDetails.contactEmail ||
                    "Not added"
                  }
                />
                <InfoTile
                  icon={Phone}
                  label="Phone"
                  value={
                    selectedBranchDetails.phone ||
                    selectedBranchDetails.contactPhone ||
                    "Not added"
                  }
                />
              </div>

              <button
                onClick={() => {
                  switchLocation(
                    locations.find((l) => l._id === selectedBranchDetails._id) ||
                      selectedBranchDetails,
                  );
                  setSelectedBranchDetails(null);
                }}
                className="w-full py-3.5 bg-primary hover:bg-(--color-primary-hover) text-(--color-on-primary) rounded-xl text-sm font-semibold active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Layers size={16} /> View This Branch&apos;s Analytics
              </button>
            </div>
          )}
        </Modal>

        {/* Chef Detail Modal */}
        <Modal
          isOpen={!!selectedChef}
          onClose={() => setSelectedChef(null)}
          title="Chef Performance"
          maxWidth="max-w-2xl"
        >
          {selectedChef && (
            <ChefDetail
              chef={selectedChef}
              kitchenAvg={Number(data?.metrics?.avgPrepTime) || 0}
              totalChefOrders={totalChefOrders}
            />
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}

/* ----------------------------- Sub-components ----------------------------- */

function MetricCard({ label, value, icon: Icon, color }) {
  const themes = {
    blue: "text-primary bg-primary/10 border-primary/20",
    indigo: "text-primary bg-primary/10 border-primary/20",
    rose: "text-danger bg-danger/10 border-danger/20",
    amber: "text-warning bg-warning/10 border-warning/20",
    emerald: "text-success bg-success/10 border-success/20",
  };

  return (
    <div className="bg-(--color-surface) p-5 rounded-2xl border border-(--color-border) shadow-sm hover:border-primary/30 transition-colors">
      <div
        className={`h-11 w-11 rounded-xl ${themes[color]} border flex items-center justify-center mb-4`}
      >
        <Icon size={20} strokeWidth={2.4} />
      </div>
      <p className="text-xs font-medium text-(--color-text-muted) mb-1">
        {label}
      </p>
      <h4 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">
        {value ?? "0"}
      </h4>
    </div>
  );
}

const RANK_BADGES = {
  1: { icon: Crown, cls: "bg-amber-400/15 text-amber-500 border-amber-400/30" },
  2: { icon: Medal, cls: "bg-slate-400/15 text-slate-400 border-slate-400/30" },
  3: { icon: Award, cls: "bg-orange-400/15 text-orange-500 border-orange-400/30" },
};

function ChefCard({ chef, rank, onClick }) {
  const badge = RANK_BADGES[rank];
  const BadgeIcon = badge?.icon || ChefHat;
  // Faster prep = fuller bar (cap the scale at 60 minutes)
  const speed = Math.max(8, 100 - Math.min(60, Number(chef.avgTime) || 0) * 1.5);

  return (
    <button
      onClick={onClick}
      className="text-left p-5 bg-(--color-surface-soft) rounded-2xl border border-(--color-border) hover:border-primary/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center justify-between mb-5">
        <div
          className={`h-11 w-11 rounded-xl flex items-center justify-center border ${badge ? badge.cls : "bg-(--color-surface) text-primary border-(--color-border)"}`}
        >
          <BadgeIcon size={20} />
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-primary">Rank #{rank}</p>
          <p className="text-[11px] text-(--color-text-muted)">
            {chef.total} orders
          </p>
        </div>
      </div>

      <h4 className="text-lg font-semibold text-(--color-text-primary) truncate group-hover:text-primary transition-colors">
        {chef.name}
      </h4>

      <div className="flex items-center justify-between mt-4 mb-2">
        <span className="text-[11px] font-medium text-(--color-text-muted)">
          Avg prep time
        </span>
        <span className="text-lg font-semibold text-primary">{chef.avgTime}m</span>
      </div>
      <div className="h-1.5 w-full bg-(--color-surface) rounded-full overflow-hidden border border-(--color-border)">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${speed}%` }}
          className="h-full bg-primary rounded-full"
        />
      </div>

      <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-(--color-text-muted) group-hover:text-primary transition-colors">
        View details <ArrowRight size={12} />
      </span>
    </button>
  );
}

function ChefDetail({ chef, kitchenAvg, totalChefOrders }) {
  const avg = Number(chef.avgTime) || 0;
  const diff = kitchenAvg ? avg - kitchenAvg : 0;
  const fasterThanAvg = diff < 0;
  const share = totalChefOrders
    ? ((Number(chef.total) || 0) / totalChefOrders) * 100
    : 0;
  const badge = RANK_BADGES[chef.rank];
  const BadgeIcon = badge?.icon || ChefHat;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-center gap-5 p-6 bg-(--color-surface-soft) rounded-2xl border border-(--color-border)">
        <div
          className={`h-20 w-20 rounded-2xl flex items-center justify-center border ${badge ? badge.cls : "bg-primary/10 text-primary border-primary/20"}`}
        >
          <BadgeIcon size={34} strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-[11px] font-medium tracking-wide mb-2">
            <Hash size={11} /> Rank {chef.rank}
          </span>
          <h3 className="text-2xl font-semibold tracking-tight text-(--color-text-primary) truncate">
            {chef.name}
          </h3>
          <p className="text-sm text-(--color-text-muted) mt-1">
            {chef.total} orders handled · {share.toFixed(0)}% of kitchen volume
          </p>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={Gauge} label="Avg Prep" value={`${chef.avgTime}m`} accent="primary" />
        <StatTile
          icon={Zap}
          label="Fastest"
          value={chef.fastest != null ? `${chef.fastest}m` : "—"}
          accent="success"
        />
        <StatTile
          icon={Flame}
          label="Slowest"
          value={chef.slowest != null ? `${chef.slowest}m` : "—"}
          accent="warning"
        />
        <StatTile
          icon={CheckCircle2}
          label="Completed"
          value={chef.completed ?? "—"}
          accent="primary"
        />
      </div>

      {/* Order outcomes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <OutcomeTile
          icon={BagIcon}
          label="Total Orders"
          value={chef.total ?? 0}
          tone="muted"
        />
        <OutcomeTile
          icon={CheckCircle2}
          label="Served"
          value={chef.served ?? 0}
          tone="success"
        />
        <OutcomeTile
          icon={XCircle}
          label="Cancelled / Rejected"
          value={chef.cancelled ?? 0}
          tone="danger"
        />
      </div>

      {/* Benchmark vs kitchen */}
      <div className="p-5 bg-(--color-surface-soft) rounded-2xl border border-(--color-border)">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-(--color-text-primary)">
            vs. Kitchen Average
          </span>
          <span
            className={`text-sm font-semibold ${fasterThanAvg ? "text-success" : diff === 0 ? "text-(--color-text-muted)" : "text-danger"}`}
          >
            {diff === 0
              ? "On par"
              : `${fasterThanAvg ? "▼" : "▲"} ${Math.abs(diff).toFixed(1)}m ${fasterThanAvg ? "faster" : "slower"}`}
          </span>
        </div>
        <div className="relative h-2.5 w-full bg-(--color-surface) rounded-full overflow-hidden border border-(--color-border)">
          {kitchenAvg > 0 && (
            <>
              <div
                className={`absolute top-0 left-0 h-full rounded-full ${fasterThanAvg ? "bg-success" : "bg-danger"}`}
                style={{
                  width: `${Math.min(100, (avg / (kitchenAvg * 2)) * 100)}%`,
                }}
              />
              {/* Kitchen average marker at the midpoint */}
              <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-(--color-text-primary) left-1/2" />
            </>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-(--color-text-muted)">
          <span>This chef: {avg.toFixed(1)}m</span>
          <span>Kitchen avg: {kitchenAvg.toFixed(1)}m</span>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="p-5 bg-(--color-surface-soft) rounded-2xl border border-(--color-border) flex items-start gap-4">
      <div className="h-11 w-11 rounded-xl bg-(--color-surface) border border-(--color-border) flex items-center justify-center text-primary shrink-0">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-(--color-text-muted) mb-0.5">{label}</p>
        <p className="text-sm font-medium text-(--color-text-primary) break-words">
          {value}
        </p>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, accent }) {
  const accents = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
  };
  return (
    <div className="p-4 bg-(--color-surface-soft) rounded-xl border border-(--color-border) text-center">
      <Icon size={18} className={`mx-auto mb-2 ${accents[accent]}`} />
      <p className="text-lg font-semibold text-(--color-text-primary)">{value}</p>
      <p className="text-[11px] text-(--color-text-muted) mt-0.5">{label}</p>
    </div>
  );
}

function OutcomeTile({ icon: Icon, label, value, tone }) {
  const tones = {
    muted: "text-(--color-text-muted) bg-(--color-surface-soft)",
    success: "text-success bg-success/10",
    danger: "text-danger bg-danger/10",
  };
  return (
    <div className="p-4 rounded-xl border border-(--color-border) flex items-center gap-3">
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xl font-semibold text-(--color-text-primary) leading-none">
          {value}
        </p>
        <p className="text-[11px] text-(--color-text-muted) mt-1">{label}</p>
      </div>
    </div>
  );
}
