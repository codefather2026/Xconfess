'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi, Analytics } from '@/app/lib/api/admin';
import { queryKeys } from '@/app/lib/api/queryKeys';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AdminAnalyticsPage() {
  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: queryKeys.admin.analytics.all(),
    queryFn: () => adminApi.getAnalytics(),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Failed to load analytics</div>
      </div>
    );
  }

  const { overview, reports, trends } = analytics;
  const reportsByTypeData = reports.byType.map((item) => ({
    name: item.type,
    value: parseInt(item.count, 10),
  }));
  const confessionsOverTimeData = trends.confessionsOverTime.map((item) => ({
    date: new Date(item.date).toLocaleDateString(),
    count: parseInt(item.count, 10),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Platform metrics, trends, and distribution breakdowns
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{overview.totalUsers.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Confessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{overview.totalConfessions.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Reactions Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{overview.reactionsToday.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Sessions (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{overview.activeSessions.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Confessions Over Time */}
        <Card className="flex flex-col min-h-[380px]">
          <CardHeader>
            <CardTitle>Confessions Posted Per Day</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            {confessionsOverTimeData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-sm text-gray-500">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={confessionsOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" name="Confessions" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Reactions by Type */}
        <Card className="flex flex-col min-h-[380px]">
          <CardHeader>
            <CardTitle>Reports by Type</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            {reportsByTypeData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-sm text-gray-500">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportsByTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Report Reasons Distribution */}
        <Card className="flex flex-col min-h-[380px]">
          <CardHeader>
            <CardTitle>Report Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            {reports.byStatus.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-sm text-gray-500">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reports.byStatus.map((item) => ({ name: item.status, value: parseInt(item.count, 10) }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {reports.byStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Moderation Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Moderation Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Banned Users</span>
              <span className="font-semibold text-gray-900 dark:text-white">{overview.bannedUsers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Hidden Confessions</span>
              <span className="font-semibold text-gray-900 dark:text-white">{overview.hiddenConfessions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Deleted Confessions</span>
              <span className="font-semibold text-gray-900 dark:text-white">{overview.deletedConfessions}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top reacted confessions */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Most Reacted Confessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Confession</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reactions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {analytics.topReactedConfessions.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-md truncate">
                      {item.message}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                      {item.reactionCount}
                    </td>
                  </tr>
                ))}
                {analytics.topReactedConfessions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">No confessions yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
