'use client'

import React from 'react'
import { Sprout, Shield, LayoutDashboard, ArrowRight, Check } from 'lucide-react'

export type SelectedRole = 'farmer' | 'officer' | 'admin'

interface RoleSelectionScreenProps {
  onSelectRole: (role: SelectedRole) => void
}

export default function RoleSelectionScreen({ onSelectRole }: RoleSelectionScreenProps) {
  return (
    <div className="role-selection-wrapper">
      <div className="role-selection-container">
        {/* Header Branding */}
        <header className="role-header-box">
          <div className="role-header-brand">
            <Sprout size={20} color="#2f6f73" />
            <b>KISAN-MITRA</b>
          </div>
          <h1>Intelligent Procurement Queue &amp; Slot Orchestration</h1>
          <p className="role-tagline">
            &ldquo;Know your slot. Know your token. Know when to arrive.&rdquo;
          </p>
        </header>

        {/* Section Heading */}
        <div className="role-prompt-heading">
          <h2>WHO ARE YOU?</h2>
          <p>Select your access portal to continue</p>
        </div>

        {/* Exactly Three Simple Options */}
        <div className="role-cards-grid">
          {/* Option 1: FARMER */}
          <div className="role-card farmer" id="role-card-farmer">
            <div className="role-card-content">
              <div className="role-card-icon">
                <Sprout size={24} />
              </div>
              <h3>FARMER</h3>
              <ul className="role-card-bullets">
                <li>
                  <Check size={15} /> Book procurement slots
                </li>
                <li>
                  <Check size={15} /> Track token, queue and ETA
                </li>
              </ul>
            </div>
            <button
              type="button"
              id="continue-farmer-btn"
              className="role-card-btn"
              onClick={() => onSelectRole('farmer')}
            >
              Continue as Farmer <ArrowRight size={15} />
            </button>
          </div>

          {/* Option 2: PROCUREMENT OFFICER */}
          <div className="role-card officer" id="role-card-officer">
            <div className="role-card-content">
              <div className="role-card-icon">
                <Shield size={24} />
              </div>
              <h3>PROCUREMENT OFFICER</h3>
              <ul className="role-card-bullets">
                <li>
                  <Check size={15} /> Manage procurement centre queues
                </li>
                <li>
                  <Check size={15} /> Control centre operations
                </li>
              </ul>
            </div>
            <button
              type="button"
              id="continue-officer-btn"
              className="role-card-btn"
              onClick={() => onSelectRole('officer')}
            >
              Continue as Officer <ArrowRight size={15} />
            </button>
          </div>

          {/* Option 3: ADMINISTRATOR */}
          <div className="role-card admin" id="role-card-admin">
            <div className="role-card-content">
              <div className="role-card-icon">
                <LayoutDashboard size={24} />
              </div>
              <h3>ADMINISTRATOR</h3>
              <ul className="role-card-bullets">
                <li>
                  <Check size={15} /> Monitor procurement centres
                </li>
                <li>
                  <Check size={15} /> View network operations
                </li>
              </ul>
            </div>
            <button
              type="button"
              id="continue-admin-btn"
              className="role-card-btn"
              onClick={() => onSelectRole('admin')}
            >
              Continue as Administrator <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Clean, Simple Footer */}
        <footer className="role-footer-simple">
          <span>SIH 2026 · Nexora</span>
        </footer>
      </div>
    </div>
  )
}
