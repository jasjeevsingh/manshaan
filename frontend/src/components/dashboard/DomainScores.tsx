/**
 * Domain Scores Chart Component
 * 
 * Radar/bar chart visualization of θ scores across 5 cognitive domains.
 */

import React from 'react';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ErrorBar,
} from 'recharts';
import type { DomainScore, Domain } from '../../types';

interface DomainScoresProps {
    scores: DomainScore[];
    variant?: 'radar' | 'bar';
}

const domainLabels: Record<Domain, string> = {
    episodic_memory: 'Memory',
    executive_function: 'Executive',
    working_memory: 'Working Mem',
    processing_speed: 'Speed',
    visuospatial: 'Visuospatial',
};

const classificationColors: Record<string, string> = {
    'Significantly Below Average': '#c53030',
    'Below Average': '#dd6b20',
    'Average': '#38a169',
    'Above Average': '#2b6cb0',
    'Significantly Above Average': '#553c9a',
};

export const DomainScores: React.FC<DomainScoresProps> = ({
    scores,
    variant = 'radar',
}) => {
    const chartData = scores.map((score) => ({
        domain: domainLabels[score.domain] || score.domain,
        theta: score.theta,
        // Normalize for radar (0-100 scale)
        normalized: ((score.theta + 3) / 6) * 100,
        percentile: score.percentile,
        se: score.standard_error,
        classification: score.classification,
        fullDomain: score.domain,
    }));

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: unknown[] }) => {
        if (!active || !payload || payload.length === 0) return null;

        const data = (payload[0] as { payload: typeof chartData[0] }).payload;
        return (
            <div className="bg-card p-md rounded-lg shadow-lg border">
                <p className="font-semibold">{data.domain}</p>
                <p className="text-sm">θ = {data.theta.toFixed(2)}</p>
                <p className="text-sm">Percentile: {data.percentile.toFixed(0)}%</p>
                <p className="text-sm">SE: ±{data.se.toFixed(2)}</p>
                <p
                    className="text-xs mt-sm font-medium"
                    style={{ color: classificationColors[data.classification] }}
                >
                    {data.classification}
                </p>
            </div>
        );
    };

    if (variant === 'bar') {
        return (
            <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            dataKey="domain"
                            tick={{ fontSize: 12, fill: '#4a5568' }}
                            tickLine={false}
                        />
                        <YAxis
                            domain={[-3, 3]}
                            tick={{ fontSize: 12, fill: '#4a5568' }}
                            tickLine={false}
                            label={{
                                value: 'θ (Ability)',
                                angle: -90,
                                position: 'insideLeft',
                                style: { fontSize: 12, fill: '#4a5568' },
                            }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                            dataKey="theta"
                            fill="#1a365d"
                            radius={[4, 4, 0, 0]}
                        >
                            <ErrorBar dataKey="se" width={4} strokeWidth={1.5} stroke="#718096" />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis
                        dataKey="domain"
                        tick={{ fontSize: 11, fill: '#4a5568' }}
                    />
                    <PolarRadiusAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: '#718096' }}
                        tickCount={5}
                    />
                    <Radar
                        name="Score"
                        dataKey="normalized"
                        stroke="#1a365d"
                        fill="#1a365d"
                        fillOpacity={0.4}
                        strokeWidth={2}
                    />
                    <Tooltip content={<CustomTooltip />} />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default DomainScores;
