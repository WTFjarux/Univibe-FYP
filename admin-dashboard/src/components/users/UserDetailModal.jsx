// admin-frontend/src/components/users/UserDetailModal.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Mail,
  Calendar,
  AlertTriangle,
  Flag,
  FileText,
  MessageSquare,
  UserCheck,
  ExternalLink,
  Activity,
  Hash,
  Loader,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import useAuthStore from '../../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * User Detail Modal
 * 
 * Displays detailed user information including warnings, reports, and stats.
 * Uses UserAvatar for profile picture and Zustand for auth token.
 */
function UserDetailModal({ user, onClose, onRefresh, onViewFullProfile }) {
  const navigate = useNavigate();

  // ============================================
  // AUTH STORE
  // ============================================
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);

  // ============================================
  // STATE
  // ============================================
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [revokingId, setRevokingId] = useState(null);

  // ============================================
  // FETCH USER DETAILS
  // ============================================
  useEffect(() => {
    if (user && user._id) {
      fetchUserDetails();
    }
  }, [user?._id]);

  const fetchUserDetails = async () => {
    if (!accessToken) {
      setFetchError('No authentication token found. Please login again.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setFetchError('');

      const response = await fetch(`${API_BASE_URL}/api/admin/users/${user._id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        logout();
        onClose();
        navigate('/login', { replace: true });
        return;
      }

      const data = await response.json();

      if (data.success) {
        setDetails(data.data);
      } else {
        setFetchError(data.message || 'Failed to load user details');
      }
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      setFetchError('Network error: ' + (err.message || 'Please check your connection'));
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // REVOKE WARNING
  // ============================================
  const handleRevokeWarning = async (warningId) => {
    if (!window.confirm('Are you sure you want to revoke this warning?')) return;
    if (!accessToken) return;

    setRevokingId(warningId);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${user._id}/warnings/${warningId}/revoke`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'Manual revocation by admin' }),
        }
      );

      if (response.status === 401) {
        logout();
        onClose();
        navigate('/login', { replace: true });
        return;
      }

      const data = await response.json();

      if (data.success) {
        await fetchUserDetails();
        if (onRefresh) onRefresh();
      } else {
        alert(data.message || 'Failed to revoke warning');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const displayUser = details?.user || user;
  const displayStats = details?.stats || {
    postCount: 0,
    commentCount: 0,
    warningCount: user?.warningCount || 0,
    reportCount: 0,
  };
  const displayWarnings = details?.warnings || [];
  const displayReports = details?.reports || [];

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'warnings', label: 'Warnings', icon: AlertTriangle, count: displayWarnings.length },
    { key: 'reports', label: 'Reports', icon: Flag, count: displayReports.length },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar
              user={displayUser}
              size="lg"
              gradient="from-purple-400 to-purple-600"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="text-xl font-bold text-gray-900"
                  style={{ fontFamily: 'Sofia Sans' }}
                >
                  {displayUser?.name || 'User'}
                </h2>
                {displayUser?.username && (
                  <span
                    className="text-sm text-gray-400"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    @{displayUser.username}
                  </span>
                )}
              </div>
              <p
                className="text-sm text-gray-500"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                {displayUser?.email || ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>
      </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader size={36} className="text-purple-500 animate-spin" />
              <p
                className="text-sm text-gray-500"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                Loading user details...
              </p>
            </div>
          ) : fetchError ? (
            <div className="text-center py-12 px-6">
              <AlertTriangle size={40} className="mx-auto text-red-400 mb-3" />
              <p
                className="text-red-500 font-medium mb-4"
                style={{ fontFamily: 'Sofia Sans' }}
              >
                {fetchError}
              </p>
              <button
                onClick={fetchUserDetails}
                className="px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Retry
              </button>
            </div>
          ) : (
            <div className="p-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <FileText size={18} className="mx-auto mb-1 text-blue-500" />
                  <p
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    {displayStats.postCount}
                  </p>
                  <p
                    className="text-[11px] text-gray-500"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    Posts
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <MessageSquare size={18} className="mx-auto mb-1 text-emerald-500" />
                  <p
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    {displayStats.commentCount}
                  </p>
                  <p
                    className="text-[11px] text-gray-500"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    Comments
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <AlertTriangle size={18} className="mx-auto mb-1 text-yellow-500" />
                  <p
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    {displayStats.warningCount}
                  </p>
                  <p
                    className="text-[11px] text-gray-500"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    Warnings
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Flag size={18} className="mx-auto mb-1 text-red-500" />
                  <p
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    {displayStats.reportCount}
                  </p>
                  <p
                    className="text-[11px] text-gray-500"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    Reports
                  </p>
                </div>
              </div>

              {/* User Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={16} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="text-gray-700"
                    style={{ fontFamily: 'Sofia Sans' }}
                  >
                    {displayUser?.email || 'N/A'}
                  </span>
                </div>
                {displayUser?.username && (
                  <div className="flex items-center gap-3 text-sm">
                    <Hash size={16} className="text-gray-400 flex-shrink-0" />
                    <span
                      className="text-gray-700"
                      style={{ fontFamily: 'Sofia Sans' }}
                    >
                      @{displayUser.username}
                    </span>
                  </div>
                )}
                {displayUser?.createdAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                    <span
                      className="text-gray-700"
                      style={{ fontFamily: 'Sofia Sans' }}
                    >
                      Joined{' '}
                      {new Date(displayUser.createdAt).toLocaleDateString(
                        'en-US',
                        { year: 'numeric', month: 'long', day: 'numeric' }
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 mb-4">
                {tabs.map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-[1px] ${
                        activeTab === tab.key
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                      style={{ fontFamily: 'Sofia Sans' }}
                    >
                      <TabIcon size={16} />
                      {tab.label}
                      {tab.count > 0 && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeTab === tab.key
                              ? 'bg-purple-100 text-purple-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="max-h-[250px] overflow-y-auto">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {displayUser?.isBanned && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p
                          className="text-sm font-semibold text-red-700"
                          style={{ fontFamily: 'Sofia Sans' }}
                        >
                          Banned
                        </p>
                        <p
                          className="text-sm text-red-600 mt-1"
                          style={{ fontFamily: 'Sofia Sans' }}
                        >
                          {displayUser.banReason}
                        </p>
                      </div>
                    )}
                    {displayUser?.isSuspended && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p
                          className="text-sm font-semibold text-amber-700"
                          style={{ fontFamily: 'Sofia Sans' }}
                        >
                          Suspended
                        </p>
                        <p
                          className="text-sm text-amber-600 mt-1"
                          style={{ fontFamily: 'Sofia Sans' }}
                        >
                          {displayUser.suspendReason}
                        </p>
                        {displayUser.suspendedUntil && (
                          <p
                            className="text-xs text-amber-500 mt-1"
                            style={{ fontFamily: 'Sofia Sans' }}
                          >
                            Until:{' '}
                            {new Date(displayUser.suspendedUntil).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                    {!displayUser?.isBanned && !displayUser?.isSuspended && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                        <UserCheck
                          size={24}
                          className="mx-auto text-emerald-500 mb-2"
                        />
                        <p
                          className="text-sm font-semibold text-emerald-700"
                          style={{ fontFamily: 'Sofia Sans' }}
                        >
                          Account in Good Standing
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'warnings' && (
                  <div className="space-y-3">
                    {displayWarnings.length > 0 ? (
                      displayWarnings.map((warning) => (
                        <div
                          key={warning._id}
                          className={`border rounded-xl p-4 transition-all ${
                            warning.isActive
                              ? 'border-yellow-200 bg-yellow-50/50 hover:shadow-sm'
                              : 'border-gray-200 bg-gray-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                                warning.isActive
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                              style={{ fontFamily: 'Sofia Sans' }}
                            >
                              {warning.isActive ? 'Active' : 'Revoked'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs text-gray-400"
                                style={{ fontFamily: 'Sofia Sans' }}
                              >
                                {new Date(warning.createdAt).toLocaleDateString(
                                  'en-US',
                                  { month: 'short', day: 'numeric', year: 'numeric' }
                                )}
                              </span>
                              {warning.isActive && (
                                <button
                                  onClick={() => handleRevokeWarning(warning._id)}
                                  disabled={revokingId === warning._id}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-all disabled:opacity-50"
                                  style={{ fontFamily: 'Sofia Sans' }}
                                  title="Revoke this warning"
                                >
                                  {revokingId === warning._id ? (
                                    <Loader size={12} className="animate-spin" />
                                  ) : (
                                    <XCircle size={12} />
                                  )}
                                  Revoke
                                </button>
                              )}
                            </div>
                          </div>
                          <p
                            className="text-sm text-gray-700 font-medium mb-2"
                            style={{ fontFamily: 'Sofia Sans' }}
                          >
                            {warning.reason}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                                warning.severity === 'critical'
                                  ? 'bg-red-100 text-red-700'
                                  : warning.severity === 'high'
                                  ? 'bg-orange-100 text-orange-700'
                                  : warning.severity === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                              style={{ fontFamily: 'Sofia Sans' }}
                            >
                              {warning.severity}
                            </span>
                            {warning.issuedBy && (
                              <span
                                className="text-xs text-gray-400"
                                style={{ fontFamily: 'Sofia Sans' }}
                              >
                                by {warning.issuedBy?.name || 'Admin'}
                              </span>
                            )}
                          </div>
                          {warning.revokedAt && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p
                                className="text-xs text-gray-400"
                                style={{ fontFamily: 'Sofia Sans' }}
                              >
                                Revoked on{' '}
                                {new Date(warning.revokedAt).toLocaleDateString()}
                                {warning.revokeReason &&
                                  `: ${warning.revokeReason}`}
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <AlertTriangle
                          size={32}
                          className="mx-auto text-gray-300 mb-2"
                        />
                        <p
                          className="text-gray-500"
                          style={{ fontFamily: 'Sofia Sans' }}
                        >
                          No warnings
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'reports' && (
                  <div className="space-y-3">
                    {displayReports.length > 0 ? (
                      displayReports.map((report) => (
                        <div
                          key={report._id}
                          className={`border rounded-xl p-3 ${
                            report.status === 'pending'
                              ? 'border-red-200 bg-red-50/30'
                              : report.status === 'resolved'
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                report.status === 'pending'
                                  ? 'bg-red-100 text-red-700'
                                  : report.status === 'resolved'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                              style={{ fontFamily: 'Sofia Sans' }}
                            >
                              {report.status}
                            </span>
                            <span
                              className="text-xs text-gray-400"
                              style={{ fontFamily: 'Sofia Sans' }}
                            >
                              {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p
                            className="text-sm text-gray-700 capitalize"
                            style={{ fontFamily: 'Sofia Sans' }}
                          >
                            {report.reason?.replace(/_/g, ' ')}
                          </p>
                          {report.description && (
                            <p
                              className="text-xs text-gray-500 mt-1"
                              style={{ fontFamily: 'Sofia Sans' }}
                            >
                              {report.description}
                            </p>
                          )}
                          {report.reportedBy && (
                            <p
                              className="text-xs text-gray-400 mt-1"
                              style={{ fontFamily: 'Sofia Sans' }}
                            >
                              Reported by {report.reportedBy?.name || 'Unknown'}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Flag
                          size={32}
                          className="mx-auto text-gray-300 mb-2"
                        />
                        <p
                          className="text-gray-500"
                          style={{ fontFamily: 'Sofia Sans' }}
                        >
                          No reports
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              if (onViewFullProfile) {
                onViewFullProfile(user._id);
              } else {
                navigate(`/users/${user._id}`);
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors shadow-sm"
            style={{ fontFamily: 'Sofia Sans' }}
          >
            <ExternalLink size={16} />
            View Full Profile
          </button>
          <button
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            style={{ fontFamily: 'Sofia Sans' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserDetailModal;