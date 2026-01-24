/**
 * Emotion Timeline Chart Component
 * 
 * Line chart showing anxiety/calm/distress over assessment duration.
 */

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine,
} from 'recharts';
import type { EmotionTimeline as EmotionTimelineType } from '../../types';

interface EmotionTimelineProps {
    data: EmotionTimelineType;
}

export const EmotionTimeline: React.FC<EmotionTimelineProps> = ({ data }) => {
    const chartData = data.timeline.map((point, index) => ({
        index,
        time: new Date(point.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        }),
        anxiety: Math.round(point.anxiety * 100),
        calm: Math.round(point.calm * 100),
        distress: Math.round(point.distress * 100),
        itemId: point.item_id,
    }));

    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
        if (!active || !payload || payload.length === 0) return null;

        return (
            <div className="bg-card p-md rounded-lg shadow-lg border">
                <p className="font-semibold text-sm">{label}</p>
                {(payload as Array<{ name: string; value: number; color: string }>).map((entry) => (
                    <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
                        {entry.name}: {entry.value}%
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="card">
            <div className="card-header">
                <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold">Emotional Resilience Timeline</h4>
                    {data.emotional_resilience_score !== undefined && (
                        <div className="score-badge excellent">
                            Resilience: {data.emotional_resilience_score.toFixed(0)}
                        </div>
                    )}
                </div>
            </div>

            <div className="card-body">
                {/* Summary stats */}
                <div className="flex gap-lg mb-md flex-wrap">
                    <div className="flex items-center gap-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#c53030' }} />
                        <span className="text-sm">Avg Anxiety: {(data.avg_anxiety * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#38a169' }} />
                        <span className="text-sm">Avg Calm: {(data.avg_calm * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#dd6b20' }} />
                        <span className="text-sm">Avg Distress: {(data.avg_distress * 100).toFixed(0)}%</span>
                    </div>
                </div>

                {/* Chart */}
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                                dataKey="time"
                                tick={{ fontSize: 10, fill: '#718096' }}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                tick={{ fontSize: 10, fill: '#718096' }}
                                tickLine={false}
                                tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ fontSize: 12 }}
                                iconType="circle"
                            />
                            <ReferenceLine y={50} stroke="#a0aec0" strokeDasharray="3 3" />
                            <Line
                                type="monotone"
                                dataKey="anxiety"
                                stroke="#c53030"
                                strokeWidth={2}
                                dot={false}
                                name="Anxiety"
                            />
                            <Line
                                type="monotone"
                                dataKey="calm"
                                stroke="#38a169"
                                strokeWidth={2}
                                dot={false}
                                name="Calm"
                            />
                            <Line
                                type="monotone"
                                dataKey="distress"
                                stroke="#dd6b20"
                                strokeWidth={2}
                                dot={false}
                                name="Distress"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Peak anxiety indicator */}
                {data.peak_anxiety_item && (
                    <p className="text-xs text-muted mt-sm">
                        Peak anxiety observed during item: <code>{data.peak_anxiety_item}</code>
                    </p>
                )}
            </div>
        </div>
    );
};

export default EmotionTimeline;
