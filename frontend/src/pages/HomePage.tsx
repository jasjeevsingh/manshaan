/**
 * Home Page
 *
 * Simple, clean landing page for Manshaan platform.
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import backgroundImage from '../logo/ElevenLabs_image_nano-banana_Make it anim..._2026-01-24T23_26_53.png';

const HomePage: React.FC = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center"
            style={{
                paddingTop: '2rem',
                paddingBottom: '4rem',
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            <div
                className="container text-center animate-fade-in"
                style={{
                    maxWidth: '800px',
                    background: 'rgba(255, 255, 255, 0.85)',
                    padding: '3rem',
                    borderRadius: '1.5rem',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(10px)',
                }}
            >
                {/* Hero Section */}
                <h1 className="font-bold mb-lg" style={{ fontSize: '3rem', lineHeight: '1.2', color: '#1e3a5f' }}>
                    Neurodevelopmental Assessment
                    <br />
                    <span style={{ color: 'var(--color-accent)' }}>Powered by AI</span>
                </h1>

                <p className="text-lg mb-xl" style={{ color: '#334155', maxWidth: '600px', margin: '0 auto 2.5rem auto' }}>
                    A multimodal, research-backed diagnostic platform for
                    Autism Spectrum Disorder (ASD) and Intellectual Disability (ID) screening.
                </p>

                <div className="flex gap-md justify-center">
                    <Link to="/assessment" className="btn btn-primary btn-lg">
                        Start Assessment
                    </Link>
                    <Link to="/about" className="btn btn-secondary btn-lg">
                        Learn More
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
