// admin-frontend/src/components/users/SuspendUserModal.jsx

import { useState } from 'react';
import { X, Clock, AlertTriangle, Calendar } from 'lucide-react';
import UserAvatar from './UserAvatar';

const SUSPEND_DURATIONS = [
  { value: 1, label: '1 Hour', desc: 'Minor infraction' },
  { value: 6, label: '6 Hours', desc: 'Cooling off' },
  { value: 12, label: '12 Hours', desc: 'Half-day' },
  { value: 24, label: '24 Hours', desc: 'One day' },
  { value: 72, label: '3 Days', desc: 'Extended' },
  { value: 168, label: '7 Days', desc: 'Week-long' },
  { value: 336, label: '14 Days', desc: 'Two weeks' },
  { value: 720, label: '30 Days', desc: 'Month-long' },
];

const SUSPEND_REASONS = [
  'Violating community guidelines',
  'Inappropriate behavior',
  'Spam or promotional content',
  'Harassment of other users',
  'Posting inappropriate content',
  'Repeated minor violations',
  'Cooling off period required',
  'Investigation pending',
  'Other',
];

/**
 * Suspend User Modal
 * Allows admin to temporarily suspend a user for a set duration.
 * Uses UserAvatar component for profile picture display.
 */
function SuspendUserModal({ user, onClose, onSubmit, loading }) {
  const [duration, setDuration] = useState(24);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showCustomReason, setShowCustomReason] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const selectedReason = showCustomReason ? customReason : reason;
  const isValid = selectedReason.trim().length > 0 && duration > 0 && confirmation === 'suspend';

  const handleSubmit = () => {
    const finalReason = selectedReason.trim();
    if (!finalReason || !duration || confirmation !== 'suspend') return;
    onSubmit(finalReason, duration);
  };

  const getDurationLabel = () => {
    const selected = SUSPEND_DURATIONS.find((d) => d.value === duration);
    return selected?.label || `${duration} Hours`;
  };

  const getSuspensionEnd = () => {
    const endDate = new Date(Date.now() + duration * 60 * 60 * 1000);
    return endDate.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Clock size={20} className="text-orange-600" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                Suspend User
              </h2>
              <p
                className="text-xs text-gray-500"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                Temporarily restrict{' '}
                <span className="font-semibold">{user?.name || 'User'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            disabled={loading}
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info Banner */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={18}
                className="text-orange-500 flex-shrink-0 mt-0.5"
              />
              <div>
                <p
                  className="text-sm font-semibold text-orange-700"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  Temporary Suspension Details:
                </p>
                <ul
                  className="mt-2 space-y-1 text-xs text-orange-600"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  <li>• User will be logged out from all devices</li>
                  <li>• User cannot log in until suspension expires</li>
                  <li>• Suspension will auto-lift after selected duration</li>
                </ul>
              </div>
            </div>
          </div>

          {/* User Preview - Using UserAvatar */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <UserAvatar
              user={user}
              size="md"
              gradient="from-orange-400 to-orange-600"
            />
            <div>
              <div className="flex items-center gap-2">
                <p
                  className="text-sm font-semibold text-gray-900"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  {user?.name}
                </p>
                {user?.username && (
                  <span
                    className="text-xs text-gray-400"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    @{user.username}
                  </span>
                )}
              </div>
              <p
                className="text-xs text-gray-500"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                {user?.email}
              </p>
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label
              className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"
              style={{ fontFamily: 'Sofia Sans' }}
            >
              <Calendar size={16} className="text-gray-400" />
              Suspension Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SUSPEND_DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`text-center p-3 rounded-xl border-2 transition-all ${
                    duration === d.value
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <p
                    className={`text-xs font-semibold ${
                      duration === d.value
                        ? 'text-orange-700'
                        : 'text-gray-700'
                    }`}
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    {d.label}
                  </p>
                  <p
                    className="text-[10px] text-gray-400 mt-0.5"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    {d.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* Duration Summary */}
            <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span
                  className="text-gray-500"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  Duration:
                </span>
                <span
                  className="font-semibold text-gray-900"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  {getDurationLabel()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span
                  className="text-gray-500"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  Expires:
                </span>
                <span
                  className="font-semibold text-orange-600"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  {getSuspensionEnd()}
                </span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label
              className="block text-sm font-semibold text-gray-700 mb-3"
              style={{ fontFamily: 'Sofia Sans' }}
            >
              Reason <span className="text-red-500">*</span>
            </label>

            {!showCustomReason ? (
              <>
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {SUSPEND_REASONS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setReason(preset)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                        reason === preset
                          ? 'border-orange-400 bg-orange-50 text-orange-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      style={{ fontFamily: 'Sofia Sans' }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCustomReason(true)}
                  className="mt-3 text-sm text-orange-600 hover:text-orange-700 font-medium"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  + Write custom reason
                </button>
              </>
            ) : (
              <div>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter detailed reason..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                  style={{ fontFamily: 'Sofia Sans' }}
                  autoFocus
                />
                <button
                  onClick={() => {
                    setShowCustomReason(false);
                    setCustomReason('');
                  }}
                  className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  ← Use preset reasons
                </button>
              </div>
            )}
          </div>

          {/* Confirmation */}
          <div>
            <label
              className="block text-sm font-semibold text-gray-700 mb-2"
              style={{ fontFamily: 'Sofia Sans' }}
            >
              Confirm Suspension
            </label>
            <p
              className="text-xs text-gray-500 mb-3"
              style={{ fontFamily: 'Sofia Sans' }}
            >
              Type{' '}
              <span className="font-bold text-orange-600">suspend</span> to
              confirm
            </p>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder='Type "suspend" to confirm'
              className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all ${
                confirmation && confirmation !== 'suspend'
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50'
                  : confirmation === 'suspend'
                  ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100 bg-emerald-50'
                  : 'border-gray-200 focus:border-orange-400 focus:ring-orange-100'
              }`}
              style={{ fontFamily: 'Sofia Sans' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            style={{ fontFamily: 'Sofia Sans' }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            style={{
              backgroundColor: isValid ? '#f59e0b' : '#9ca3af',
              fontFamily: 'Sofia Sans',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Suspending...
              </>
            ) : (
              <>
                <Clock size={16} />
                Suspend for {getDurationLabel()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SuspendUserModal;