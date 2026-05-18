// admin-frontend/src/components/users/WarnUserModal.jsx

import { useState } from 'react';
import { X, AlertTriangle, Shield } from 'lucide-react';
import UserAvatar from './UserAvatar';

const SEVERITY_LEVELS = [
  {
    value: 'low',
    label: 'Low',
    description: 'Minor violation, first warning',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    activeBg: 'bg-blue-100',
    activeBorder: 'border-blue-400',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Moderate violation',
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    border: 'border-yellow-200',
    activeBg: 'bg-yellow-100',
    activeBorder: 'border-yellow-400',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Serious violation',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
    activeBg: 'bg-orange-100',
    activeBorder: 'border-orange-400',
  },
  {
    value: 'critical',
    label: 'Critical',
    description: 'Severe violation, may lead to ban',
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    activeBg: 'bg-red-100',
    activeBorder: 'border-red-400',
  },
];

const PRESET_REASONS = [
  'Spam or promotional content',
  'Harassment or bullying',
  'Hate speech or discrimination',
  'Inappropriate content',
  'Misinformation',
  'Impersonation',
  'Sharing personal information',
  'Violating community guidelines',
  'Multiple content violations',
  'Other',
];

/**
 * Warn User Modal
 * 
 * Issues a warning to a user with severity level and reason.
 * Shows escalation warnings if thresholds are about to be crossed.
 * Uses UserAvatar component for profile picture display.
 */
function WarnUserModal({ user, onClose, onSubmit, loading }) {
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [customReason, setCustomReason] = useState('');
  const [showCustomReason, setShowCustomReason] = useState(false);

  const selectedReason = showCustomReason ? customReason : reason;

  const handleSubmit = () => {
    const finalReason = selectedReason.trim();
    if (!finalReason) return;
    onSubmit(finalReason, severity);
  };

  const isValid = selectedReason.trim().length > 0;

  const getEscalationInfo = () => {
    const warnings = (user?.warningCount || 0) + 1;
    if (warnings >= 7) return { text: '⚠️ This will trigger an automatic ban', color: 'text-red-600 bg-red-50 border-red-200' };
    if (warnings >= 5) return { text: '⚠️ This will trigger a 7-day suspension', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    if (warnings >= 3) return { text: '⚠️ This will trigger a 24-hour suspension', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    return null;
  };

  const escalation = getEscalationInfo();

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
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-yellow-600" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                Issue Warning
              </h2>
              <p
                className="text-xs text-gray-500"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                To:{' '}
                <span className="font-semibold text-gray-700">
                  {user?.name || 'User'}
                </span>
                {user?.warningCount > 0 && (
                  <span className="ml-2 text-yellow-600">
                    ({user.warningCount} previous warning
                    {user.warningCount > 1 ? 's' : ''})
                  </span>
                )}
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
          {/* Escalation Warning */}
          {escalation && (
            <div
              className={`border rounded-xl p-3 flex items-center gap-3 ${escalation.color}`}
            >
              <AlertTriangle size={18} className="flex-shrink-0" />
              <p
                className="text-sm font-medium"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                {escalation.text}
              </p>
            </div>
          )}

          {/* User Preview - Using UserAvatar */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <UserAvatar
              user={user}
              size="md"
              gradient="from-purple-400 to-purple-600"
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

          {/* Severity Selection */}
          <div>
            <label
              className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"
              style={{ fontFamily: 'Sofia Sans' }}
            >
              <Shield size={16} className="text-gray-400" />
              Severity Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setSeverity(level.value)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    severity === level.value
                      ? `${level.activeBg} ${level.activeBorder}`
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      severity === level.value ? level.text : 'text-gray-700'
                    }`}
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    {level.label}
                  </p>
                  <p
                    className="text-xs mt-0.5 text-gray-400"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    {level.description}
                  </p>
                </button>
              ))}
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
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {PRESET_REASONS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setReason(preset)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                        reason === preset
                          ? 'border-yellow-400 bg-yellow-50 text-yellow-700 font-medium'
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
                  className="mt-3 text-sm text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1"
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
                  placeholder="Enter detailed reason for this warning..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all"
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
              backgroundColor: isValid ? '#eab308' : '#9ca3af',
              fontFamily: 'Sofia Sans',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Issuing...
              </>
            ) : (
              <>
                <AlertTriangle size={16} />
                Issue Warning
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WarnUserModal;