'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Users, Shield, MapPin, Info, Sparkles } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNotifications } from '../context/NotificationContext';
import { Button } from './ui/Button';
import PremiumSelect from './ui/PremiumSelect';

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
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const fetchTargets = async () => {
        try {
          const res = await api.get('/notifications/targets');
          setTargets(res.data.data);
        } catch (err) {
          toast.error('Could not load the recipient list');
        }
      };
      fetchTargets();
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const loadToast = toast.loading('Sending message...');
    try {
      await api.post('/notifications', formData);
      toast.success('Message sent successfully', { id: loadToast });
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
      toast.error(err.response?.data?.message || 'Could not send the message', { id: loadToast });
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
        className="fixed inset-0 bg-black/50 z-[-1]"
      />

      <motion.div
        initial={{ scale: 0.97, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative w-full max-w-lg bg-[var(--color-surface)] rounded-xl overflow-hidden shadow-[var(--shadow-md)] border border-[var(--color-border)] my-auto"
      >
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Send size={18} />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">New Message</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-surface-soft)] rounded-lg transition-colors">
            <X size={20} className="text-[var(--color-text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <PremiumSelect
              label="Send To"
              value={formData.targetType}
              onChange={val => setFormData({ ...formData, targetType: val, targetId: '' })}
              options={[
                { label: 'A Single Person', value: 'individual' },
                ...(targets.roles.length > 0 ? [{ label: 'A Role', value: 'role' }] : []),
                ...(targets.branches.length > 0 ? [{ label: 'A Branch', value: 'branch' }] : []),
                ...(targets.roles.includes('all') ? [{ label: 'Everyone', value: 'system' }] : [])
              ]}
            />

            <PremiumSelect 
              label="Priority"
              value={formData.priority}
              onChange={val => setFormData({ ...formData, priority: val })}
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Normal', value: 'medium' },
                { label: 'Urgent', value: 'high' }
              ]}
            />
        

          <PremiumSelect
            label="Choose Recipient"
            value={formData.targetId}
            onChange={val => setFormData({ ...formData, targetId: val })}
            options={[
              { label: 'Choose recipient...', value: '', disabled: true },
              ...(formData.targetType === 'individual' ? targets.users.map(u => ({ label: `${u.name} (${u.role.replace('_', ' ')})`, value: u._id })) : []),
              ...(formData.targetType === 'role' ? targets.roles.map(r => ({ label: r.replace('_', ' ').toUpperCase(), value: r })) : []),
              ...(formData.targetType === 'branch' ? targets.branches.map(b => ({ label: `${b.name} - ${b.city}`, value: b._id })) : []),
              ...(formData.targetType === 'system' ? [{ label: 'Everyone', value: 'all' }] : [])
            ]}
          />

          <div className="space-y-2">
            <label className="label">Title</label>
            <input
              required
              className="input"
              placeholder="Enter a subject..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="label">Message</label>
            <textarea
              required
              rows={4}
              className="input resize-none"
              placeholder="Enter message details..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            />
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              icon={Send}
              loading={loading}
            >
              Send Message
            </Button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
};

export default NotificationModal;
