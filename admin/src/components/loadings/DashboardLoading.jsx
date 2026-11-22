import React from "react";

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6">
      {/* Header and Filter Loading */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="skeleton h-10 w-48 rounded-lg"></div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="skeleton h-12 w-full md:w-40 rounded-lg"></div>
          <div className="skeleton h-12 w-full rounded-lg"></div>
        </div>
      </div>

      {/* Summary Cards Loading */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="card bg-base-200 shadow-md rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="skeleton w-10 h-10 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="skeleton h-4 w-24"></div>
                  <div className="skeleton h-6 w-16"></div>
                </div>
              </div>
              <div className="skeleton h-5 w-12 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
        <div className="card bg-base-200 shadow-md p-4 rounded-xl">
          <div className="skeleton h-6 w-48 mb-4"></div>
          <div className="skeleton h-64 md:h-80 rounded-lg"></div>
        </div>
        <div className="card bg-base-200 shadow-md p-4 rounded-xl">
          <div className="skeleton h-6 w-48 mb-4"></div>
          <div className="skeleton h-64 md:h-80 rounded-lg"></div>
        </div>
      </div>

      {/* Recent Sales Loading */}
      <div className="card bg-base-200 shadow-md p-4 rounded-xl">
        <div className="skeleton h-6 w-48 mb-4"></div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                {[...Array(7)].map((_, i) => (
                  <th key={i}><div className="skeleton h-4 w-full"></div></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j}><div className="skeleton h-4 w-full"></div></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}