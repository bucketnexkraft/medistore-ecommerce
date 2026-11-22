import React from 'react';
import { Link } from 'react-router-dom';

const UnAuthorized = () => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-base-200">
            <div className="card w-96 bg-base-100 shadow-xl">
                <figure className="px-10 pt-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </figure>
                <div className="card-body items-center text-center">
                    <h2 className="card-title text-3xl font-bold">Unauthorized Access!</h2>
                    <p>You do not have the necessary permissions to view this page.</p>
                    <div className="card-actions">
                        <Link to="/dashboard" className="btn btn-primary">Go to Homepage</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnAuthorized;
