// admin-frontend/src/components/users/BanUserModal.jsx

import { useState } from 'react';
import { X, Ban, AlertTriangle, UserX } from 'lucide-react';
import UserAvatar from './UserAvatar';

const BAN_REASONS = [
  'Repeated violations of community guidelines',
  'Hate speech or discrimination',
  'Harassment or bullying',
  'Sharing illegal content',
  'Impersonation',
  'Spam or scam activity',
  'Threats of violence',
  'Sharing personal information of others',
  'Creating multiple accounts to bypass restrictions',
  'Other',
];

/**
 * Ban User Modal
 * 
 * Permanently bans a user with reason and confirmation.
 * Uses UserAvatar component for profile picture display.
 */
function BanUserModal({ user, onClose, onSubmit, loading }) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showCustomReason, setShowCustomReason] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const selectedReason = showCustomReason ? customReason : reason;
  const isValid = selectedReason.trim().length > 0 && confirmation === user?.name;

  const handleSubmit = () => {
    const finalReason = selectedReason.trim();
    if (!finalReason || confirmation !== user?.name) return;
    onSubmit(finalReason);
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
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Ban size={20} className="text-red-600" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                Ban User
              </h2>
              <p
                className="text-xs text-gray-500"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                This action is{' '}
                <span className="text-red-500 font-semibold">permanent</span>{' '}
                and cannot be easily undone
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
          {/* Warning Banner */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="text-red-500 flex-shrink-0 mt-0.5"
              />
              <div>
                <p
                  className="text-sm font-semibold text-red-700"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  Consequences of banning:
                </p>
                <ul
                  className="mt-2 space-y-1.5 text-xs text-red-600"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    User will be logged out from all devices
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    User will not be able to log in again
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    All user content will remain but be hidden
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    This action will be permanently logged
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* User Preview - Using UserAvatar */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <UserAvatar
              user={user}
              size="md"
              gradient="from-red-400 to-red-600"
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

          {/* Reason */}
          <div>
            <label
              className="block text-sm font-semibold text-gray-700 mb-3"
              style={{ fontFamily: 'Sofia Sans' }}
            >
              Ban Reason <span className="text-red-500">*</span>
            </label>

            {!showCustomReason ? (
              <>
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {BAN_REASONS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setReason(preset)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                        reason === preset
                          ? 'border-red-400 bg-red-50 text-red-700 font-medium'
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
                  className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
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
                  placeholder="Enter detailed reason for ban..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
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
              Confirm Ban
            </label>
            <p
              className="text-xs text-gray-500 mb-3"
              style={{ fontFamily: 'Sofia Sans' }}
            >
              Type{' '}
              <span className="font-bold text-red-600">{user?.name}</span> to
              confirm this permanent action
            </p>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={`Type "${user?.name}" to confirm`}
              className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all ${
                confirmation && confirmation !== user?.name
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50'
                  : confirmation === user?.name
                  ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100 bg-emerald-50'
                  : 'border-gray-200 focus:border-gray-400 focus:ring-gray-100'
              }`}
              style={{ fontFamily: 'Sofia Sans' }}
            />
            {confirmation && confirmation !== user?.name && (
              <p
                className="text-xs text-red-500 mt-1.5 flex items-center gap-1"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                <AlertTriangle size={12} />
                Name does not match
              </p>
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
              backgroundColor: isValid ? '#ef4444' : '#9ca3af',
              fontFamily: 'Sofia Sans',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Banning...
              </>
            ) : (
              <>
                <UserX size={16} />
                Ban Permanently
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BanUserModal;