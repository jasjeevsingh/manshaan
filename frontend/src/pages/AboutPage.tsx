/**
 * About Page
 *
 * Detailed information about Manshaan platform features and methodology.
 */

import React from 'react';
import { Link } from 'react-router-dom';

const AboutPage: React.FC = () => {
    return (
        <div className="container py-2xl">
            {/* Page Header */}
            <section className="text-center mb-2xl" style={{ marginTop: '6rem' }}>
                <h1 className="text-3xl font-bold mb-md">About Manshaan</h1>
                <p className="text-lg text-secondary max-w-2xl mx-auto">
                    Learn how our AI-powered platform provides comprehensive neurodevelopmental assessments.
                </p>
            </section>

            {/* Features Grid */}
            <section className="mb-2xl">
                <h2 className="text-2xl font-semibold text-center mb-lg">Our Technology</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                    <div className="card p-lg transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
                        <div className="w-12 h-12 rounded-lg bg-domain-memory flex items-center justify-center mb-md transition-transform duration-300 hover:scale-110">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold mb-sm">MIRT Adaptive Testing</h3>
                        <p className="text-secondary text-sm">
                            3-parameter IRT model with Expected A Posteriori estimation across
                            5 cognitive domains. Maximum Fisher Information item selection.
                        </p>
                    </div>

                    <div className="card p-lg transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
                        <div className="w-12 h-12 rounded-lg bg-domain-executive flex items-center justify-center mb-md transition-transform duration-300 hover:scale-110">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold mb-sm">Empathic Voice AI</h3>
                        <p className="text-secondary text-sm">
                            Hume AI integration captures paralinguistic markers (anxiety, calm, distress)
                            for emotional resilience analysis during voice-based tasks.
                        </p>
                    </div>

                    <div className="card p-lg transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
                        <div className="w-12 h-12 rounded-lg bg-domain-working flex items-center justify-center mb-md transition-transform duration-300 hover:scale-110">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                                <path d="M9 12L11 14L15 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold mb-sm">Vision Analysis</h3>
                        <p className="text-secondary text-sm">
                            GPT-4o Vision evaluates drawing tasks against Beery-Buktenica VMI
                            clinical benchmarks with age-equivalent scoring.
                        </p>
                    </div>
                </div>
            </section>

            {/* Cognitive Domains */}
            <section className="mb-2xl">
                <h2 className="text-2xl font-semibold text-center mb-lg">5 Cognitive Domains</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-md max-w-5xl mx-auto">
                    {[
                        { name: 'Episodic/Semantic Memory', icon: '🧠', className: 'bg-domain-memory' },
                        { name: 'Executive Function', icon: '⚡', className: 'bg-domain-executive' },
                        { name: 'Working Memory', icon: '💭', className: 'bg-domain-working' },
                        { name: 'Processing Speed', icon: '⏱️', className: 'bg-domain-speed' },
                        { name: 'Visuospatial Skills', icon: '👁️', className: 'bg-domain-visuospatial' },
                    ].map((domain) => (
                        <div
                            key={domain.name}
                            className="bg-card p-lg rounded-xl shadow-sm border flex flex-col items-center text-center gap-sm transition-all duration-300 hover:scale-110 hover:shadow-xl cursor-pointer"
                        >
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-sm transition-transform duration-300 ${domain.className}`}>
                                <span className="text-2xl transition-transform duration-300 hover:scale-125">{domain.icon}</span>
                            </div>
                            <span className="text-sm font-medium">{domain.name}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* How It Works */}
            <section className="mb-2xl">
                <h2 className="text-2xl font-semibold text-center mb-lg">How It Works</h2>
                <div className="flex items-center justify-center gap-sm max-w-5xl mx-auto flex-wrap">
                    {[
                        { step: 1, title: 'Start Assessment', desc: 'Parent or clinician initiates a new assessment session' },
                        { step: 2, title: 'Adaptive Testing', desc: 'AI selects optimal questions based on real-time ability estimates' },
                        { step: 3, title: 'Multimodal Tasks', desc: 'Voice, drawing, and timed response tasks enrich clinical data' },
                        { step: 4, title: 'Clinical Report', desc: 'Receive a Clinical Insight Report with ASD/ID differential analysis' },
                    ].map((item, index) => (
                        <div key={item.step} className="flex items-center group">
                            <div className="card p-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer" style={{ width: '200px' }}>
                                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-md font-bold transition-all duration-300 group-hover:scale-150 group-hover:shadow-lg">
                                    {item.step}
                                </div>
                                <h4 className="font-semibold mb-sm text-sm">{item.title}</h4>
                                <p className="text-xs text-secondary">{item.desc}</p>
                            </div>
                            {index < 3 && (
                                <div className="hidden md:flex items-center px-sm transition-transform duration-300 group-hover:translate-x-1">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="text-center">
                <Link
                    to="/assessment"
                    className="btn btn-primary btn-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:opacity-100"
                    style={{ color: '#ffffff', opacity: 1 }}
                >
                    Start Assessment
                </Link>
            </section>
        </div>
    );
};

export default AboutPage;
