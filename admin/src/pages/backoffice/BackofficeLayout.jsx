import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { PiUsersThree, PiUserCircleDashed, PiFileText, PiGearFine, PiCoins, PiGear, PiBank, PiReceipt, PiColumns, PiCaretDown, PiCaretRight, PiEnvelopeSimple, PiCurrencyDollar, PiChartPieSlice, PiMapPin } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/layout/Navbar';
import { ToastContainer } from 'react-toastify';
import { removeLandingThemeAssets } from '../../hooks/useLandingThemeAssets';

export default function BackofficeLayout() {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isContentOpen, setIsContentOpen] = useState(true);
  const [isStorefrontOpen, setIsStorefrontOpen] = useState(true);
  const location = useLocation();
  const isContentRoute = location.pathname.startsWith('/backoffice/content/');
  const isStorefrontRoute = [
    '/backoffice/e-categories',
    '/backoffice/e-templates',
  ].some((path) => location.pathname.startsWith(path));

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const isActive = (path) => location.pathname === path;
  const isConfigActive = location.pathname === '/backoffice/cofigurations' || location.pathname === '/backoffice/configurations';

  useEffect(() => {
    removeLandingThemeAssets();
  }, []);

  useEffect(() => {
    if (isStorefrontRoute) {
      setIsStorefrontOpen(true);
    }
  }, [isStorefrontRoute]);

  const primaryItems = [
    { to: '/backoffice/dashboard', label: 'Dashboard', icon: PiChartPieSlice, active: location.pathname === '/backoffice' || isActive('/backoffice/dashboard') },
    { to: '/backoffice/companies', label: 'Companies', icon: PiUsersThree, active: isActive('/backoffice/companies') },
    { to: '/backoffice/rights', label: 'Rights', icon: PiUserCircleDashed, active: isActive('/backoffice/rights') },
  ];

  const systemItems = [
    { to: '/backoffice/cofigurations', label: 'Configurations', icon: PiGear, active: isConfigActive },
    { to: '/backoffice/email-templates', label: 'Email Templates', icon: PiEnvelopeSimple, active: isActive('/backoffice/email-templates') },
    { to: '/backoffice/languages', label: 'Languages', icon: PiFileText, active: isActive('/backoffice/languages') },
    { to: '/backoffice/feature-preferences', label: 'Feature Preference', icon: PiGearFine, active: isActive('/backoffice/feature-preferences') },
    { to: '/backoffice/currencies', label: 'Currencies', icon: PiCurrencyDollar, active: isActive('/backoffice/currencies') },
    { to: '/backoffice/locations', label: 'Locations', icon: PiMapPin, active: isActive('/backoffice/locations') },
  ];

  const storefrontItems = [
    { to: '/backoffice/e-categories', label: 'Store Categories', active: isActive('/backoffice/e-categories') },
    { to: '/backoffice/e-templates', label: 'Store Templates', active: isActive('/backoffice/e-templates') },
  ];

  const billingItems = [
    { to: '/backoffice/plans', label: 'SaaS Plans', icon: PiCoins, active: isActive('/backoffice/plans') },
    { to: '/backoffice/gateways', label: 'Gateways', icon: PiBank, active: isActive('/backoffice/gateways') },
    { to: '/backoffice/plan-payment-logs', label: 'Plan Payments', icon: PiReceipt, active: isActive('/backoffice/plan-payment-logs') },
    { to: '/backoffice/commission-payment-logs', label: 'Commission Receivables', icon: PiReceipt, active: isActive('/backoffice/commission-payment-logs') },
  ];

  const utilityItems = [
    { to: '/backoffice/logs', label: 'Logs', icon: PiFileText, active: isActive('/backoffice/logs') },
  ];

  const renderNavItem = ({ to, label, icon: Icon, active }) => (
    <Link
      key={to}
      to={to}
      title={t(label)}
      className={`group flex items-center ${isSidebarOpen ? 'justify-start' : 'justify-center'} px-3 py-2.5 rounded-xl transition-all duration-200 ${
        active
          ? 'bg-primary text-white shadow-sm'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="flex-shrink-0" size={19} />
      {isSidebarOpen && <span className="ml-3 font-medium text-sm">{t(label)}</span>}
    </Link>
  );

  const renderSection = (title, items) => (
    <div className="space-y-1.5">
      {isSidebarOpen && (
        <p className="px-3 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          {title}
        </p>
      )}
      {items.map(renderNavItem)}
    </div>
  );

  return (
    <div className="h-screen h-dvh min-h-0 overflow-hidden flex flex-col">
      {/* Navbar */}
      <div className="relative z-40">
        <Navbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden pt-16">
        {/* Backoffice Sidebar */}
        <div className={`${isSidebarOpen ? 'w-72' : 'w-20'} max-lg:hidden shrink-0 bg-white border-r border-slate-200 text-base-content flex flex-col transition-all duration-300 ease-in-out sticky top-16 h-[calc(100vh-4rem)] overflow-hidden`}>
          <div className="flex h-full min-h-0 flex-col p-3">
            <div className={`mb-2 px-3 py-2 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 ${isSidebarOpen ? 'block' : 'hidden'}`}>
              <h2 className="text-sm font-semibold text-slate-700 tracking-wide">{t('Backoffice Panel')}</h2>
            </div>
            <nav className="flex-1 min-h-0 space-y-4 overflow-y-auto scrollbar-hidden pr-1">
              {renderSection(t('Core'), primaryItems)}
              {renderSection(t('System'), systemItems)}

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setIsStorefrontOpen((prev) => !prev)}
                  title={t('Storefront Setup')}
                  className={`w-full flex items-center ${isSidebarOpen ? 'justify-start' : 'justify-center'} px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isStorefrontRoute ? 'bg-primary text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <PiColumns className="flex-shrink-0" size={19} />
                  {isSidebarOpen && (
                    <>
                      <span className="ml-3 font-medium text-sm flex-1 text-left">{t('Storefront Setup')}</span>
                      {isStorefrontOpen ? <PiCaretDown size={16} /> : <PiCaretRight size={16} />}
                    </>
                  )}
                </button>

                {isSidebarOpen && isStorefrontOpen && (
                  <div className="ml-4 border-l border-slate-200 pl-3 space-y-1">
                    {storefrontItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                          item.active
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {t(item.label)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {renderSection(t('Billing'), billingItems)}

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setIsContentOpen((prev) => !prev)}
                  title={t('Contact Messages')}
                  className={`w-full flex items-center ${isSidebarOpen ? 'justify-start' : 'justify-center'} px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isContentRoute ? 'bg-primary text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <PiColumns className="flex-shrink-0" size={19} />
                  {isSidebarOpen && (
                    <>
                      <span className="ml-3 font-medium text-sm flex-1 text-left">{t('Contact Messages')}</span>
                      {isContentOpen ? <PiCaretDown size={16} /> : <PiCaretRight size={16} />}
                    </>
                  )}
                </button>

                {isSidebarOpen && isContentOpen && (
                  <div className="ml-4 border-l border-slate-200 pl-3 space-y-1">
                    {/* <Link
                      to="/backoffice/content/sections"
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/backoffice/content/sections' || location.pathname.startsWith('/backoffice/content/sections/')
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t('Sections')}
                    </Link>
                    <Link
                      to="/backoffice/content/pages"
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/backoffice/content/pages' || location.pathname.includes('/backoffice/content/pages/')
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t('Pages')}
                    </Link>
                    <Link
                      to="/backoffice/content/menus"
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/backoffice/content/menus'
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t('Menu')}
                    </Link>
                    <Link
                      to="/backoffice/content/blog-categories"
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/backoffice/content/blog-categories'
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t('Blog Categories')}
                    </Link>
                    <Link
                      to="/backoffice/content/blogs"
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/backoffice/content/blogs' ||
                        location.pathname === '/backoffice/content/blogs/create' ||
                        location.pathname.includes('/backoffice/content/blogs/')
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t('Blogs')}
                    </Link> */}
                    <Link
                      to="/backoffice/content/contact-messages"
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/backoffice/content/contact-messages'
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t('Contact Messages')}
                    </Link>
                    <Link
                      to="/backoffice/content/newsletters"
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/backoffice/content/newsletters'
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t('Newsletters')}
                    </Link>
                  </div>
                )}
              </div>
              {renderSection(t('Utilities'), utilityItems)}
            </nav>
          </div>
        </div>
        
        {/* Main Content */}
        <main
          className="flex-1 min-h-0 p-2 lg:p-4 rounded-xl bg-zinc-50 overflow-y-auto transition-all duration-300"
          data-lenis-prevent-wheel
        >
          <Outlet />
        </main>
      </div>
      <ToastContainer style={{ zIndex: 9999 }} />
    </div>
  );
}
