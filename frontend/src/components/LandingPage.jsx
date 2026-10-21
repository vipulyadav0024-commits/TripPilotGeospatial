import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Map, Sun, ArrowRight, DollarSign, Send } from 'lucide-react';
import LandingNavbar from './LandingNavbar';

const DESTINATIONS = [
  {
    name: 'Tokyo, Japan',
    region: 'Asia',
    blurb: 'Perfect for tech exploration, ancient temples, sushi tasting, and neon lights.',
    img: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600',
    accent: 'brand',
  },
  {
    name: 'Paris, France',
    region: 'Europe',
    blurb: 'Discover museum masterpieces, cozy patisseries, classical architecture, and the Eiffel Tower.',
    img: 'https://images.pexels.com/photos/1530259/pexels-photo-1530259.jpeg?auto=compress&cs=tinysrgb&w=600',
    accent: 'lagoon',
  },
  {
    name: 'Rome, Italy',
    region: 'Europe',
    blurb: 'Walk inside colosseum paths, explore Vatican galleries, and taste world-class gelato.',
    img: 'https://images.pexels.com/photos/532263/pexels-photo-532263.jpeg?auto=compress&cs=tinysrgb&w=600',
    accent: 'sun',
  },
];

const STEPS = [
  { n: '1', title: 'Sign Up', copy: 'Create a secure profile that isolates your travel plans.', accent: 'brand' },
  { n: '2', title: 'Set Preferences', copy: 'Choose destination, duration, budget tier, and interests.', accent: 'sun' },
  { n: '3', title: 'Review & Customize', copy: 'Modify schedules, regenerate specific days, and view recommendations.', accent: 'lagoon' },
  { n: '4', title: 'Pack & Travel', copy: 'Check off your weather-aware packing list items as you prepare.', accent: 'brand' },
];

const ACCENTS = {
  brand: { bg: 'bg-brand-100', text: 'text-brand-600', ring: 'border-brand-200', solid: 'bg-brand-500' },
  sun: { bg: 'bg-sun-100', text: 'text-sun-700', ring: 'border-sun-300', solid: 'bg-sun-500' },
  lagoon: { bg: 'bg-lagoon-100', text: 'text-lagoon-700', ring: 'border-lagoon-300', solid: 'bg-lagoon-500' },
};

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState('');
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');
  const token = localStorage.getItem('token');

  const bannerImg = "https://images.pexels.com/photos/15693280/pexels-photo-15693280.jpeg?_gl=1*z79qpe*_ga*MjQ0NzIwMzMwLjE3ODE5NjU1MzY.*_ga_8JE65Q40S6*czE3ODE5NjU1MzYkbzEkZzEkdDE3ODE5NjU2MzIkajQzJGwwJGgw";

  const scrollToSection = useCallback((e, sectionId) => {
    e.preventDefault();

    const section = document.getElementById(sectionId);
    if (!section) return;

    const headerOffset = 80;
    const top = section.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({ top, behavior: 'smooth' });
    setActiveSection(sectionId);

    section.classList.remove('section-nav-target');
    void section.offsetWidth;
    section.classList.add('section-nav-target');

    section.addEventListener(
      'animationend',
      () => section.classList.remove('section-nav-target'),
      { once: true }
    );
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll('.landing-section');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('section-visible');
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.2, rootMargin: '-90px 0px -10% 0px' }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!token) return;

    const storedName = localStorage.getItem('userName');
    if (storedName) {
      return;
    }

    const fetchUserProfile = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const user = await res.json();
          const displayName = user.name || user.email?.split('@')[0];
          if (displayName) {
            localStorage.setItem('userName', displayName);
            setUserName(displayName);
          }
        }
      } catch (err) {
        console.error('Failed to fetch user profile', err);
      }
    };

    fetchUserProfile();
  }, [token]);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-cream-50 text-ink-900 flex flex-col justify-between">

      <LandingNavbar
        token={token}
        userName={userName}
        activeSection={activeSection}
        onScrollToSection={scrollToSection}
        onSignOut={handleSignOut}
      />

      {/* Spacer for fixed navbar height */}
      <div className="h-14 lg:h-16 shrink-0" aria-hidden="true" />

      {/* Hero Section */}
      <section className="relative flex items-center justify-center pt-16 pb-28 sm:pt-24 sm:pb-36 px-4 sm:px-6 lg:px-8 overflow-x-hidden bg-ink-900">

        {/* Full-bleed background with overlays */}
        <div className="absolute inset-0 z-0">
          <img
            src={bannerImg}
            alt="Scenic Travel Banner"
            className="w-full h-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/85 to-ink-900/60" />
        </div>

        {/* Content Panel */}
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs sm:text-sm font-semibold text-sun-300">
            <Send className="h-3.5 w-3.5 -rotate-45" />
            AI-powered trip planning, made simple
          </div>

          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-white">
            Your next adventure, tailored by intelligence
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-xl text-white/75 leading-relaxed">
            Generate customized day-by-day itineraries, estimate budgets, discover hotels, and auto-generate weather-aware packing lists instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link
              to={token ? "/dashboard" : "/register"}
              className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 px-8 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-500/30 flex justify-center items-center gap-2"
            >
              Start Planning Free <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="w-full sm:w-auto bg-white/10 border border-white/20 hover:bg-white/15 text-white font-semibold py-4 px-8 rounded-xl transition flex justify-center items-center hover:scale-[1.02] active:scale-[0.98]"
            >
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* Wave divider between hero and content */}
      <div className="relative -mt-1 bg-ink-900">
        <svg viewBox="0 0 1440 80" className="w-full h-12 sm:h-16 block" preserveAspectRatio="none">
          <path d="M0,32 C240,80 480,0 720,24 C960,48 1200,72 1440,32 L1440,80 L0,80 Z" fill="#fff7ec" />
        </svg>
      </div>

      {/* Features Grid Section */}
      <section id="features" className="landing-section scroll-mt-24 py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative bg-cream-50 overflow-x-hidden">

        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <p className="font-display text-3xl sm:text-5xl font-bold text-ink-900">Smart travel framework</p>
          <p className="text-ink-900/60 text-base sm:text-lg">Everything you need to plan, structure, and modify your trips in a secure environment.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="group bg-white border border-ink-900/10 rounded-[28px] p-8 hover:border-brand-200 transition duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md relative overflow-hidden">
            <div className="bg-brand-100 p-4 rounded-2xl w-fit mb-6 text-brand-600 group-hover:scale-110 transition duration-300 rotate-[-4deg]">
              <Map className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-ink-900 mb-3">AI Itinerary Generation</h3>
            <p className="text-sm text-ink-900/60 leading-relaxed">
              Dynamically build deep day-by-day travel schedules based on destination, travel length, and specific hobbies or interests.
            </p>
          </div>

          {/* Card 2 */}
          <div className="group bg-white border border-ink-900/10 rounded-[28px] p-8 hover:border-lagoon-200 transition duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md relative overflow-hidden">
            <div className="bg-lagoon-100 p-4 rounded-2xl w-fit mb-6 text-lagoon-700 group-hover:scale-110 transition duration-300 rotate-[-4deg]">
              <DollarSign className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-ink-900 mb-3">Financial Cost Ledger</h3>
            <p className="text-sm text-ink-900/60 leading-relaxed">
              Estimate accommodation, transport, food, and activities budgets. Recalculates in real-time as you add or remove plans.
            </p>
          </div>

          {/* Card 3 */}
          <div className="group bg-white border border-ink-900/10 rounded-[28px] p-8 hover:border-sun-300 transition duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md relative overflow-hidden">
            <div className="bg-sun-100 p-4 rounded-2xl w-fit mb-6 text-sun-700 group-hover:scale-110 transition duration-300 rotate-[-4deg]">
              <Sun className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-ink-900 mb-3">Weather-Aware Pack Assistant</h3>
            <p className="text-sm text-ink-900/60 leading-relaxed">
              An intelligent assistant cross-referencing your travel destination season with the itinerary to checklist crucial gear, documents, and wear.
            </p>
          </div>
        </div>
      </section>

      {/* Popular Destinations Showcase */}
      <section id="destinations" className="landing-section scroll-mt-24 py-24 bg-cream-100/60 border-y border-ink-900/10 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-4">
            <p className="font-display text-3xl sm:text-5xl font-bold text-ink-900">Popular destinations</p>
            <p className="text-ink-900/55 max-w-md text-sm sm:text-base">
              Travelers are leveraging TripPilot to schedule trips to diverse historical, cultural, and tropical coordinates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {DESTINATIONS.map((dest) => {
              const accent = ACCENTS[dest.accent];
              return (
                <div
                  key={dest.name}
                  className="group rounded-[28px] overflow-hidden border border-ink-900/10 bg-white shadow-sm hover:shadow-md transition duration-300 flex flex-col justify-between"
                >
                  <div className="h-56 overflow-hidden relative">
                    <img
                      src={dest.img}
                      alt={dest.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                    />
                    <div className={`absolute top-4 left-4 w-14 h-14 rounded-full ${accent.solid} text-white flex items-center justify-center text-[10px] font-bold uppercase tracking-wide rotate-[-8deg] border-2 border-dashed border-white/70 shadow-md text-center leading-tight px-1`}>
                      {dest.region}
                    </div>
                  </div>
                  <div className="p-6 space-y-2">
                    <h4 className="text-xl font-bold text-ink-900">{dest.name}</h4>
                    <p className="text-sm text-ink-900/55">{dest.blurb}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="landing-section scroll-mt-24 py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-cream-50 overflow-x-hidden">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <p className="font-display text-3xl sm:text-5xl font-bold text-ink-900">How it works</p>
        </div>

        <div className="relative">
          {/* Dashed flight path connecting the steps, desktop only */}
          <svg className="hidden md:block absolute top-8 left-0 w-full h-4" viewBox="0 0 1000 20" preserveAspectRatio="none" aria-hidden="true">
            <line x1="60" y1="10" x2="940" y2="10" stroke="#16223d" strokeOpacity="0.15" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
          </svg>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 text-center relative">
            {STEPS.map((step) => {
              const accent = ACCENTS[step.accent];
              return (
                <div key={step.n} className="space-y-4">
                  <div className={`mx-auto ${accent.solid} shadow-md rounded-full w-16 h-16 flex items-center justify-center text-xl font-bold text-white rotate-[-6deg]`}>
                    {step.n}
                  </div>
                  <h4 className="text-lg font-bold text-ink-900">{step.title}</h4>
                  <p className="text-sm text-ink-900/55">{step.copy}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-ink-900 py-12 text-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500 p-2 rounded-lg text-white -rotate-6">
              <Send className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold text-white">TripPilot</span>
          </div>
          <p className="text-white/50 text-xs sm:text-sm text-center">
            &copy; {new Date().getFullYear()} TripPilot. Developed for modern secure travel planning. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-white/60">
            <a href="#" className="hover:text-white transition">Privacy Policy</a>
            <a href="#" className="hover:text-white transition">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
