"use client";

import { Users, CreditCard, FileText, Mail, TrendingUp, Clock } from "lucide-react";
import Avatar from "@/components/Avatar";

interface Stats {
  totalUsers: number;
  newUsersThisWeek: number;
  activeSubs: number;
  trialingSubs: number;
  canceledSubs: number;
  totalPosts: number;
  postsByStatus: Record<string, number>;
  newPostsThisWeek: number;
  totalNewsletters: number;
  totalPlans: number;
}

interface RecentSignup {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  createdAt: string | Date;
}

export default function AdminOverviewClient({
  stats,
  recentSignups,
}: {
  stats: Stats;
  recentSignups: RecentSignup[];
}) {
  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Subs", value: stats.activeSubs, icon: CreditCard, color: "text-green-600", bg: "bg-green-50" },
    { label: "Trials", value: stats.trialingSubs, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Total Posts", value: stats.totalPosts, icon: FileText, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Newsletters", value: stats.totalNewsletters, icon: Mail, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Content Plans", value: stats.totalPlans, icon: TrendingUp, color: "text-cyan-600", bg: "bg-cyan-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Overview</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Platform-wide analytics and recent activity</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <div className={`w-9 h-9 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Growth Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">This Week</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">New users</span>
              <span className="text-sm font-semibold text-green-600">+{stats.newUsersThisWeek}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">New posts</span>
              <span className="text-sm font-semibold text-green-600">+{stats.newPostsThisWeek}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Canceled subs</span>
              <span className="text-sm font-semibold text-red-600">{stats.canceledSubs}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Post Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(stats.postsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-indigo-500 rounded-full h-2"
                      style={{ width: `${stats.totalPosts ? (count / stats.totalPosts) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Signups */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Signups</h3>
        <div className="space-y-3">
          {recentSignups.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <Avatar src={user.image} name={user.name} size={32} fallbackClassName="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name ?? "Unnamed"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
              {user.role === "admin" && (
                <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">admin</span>
              )}
              <span className="text-xs text-gray-400">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
