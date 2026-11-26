"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/lib/i18n";

interface RevenuePoint {
  month: string;
  billed: number;
  collected: number;
}

interface BuildingOccupancyPoint {
  name: string;
  occupied: number;
  free: number;
}

export function DashboardCharts({
  monthlyRevenueData,
  buildingOccupancyData,
}: {
  monthlyRevenueData: RevenuePoint[];
  buildingOccupancyData: BuildingOccupancyPoint[];
}) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          {t.dashboard.revenueChartTitle}
        </h3>
        <div className="h-64 w-full">
          {monthlyRevenueData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              {t.common.noData}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="billed"
                  name={t.dashboard.billedAmount}
                  fill="#1e2e9e"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="collected"
                  name={t.dashboard.collectedAmount}
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          {t.dashboard.buildingOccupancyTitle}
        </h3>
        <div className="h-64 w-full">
          {buildingOccupancyData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              {t.common.noData}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buildingOccupancyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="occupied"
                  name={t.dashboard.occupiedBeds}
                  stackId="a"
                  fill="#2546eb"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="free"
                  name={t.dashboard.freeBeds}
                  stackId="a"
                  fill="#cbd5e1"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
