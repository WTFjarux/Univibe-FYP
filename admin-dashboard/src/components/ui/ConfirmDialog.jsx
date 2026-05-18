// admin-frontend/src/components/ui/ConfirmDialog.jsx

import { AlertTriangle, X } from 'lucide-react';

/**
 * Reusable Confirmation Dialog
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dialog is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onConfirm - Confirm handler
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Confirmation message
 * @param {string} props.confirmText - Text for confirm button (default: "Confirm")
 * @param {string} props.cancelText - Text for cancel button (default: "Cancel")
 * @param {string} props.variant - 'danger' | 'warning' | 'info' (default: 'danger')
 * @param {boolean} props.loading - Show loading state on confirm button
 */
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  if (!isOpen) return null;

  const variants = {
    danger: {
      icon: 'bg-red-100 text-red-600',
      iconColor: 'text-red-600',
      confirmBg: 'bg-red-500 hover:bg-red-600',
      border: 'border-red-200',
    },
    warning: {
      icon: 'bg-orange-100 text-orange-600',
      iconColor: 'text-orange-600',
      confirmBg: 'bg-orange-500 hover:bg-orange-600',
      border: 'border-orange-200',
    },
    info: {
      icon: 'bg-blue-100 text-blue-600',
      iconColor: 'text-blue-600',
      confirmBg: 'bg-blue-500 hover:bg-blue-600',
      border: 'border-blue-200',
    },
  };

  const style = variants[variant] || variants.danger;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.icon}`}>
              <AlertTriangle size={20} />
            </div>
            <h2
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: 'Sofia Sans' }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            disabled={loading}
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Message */}
        <div className="px-6 py-4">
          <p
            className="text-sm text-gray-600 leading-relaxed"
            style={{ fontFamily: 'Sofia Sans' }}
          >
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            style={{ fontFamily: 'Sofia Sans' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center gap-2 ${style.confirmBg}`}
            style={{ fontFamily: 'Sofia Sans' }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;