'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  UserRole,
  PropertyDto,
  CommunityPostDto,
  CommunityPostDetailDto,
  CommunityCommentDto,
  CommunityPostCategory,
  CommunitySummaryDto,
} from '@propertyos/types';
import {
  MessageSquare,
  Pin,
  PinOff,
  Megaphone,
  Wrench,
  PartyPopper,
  ScrollText,
  Search,
  Plus,
  Trash2,
  Edit2,
  Send,
  Building2,
  Clock,
  User,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  HelpCircle,
  X,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const CATEGORY_CONFIG: Record<
  CommunityPostCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }
> = {
  [CommunityPostCategory.ANNOUNCEMENT]: {
    label: 'Announcement',
    icon: Megaphone,
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
  },
  [CommunityPostCategory.MAINTENANCE]: {
    label: 'Maintenance',
    icon: Wrench,
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
  },
  [CommunityPostCategory.EVENT]: {
    label: 'Event',
    icon: PartyPopper,
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
  },
  [CommunityPostCategory.RULE]: {
    label: 'Rule & Policy',
    icon: ScrollText,
    color: 'text-rose-700 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
  },
  [CommunityPostCategory.LOST_AND_FOUND]: {
    label: 'Lost & Found',
    icon: Search,
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
  },
  [CommunityPostCategory.GENERAL]: {
    label: 'General Discussion',
    icon: MessageSquare,
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700',
  },
};

export default function CommunityPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [posts, setPosts] = useState<CommunityPostDto[]>([]);
  const [summary, setSummary] = useState<CommunitySummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Detail / Comments expansion state
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, CommunityCommentDto[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});

  // New Post Modal State
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState<boolean>(false);
  const [newPostTitle, setNewPostTitle] = useState<string>('');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [newPostCategory, setNewPostCategory] = useState<CommunityPostCategory>(CommunityPostCategory.GENERAL);
  const [newPostPropertyId, setNewPostPropertyId] = useState<string>('');
  const [newPostIsPinned, setNewPostIsPinned] = useState<boolean>(false);
  const [newPostImageUrl, setNewPostImageUrl] = useState<string>('');
  const [isSubmittingPost, setIsSubmittingPost] = useState<boolean>(false);

  const isModerator =
    user?.roles?.includes(UserRole.OWNER) ||
    user?.roles?.includes(UserRole.PROPERTY_MANAGER) ||
    user?.roles?.includes(UserRole.WARDEN);

  const isTenant =
    user?.roles?.includes(UserRole.TENANT) &&
    !user?.roles?.includes(UserRole.OWNER) &&
    !user?.roles?.includes(UserRole.PROPERTY_MANAGER) &&
    !user?.roles?.includes(UserRole.WARDEN);

  // Fetch properties on mount
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch(`${API_BASE}/properties`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const props = json.data || json;
          if (Array.isArray(props) && props.length > 0) {
            setProperties(props);
            setSelectedPropertyId(props[0].id);
            setNewPostPropertyId(props[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load properties', err);
      }
    };
    fetchProperties();
  }, []);

  // Fetch posts and summary
  const fetchPostsAndSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedPropertyId) params.append('propertyId', selectedPropertyId);
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '50');

      const [postsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/community/posts?${params.toString()}`, { credentials: 'include' }),
        selectedPropertyId
          ? fetch(`${API_BASE}/community/summary?propertyId=${selectedPropertyId}`, { credentials: 'include' })
          : Promise.resolve(null),
      ]);

      if (postsRes.ok) {
        const json = await postsRes.json();
        setPosts(json.data?.data || json.data || []);
      } else {
        const errJson = await postsRes.json().catch(() => ({}));
        setError(errJson.message || 'Failed to load community posts');
      }

      if (summaryRes && summaryRes.ok) {
        const sJson = await summaryRes.json();
        setSummary(sJson.data || sJson);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading community feed');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPropertyId, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchPostsAndSummary();
  }, [fetchPostsAndSummary]);

  // Fetch comments for expanded post
  const toggleExpandComments = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }

    setExpandedPostId(postId);
    if (!expandedComments[postId]) {
      setLoadingComments((prev) => ({ ...prev, [postId]: true }));
      try {
        const res = await fetch(`${API_BASE}/community/posts/${postId}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const detail: CommunityPostDetailDto = json.data || json;
          setExpandedComments((prev) => ({ ...prev, [postId]: detail.comments || [] }));
        }
      } catch (err) {
        console.error('Failed to load comments for post', postId, err);
      } finally {
        setLoadingComments((prev) => ({ ...prev, [postId]: false }));
      }
    }
  };

  // Submit comment
  const handleAddComment = async (postId: string) => {
    const text = newCommentText[postId]?.trim();
    if (!text) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`${API_BASE}/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: text }),
      });

      if (res.ok) {
        const json = await res.json();
        const createdComment: CommunityCommentDto = json.data || json;
        setExpandedComments((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), createdComment],
        }));
        setNewCommentText((prev) => ({ ...prev, [postId]: '' }));
        // Update post commentCount in list
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p))
        );
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to post comment');
      }
    } catch (err: any) {
      alert(err.message || 'Error posting comment');
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Delete comment
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      const res = await fetch(`${API_BASE}/community/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setExpandedComments((prev) => ({
          ...prev,
          [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
        }));
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount || 1) - 1) } : p))
        );
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to delete comment');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting comment');
    }
  };

  // Toggle Pin
  const handleTogglePin = async (postId: string, currentPinned: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/community/posts/${postId}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPinned: !currentPinned }),
      });

      if (res.ok) {
        setSuccessMessage(currentPinned ? 'Post unpinned successfully' : 'Post pinned to top banner');
        setTimeout(() => setSuccessMessage(null), 4000);
        fetchPostsAndSummary();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to update pin status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating pin status');
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post and all its comments?')) return;
    try {
      const res = await fetch(`${API_BASE}/community/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setSuccessMessage('Community post deleted');
        setTimeout(() => setSuccessMessage(null), 4000);
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        if (summary) {
          setSummary({ ...summary, activePosts: Math.max(0, summary.activePosts - 1) });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to delete post');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting post');
    }
  };

  // Create Post Submit
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    setIsSubmittingPost(true);
    try {
      const payload = {
        propertyId: newPostPropertyId || selectedPropertyId,
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        category: newPostCategory,
        isPinned: isModerator ? newPostIsPinned : false,
        images: newPostImageUrl.trim() ? [newPostImageUrl.trim()] : [],
      };

      const res = await fetch(`${API_BASE}/community/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMessage('Post published to community board');
        setTimeout(() => setSuccessMessage(null), 4000);
        setIsNewPostModalOpen(false);
        setNewPostTitle('');
        setNewPostContent('');
        setNewPostCategory(CommunityPostCategory.GENERAL);
        setNewPostIsPinned(false);
        setNewPostImageUrl('');
        fetchPostsAndSummary();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to create post');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating post');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const pinnedPosts = posts.filter((p) => p.isPinned);
  const regularPosts = posts.filter((p) => !p.isPinned);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.OWNER:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">Owner</span>;
      case UserRole.PROPERTY_MANAGER:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">Manager</span>;
      case UserRole.WARDEN:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Warden</span>;
      case UserRole.TENANT:
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Resident</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Staff</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-brand-navy via-slate-900 to-teal-950 text-brand-white p-6 md:p-8 rounded-2xl shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-teal flex items-center justify-center text-brand-white shadow-md">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-brand-white">Community & Notice Board</h1>
              <p className="text-xs md:text-sm text-teal-200/90 font-medium">
                Official property announcements, maintenance alerts, and resident discussions
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsNewPostModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-teal text-brand-white text-xs md:text-sm font-semibold hover:bg-teal-600 transition-all shadow-lg hover:shadow-teal-500/25 active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isModerator ? 'New Announcement / Post' : 'New Resident Post'}</span>
        </button>
      </div>

      {/* Alert Banners */}
      {successMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-brand-white dark:bg-slate-900 border border-surface-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-brand-teal flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-surface-textSecondary uppercase tracking-wider">Active Posts</p>
            <p className="text-2xl font-bold text-brand-navy dark:text-brand-white">{summary?.activePosts ?? posts.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-brand-white dark:bg-slate-900 border border-surface-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <Pin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-surface-textSecondary uppercase tracking-wider">Pinned Notices</p>
            <p className="text-2xl font-bold text-brand-navy dark:text-brand-white">{summary?.pinnedAnnouncements ?? pinnedPosts.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-brand-white dark:bg-slate-900 border border-surface-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-surface-textSecondary uppercase tracking-wider">Total Comments</p>
            <p className="text-2xl font-bold text-brand-navy dark:text-brand-white">{summary?.totalComments ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="p-4 rounded-xl bg-brand-white dark:bg-slate-900 border border-surface-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Property Selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Building2 className="w-4 h-4 text-brand-teal shrink-0" />
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full md:w-64 px-3 py-2 text-xs font-semibold rounded-lg bg-surface-subtle border border-surface-border text-brand-navy dark:text-brand-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.propertyType})
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-surface-textSecondary absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search posts or notices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-surface-subtle border border-surface-border text-brand-navy dark:text-brand-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              selectedCategory === 'ALL'
                ? 'bg-brand-navy text-brand-white'
                : 'bg-surface-subtle text-surface-textSecondary hover:text-brand-navy'
            }`}
          >
            All Categories
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([catKey, config]) => {
            const Icon = config.icon;
            const isSelected = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 border ${
                  isSelected
                    ? 'bg-brand-teal text-brand-white border-brand-teal'
                    : 'bg-brand-white dark:bg-slate-800 border-surface-border text-surface-textSecondary hover:text-brand-navy dark:hover:text-brand-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Feed Content */}
      {isLoading ? (
        <div className="p-12 flex flex-col items-center justify-center text-surface-textSecondary gap-3 bg-brand-white dark:bg-slate-900 rounded-xl border border-surface-border">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
          <p className="text-xs font-medium">Loading community feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center bg-brand-white dark:bg-slate-900 rounded-xl border border-surface-border space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-surface-textSecondary">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-brand-navy dark:text-brand-white">No community posts yet</h3>
          <p className="text-xs text-surface-textSecondary max-w-sm mx-auto">
            Be the first to start a conversation, share an announcement, or ask a question for this property.
          </p>
          <button
            onClick={() => setIsNewPostModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-brand-white text-xs font-semibold hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Post</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pinned Section */}
          {pinnedPosts.length > 0 && selectedCategory === 'ALL' && !searchQuery.trim() && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                <Pin className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Pinned Announcements ({pinnedPosts.length})</span>
              </div>
              {pinnedPosts.map((post) => renderPostCard(post, true))}
            </div>
          )}

          {/* Regular Posts Section */}
          <div className="space-y-4">
            {pinnedPosts.length > 0 && selectedCategory === 'ALL' && !searchQuery.trim() && (
              <div className="flex items-center gap-2 text-xs font-bold text-surface-textSecondary uppercase tracking-wider pt-2">
                <MessageSquare className="w-4 h-4" />
                <span>Recent Community Feed ({regularPosts.length})</span>
              </div>
            )}
            {(selectedCategory !== 'ALL' || searchQuery.trim() ? posts : regularPosts).map((post) =>
              renderPostCard(post, false)
            )}
          </div>
        </div>
      )}

      {/* New Post Modal */}
      {isNewPostModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-lg bg-brand-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-surface-border overflow-hidden">
            <div className="px-6 py-4 bg-surface-subtle border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-brand-teal" />
                <h3 className="text-sm font-bold text-brand-navy dark:text-brand-white">
                  {isModerator ? 'Publish Announcement or Post' : 'Create Resident Community Post'}
                </h3>
              </div>
              <button
                onClick={() => setIsNewPostModalOpen(false)}
                className="p-1 rounded-lg text-surface-textSecondary hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="p-6 space-y-4">
              {/* Property Select */}
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-slate-200 mb-1">
                  Property <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newPostPropertyId}
                  onChange={(e) => setNewPostPropertyId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-surface-subtle border border-surface-border text-brand-navy dark:text-brand-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.propertyType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Select */}
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-slate-200 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newPostCategory}
                  onChange={(e) => setNewPostCategory(e.target.value as CommunityPostCategory)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-surface-subtle border border-surface-border text-brand-navy dark:text-brand-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  {Object.entries(CATEGORY_CONFIG)
                    .filter(([catKey]) => (isTenant ? catKey !== CommunityPostCategory.ANNOUNCEMENT : true))
                    .map(([catKey, config]) => (
                      <option key={catKey} value={catKey}>
                        {config.label}
                      </option>
                    ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-slate-200 mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scheduled Power Outage on Sunday"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  minLength={3}
                  maxLength={255}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-surface-subtle border border-surface-border text-brand-navy dark:text-brand-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-slate-200 mb-1">
                  Message / Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Write complete notice or discussion details here..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  minLength={5}
                  maxLength={5000}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-surface-subtle border border-surface-border text-brand-navy dark:text-brand-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-slate-200 mb-1">
                  Image Attachment URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/banner.jpg"
                  value={newPostImageUrl}
                  onChange={(e) => setNewPostImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-surface-subtle border border-surface-border text-brand-navy dark:text-brand-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>

              {/* Pin Toggle (Moderator only) */}
              {isModerator && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPinnedCheck"
                    checked={newPostIsPinned}
                    onChange={(e) => setNewPostIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal border-surface-border"
                  />
                  <label htmlFor="isPinnedCheck" className="text-xs font-semibold text-brand-navy dark:text-slate-200 cursor-pointer">
                    Pin this post as high-priority notice
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsNewPostModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-surface-textSecondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPost}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-teal text-brand-white text-xs font-semibold hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmittingPost && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Publish Post</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Post Card Renderer
  function renderPostCard(post: CommunityPostDto, isHighlightedPinned = false) {
    const config = CATEGORY_CONFIG[post.category] || CATEGORY_CONFIG[CommunityPostCategory.GENERAL];
    const Icon = config.icon;
    const isExpanded = expandedPostId === post.id;
    const commentsList = expandedComments[post.id] || [];
    const isAuthor = user?.id === post.authorId;

    return (
      <div
        key={post.id}
        className={`rounded-2xl border transition-all shadow-sm overflow-hidden ${
          isHighlightedPinned
            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 shadow-md'
            : 'bg-brand-white dark:bg-slate-900 border-surface-border'
        }`}
      >
        <div className="p-5 md:p-6 space-y-3">
          {/* Card Top Meta */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-center font-bold text-brand-teal text-xs">
                {post.authorName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs md:text-sm font-bold text-brand-navy dark:text-brand-white">
                    {post.authorName}
                  </h4>
                  {getRoleBadge(post.authorRole)}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-surface-textSecondary">
                  <span>{new Date(post.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {post.propertyName && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-brand-teal">{post.propertyName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Badges & Actions */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${config.bgColor} ${config.color}`}
              >
                <Icon className="w-3 h-3" />
                <span>{config.label}</span>
              </span>

              {post.isPinned && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300">
                  <Pin className="w-3 h-3 fill-amber-500" />
                  <span>Pinned</span>
                </span>
              )}

              {/* Moderator Pin/Unpin Action */}
              {isModerator && (
                <button
                  onClick={() => handleTogglePin(post.id, post.isPinned)}
                  title={post.isPinned ? 'Unpin post' : 'Pin post'}
                  className="p-1.5 rounded-lg text-surface-textSecondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {post.isPinned ? <PinOff className="w-4 h-4 text-amber-600" /> : <Pin className="w-4 h-4 text-slate-400" />}
                </button>
              )}

              {/* Delete Action */}
              {(isAuthor || isModerator) && (
                <button
                  onClick={() => handleDeletePost(post.id)}
                  title="Delete post"
                  className="p-1.5 rounded-lg text-surface-textSecondary hover:bg-rose-50 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Title & Body */}
          <div className="space-y-1.5">
            <h3 className="text-sm md:text-base font-bold text-brand-navy dark:text-brand-white leading-snug">
              {post.title}
            </h3>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {post.content}
            </p>
          </div>

          {/* Attached Images */}
          {post.images && post.images.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-2">
              {post.images.map((img, idx) => (
                <a
                  key={idx}
                  href={img}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative h-32 w-48 rounded-xl overflow-hidden border border-surface-border group"
                >
                  <img src={img} alt="Attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </a>
              ))}
            </div>
          )}

          {/* Bottom Card Bar */}
          <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between text-xs">
            <button
              onClick={() => toggleExpandComments(post.id)}
              className="inline-flex items-center gap-1.5 font-semibold text-brand-teal hover:text-teal-700 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>
                {post.commentCount || 0} {post.commentCount === 1 ? 'Comment' : 'Comments'}
              </span>
            </button>
          </div>
        </div>

        {/* Expandable Comments Drawer */}
        {isExpanded && (
          <div className="bg-surface-subtle dark:bg-slate-950/50 border-t border-surface-border p-5 md:p-6 space-y-4">
            <h4 className="text-xs font-bold text-brand-navy dark:text-brand-white uppercase tracking-wider">
              Discussion Thread
            </h4>

            {loadingComments[post.id] ? (
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-surface-textSecondary">
                <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
                <span>Loading comments...</span>
              </div>
            ) : commentsList.length === 0 ? (
              <p className="text-xs text-surface-textSecondary italic">No comments yet. Join the conversation!</p>
            ) : (
              <div className="space-y-3">
                {commentsList.map((c) => {
                  const canDeleteComment = isModerator || user?.id === c.authorId;
                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-brand-white dark:bg-slate-900 border border-surface-border flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-surface-subtle border border-surface-border flex items-center justify-center font-bold text-brand-teal text-[10px] shrink-0 mt-0.5">
                          {c.authorName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-bold text-brand-navy dark:text-brand-white">{c.authorName}</span>
                            {getRoleBadge(c.authorRole)}
                            <span className="text-[10px] text-surface-textSecondary">
                              • {new Date(c.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300">{c.content}</p>
                        </div>
                      </div>

                      {canDeleteComment && (
                        <button
                          onClick={() => handleDeleteComment(post.id, c.id)}
                          title="Delete comment"
                          className="p-1 rounded text-surface-textSecondary hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Comment Input */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Write a comment..."
                value={newCommentText[post.id] || ''}
                onChange={(e) => setNewCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment(post.id);
                  }
                }}
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-brand-white dark:bg-slate-900 border border-surface-border text-brand-navy dark:text-brand-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal"
              />
              <button
                onClick={() => handleAddComment(post.id)}
                disabled={submittingComment[post.id] || !newCommentText[post.id]?.trim()}
                className="px-4 py-2 rounded-lg bg-brand-teal text-brand-white text-xs font-semibold hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-1 shrink-0"
              >
                {submittingComment[post.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Post</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}
