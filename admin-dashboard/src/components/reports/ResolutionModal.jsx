// src/components/reports/ResolutionModal.jsx

import { useState } from "react";
import {
  X,
  CheckCircle,
  AlertTriangle,
  Ban,
  Bell,
  Trash2,
  Eye,
  Clock,
  XCircle,
} from "lucide-react";

const RESOLUTION_TYPES = [
  {
    value: "content_removed",
    label: "Content Removed",
    description: "Remove the reported content",
    icon: Trash2,
    color: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
    activeColor: "bg-red-500 text-white border-red-500",
  },
  {
    value: "user_warned",
    label: "User Warned",
    description: "Send a warning to the user",
    icon: Bell,
    color: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
    activeColor: "bg-orange-500 text-white border-orange-500",
  },
  {
    value: "user_suspended",
    label: "User Suspended",
    description: "Temporarily suspend the user",
    icon: Clock,
    color: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
    activeColor: "bg-amber-500 text-white border-amber-500",
  },
  {
    value: "user_banned",
    label: "User Banned",
    description: "Permanently ban the user",
    icon: Ban,
    color: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
    activeColor: "bg-red-500 text-white border-red-500",
  },
  {
    value: "no_action",
    label: "No Action Needed",
    description: "Report reviewed, no violation found",
    icon: Eye,
    color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
    activeColor: "bg-blue-500 text-white border-blue-500",
  },
];

function ResolutionModal({ type, onClose, onSubmit }) {
  const [selectedResolution, setSelectedResolution] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const isResolve = type === "resolve";
  const title = isResolve ? "Resolve Report" : "Dismiss Report";
  const subtitle = isResolve
    ? "Choose an action to take on this report"
    : "Provide a reason for dismissing this report";

  const handleSubmit = async () => {
    if (isResolve && !selectedResolution) return;
    if (!isResolve && !note.trim()) return;

    setLoading(true);
    await onSubmit({
      resolution: isResolve ? selectedResolution : "dismissed",
      note: note.trim(),
    });
    setLoading(false);
  };

  const canSubmit = isResolve ? selectedResolution !== "" : note.trim() !== "";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Sofia Sans" }}
            >
              {title}
            </h2>
            <p
              className="text-sm text-gray-500 mt-0.5"
              style={{ fontFamily: "Sofia Sans" }}
            >
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isResolve ? (
            <div className="space-y-2">
              <label
                className="text-sm font-semibold text-gray-700"
                style={{ fontFamily: "Sofia Sans" }}
              >
                Resolution Action
              </label>
              <div className="grid gap-2">
                {RESOLUTION_TYPES.map((resolution) => {
                  const Icon = resolution.icon;
                  const isSelected = selectedResolution === resolution.value;

                  return (
                    <button
                      key={resolution.value}
                      onClick={() => setSelectedResolution(resolution.value)}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? resolution.activeColor
                          : `border-gray-200 ${resolution.color}`
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg flex-shrink-0 ${isSelected ? "bg-white/20" : "bg-white"}`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="flex-1">
                        <p
                          className="text-sm font-semibold"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          {resolution.label}
                        </p>
                        <p
                          className="text-xs mt-0.5 opacity-80"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          {resolution.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0 self-center">
                          <CheckCircle size={18} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <AlertTriangle
                size={20}
                className="text-amber-500 flex-shrink-0 mt-0.5"
              />
              <div>
                <p
                  className="text-sm font-semibold text-amber-800"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  Dismiss Report
                </p>
                <p
                  className="text-xs text-amber-600 mt-1"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  This will mark the report as dismissed. The reporter will not
                  be notified.
                </p>
              </div>
            </div>
          )}

          {/* Notes Field */}
          <div>
            <label
              className="text-sm font-semibold text-gray-700 mb-2 block"
              style={{ fontFamily: "Sofia Sans" }}
            >
              {isResolve ? "Resolution Notes" : "Dismissal Reason"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isResolve
                  ? "Add notes (optional)..."
                  : "Explain why this report is being dismissed..."
              }
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              style={{ fontFamily: "Sofia Sans" }}
              autoFocus={!isResolve}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-100 flex gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              isResolve
                ? "bg-green-500 hover:bg-green-600"
                : "bg-gray-500 hover:bg-gray-600"
            }`}
            style={{ fontFamily: "Sofia Sans" }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {isResolve ? (
                  <>
                    <CheckCircle size={16} /> Resolve Report
                  </>
                ) : (
                  <>
                    <XCircle size={16} /> Dismiss Report
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResolutionModal;
