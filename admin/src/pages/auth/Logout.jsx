import React from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../slice/authSlice';
import { resetRights } from '../../slice/rightSlice';

const Logout = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    React.useEffect(() => {
        // Dispatch logout action
        dispatch(logout());
        dispatch(resetRights());

        // Redirect to login page
        navigate('/');
    }, [dispatch, navigate]);

    return null; // No UI required for logout
};

export default Logout;
