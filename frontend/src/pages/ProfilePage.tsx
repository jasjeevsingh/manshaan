/**
 * Profile Page
 * 
 * Parent profile and child management.
 */

import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

const ProfilePage: React.FC = () => {
    const { user, children, signOut, addChild, deleteChild } = useAuthStore();
    const [showAddChild, setShowAddChild] = useState(false);
    const [childName, setChildName] = useState('');
    const [childDOB, setChildDOB] = useState('');
    const [childNotes, setChildNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAddChild = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await addChild({
                name: childName,
                date_of_birth: childDOB || undefined,
                notes: childNotes || undefined,
            });

            setChildName('');
            setChildDOB('');
            setChildNotes('');
            setShowAddChild(false);
        } catch (error) {
            console.error('Error adding child:', error);
            alert('Failed to add child profile');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteChild = async (childId: string, childName: string) => {
        if (!confirm(`Are you sure you want to delete ${childName}'s profile?`)) {
            return;
        }

        try {
            await deleteChild(childId);
        } catch (error) {
            console.error('Error deleting child:', error);
            alert('Failed to delete child profile');
        }
    };

    return (
        <div className="container py-2xl">
            <div className="page-header">
                <h1 className="text-3xl font-bold">My Profile</h1>
                <p className="text-secondary mt-sm">Manage your account and children's profiles</p>
            </div>

            {/* Account Info */}
            <section className="card mb-xl">
                <div className="card-header">
                    <h2 className="text-xl font-semibold">Account Information</h2>
                </div>
                <div className="card-body">
                    <div className="flex flex-col gap-md">
                        <div>
                            <label className="label">Name</label>
                            <p className="text-lg">{user?.user_metadata?.full_name || user?.email}</p>
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <p className="text-lg">{user?.email}</p>
                        </div>
                        <div className="mt-md">
                            <button onClick={signOut} className="btn btn-danger">
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Children Profiles */}
            <section className="card">
                <div className="card-header flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Children</h2>
                    <button
                        onClick={() => setShowAddChild(!showAddChild)}
                        className="btn btn-primary btn-sm"
                    >
                        {showAddChild ? 'Cancel' : '+ Add Child'}
                    </button>
                </div>
                <div className="card-body">
                    {showAddChild && (
                        <form onSubmit={handleAddChild} className="card mb-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                            <div className="card-body flex flex-col gap-md">
                                <h3 className="font-semibold">Add New Child</h3>
                                <div>
                                    <label className="label">Child's Name *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={childName}
                                        onChange={(e) => setChildName(e.target.value)}
                                        required
                                        disabled={loading}
                                        placeholder="Enter child's name"
                                    />
                                </div>
                                <div>
                                    <label className="label">Date of Birth</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={childDOB}
                                        onChange={(e) => setChildDOB(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <div>
                                    <label className="label">Notes (optional)</label>
                                    <textarea
                                        className="input"
                                        value={childNotes}
                                        onChange={(e) => setChildNotes(e.target.value)}
                                        disabled={loading}
                                        placeholder="Any relevant information..."
                                        rows={3}
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Adding...' : 'Add Child'}
                                </button>
                            </div>
                        </form>
                    )}

                    {children.length === 0 ? (
                        <div className="text-center py-xl text-muted">
                            <p>No children added yet.</p>
                            <p className="text-sm mt-sm">Click "Add Child" to create a profile.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-md">
                            {children.map((child) => (
                                <div key={child.id} className="card">
                                    <div className="card-body flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-semibold">{child.name}</h3>
                                            {child.date_of_birth && (
                                                <p className="text-sm text-secondary">
                                                    Born: {new Date(child.date_of_birth).toLocaleDateString()}
                                                </p>
                                            )}
                                            {child.notes && (
                                                <p className="text-sm text-muted mt-sm">{child.notes}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteChild(child.id, child.name)}
                                            className="btn btn-danger btn-sm"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ProfilePage;
