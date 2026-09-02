import React, { useEffect, useId, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  ChevronDown,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Search
} from "lucide-react";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";

const logoPlanetour = "/logo_planetour.png";

export const Navbar = () => {
  const {
    searchTerm,
    setSearchTerm,
    syncWithKaring,
    currentUser,
    logout,
    isReadOnly,
    isAuthenticated,
    canSyncKaring,
    isSyncing
  } = useApp();

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const accountMenuId = useId();
  const accountMenuRef = useRef(null);
  const profileButtonRef = useRef(null);

  useEffect(() => {
    if (!showRoleDropdown) return undefined;

    const handlePointerDown = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) {
        setShowRoleDropdown(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowRoleDropdown(false);
        profileButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showRoleDropdown]);

  if (!isAuthenticated) return null;

  return (
    <>
      <header className="app-navbar">
        <div className="navbar-brand-group" aria-label="Planetour CRM Consolidador">
          <div className="navbar-logo-shell">
            <img src={logoPlanetour} alt="Planetour" className="navbar-logo" />
          </div>

          <div className="navbar-brand-copy">
            <div className="navbar-brand-title">
              <span>Consolidador</span>
              <span className="navbar-crm-badge">CRM</span>
            </div>
            <p>Control comercial y operativo</p>
          </div>

          <div className="navbar-integration-note" title="La conciliación usa las facturas registradas en PostgreSQL">
            <RefreshCw aria-hidden="true" />
            <span>
              <strong>Karing ERP</strong>
              <small>Conciliación local</small>
            </span>
          </div>
        </div>

        <div className="navbar-search">
          <label htmlFor="global-search" className="sr-only">
            Buscar en Planetour CRM
          </label>
          <Search aria-hidden="true" />
          <input
            id="global-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar agencia, NIT, firma o contrato..."
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        <div className="navbar-actions">
          <button
            type="button"
            onClick={syncWithKaring}
            disabled={!canSyncKaring || isSyncing}
            className="navbar-action navbar-sync-action"
            title={canSyncKaring ? "Recalcular cartera desde las facturas registradas" : "Tu rol no permite recalcular la cartera"}
            aria-label={isSyncing ? "Recalculando cartera registrada" : "Recalcular cartera registrada"}
          >
            <RefreshCw aria-hidden="true" className={isSyncing ? "animate-spin" : undefined} />
            <span>{isSyncing ? "Recalculando" : "Recalcular"}</span>
          </button>

          {isReadOnly && (
            <div className="navbar-readonly-badge" role="status" title="Perfil con permisos de solo lectura">
              <Lock aria-hidden="true" />
              <span>Solo lectura</span>
            </div>
          )}

          {currentUser && (
            <div className="navbar-account" ref={accountMenuRef}>
              <button
                ref={profileButtonRef}
                type="button"
                onClick={() => setShowRoleDropdown((isOpen) => !isOpen)}
                className="navbar-profile-button"
                aria-label={`Abrir menú de ${currentUser.name}`}
                aria-haspopup="menu"
                aria-expanded={showRoleDropdown}
                aria-controls={accountMenuId}
              >
                <span
                  className="navbar-avatar"
                  style={{ backgroundColor: currentUser.avatarColor || "#ea580c" }}
                  aria-hidden="true"
                >
                  {currentUser.role?.slice(0, 2) || "PL"}
                </span>

                <span className="navbar-user-copy">
                  <strong>{currentUser.name}</strong>
                  <small>{currentUser.roleLabel}</small>
                </span>

                <ChevronDown
                  aria-hidden="true"
                  className={showRoleDropdown ? "is-open" : undefined}
                />
              </button>

              {showRoleDropdown && (
                <div id={accountMenuId} className="navbar-account-menu" role="menu">
                  <div className="navbar-account-summary">
                    <span>Mi cuenta</span>
                    <strong>{currentUser.email}</strong>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowRoleDropdown(false);
                      setShowChangePasswordModal(true);
                    }}
                    className="navbar-menu-item"
                  >
                    <KeyRound aria-hidden="true" />
                    Cambiar mi contraseña
                  </button>

                  <div className="navbar-menu-separator">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowRoleDropdown(false);
                        logout();
                      }}
                      className="navbar-menu-item is-danger"
                    >
                      <LogOut aria-hidden="true" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {showChangePasswordModal && (
        <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
      )}
    </>
  );
};
