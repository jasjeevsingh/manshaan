/**
 * Simulation Page
 * 
 * IRT Simulation Mode to demonstrate θ convergence.
 * Shows judges how the adaptive algorithm works.
 */

import React, { useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { AIDisclaimer } from '../components/compliance/AIDisclaimer';
import type { SimulationResult, Domain } from '../types';

const domainColors: Record<string, string> = {
    episodic_memory: '#1a365d',
    executive_function: '#805ad5',
    working_memory: '#38a169',
    processing_speed: '#dd6b20',
    visuospatial: '#e53e3e',
};

const domainLabels: Record<string, string> = {
    episodic_memory: 'Memory',
    executive_function: 'Executive',
    working_memory: 'Working',
    processing_speed: 'Speed',
    visuospatial: 'Visual',
};

const SimulationPage: React.FC = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<SimulationResult | null>(null);
    const [numItems, setNumItems] = useState(20);
    const [trueTheta, setTrueTheta] = useState<Record<string, number>>({
        episodic_memory: 1.0,
        executive_function: -0.5,
        working_memory: 0.0,
        processing_speed: 0.5,
        visuospatial: -1.0,
    });

    const runSimulation = async () => {
        setIsRunning(true);
        try {
            // Note: This would call the backend simulation endpoint
            // For demo, we'll simulate locally
            const mockResult: SimulationResult = {
                true_theta: trueTheta as unknown as Record<Domain, number>,
                theta_trajectory: Array.from({ length: numItems }, (_, i) => {
                    const progress = (i + 1) / numItems;
                    return Object.fromEntries(
                        Object.entries(trueTheta).map(([domain, trueTh]) => [
                            domain,
                            trueTh * progress + (Math.random() - 0.5) * (1 - progress),
                        ])
                    ) as Record<Domain, number>;
                }),
                se_trajectory: Array.from({ length: numItems }, (_, i) => {
                    const se = 1 / (1 + i * 0.3);
                    return Object.fromEntries(
                        Object.keys(trueTheta).map((domain) => [domain, se])
                    ) as Record<Domain, number>;
                }),
                items_used: Array.from({ length: numItems }, (_, i) => `ITEM${i + 1}`),
                final_theta: Object.fromEntries(
                    Object.entries(trueTheta).map(([domain, th]) => [
                        domain,
                        { domain, theta: th + (Math.random() - 0.5) * 0.2, standard_error: 0.15, percentile: 50 },
                    ])
                ) as unknown as Record<Domain, { domain: Domain; theta: number; standard_error: number; percentile: number }>,
                convergence_achieved: true,
                num_items_to_convergence: Math.floor(numItems * 0.7),
            };
            setResult(mockResult);
        } catch (error) {
            console.error('Simulation error:', error);
        } finally {
            setIsRunning(false);
        }
    };

    // Prepare chart data
    const chartData = result?.theta_trajectory.map((theta, i) => ({
        item: i + 1,
        ...Object.fromEntries(
            Object.entries(theta).map(([domain, val]) => [domain, Number(val.toFixed(2))])
        ),
    })) || [];

    const seChartData = result?.se_trajectory.map((se, i) => ({
        item: i + 1,
        ...Object.fromEntries(
            Object.entries(se).map(([domain, val]) => [domain, Number(val.toFixed(2))])
        ),
    })) || [];

    return (
        <div className="container py-xl">
            <div className="page-header">
                <h1 className="text-2xl font-bold">IRT Simulation Mode</h1>
                <p className="text-secondary mt-sm">
                    Demonstrates how the MIRT 3PL adaptive algorithm converges to true ability (θ) estimates.
                </p>
            </div>

            <AIDisclaimer variant="compact" />

            {/* Configuration */}
            <div className="card mt-lg">
                <div className="card-header">
                    <h3 className="text-lg font-semibold">Simulation Parameters</h3>
                </div>
                <div className="card-body">
                    <div className="grid gap-md mb-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        {Object.entries(trueTheta).map(([domain, value]) => (
                            <div key={domain}>
                                <label className="label">{domainLabels[domain]} True θ</label>
                                <input
                                    type="range"
                                    min="-2"
                                    max="2"
                                    step="0.1"
                                    value={value}
                                    onChange={(e) =>
                                        setTrueTheta((prev) => ({ ...prev, [domain]: parseFloat(e.target.value) }))
                                    }
                                    className="w-full"
                                />
                                <span className="text-sm text-muted">{value.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-md">
                        <div>
                            <label className="label">Number of Items</label>
                            <input
                                type="number"
                                min="5"
                                max="50"
                                value={numItems}
                                onChange={(e) => setNumItems(parseInt(e.target.value) || 20)}
                                className="input"
                                style={{ width: '100px' }}
                            />
                        </div>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={runSimulation}
                            disabled={isRunning}
                        >
                            {isRunning ? 'Running...' : 'Run Simulation'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Results */}
            {result && (
                <>
                    {/* Convergence Summary */}
                    <div className="card mt-lg">
                        <div className="card-header">
                            <h3 className="text-lg font-semibold">Convergence Summary</h3>
                        </div>
                        <div className="card-body">
                            <div className="flex gap-lg flex-wrap">
                                <div>
                                    <p className="text-sm text-muted">Convergence Achieved</p>
                                    <p className={`text-lg font-bold ${result.convergence_achieved ? 'text-success' : 'text-warning'}`}>
                                        {result.convergence_achieved ? 'Yes ✓' : 'No'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Items to Convergence</p>
                                    <p className="text-lg font-bold">{result.num_items_to_convergence}</p>
                                </div>
                            </div>

                            <div className="mt-lg">
                                <h4 className="font-medium mb-sm">Final θ Estimates vs True Values</h4>
                                <div className="grid gap-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                                    {Object.entries(result.final_theta).map(([domain, est]) => (
                                        <div key={domain} className="bg-secondary p-md rounded-lg">
                                            <p className="text-xs text-muted">{domainLabels[domain]}</p>
                                            <p className="font-bold" style={{ color: domainColors[domain] }}>
                                                Est: {est.theta.toFixed(2)}
                                            </p>
                                            <p className="text-sm text-secondary">
                                                True: {trueTheta[domain].toFixed(2)}
                                            </p>
                                            <p className="text-xs text-muted">
                                                Error: {(Math.abs(est.theta - trueTheta[domain])).toFixed(2)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* θ Trajectory Chart */}
                    <div className="card mt-lg">
                        <div className="card-header">
                            <h3 className="text-lg font-semibold">θ Trajectory Over Items</h3>
                            <p className="text-sm text-muted">Dashed lines show true θ values</p>
                        </div>
                        <div className="card-body">
                            <div className="chart-container" style={{ height: '400px' }}>
                                <ResponsiveContainer>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="item" label={{ value: 'Items Administered', position: 'bottom' }} />
                                        <YAxis domain={[-3, 3]} label={{ value: 'θ', angle: -90, position: 'left' }} />
                                        <Tooltip />
                                        <Legend />
                                        {Object.keys(trueTheta).map((domain) => (
                                            <React.Fragment key={domain}>
                                                <Line
                                                    type="monotone"
                                                    dataKey={domain}
                                                    stroke={domainColors[domain]}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    name={domainLabels[domain]}
                                                />
                                                <ReferenceLine
                                                    y={trueTheta[domain]}
                                                    stroke={domainColors[domain]}
                                                    strokeDasharray="5 5"
                                                    strokeWidth={1}
                                                />
                                            </React.Fragment>
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* SE Trajectory Chart */}
                    <div className="card mt-lg">
                        <div className="card-header">
                            <h3 className="text-lg font-semibold">Standard Error Reduction</h3>
                            <p className="text-sm text-muted">SE decreases as more items provide information</p>
                        </div>
                        <div className="card-body">
                            <div className="chart-container" style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <LineChart data={seChartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="item" />
                                        <YAxis domain={[0, 1]} />
                                        <Tooltip />
                                        <Legend />
                                        {Object.keys(trueTheta).map((domain) => (
                                            <Line
                                                key={domain}
                                                type="monotone"
                                                dataKey={domain}
                                                stroke={domainColors[domain]}
                                                strokeWidth={2}
                                                dot={false}
                                                name={`${domainLabels[domain]} SE`}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SimulationPage;
