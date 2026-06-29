'use client';

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/app/lib/api/admin";
import { queryKeys } from "@/app/lib/api/queryKeys";
import { Button } from "@/app/components/ui/button";
import { useAdminConfirmation } from "@/app/components/admin/useAdminConfirmation";
import { useGlobalToast } from "@/app/components/common/Toast";
import { Checkbox } from "@/app/components/ui/checkbox";

interface ModerationItem {
  id: string;
  confessionId: string;
  confession?: {
    id: string;
    message: string;
    created_at: string;
  };
  type: string;
  status: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const { openConfirmation } = useAdminConfirmation();
  const toast = useGlobalToast();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "moderation", "list", statusFilter],
    queryFn: () => adminApi.getReports({
      status: statusFilter !== "all" ? statusFilter : undefined,
      limit: 50,
      offset: 0,
    }),
  });

  const items: ModerationItem[] = (data?.reports || []) as ModerationItem[];

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.resolveReport(id, "Approved by moderation"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      toast.success("Report approved");
    },
    onError: () => toast.error("Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminApi.dismissReport(id, "Rejected by moderation"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      toast.success("Report rejected");
    },
    onError: () => toast.error("Failed to reject"),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => adminApi.bulkResolveReports(ids, "Bulk approved by moderation"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      setSelectedIds(new Set());
      toast.success("Selected reports approved");
    },
    onError: () => toast.error("Failed to bulk approve"),
  });

  const bulkRejectMutation = useMutation({
    mutationFn: (ids: string[]) =>
      adminApi.bulkResolveReports(
        ids,
        "Bulk rejected by moderation",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      setSelectedIds(new Set());
      toast.success("Selected reports rejected");
    },
    onError: () => toast.error("Failed to bulk reject"),
  });

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkAction = (action: "approve" | "reject") => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const mutation = action === "approve" ? bulkApproveMutation : bulkRejectMutation;
    openConfirmation({
      title: `${action === "approve" ? "Approve" : "Reject"} selected reports?`,
      description: `This will mark ${ids.length} selected reports as ${action === "approve" ? "resolved" : "dismissed"}.`,
      confirmLabel: action === "approve" ? "Approve" : "Reject",
      variant: action === "approve" ? "default" : "destructive",
      action: () => mutation.mutateAsync(ids),
      successMessage: `Selected reports ${action === "approve" ? "approved" : "rejected"}.`,
      errorMessage: `Failed to ${action} selected reports.`,
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleApprove = (id: string) => {
    openConfirmation({
      title: "Approve this report?",
      description: "This will mark the report as resolved.",
      confirmLabel: "Approve",
      action: () => approveMutation.mutateAsync(id),
      successMessage: "Report approved.",
      errorMessage: "Failed to approve report.",
    });
  };

  const handleReject = (id: string) => {
    openConfirmation({
      title: "Reject this report?",
      description: "This will dismiss the report without taking action.",
      confirmLabel: "Reject",
      variant: "danger",
      action: () => rejectMutation.mutateAsync(id),
      successMessage: "Report rejected.",
      errorMessage: "Failed to reject report.",
    });
  };

  const statusClassMap: Record<string, string> = {
    pending: "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100",
    reviewing: "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100",
    resolved: "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
    dismissed: "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  };

  const humanizeStatus = (s: string) => {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">Loading moderation queue...</div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {confirmDialog}

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Moderation Queue</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review flagged confessions and take action
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setSelectedIds(new Set());
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewing">Reviewing</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>

        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleBulkAction("approve")}
              className="min-h-[44px] rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
            >
              Approve Selected ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              onClick={() => handleBulkAction("reject")}
              className="min-h-[44px] rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              Reject Selected ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-white">No reports in queue</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Check back later for new flagged content.</p>
        </div>
      ) : (
        <div className="min-w-0 max-w-full overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
          <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="min-w-[48rem] divide-y divide-gray-200 dark:divide-gray-700 md:min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <Checkbox
                      checked={selectedIds.size === items.length && items.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedIds(new Set(items.map((i) => i.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Preview</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky right-0 bg-gray-50 dark:bg-gray-700 after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-gray-300 dark:after:bg-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                      {item.confession?.message || "No preview"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={statusClassMap[item.status] || statusClassMap["dismissed"]}>
                        {humanizeStatus(item.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white dark:bg-gray-800 after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-gray-200 dark:after:bg-gray-700">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprove(item.id)}
                          className="min-h-[44px] min-w-[44px] rounded-md px-3 text-green-600 hover:text-green-800"
                          aria-label={`Approve report ${item.id}`}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(item.id)}
                          className="min-h-[44px] min-w-[44px] rounded-md px-3 text-red-600 hover:text-red-800"
                          aria-label={`Reject report ${item.id}`}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
