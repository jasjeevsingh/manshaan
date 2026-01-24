/**
 * Home Page
 * 
 * Landing page for Manshaan platform.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { AIDisclaimer } from '../components/compliance/AIDisclaimer';

const HomePage: React.FC = () => {
    return (
        <div className="container py-2xl">
            {/* Hero Section */}
            <section className="text-center mb-2xl">
                <h1 className="text-4xl font-bold mb-md" style={{ color: 'var(--color-primary)' }}>
                    Neurodevelopmental Assessment
                    <br />
                    <span style={{ color: 'var(--color-accent)' }}>Powered by AI</span>
                </h1>
                <p className="text-lg text-secondary max-w-2xl mx-auto mb-lg">
                    Manshaan is a multimodal, research-backed diagnostic platform for
                    Autism Spectrum Disorder (ASD) and Intellectual Disability (ID) screening.
                    Adaptive testing with empathic voice AI and vision analysis.
                </p>

                <div className="flex gap-md justify-center mb-xl">
                    <Link to="/assessment" className="btn btn-primary btn-lg">
                        Start Assessment
                    </Link>
                    <Link to="/simulation" className="btn btn-secondary btn-lg">
                        View IRT Demo
                    </Link>
                </div>

                <AIDisclaimer />
            </section>

            {/* Features Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-2xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                <div className="card p-lg">
                    <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-md" style={{ background: 'linear-gradient(135deg, #1a365d 0%, #2c5282 100%)' }}>
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

                <div className="card p-lg">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-md" style={{ background: 'linear-gradient(135deg, #805ad5 0%, #9f7aea 100%)' }}>
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

                <div className="card p-lg">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-md" style={{ background: 'linear-gradient(135deg, #38a169 0%, #48bb78 100%)' }}>
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
            </section>

            {/* Cognitive Domains */}
            <section className="mb-2xl">
                <h2 className="text-2xl font-semibold text-center mb-lg">5 Cognitive Domains</h2>
                <div className="flex flex-wrap justify-center gap-md">
                    {[
                        { name: 'Episodic/Semantic Memory', icon: '🧠' },
                        { name: 'Executive Function', icon: '⚡' },
                        { name: 'Working Memory', icon: '💭' },
                        { name: 'Processing Speed', icon: '⏱️' },
                        { name: 'Visuospatial Skills', icon: '👁️' },
                    ].map((domain) => (
                        <div key={domain.name} className="bg-card px-lg py-md rounded-full shadow-sm border flex items-center gap-sm" style={{ whiteSpace: 'nowrap' }}>
                            <span className="text-xl">{domain.icon}</span>
                            <span className="text-sm font-medium">{domain.name}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* How It Works */}
            <section>
                <h2 className="text-2xl font-semibold text-center mb-lg">How It Works</h2>
                <div className="flex flex-col md:flex-row gap-lg justify-center" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {[
                        { step: 1, title: 'Start Assessment', desc: 'Parent or clinician initiates a new assessment session' },
                        { step: 2, title: 'Adaptive Testing', desc: 'AI selects optimal questions based on real-time ability estimates' },
                        { step: 3, title: 'Multimodal Tasks', desc: 'Voice, drawing, and timed response tasks enrich clinical data' },
                        { step: 4, title: 'Clinical Report', desc: 'Receive a Clinical Insight Report with ASD/ID differential analysis' },
                    ].map((item) => (
                        <div key={item.step} className="card p-lg text-center" style={{ flex: '1 1 220px', maxWidth: '280px' }}>
                            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-md font-bold">
                                {item.step}
                            </div>
                            <h4 className="font-semibold mb-sm">{item.title}</h4>
                            <p className="text-sm text-secondary">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default HomePage;
