import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  BedDouble,
  Cpu,
  FileText,
  LayoutDashboard,
  Menu,
  Receipt,
  Settings,
  Sparkles,
  Users,
  X
} from "lucide-react";

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard Ejecutivo",
    shortLabel: "Inicio",
    icon: LayoutDashboard
  },
  {
    id: "clients",
    label: "Agencias & Clientes",
    shortLabel: "Clientes",
    icon: Users,
    badgeKey: "clients"
  },
  {
    id: "systems",
    label: "Sistemas & Firmas GDS",
    shortLabel: "Firmas",
    icon: Cpu,
    badgeKey: "signatures"
  },
  {
    id: "contracts",
    label: "Contratos Estatales",
    shortLabel: "Contratos",
    icon: FileText,
    badgeKey: "contracts"
  },
  {
    id: "hospitality",
    label: "Hotel & Reserva Natural",
    shortLabel: "Hotel",
    icon: BedDouble,
    badge: "B2B"
  },
  {
    id: "karing",
    label: "Cartera Karing",
    shortLabel: "Karing",
    icon: Receipt,
    badge: "ERP"
  },
  {
    id: "settings",
    label: "Parametrización",
    shortLabel: "Ajustes",
    icon: Settings,
    badgeKey: "systems"
  }
];

const getBadgeLabel = (badge) =>
  typeof badge === "number" ? `Total: ${badge}` : `Categoría: ${badge}`;

export const Sidebar = () => {
  const {
    activeTab,
    setActiveTab,
    clients,
    signatures,
    contracts,
    systems,
    isAuthenticated
  } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const moreButtonRef = useRef(null);

  const badgeValues = {
    clients: clients.length,
    signatures: signatures.length,
    contracts: contracts.length,
    systems: systems.length
  };

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.badgeKey ? badgeValues[item.badgeKey] : item.badge ?? null
  }));
  const primaryMobileItems = navItems.slice(0, 3);
  const secondaryMobileIds = navItems.slice(3).map((item) => item.id);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        window.requestAnimationFrame(() => moreButtonRef.current?.focus());
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusableElements = drawerRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  if (!isAuthenticated) return null;

  const selectSection = (itemId, closeDrawer = false) => {
    setActiveTab(itemId);
    if (closeDrawer) setIsMobileMenuOpen(false);
  };

  return (
    <>
      <aside className="desktop-sidebar" aria-label="Navegación lateral">
        <div className="desktop-sidebar-content">
          <div>
            <p className="sidebar-eyebrow">Navegación principal</p>
            <nav className="sidebar-nav" aria-label="Módulos de Planetour CRM">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => selectSection(item.id)}
                    className={`sidebar-nav-item${isActive ? " is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="sidebar-nav-label">
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>

                    {item.badge !== null && (
                      <span className="sidebar-nav-badge" aria-label={getBadgeLabel(item.badge)}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <section className="sidebar-local-card" aria-label="Información del despliegue">
            <div>
              <Sparkles aria-hidden="true" />
              <strong>Planetour local</strong>
            </div>
            <p>Entorno on-premise preparado para operar con PostgreSQL.</p>
            <small>Datos bajo control de la organización</small>
          </section>
        </div>

        <footer className="sidebar-footer">Planetour CRM • Operación local</footer>
      </aside>

      <div className="mobile-navigation">
        <nav aria-label="Navegación móvil principal">
          {primaryMobileItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => selectSection(item.id)}
                className={isActive ? "is-active" : undefined}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                <Icon aria-hidden="true" />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}

          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className={secondaryMobileIds.includes(activeTab) ? "is-active" : undefined}
            aria-haspopup="dialog"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-module-drawer"
          >
            <Menu aria-hidden="true" />
            <span>Más</span>
          </button>
        </nav>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-drawer-layer">
          <div
            className="mobile-drawer-backdrop"
            aria-hidden="true"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <section
            ref={drawerRef}
            id="mobile-module-drawer"
            className="mobile-module-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-module-title"
          >
            <header>
              <div>
                <span>Planetour CRM</span>
                <h2 id="mobile-module-title">Todos los módulos</h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  window.requestAnimationFrame(() => moreButtonRef.current?.focus());
                }}
                className="mobile-drawer-close"
                aria-label="Cerrar menú de módulos"
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <nav aria-label="Todos los módulos de Planetour CRM">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => selectSection(item.id, true)}
                    className={isActive ? "is-active" : undefined}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="mobile-drawer-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="mobile-drawer-label">
                      <strong>{item.shortLabel}</strong>
                      <small>{item.label}</small>
                    </span>
                    {item.badge !== null && (
                      <span className="mobile-drawer-badge" aria-label={getBadgeLabel(item.badge)}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </section>
        </div>
      )}
    </>
  );
};
