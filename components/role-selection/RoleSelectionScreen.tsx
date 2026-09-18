'use client'

import React, { useState } from 'react'
import {
  Sprout,
  Shield,
  LayoutDashboard,
  ArrowRight,
  Check,
  Globe,
  HelpCircle,
  X,
} from 'lucide-react'
import { translations, Language } from '@/lib/i18n'

export type SelectedRole = 'farmer' | 'officer' | 'admin'

interface RoleSelectionScreenProps {
  onSelectRole: (role: SelectedRole) => void
  currentLanguage: Language
  onLanguageChange: (lang: Language) => void
}

export default function RoleSelectionScreen({
  onSelectRole,
  currentLanguage,
  onLanguageChange,
}: RoleSelectionScreenProps) {
  const [showHelpModal, setShowHelpModal] = useState(false)
  const t = translations[currentLanguage]

  return (
    <div className="role-selection-wrapper">
      {/* Top Header Utility Bar */}
      <header className="top-utility-bar">
        <div className="utility-left">
          <div className="utility-brand">
            <Sprout size={20} color="#8bd3c7" />
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#ffffff', letterSpacing: '0.02em' }}>
              Kisan-Mitra
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.12)', padding: '2px 8px', borderRadius: '4px', color: '#d1fae5', marginLeft: '6px', fontWeight: 500 }}>
              Digital Mandi Portal
            </span>
          </div>
        </div>

        <div className="utility-right">
          <button
            type="button"
            className="help-trigger-btn"
            onClick={() => setShowHelpModal(true)}
            aria-label="Help & FAQ"
            id="help-faq-btn"
          >
            <HelpCircle size={15} />
            <span>{currentLanguage === 'mr' ? 'मदत व प्रश्न' : currentLanguage === 'hi' ? 'सहायता एवं प्रश्न' : 'Help & FAQ'}</span>
          </button>

          <label className="language-select-label" aria-label="Language selector" htmlFor="role-selection-language-select">
            <Globe size={14} />
            <select
              value={currentLanguage}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="lang-dropdown hero-language-select"
              id="role-selection-language-select"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
              <option value="mr">मराठी</option>
            </select>
          </label>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="role-selection-container">
        {/* Header Branding: Logo, Title, Subtitle */}
        <div className="role-header-box">
          <div className="role-header-brand">
            <Sprout size={24} color="#8bd3c7" />
            <b>{t.appName.toUpperCase()}</b>
          </div>
          <h1>{t.tagline}</h1>
          <p className="role-tagline">
            &ldquo;Know your slot. Know your token. Know when to arrive.&rdquo;
          </p>
        </div>

        {/* Exactly Three Role Selection Blocks */}
        <div className="role-cards-grid">
          {/* Option 1: FARMER */}
          <div className="role-card farmer" id="role-card-farmer">
            <div className="role-card-content">
              <div className="role-badge-pill">{t.roles.farmer.badge}</div>
              <div className="role-card-icon">
                <Sprout size={24} />
              </div>
              <h3>{t.roles.farmer.title}</h3>
              <p className="role-card-subtitle">{t.roles.farmer.subtitle}</p>
              <ul className="role-card-bullets">
                {t.roles.farmer.bullets.map((b, i) => (
                  <li key={i}>
                    <Check size={15} /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              id="continue-farmer-btn"
              className="role-card-btn"
              onClick={() => onSelectRole('farmer')}
            >
              {currentLanguage === 'mr'
                ? 'शेतकरी म्हणून पुढे जा'
                : currentLanguage === 'hi'
                ? 'किसान पोर्टल पर जाएं'
                : 'Continue as Farmer'} <ArrowRight size={15} />
            </button>
          </div>

          {/* Option 2: PROCUREMENT OFFICER */}
          <div className="role-card officer" id="role-card-officer">
            <div className="role-card-content">
              <div className="role-badge-pill officer">{t.roles.officer.badge}</div>
              <div className="role-card-icon">
                <Shield size={24} />
              </div>
              <h3>{t.roles.officer.title}</h3>
              <p className="role-card-subtitle">{t.roles.officer.subtitle}</p>
              <ul className="role-card-bullets">
                {t.roles.officer.bullets.map((b, i) => (
                  <li key={i}>
                    <Check size={15} /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              id="continue-officer-btn"
              className="role-card-btn"
              onClick={() => onSelectRole('officer')}
            >
              {currentLanguage === 'mr'
                ? 'अधिकारी म्हणून पुढे जा'
                : currentLanguage === 'hi'
                ? 'अधिकारी पोर्टल पर जाएं'
                : 'Continue as Officer'} <ArrowRight size={15} />
            </button>
          </div>

          {/* Option 3: ADMINISTRATOR */}
          <div className="role-card admin" id="role-card-admin">
            <div className="role-card-content">
              <div className="role-badge-pill admin">{t.roles.admin.badge}</div>
              <div className="role-card-icon">
                <LayoutDashboard size={24} />
              </div>
              <h3>{t.roles.admin.title}</h3>
              <p className="role-card-subtitle">{t.roles.admin.subtitle}</p>
              <ul className="role-card-bullets">
                {t.roles.admin.bullets.map((b, i) => (
                  <li key={i}>
                    <Check size={15} /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              id="continue-admin-btn"
              className="role-card-btn"
              onClick={() => onSelectRole('admin')}
            >
              {currentLanguage === 'mr'
                ? 'प्रशासक म्हणून पुढे जा'
                : currentLanguage === 'hi'
                ? 'प्रशासक पोर्टल पर जाएं'
                : 'Continue as Administrator'} <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Clean Public Service Footer */}
        <footer className="role-footer-simple">
          <span>Kisan-Mitra · Intelligent Procurement Queue & Slot Orchestration</span>
        </footer>
      </main>

      {/* Help & Support Static FAQ Modal */}
      {showHelpModal && (
        <div className="modal-backdrop" onClick={() => setShowHelpModal(false)}>
          <div
            className="help-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
          >
            <div className="help-modal-header">
              <div className="help-modal-title-area">
                <HelpCircle size={20} color="#2f6f73" />
                <h3 id="help-modal-title">{t.help.title}</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setShowHelpModal(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="help-modal-body">
              <p className="help-modal-intro">{t.help.desc}</p>

              <div className="faq-accordion">
                <div className="faq-item">
                  <h4>{t.help.faq1Q}</h4>
                  <p>{t.help.faq1A}</p>
                </div>
                <div className="faq-item">
                  <h4>{t.help.faq2Q}</h4>
                  <p>{t.help.faq2A}</p>
                </div>
                <div className="faq-item">
                  <h4>{t.help.faq3Q}</h4>
                  <p>{t.help.faq3A}</p>
                </div>
                <div className="faq-item">
                  <h4>{t.help.faq4Q}</h4>
                  <p>{t.help.faq4A}</p>
                </div>
              </div>

              <div className="static-contact-notice">
                <b>Local Procurement Support:</b>
                <span>
                  For centre-specific inquiries, weighbridge status, or moisture testing assistance, visit the Help Desk at your assigned Mandi or contact the Centre Officer on duty.
                </span>
              </div>
            </div>

            <div className="help-modal-footer">
              <button
                type="button"
                className="button primary small"
                onClick={() => setShowHelpModal(false)}
              >
                {t.help.closeBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
