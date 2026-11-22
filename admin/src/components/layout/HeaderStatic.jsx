import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { FiGrid, FiGlobe, FiMenu, FiChevronDown, FiHelpCircle, FiBookOpen, FiFileText, FiStar } from "react-icons/fi";
import { RiBankLine } from "react-icons/ri";

const iconPool = [FiGrid, FiGlobe, RiBankLine, FiHelpCircle, FiBookOpen, FiFileText, FiStar];

function isExternal(path) {
  return typeof path === "string" && (path.startsWith("http://") || path.startsWith("https://"));
}

function MenuLink({ item, className, children, onClick }) {
  const path = item?.path || "#";
  const target = item?.target || "_self";

  if (isExternal(path)) {
    return (
      <a href={path} className={className} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link to={path} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

export default function HeaderStatic({ logoUrl, brandColor = "#2f3a4c", menuItems = [] }) {
  const location = useLocation();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const isSuperAdmin = Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;
  const needsPlanSelection = useSelector((state) => state.auth.needs_plan_selection) === true && !isSuperAdmin;
  const fallbackLogo = "/logo/default-logo.png";
  const [currentLogo, setCurrentLogo] = useState(fallbackLogo);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMobileMenus, setOpenMobileMenus] = useState([]);
  const isLoggedIn = Boolean(accessToken);
  const dashboardPath = isSuperAdmin ? "/backoffice/dashboard" : needsPlanSelection ? "/subscription/plans" : "/dashboard";

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setOpenMobileMenus([]);
  };

  const toggleMobileSubmenu = (id) => {
    setOpenMobileMenus((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  useEffect(() => {
    if (!logoUrl) {
      setCurrentLogo(fallbackLogo);
      return;
    }

    let cancelled = false;
    const image = new window.Image();

    image.onload = () => {
      if (!cancelled) {
        setCurrentLogo(logoUrl);
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setCurrentLogo(fallbackLogo);
      }
    };

    image.src = logoUrl;

    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  return (
    <header>
      <style>
        {`
          .ot-main-menu > nav > ul > li > a { font-weight: 600; }
          .ot-main-menu > nav > ul > li .submenu {
            min-width: auto !important;
            padding: 0 !important;
            background: transparent !important;
            border-radius: 0 !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
          }
          .submenu-widget-title { color: #5a63ea; font-weight: 700; font-size: 1.125rem; margin-bottom: 14px; }
          .submenu-widget-menu { font-size: 1.05rem; font-weight: 700; color: #1f2937; display: inline-flex; align-items: center; gap: 8px; }
          .submenu-widget-dsc { font-size: 0.95rem; color: #4b5563; margin-top: 4px; line-height: 1.45; }
          .submenu-widget-item { padding: 8px 0; }
          .widget-icon { color: #5a63ea; display: inline-flex; font-size: 1.2rem; }
          .ot-main-menu > nav > ul > li .submenu .submenu-widget {
            background: rgba(244, 246, 252, 0.96);
            border-radius: 30px;
            padding: 34px 42px;
            width: 690px;
            max-width: 82vw;
            border: 1px solid rgba(255, 255, 255, 0.65);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            box-shadow: none;
          }
          .landing-nav-active { color: #5a63ea !important; text-decoration: underline; }
          @media (max-width: 1199.98px) {
            .ot-header-layout1 .ot-header-right-bars {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              padding: 0 !important;
              line-height: 1 !important;
              vertical-align: middle;
            }
            .ot-header-layout1 .ot-header-right-bars svg {
              display: block;
              width: 22px;
              height: 22px;
              margin: 0;
            }
          }
          @media (min-width: 1200px) {
            .ot-header-layout1 .ot-header-right-bars {
              display: none !important;
            }
          }
          .landing-mobile-overlay {
            position: fixed;
            inset: 0;
            z-index: 9998;
            background: rgba(15, 23, 42, 0.48);
            opacity: 0;
            pointer-events: none;
            transition: opacity 180ms ease;
          }
          .landing-mobile-overlay.open {
            opacity: 1;
            pointer-events: auto;
          }
          .landing-mobile-drawer {
            position: fixed;
            top: 0;
            right: 0;
            z-index: 9999;
            width: min(86vw, 360px);
            height: 100vh;
            background: #ffffff;
            box-shadow: -18px 0 40px rgba(15, 23, 42, 0.18);
            transform: translateX(100%);
            transition: transform 220ms ease;
            padding: 24px;
            overflow-y: auto;
          }
          .landing-mobile-drawer.open {
            transform: translateX(0);
          }
          .landing-mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 24px;
          }
          .landing-mobile-logo {
            max-width: 120px;
            max-height: 56px;
            object-fit: contain;
          }
          .landing-mobile-close {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            border: 1px solid #d8dee9;
            background: #f8fafc;
            color: #111827;
            font-size: 24px;
            line-height: 1;
          }
          .landing-mobile-menu {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .landing-mobile-link,
          .landing-mobile-parent {
            display: flex;
            width: 100%;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border: 0;
            border-radius: 12px;
            background: #f8fafc;
            color: #111827;
            padding: 13px 14px;
            font-weight: 700;
            text-align: left;
          }
          .landing-mobile-link:hover,
          .landing-mobile-parent:hover {
            color: #5a63ea;
          }
          .landing-mobile-submenu {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 8px 0 8px 14px;
          }
          .landing-mobile-submenu .landing-mobile-link {
            background: #ffffff;
            border: 1px solid #eef2f7;
            font-weight: 600;
          }
          .landing-mobile-actions {
            display: grid;
            gap: 10px;
            margin-top: 24px;
          }
        `}
      </style>
      <div id="header-sticky" className="ot-header-area ot-header-layout1 header-transparent">
        <div className="ot-header-wrapper">
          <div className="container-fluid z-index-2">
            <div className="row justify-content-between align-items-center justify-content-between">
              <div className="col-xxl-2 col-xl-2 col-lg-6 col-md-6 col-sm-6 col-6">
                <div className="ot-main-logo">
                  <Link to="/">
                    <img
                      src={currentLogo}
                      alt="logo"
                      style={{ display: "inline-block" }}
                      onError={() => {
                        if (currentLogo !== fallbackLogo) {
                          setCurrentLogo(fallbackLogo);
                        }
                      }}
                    />
                  </Link>
                </div>
              </div>

              <div className="col-xxl-7 col-xl-6 d-none d-xl-block">
                <div className="ot-main-menu ot-main-menu text-center">
                  <nav className="ot-mobile-menu-active">
                    <ul>
                      {menuItems.map((item) => {
                        const hasChildren = Array.isArray(item?.children) && item.children.length > 0;
                        const isActive = item?.path === location.pathname || (item?.path !== "/" && location.pathname.startsWith(item?.path || ""));

                        return (
                          <li key={`menu-${item.id}`} className={hasChildren ? "has-dropdown" : ""}>
                            <MenuLink item={item} className={`d-flex align-items-center gap-2 ${isActive ? "landing-nav-active" : ""}`}>
                              {item.title}
                              {hasChildren ? <FiChevronDown size={16} /> : null}
                            </MenuLink>

                            {hasChildren ? (
                              <ul className="ot-submenu submenu">
                                <div className="submenu-widget">
                                  <h3 className="submenu-widget-title">{item.title}</h3>
                                  {item.children.map((child, idx) => {
                                    const Icon = iconPool[idx % iconPool.length];
                                    return (
                                      <div className="submenu-widget-item" key={`submenu-${child.id}`}>
                                        <MenuLink item={child} className="submenu-widget-menu">
                                          <span className="widget-icon">
                                            <Icon />
                                          </span>
                                          {child.title}
                                        </MenuLink>
                                        <p className="submenu-widget-dsc">{child.description || "Explore this section."}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </div>
              </div>

              <div className="col-xxl-3 col-xl-4 col-lg-6 col-md-6 col-sm-6 col-6 text-end">
                <div className="ot-header-right d-flex gap-3 align-items-center justify-content-end d-none d-xl-inline-flex">
                  {isLoggedIn ? (
                    <Link to={dashboardPath} className="ot-btn-primary">
                      Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link to="/login" className="ot-btn-secondary">
                        Log In
                      </Link>
                      <Link to="/register" className="ot-btn-primary">
                        Register
                      </Link>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="ot-offcanvas-toogle d-xl-none ot-header-right-bars"
                  aria-label="Open menu"
                  aria-expanded={isMobileMenuOpen}
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <FiMenu />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`landing-mobile-overlay ${isMobileMenuOpen ? "open" : ""}`}
        onClick={closeMobileMenu}
      />
      <aside className={`landing-mobile-drawer ${isMobileMenuOpen ? "open" : ""}`}>
        <div className="landing-mobile-header">
          <Link to="/" onClick={closeMobileMenu}>
            <img src={currentLogo} alt="logo" className="landing-mobile-logo" />
          </Link>
          <button type="button" className="landing-mobile-close" onClick={closeMobileMenu} aria-label="Close menu">
            ×
          </button>
        </div>
        <nav className="landing-mobile-menu">
          {menuItems.map((item) => {
            const hasChildren = Array.isArray(item?.children) && item.children.length > 0;
            const menuId = item.id || item.path || item.title;
            const isOpen = openMobileMenus.includes(menuId);

            if (hasChildren) {
              return (
                <div key={`mobile-menu-${menuId}`}>
                  <button
                    type="button"
                    className="landing-mobile-parent"
                    onClick={() => toggleMobileSubmenu(menuId)}
                  >
                    <span>{item.title}</span>
                    <FiChevronDown style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </button>
                  {isOpen ? (
                    <div className="landing-mobile-submenu">
                      {item.children.map((child) => (
                        <MenuLink
                          key={`mobile-submenu-${child.id}`}
                          item={child}
                          className="landing-mobile-link"
                          onClick={closeMobileMenu}
                        >
                          {child.title}
                        </MenuLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <MenuLink
                key={`mobile-menu-${menuId}`}
                item={item}
                className="landing-mobile-link"
                onClick={closeMobileMenu}
              >
                {item.title}
              </MenuLink>
            );
          })}
        </nav>
        <div className="landing-mobile-actions">
          {isLoggedIn ? (
            <Link to={dashboardPath} className="ot-btn-primary text-center" onClick={closeMobileMenu}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="ot-btn-secondary text-center" onClick={closeMobileMenu}>
                Log In
              </Link>
              <Link to="/register" className="ot-btn-primary text-center" onClick={closeMobileMenu}>
                Register
              </Link>
            </>
          )}
        </div>
      </aside>
    </header>
  );
}
