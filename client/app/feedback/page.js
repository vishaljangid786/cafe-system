'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../services/api';
import { Star, CheckCircle2 } from 'lucide-react';

function FeedbackForm() {
  const params = useSearchParams();
  const branch = params.get('branch') || params.get('locationId') || '';
  const orderId = params.get('order') || '';

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!branch) return;
    if (rating < 1) return;
    setSubmitting(true);
    try {
      await api.post('/feedback', { locationId: branch, orderId: orderId || undefined, customerName: name, rating, comment, source: 'qr' });
      setDone(true);
    } catch (e) {
      // Stay on the form; show a soft message.
      setDone(false);
      alert(e.response?.data?.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!branch) {
    return <p className="text-center text-sm text-(--color-text-muted)">Invalid feedback link.</p>;
  }

  if (done) {
    return (
      <div className="text-center space-y-3 py-8">
        <CheckCircle2 size={48} className="text-success mx-auto" />
        <h2 className="text-xl font-bold text-(--color-text-primary)">Thank you!</h2>
        <p className="text-sm text-(--color-text-muted)">Your feedback helps us serve you better.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-(--color-text-primary) tracking-tight">How was your visit?</h1>
        <p className="text-xs text-(--color-text-muted)">Tap a star to rate us</p>
      </div>

      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)} className="transition-transform active:scale-90">
            <Star size={40} className={(hover || rating) >= n ? 'text-amber-400 fill-amber-400' : 'text-(--color-border)'} />
          </button>
        ))}
      </div>

      <input
        value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
        className="w-full px-4 py-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:border-primary"
      />
      <textarea
        value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us more (optional)" rows={3}
        className="w-full px-4 py-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:border-primary resize-none"
      />

      <button
        onClick={submit} disabled={submitting || rating < 1}
        className="w-full py-4 bg-primary text-(--color-on-primary) text-xs font-bold uppercase tracking-normal rounded-xl hover:opacity-90 disabled:opacity-40 transition-all"
      >
        {submitting ? 'Submitting…' : 'Submit feedback'}
      </button>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-(--color-bg-base)">
      <div className="w-full max-w-md glass-card p-8 rounded-2xl premium-shadow">
        <Suspense fallback={<p className="text-center text-sm text-(--color-text-muted)">Loading…</p>}>
          <FeedbackForm />
        </Suspense>
      </div>
    </div>
  );
}
