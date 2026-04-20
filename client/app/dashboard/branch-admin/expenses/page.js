'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Receipt, Plus, Search, Filter, Image as ImageIcon, Loader2, X, AlertCircle, Calendar, Trash2, Edit3 } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function ExpensesPage() {
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [formData, setFormData] = useState({
    title: '', amount: '', category: 'Other', description: '', 
    date: new Date().toISOString().split('T')[0]
  });
  const [image, setImage] = useState(null);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.startDate) query.append('startDate', filters.startDate);
      if (filters.endDate) query.append('endDate', filters.endDate);
      
      const res = await api.get(`/expenses?${query.toString()}`);
      setExpenses(res.data.data);
    } catch (error) {
      toast.error('Failed to sync ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      date: expense.date.split('T')[0]
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const loadToast = toast.loading(editingExpense ? 'Updating ledger...' : 'Recording transaction...');
    
    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    if (image) data.append('proofImage', image);

    try {
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Ledger updated!', { id: loadToast });
      } else {
        await api.post('/expenses', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Transaction recorded!', { id: loadToast });
      }
      setShowModal(false);
      setEditingExpense(null);
      setFormData({ title: '', amount: '', category: 'Other', description: '', date: new Date().toISOString().split('T')[0] });
      setImage(null);
      fetchExpenses();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol failure', { id: loadToast });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    const loadToast = toast.loading('Purging record...');
    try {
      await api.delete(`/expenses/${showDeleteConfirm}`);
      fetchExpenses();
      toast.success('Record liquidated', { id: loadToast });
    } catch (error) {
      toast.error('Liquidation failed', { id: loadToast });
    }
  };

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row justify-between md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 gap-6">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
                <Receipt className="mr-4 text-amber-600" size={36} /> Expense <span className="ml-3 text-amber-600">Vault</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2 font-medium">Digital operational ledger and fiscal matrix.</p>
            </div>
            <div className="flex flex-wrap gap-4 w-full md:w-auto">
              <div 
                onClick={() => startInputRef.current?.showPicker()}
                className="flex items-center space-x-2 bg-gray-50 dark:bg-zinc-800 p-2 rounded-xl border border-gray-100 dark:border-zinc-800 cursor-pointer hover:border-amber-500 transition-colors flex-1 md:flex-none"
              >
                <div className="p-2 text-gray-400"><Calendar size={18} /></div>
                <input 
                  ref={startInputRef}
                  type="date" 
                  className="bg-transparent outline-none text-xs font-black text-gray-700 dark:text-zinc-200 pr-3 cursor-pointer"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                />
              </div>

              <div 
                onClick={() => endInputRef.current?.showPicker()}
                className="flex items-center space-x-2 bg-gray-50 dark:bg-zinc-800 p-2 rounded-xl border border-gray-100 dark:border-zinc-800 cursor-pointer hover:border-amber-500 transition-colors flex-1 md:flex-none"
              >
                <div className="p-2 text-gray-400"><Calendar size={18} /></div>
                <input 
                  ref={endInputRef}
                  type="date" 
                  className="bg-transparent outline-none text-xs font-black text-gray-700 dark:text-zinc-200 pr-3 cursor-pointer"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                />
              </div>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setEditingExpense(null);
                  setShowModal(true);
                }}
                className="bg-zinc-900 dark:bg-amber-600 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition flex items-center shadow-2xl shadow-amber-600/10"
              >
                <Plus size={20} className="mr-3" strokeWidth={3} /> Record Transaction
              </motion.button>
            </div>
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={0.1}>
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-50 dark:border-zinc-800">
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Temporal Stamp</th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Particulars</th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Volume (₹)</th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Receipt</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {loading ? (
                    [1,2,3,4].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="5" className="px-8 py-8"><div className="h-6 bg-gray-100 dark:bg-zinc-800 rounded-xl w-full"></div></td>
                      </tr>
                    ))
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-8 py-24 text-center">
                        <div className="flex flex-col items-center justify-center opacity-30">
                          <AlertCircle size={48} className="mb-4" />
                          <p className="font-black text-xs uppercase tracking-widest">Vault is currently empty</p>
                        </div>
                      </td>
                    </tr>
                  ) : expenses.map((exp, idx) => (
                    <tr key={exp._id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-8 py-6 text-sm font-black text-gray-400">
                        {new Date(exp.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-gray-900 dark:text-zinc-100 tracking-tight">{exp.title}</div>
                        <div className="text-[10px] text-amber-600 font-black uppercase tracking-widest mt-1">{exp.category}</div>
                      </td>
                      <td className="px-8 py-6 text-sm font-black text-gray-900 dark:text-zinc-100">
                        ₹{exp.amount.toLocaleString()}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center">
                          {exp.proofImage ? (
                            <motion.a 
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              href={exp.proofImage} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="h-10 w-10 flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-xl border border-amber-200/20 shadow-sm"
                            >
                              <ImageIcon size={18} />
                            </motion.a>
                          ) : (
                            <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest italic">Digital Seal Missing</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(exp)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors"><Edit3 size={18} /></button>
                          <button onClick={() => setShowDeleteConfirm(exp._id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SlideIn>

        <Modal 
          isOpen={showModal} 
          onClose={() => setShowModal(false)} 
          title={editingExpense ? 'Refine Expenditure' : 'Capture Transaction'}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Expenditure Identity</label>
                <input required type="text" className="w-full rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Bulk Beans Purchase" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Fiscal Volume (₹)</label>
                <input required type="number" className="w-full rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Temporal Stamp</label>
                <input required type="date" className="w-full rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Operational Matrix</label>
                <select className="w-full rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all appearance-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  <option value="Raw Materials">Raw Materials</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Rent">Rent</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Salary">Salary (Operational)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Digital Evidence (Optional if already uploaded)</label>
                <div className="group relative flex flex-col items-center justify-center p-12 bg-gray-50 dark:bg-zinc-800/50 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-[2.5rem] hover:border-amber-500 transition-all cursor-pointer">
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleImageChange} accept="image/*" />
                  <ImageIcon className="h-12 w-12 text-gray-300 dark:text-zinc-600 mb-4 transition-transform group-hover:scale-110" />
                  <p className="text-[10px] font-black text-gray-500 dark:text-zinc-400 uppercase tracking-widest text-center">
                    {image ? <span className="text-amber-600">{image.name}</span> : 'Select Identity Scan'}
                  </p>
                </div>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="w-full py-5 bg-zinc-900 dark:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl shadow-amber-600/20 flex items-center justify-center">
              {submitting ? <Loader2 className="animate-spin mr-3" /> : (editingExpense ? 'Authorize Refinement' : 'Capture Transaction')}
            </button>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Liquidate Record?"
          message="This transaction will be permanently purged from the fiscal vault."
        />
      </div>
    </PageTransition>
  );
}
