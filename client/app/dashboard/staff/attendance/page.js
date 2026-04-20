'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { Calendar, Wallet, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

export default function StaffAttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [attRes, salRes] = await Promise.all([
          api.get(`/attendance/all?userId=${user._id}&month=${month}`),
          api.get(`/salary/user/${user._id}?month=${month}`)
        ]);
        setAttendance(attRes.data.data);
        setSalaryData(salRes.data.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user, month]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2 text-amber-600" /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <Calendar className="mr-3 text-amber-600" /> My Attendance & Salary
          </h1>
          <p className="text-gray-500 mt-1">Review your work days and calculated pay for the month.</p>
        </div>
        <input 
          type="month" 
          className="border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-amber-500 focus:border-amber-500 font-semibold"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {/* Salary Overview Card */}
      <div className="bg-amber-600 rounded-2xl shadow-xl p-8 text-white flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
        <Wallet className="absolute -right-8 -bottom-8 opacity-10" size={200} />
        <div className="z-10 text-center md:text-left mb-6 md:mb-0">
          <p className="text-amber-100 font-medium uppercase tracking-widest text-xs mb-1">Estimated Payout for {month}</p>
          <h2 className="text-4xl font-black">₹{Math.round(salaryData?.calculatedSalary || 0).toLocaleString()}</h2>
          <div className="mt-4 flex space-x-4 text-sm font-medium">
            <span className="bg-amber-500/30 px-3 py-1 rounded-full border border-white/20">Base: ₹{user.monthlySalary?.toLocaleString()}</span>
            <span className="bg-amber-500/30 px-3 py-1 rounded-full border border-white/20">{salaryData?.payableDays} Payable Days</span>
          </div>
        </div>
        <div className="z-10 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/10 p-4 rounded-xl border border-white/10">
            <p className="text-xs text-amber-100 uppercase mb-1">Present</p>
            <p className="text-xl font-bold">{salaryData?.totalPresent}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-xl border border-white/10">
            <p className="text-xs text-amber-100 uppercase mb-1">Half Day</p>
            <p className="text-xl font-bold">{salaryData?.totalHalfDay}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-xl border border-white/10">
            <p className="text-xs text-amber-100 uppercase mb-1">Absent</p>
            <p className="text-xl font-bold">{salaryData?.totalAbsent}</p>
          </div>
        </div>
      </div>

      {/* Attendance History */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Daily Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Log Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendance.map((log, idx) => (
                <tr key={idx} className="text-sm">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-700">{new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                      log.status === 'present' ? 'bg-green-100 text-green-700' :
                      log.status === 'half-day' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400 text-xs">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr><td colSpan="3" className="px-6 py-10 text-center text-gray-400 italic">No attendance records found for this month.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
