// admin-frontend/src/components/users/WarnUserModal.jsx

import { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  Shield,
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader,
} from "lucide-react";
import UserAvatar from "./UserAvatar";

const SEVERITY_LEVELS = [
  {
    value: "low",
    label: "Low",
    description: "Minor violation, first warning",
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
    activeBg: "bg-blue-100",
    activeBorder: "border-blue-400",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Moderate violation",
    bg: "bg-yellow-50",
    text: "text-yellow-600",
    border: "border-yellow-200",
    activeBg: "bg-yellow-100",
    activeBorder: "border-yellow-400",
  },
  {
    value: "high",
    label: "High",
    description: "Serious violation",
    bg: "bg-orange-50",
    text: "text-orange-600",
    border: "border-orange-200",
    activeBg: "bg-orange-100",
    activeBorder: "border-orange-400",
  },
  {
    value: "critical",
    label: "Critical",
    description: "Severe violation, may lead to ban",
    bg: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
    activeBg: "bg-red-100",
    activeBorder: "border-red-400",
  },
];

const PRESET_REASONS = [
  "Spam or promotional content",
  "Harassment or bullying",
  "Hate speech or discrimination",
  "Inappropriate content",
  "Misinformation",
  "Impersonation",
  "Sharing personal information",
  "Violating community guidelines",
  "Multiple content violations",
  "Other",
];

/**
 * Warn User Modal
 *
 * Issues a warning to a user with severity level and reason.
 * Shows escalation warnings if thresholds are about to be crossed.
 * Displays warning history with option to revoke active warnings.
 */
function WarnUserModal({
  user,
  onClose,
  onSubmit,
  loading,
  warnings = [],
  onRevokeWarning,
}) {
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [customReason, setCustomReason] = useState("");
  const [showCustomReason, setShowCustomReason] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokingId, setRevokingId] = useState(null);
  const [revokingLoading, setRevokingLoading] = useState(false);

  const selectedReason = showCustomReason ? customReason : reason;

  // Debug logging - check what data we're receiving
  useEffect(() => {
    console.log(
      "🔍 WarnUserModal - Full warnings data:",
      JSON.stringify(warnings, null, 2),
    );
    console.log("🔍 WarnUserModal - Warnings length:", warnings?.length);
    console.log("🔍 WarnUserModal - First warning:", warnings?.[0]);
    console.log(
      "🔍 WarnUserModal - isActive field examples:",
      warnings?.map((w) => ({ id: w._id, isActive: w.isActive })),
    );
    console.log("🔍 WarnUserModal - has onRevokeWarning:", !!onRevokeWarning);
  }, [warnings, onRevokeWarning]);

  // Auto-show history if there are warnings
  useEffect(() => {
    if (warnings && warnings.length > 0) {
      setShowHistory(true);
      console.log("✅ Auto-showing history because warnings exist");
    }
  }, [warnings]);

  const handleSubmit = () => {
    const finalReason = selectedReason.trim();
    if (!finalReason) return;
    onSubmit(finalReason, severity);
  };

  const handleRevoke = async (warningId) => {
    if (!revokeReason.trim()) {
      alert("Please enter a reason for revoking this warning");
      return;
    }
    if (!onRevokeWarning) {
      alert("Revoke handler not available");
      return;
    }

    console.log(
      "🔄 Revoking warning:",
      warningId,
      "with reason:",
      revokeReason,
    );
    setRevokingLoading(true);
    try {
      await onRevokeWarning(warningId, revokeReason.trim());
      setRevokingId(null);
      setRevokeReason("");
      console.log("✅ Warning revoked successfully");
    } catch (error) {
      console.error("❌ Failed to revoke warning:", error);
      alert(error.message || "Failed to revoke warning. Please try again.");
    } finally {
      setRevokingLoading(false);
    }
  };

  const isValid = selectedReason.trim().length > 0;

  // Handle different data structures for isActive
  const isWarningActive = (warning) => {
    // Check if isActive field exists and is true
    if (warning.isActive !== undefined) {
      return warning.isActive === true;
    }
    // If no isActive field, check if it has been revoked
    if (warning.revokedAt || warning.revokedBy) {
      return false;
    }
    // If no revocation info, assume active
    return true;
  };

  const activeWarnings = (warnings || []).filter((w) => isWarningActive(w));
  const revokedWarnings = (warnings || []).filter((w) => !isWarningActive(w));
  const hasWarnings = warnings && warnings.length > 0;
  const hasActiveWarnings = activeWarnings.length > 0;

  console.log(
    "📊 Counts - Total:",
    warnings?.length,
    "Active:",
    activeWarnings.length,
    "Revoked:",
    revokedWarnings.length,
  );

  const getEscalationInfo = () => {
    const currentWarnings = activeWarnings.length + 1;
    if (currentWarnings >= 7)
      return {
        text: "⚠️ This will trigger an automatic permanent ban",
        color: "text-red-600 bg-red-50 border-red-200",
      };
    if (currentWarnings >= 5)
      return {
        text: "⚠️ This will trigger a 7-day suspension",
        color: "text-orange-600 bg-orange-50 border-orange-200",
      };
    if (currentWarnings >= 3)
      return {
        text: "⚠️ This will trigger a 24-hour suspension",
        color: "text-yellow-600 bg-yellow-50 border-yellow-200",
      };
    return null;
  };

  const getSeverityStyles = (severityLevel) => {
    const styles = {
      low: "bg-blue-50 text-blue-700 border-blue-200",
      medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
      high: "bg-orange-50 text-orange-700 border-orange-200",
      critical: "bg-red-50 text-red-700 border-red-200",
    };
    return styles[severityLevel] || styles.medium;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid date";
    }
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
                style={{ fontFamily: "Sofia Sans" }}
              >
                Issue Warning
              </h2>
              <p
                className="text-xs text-gray-500"
                style={{ fontFamily: "Sofia Sans" }}
              >
                To:{" "}
                <span className="font-semibold text-gray-700">
                  {user?.name || "User"}
                </span>
                {hasActiveWarnings && (
                  <span className="ml-2 text-yellow-600 font-medium">
                    ({activeWarnings.length} active warning
                    {activeWarnings.length > 1 ? "s" : ""})
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            disabled={loading || revokingLoading}
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
                style={{ fontFamily: "Sofia Sans" }}
              >
                {escalation.text}
              </p>
            </div>
          )}

          {/* User Preview */}
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
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  {user?.name}
                </p>
                {user?.username && (
                  <span
                    className="text-xs text-gray-400"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    @{user.username}
                  </span>
                )}
              </div>
              <p
                className="text-xs text-gray-500"
                style={{ fontFamily: "Sofia Sans" }}
              >
                {user?.email}
              </p>
            </div>
            {hasActiveWarnings && (
              <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertTriangle size={12} className="text-yellow-600" />
                <span
                  className="text-xs font-medium text-yellow-700"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  {activeWarnings.length} active
                </span>
              </div>
            )}
          </div>

          {/* ===== WARNING HISTORY SECTION ===== */}
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                hasActiveWarnings
                  ? "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                  : hasWarnings
                    ? "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <History
                  size={16}
                  className={
                    hasActiveWarnings ? "text-yellow-600" : "text-gray-400"
                  }
                />
                <span
                  className={`text-sm font-medium ${hasActiveWarnings ? "text-yellow-800" : "text-gray-600"}`}
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  {hasWarnings
                    ? `Warning History (${activeWarnings.length} active${revokedWarnings.length > 0 ? `, ${revokedWarnings.length} revoked` : ""})`
                    : "Warning History (No previous warnings)"}
                </span>
              </div>
              {showHistory ? (
                <ChevronUp
                  size={16}
                  className={
                    hasActiveWarnings ? "text-yellow-600" : "text-gray-400"
                  }
                />
              ) : (
                <ChevronDown
                  size={16}
                  className={
                    hasActiveWarnings ? "text-yellow-600" : "text-gray-400"
                  }
                />
              )}
            </button>

            {showHistory && (
              <div className="mt-2 space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {hasWarnings ? (
                  warnings.map((warning) => {
                    const isActive = isWarningActive(warning);
                    return (
                      <div
                        key={warning._id}
                        className={`p-3 rounded-xl border ${
                          isActive
                            ? getSeverityStyles(warning.severity) +
                              " border-opacity-50"
                            : "bg-gray-50 border-gray-200 opacity-75"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Badges Row */}
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                  isActive
                                    ? getSeverityStyles(warning.severity)
                                    : "bg-gray-100 text-gray-500 border-gray-200"
                                }`}
                                style={{ fontFamily: "Sofia Sans" }}
                              >
                                {warning.severity?.charAt(0).toUpperCase() +
                                  warning.severity?.slice(1) || "Medium"}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  isActive
                                    ? "bg-green-50 text-green-600 border border-green-200"
                                    : "bg-gray-200 text-gray-500"
                                }`}
                                style={{ fontFamily: "Sofia Sans" }}
                              >
                                {isActive ? "Active" : "Revoked"}
                              </span>
                            </div>

                            {/* Reason */}
                            <p
                              className="text-sm text-gray-700 mb-1"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {warning.reason}
                            </p>

                            {/* Date & Issuer */}
                            <div
                              className="flex items-center gap-3 text-xs text-gray-400 flex-wrap"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              <span>{formatDate(warning.createdAt)}</span>
                              {warning.issuedBy && (
                                <span>
                                  by{" "}
                                  {typeof warning.issuedBy === "object"
                                    ? warning.issuedBy?.name || "Unknown"
                                    : "Admin"}
                                </span>
                              )}
                            </div>

                            {/* Revocation Info */}
                            {!isActive && warning.revokedAt && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p
                                  className="text-xs text-gray-500"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  <span className="font-medium">Revoked:</span>{" "}
                                  {formatDate(warning.revokedAt)}
                                </p>
                                {warning.revokeReason && (
                                  <p
                                    className="text-xs text-gray-500 mt-0.5"
                                    style={{ fontFamily: "Sofia Sans" }}
                                  >
                                    <span className="font-medium">Reason:</span>{" "}
                                    {warning.revokeReason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* REVOKE BUTTON - Only for active warnings */}
                          {isActive && onRevokeWarning && (
                            <div className="flex-shrink-0">
                              {revokingId === warning._id ? (
                                <div className="flex flex-col gap-1.5 min-w-[170px]">
                                  <input
                                    type="text"
                                    value={revokeReason}
                                    onChange={(e) =>
                                      setRevokeReason(e.target.value)
                                    }
                                    placeholder="Reason for revoking..."
                                    className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 w-full"
                                    style={{ fontFamily: "Sofia Sans" }}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (
                                        e.key === "Enter" &&
                                        revokeReason.trim()
                                      ) {
                                        handleRevoke(warning._id);
                                      }
                                      if (e.key === "Escape") {
                                        setRevokingId(null);
                                        setRevokeReason("");
                                      }
                                    }}
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRevoke(warning._id);
                                      }}
                                      disabled={
                                        !revokeReason.trim() || revokingLoading
                                      }
                                      className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                                      style={{ fontFamily: "Sofia Sans" }}
                                    >
                                      {revokingLoading
                                        ? "Revoking..."
                                        : "Confirm"}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRevokingId(null);
                                        setRevokeReason("");
                                      }}
                                      className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                                      style={{ fontFamily: "Sofia Sans" }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRevokingId(warning._id);
                                    setRevokeReason("");
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs font-medium border border-red-200 whitespace-nowrap"
                                  style={{ fontFamily: "Sofia Sans" }}
                                  title="Revoke this warning"
                                >
                                  <RotateCcw size={12} />
                                  Revoke
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    className="text-center py-4 text-sm text-gray-400"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    No warning history found for this user
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===== ISSUE NEW WARNING SECTION ===== */}
          {/* Severity Selection */}
          <div>
            <label
              className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"
              style={{ fontFamily: "Sofia Sans" }}
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
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      severity === level.value ? level.text : "text-gray-700"
                    }`}
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {level.label}
                  </p>
                  <p
                    className="text-xs mt-0.5 text-gray-400"
                    style={{ fontFamily: "Sofia Sans" }}
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
              style={{ fontFamily: "Sofia Sans" }}
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
                          ? "border-yellow-400 bg-yellow-50 text-yellow-700 font-medium"
                          : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCustomReason(true)}
                  className="mt-3 text-sm text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1"
                  style={{ fontFamily: "Sofia Sans" }}
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
                  style={{ fontFamily: "Sofia Sans" }}
                  autoFocus
                />
                <button
                  onClick={() => {
                    setShowCustomReason(false);
                    setCustomReason("");
                  }}
                  className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  ← Use preset reasons
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between rounded-b-2xl bg-white sticky bottom-0">
          <div className="flex items-center gap-2">
            {hasActiveWarnings && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertTriangle size={14} className="text-yellow-600" />
                <span
                  className="text-xs font-medium text-yellow-700"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  {activeWarnings.length} active warning
                  {activeWarnings.length > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              style={{ fontFamily: "Sofia Sans" }}
              disabled={loading || revokingLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              style={{
                backgroundColor: isValid ? "#eab308" : "#9ca3af",
                fontFamily: "Sofia Sans",
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
                  Issue Warning{" "}
                  {hasActiveWarnings ? `(#${activeWarnings.length + 1})` : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WarnUserModal;
