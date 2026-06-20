"use client";

import { useState, useCallback } from "react";
import { Search, Shield, ShieldOff, Trash2, Database, UserX, MoreVertical } from "lucide-react";
import Avatar from "@/components/Avatar";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  onboardingCompleted: boolean;
  createdAt: string | Date;
  subscription: { status: string; trialEnd: string | Date | null; currentPeriodEnd: string | Date | null } | null;
  _count: { contentPlans: number; newsletters: number };
}

export default function AdminUsersClient({
  initialUsers,
  initialTotal,
}: {
  initialUsers: UserRow[];
  initialTotal: number;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const fetchUsers = useCallback(async (searchTerm: string, pageNum: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(searchTerm)}&page=${pageNum}&limit=20`);
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    // Debounce
    const timeout = setTimeout(() => fetchUsers(value, 1), 300);
    return () => clearTimeout(timeout);
  }

  async function handleAction(userId: string, action: string) {
    setActiveMenu(null);
    const confirmed = window.confirm(
      action === "delete-full"
        ? "Permanently delete this user and ALL their data? This cannot be undone."
        : action === "delete-data"
        ? "Delete all content (posts, plans, newsletters) for this user? The account will remain."
        : `Are you sure you want to ${action} this user?`
    );
    if (!confirmed) return;

    try {
      if (action === "make-admin" || action === "remove-admin") {
        await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: action === "make-admin" ? "admin" : "user" }),
        });
      } else if (action === "delete-data") {
        await fetch(`/api/admin/users/${userId}?mode=data`, { method: "DELETE" });
      } else if (action === "delete-full") {
        await fetch(`/api/admin/users/${userId}?mode=full`, { method: "DELETE" });
      }
      fetchUsers(search, page);
    } catch (err) {
      console.error("Action failed:", err);
    }
  }

  const totalPages = Math.ceil(total / 20);

  const statusBadge = (status: string | undefined) => {
    if (!status) return <span className="text-xs text-gray-400">None</span>;
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
      trialing: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
      past_due: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
      canceled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    };
    return (
      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", colors[status] ?? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400")}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Users</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{total} total users</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 w-72 bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Subscription</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Plans</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Joined</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-gray-50 dark:divide-gray-800", loading && "opacity-50")}>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={user.image} name={user.name} size={32} fallbackClassName="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{user.name ?? "Unnamed"}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.role === "admin" ? (
                      <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">admin</span>
                    ) : (
                      <span className="text-xs text-gray-400">user</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{statusBadge(user.subscription?.status)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user._count.contentPlans}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                    {activeMenu === user.id && (
                      <div className="absolute right-4 top-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 py-1 w-52">
                        {user.role === "admin" ? (
                          <button
                            onClick={() => handleAction(user.id, "remove-admin")}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
                          >
                            <ShieldOff className="w-4 h-4" /> Remove Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(user.id, "make-admin")}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
                          >
                            <Shield className="w-4 h-4" /> Make Admin
                          </button>
                        )}
                        <button
                          onClick={() => handleAction(user.id, "delete-data")}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-amber-600"
                        >
                          <Database className="w-4 h-4" /> Delete Data (Keep Account)
                        </button>
                        <button
                          onClick={() => handleAction(user.id, "delete-full")}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600"
                        >
                          <UserX className="w-4 h-4" /> Delete User (Full)
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages} ({total} users)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setPage(page - 1); fetchUsers(search, page - 1); }}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
              >
                Previous
              </button>
              <button
                onClick={() => { setPage(page + 1); fetchUsers(search, page + 1); }}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
