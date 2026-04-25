'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Users, Shield, MapPin, Info, Sparkles } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNotifications } from '../context/NotificationContext';
import { Button } from './ui/Button';

const NotificationModal = ({ isOpen, onClose }) => {
  const { refresh } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [targets, setTargets] = useState({ users: [], roles: [], branches: [] });
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'announcement',
    priority: 'medium',
    targetType: 'individual',
    targetId: ''
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const fetchTargets = async () => {
        try {
          const res = await api.get('/notifications/targets');
          setTargets(res.data.data);
        } catch (err) {
          toast.error('Failed to fetch communication targets');
        }
      };
      fetchTargets();
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const loadToast = toast.loading('Dispatching transmission...');
    try {
      await api.post('/notifications', formData);
      toast.success('Notification dispatched successfully', { id: loadToast });
      onClose();
      setFormData({
        title: '',
        message: '',
        type: 'announcement',
        priority: 'medium',
        targetType: 'individual',
        targetId: ''
      });
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transmission failed', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[-1]"
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg glass-card rounded-[2.5rem] overflow-hidden shadow-[var(--shadow-premium)] border border-[var(--color-border)] my-auto"
      >
        <div className="px-8 py-6 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-soft)]/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Send size={18} />
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">New Transmission</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-soft)] rounded-full transition-colors">
            <X size={20} className="text-[var(--color-text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] ml-2">Channel Type</label>
              <select 
                className="w-full bg-[var(--color-bg-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                value={formData.targetType}
                onChange={(e) => setFormData({ ...formData, targetType: e.target.value, targetId: '' })}
              >
                <option value="individual">Individual Node</option>
                {targets.roles.length > 0 && <option value="role">Role Broadcast</option>}
                {targets.branches.length > 0 && <option value="branch">Branch Direct</option>}
                {targets.roles.includes('all') && <option value="system">Global System</option>}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] ml-2">Priority</label>
              <select 
                className="w-full bg-[var(--color-bg-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Standard</option>
                <option value="high">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] ml-2">Select Target</label>
            <select 
              required
              className="w-full bg-[var(--color-bg-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              value={formData.targetId}
              onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
            >
              <option value="" disabled>Choose Recipient...</option>
              {formData.targetType === 'individual' && targets.users.map(u => (
                <option key={u._id} value={u._id}>{u.name} ({u.role.replace('_', ' ')})</option>
              ))}
              {formData.targetType === 'role' && targets.roles.map(r => (
                <option key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</option>
              ))}
              {formData.targetType === 'branch' && targets.branches.map(b => (
                <option key={b._id} value={b._id}>{b.name} - {b.city}</option>
              ))}
              {formData.targetType === 'system' && <option value="all">Entire Network</option>}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] ml-2">Transmission Title</label>
            <input 
              required
              className="w-full bg-[var(--color-bg-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              placeholder="Enter subject..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] ml-2">Message Intelligence</label>
            <textarea 
              required
              rows={4}
              className="w-full bg-[var(--color-bg-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] p-4 rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
              placeholder="Enter message details..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button 
              type="submit"
              variant="primary" 
              className="flex-1 !rounded-2xl !py-4 font-black uppercase tracking-[0.2em] text-[10px] shadow-[var(--shadow-premium)]" 
              icon={Send}
              loading={loading}
            >
              Dispatch Transmission
            </Button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
};

export default NotificationModal;
