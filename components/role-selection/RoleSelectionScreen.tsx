'use client'

import React from 'react'
import { Sprout, Shield, LayoutDashboard, Check, ArrowRight, Activity, Zap } from 'lucide-react'

export type SelectedRole = 'farmer' | 'officer' | 'admin'

interface RoleSelectionScreenProps {
  onSelectRole: (role: SelectedRole) => void
}

export default function RoleSelectionScreen({ onSelectRole }: RoleSelectionScreenProps) {
  return (
    <div className="role-selection-wrapper">
      <div className="role-selection-container">
        {/* Header Branding */}
        <div className="role-header-box">
          <div className="role-header-brand">
            <Sprout size={18} color="#9cd0c3" />
            <b>KISAN-MITRA</b>
            <span>SIH26032 · Team Nexora</span>
          </div>
          <h1>Intelligent Procurement Queue &amp; Slot Orchestration</h1>
          <p>
            Eliminating long waiting times, scheduling opacity, and queue uncertainty at agricultural procurement centres across India.
          </p>
        </div>

        {/* Role Prompt */}
        <div className="role-prompt-heading">
          <h2>Who are you?</h2>
          <p>Choose your role to continue to the designated portal</p>
        </div>

        {/* Three Role Cards */}
        <div className="role-cards-grid">
          {/* Card 1: Farmer */}
          <div className="role-card farmer" id="role-card-farmer">
            <div>
              <div className="role-card-icon">
                <Sprout size={24} />
              </div>
              <h3>FARMER</h3>
              <div className="role-card-desc">
                For farmers bringing agricultural produce to government procurement centres.
              </div>
              <ul className="role-card-bullets">
                <li><Check size={14} /> Book a procurement slot</li>
                <li><Check size={14} /> Get your digital token</li>
                <li><Check size={14} /> Track your live queue</li>
                <li><Check size={14} /> Know exactly when to arrive</li>
              </ul>
            </div>
            <button
              id="continue-farmer-btn"
              className="role-card-btn"
              onClick={() => onSelectRole('farmer')}
            >
              Continue as Farmer <ArrowRight size={15} />
            </button>
          </div>

          {/* Card 2: Procurement Officer */}
          <div className="role-card officer" id="role-card-officer">
            <div>
              <div className="role-card-icon">
                <Shield size={24} />
              </div>
              <h3>PROCUREMENT OFFICER</h3>
              <div className="role-card-desc">
                For authorized staff managing day-to-day procurement centre operations.
              </div>
              <ul className="role-card-bullets">
                <li><Check size={14} /> Manage live centre queue</li>
                <li><Check size={14} /> Monitor centre conditions</li>
                <li><Check size={14} /> Update processing conditions</li>
                <li><Check size={14} /> Track incoming farmer flow</li>
              </ul>
            </div>
            <button
              id="continue-officer-btn"
              className="role-card-btn"
              onClick={() => onSelectRole('officer')}
            >
              Continue as Officer <ArrowRight size={15} />
            </button>
          </div>

          {/* Card 3: Administrator */}
          <div className="role-card admin" id="role-card-admin">
            <div>
              <div className="role-card-icon">
                <LayoutDashboard size={24} />
              </div>
              <h3>ADMINISTRATOR</h3>
              <div className="role-card-desc">
                For state/district administrators monitoring the procurement network.
              </div>
              <ul className="role-card-bullets">
                <li><Check size={14} /> Monitor multiple centres</li>
                <li><Check size={14} /> Compare centre load levels</li>
                <li><Check size={14} /> View real-time network status</li>
                <li><Check size={14} /> Monitor subsystem health</li>
              </ul>
            </div>
            <button
              id="continue-admin-btn"
              className="role-card-btn"
              onClick={() => onSelectRole('admin')}
            >
              Continue as Administrator <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Footer Architectural Transparency Banner */}
        <div className="role-footer-banner">
          <div className="role-footer-left">
            <div className="role-footer-icon">
              <Zap size={20} />
            </div>
            <div className="role-footer-text">
              <b>Role Selection is an Authentication Context, Not a Security Bypass</b>
              <span>Authoritative access control is strictly enforced by backend JWT verification and role-based policies (RBAC).</span>
            </div>
          </div>
          <div className="role-footer-pill">
            Aiven MySQL + Smart Queue Engine
          </div>
        </div>
      </div>
    </div>
  )
}
