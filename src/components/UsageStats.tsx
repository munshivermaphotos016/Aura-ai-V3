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
      className="absolute inset-0 bg-transparent z-50 flex flex-col w-full font-sans text-white/95"
    >
      <header className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-white/5 backdrop-blur-2xl sticky top-0 mx-2 mt-2 rounded-[2rem] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#10b981] to-[#3b82f6] flex items-center justify-center shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
            <Activity className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-medium tracking-wide text-white/95 leading-tight">Usage Statistics</h2>
            <p className="text-[11px] text-white/50 font-medium uppercase tracking-[0.05em]">Activity and metrics</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-24 custom-scrollbar">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/5 backdrop-blur-xl p-5 rounded-[1.5rem] flex flex-col gap-2 hover:bg-white/10 transition-all shadow-sm">
            <div className="flex items-center gap-2 text-white/60">
              <MessageSquare size={16} />
              <span className="text-[13px] font-medium uppercase tracking-[0.05em]">Total Input</span>
            </div>
            <div className="text-[32px] font-semibold text-white/95 tracking-tight">{stats.userMessages}</div>
          </div>
          <div className="bg-white/5 border border-white/5 backdrop-blur-xl p-5 rounded-[1.5rem] flex flex-col gap-2 hover:bg-white/10 transition-all shadow-sm">
            <div className="flex items-center gap-2 text-white/60">
              <Activity size={16} />
              <span className="text-[13px] font-medium uppercase tracking-[0.05em]">Responses</span>
            </div>
            <div className="text-[32px] font-semibold text-white/95 tracking-tight">{stats.assistantMessages}</div>
          </div>
          <div className="bg-white/5 border border-white/5 backdrop-blur-xl p-5 rounded-[1.5rem] flex flex-col gap-2 hover:bg-white/10 transition-all shadow-sm">
            <div className="flex items-center gap-2 text-white/60">
              <Zap size={16} />
              <span className="text-[13px] font-medium uppercase tracking-[0.05em]">Actions</span>
            </div>
            <div className="text-[32px] font-semibold text-white/95 tracking-tight">{stats.actionsTaken}</div>
          </div>
          <div className="bg-white/5 border border-white/5 backdrop-blur-xl p-5 rounded-[1.5rem] flex flex-col gap-2 hover:bg-white/10 transition-all shadow-sm">
            <div className="flex items-center gap-2 text-white/60">
              <Activity size={16} />
              <span className="text-[13px] font-medium uppercase tracking-[0.05em]">Active Days</span>
            </div>
            <div className="text-[32px] font-semibold text-white/95 tracking-tight">{stats.chartData.filter(d => d.user > 0 || d.assistant > 0).length || 1}</div>
          </div>
        </div>

        {/* Charts Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Line Chart */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] flex flex-col gap-4 shadow-sm">
            <h3 className="text-[15px] font-medium text-white/90 tracking-wide mt-2">Message Volume</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '1rem', backdropFilter: 'blur(16px)' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line type="monotone" name="User" dataKey="user" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="Assistant" dataKey="assistant" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] flex flex-col gap-4 shadow-sm">
            <h3 className="text-[15px] font-medium text-white/90 tracking-wide mt-2">Interaction Breakdown</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '1rem', backdropFilter: 'blur(16px)' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar name="User Queries" dataKey="user" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar name="AI Responses" dataKey="assistant" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
