import React from 'react';
import { useSelector } from 'react-redux';
import BackofficeLayout from '../../pages/backoffice/BackofficeLayout';
import Layout from '../../layout/Layout';

const ConditionalLayout = ({ children }) => {
  const isSuperAdmin = useSelector((state) => state.auth.is_super_admin);
  
  // Super admins get BackofficeLayout, regular users get Layout
  return isSuperAdmin ? <BackofficeLayout /> : <Layout />;
};

export default ConditionalLayout;
