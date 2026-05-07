import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Message } from '../types';
import { X, Activity, MessageSquare, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface UsageStatsProps {
  messages: Message[];
  onClose: () => void;
}

export function UsageStats({ messages, onClose }: UsageStatsProps) {
  // Compute some interesting stats from the messages array
  const stats = useMemo(() => {
    const userMessages = messages.filter((m) => m.role === 'user').length;
    const assistantMessages = messages.filter((m) => m.role === 'assistant').length;
    const actionsTaken = messages.filter((m) => m.role === 'assistant' && (m.content.includes("I'll ") || m.content.includes("Sending") || m.content.includes("Call"))).length;

    // Group messages by day
    const messagesByDay: Record<string, { date: string; user: number; assistant: number }> = {};
    
    // Default to last 7 days including today (to fake data if none or few exist)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      messagesByDay[dateStr] = { date: dateStr, user: 0, assistant: 0 };
    }

    messages.forEach((m) => {
      const dateStr = new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!messagesByDay[dateStr]) {
        messagesByDay[dateStr] = { date: dateStr, user: 0, assistant: 0 };
      }
      if (m.role === 'user') messagesByDay[dateStr].user++;
      else messagesByDay[dateStr].assistant++;
    });

    const chartData = Object.values(messagesByDay);

    return {
      userMessages,
      assistantMessages,
      actionsTaken,
      chartData,
    };
  }, [messages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-slate-900 border-l border-slate-700 z-50 flex flex-col w-full font-sans text-slate-100"
    >
      <header className="flex justify-between items-center p-4 border-b border-slate-700/50 bg-[#0F172A]/80 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Activity className="text-emerald-400" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">Usage Statistics</h2>
            <p className="text-xs text-slate-400">Activity and performance metrics</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-700/50"
        >
          <X size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-400">
              <MessageSquare size={16} />
              <span className="text-sm font-medium">Total Input</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.userMessages}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Activity size={16} />
              <span className="text-sm font-medium">Responses</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.assistantMessages}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Zap size={16} />
              <span className="text-sm font-medium">Actions</span>
            </div>
            <div className="text-3xl font-bold text-purple-400">{stats.actionsTaken}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Activity size={16} />
              <span className="text-sm font-medium">Active Days</span>
            </div>
            <div className="text-3xl font-bold text-amber-400">{stats.chartData.filter(d => d.user > 0 || d.assistant > 0).length || 1}</div>
          </div>
        </div>

        {/* Charts Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Line Chart */}
          <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-3xl flex flex-col gap-4">
            <h3 className="text-lg font-medium text-slate-200">Message Volume</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" name="User" dataKey="user" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="Assistant" dataKey="assistant" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-3xl flex flex-col gap-4">
            <h3 className="text-lg font-medium text-slate-200">Interaction Breakdown</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem' }}
                    cursor={{ fill: '#334155', opacity: 0.4 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar name="User Queries" dataKey="user" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar name="AI Responses" dataKey="assistant" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
