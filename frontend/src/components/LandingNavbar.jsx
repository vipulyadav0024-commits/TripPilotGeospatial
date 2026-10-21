import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, Menu, X, ArrowRight } from 'lucide-react';
import NavUserGreeting from './NavUserGreeting';

const NAV_SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'destinations', label: 'Destinations' },
  { id: 'how-it-works', label: 'How It Works' },
];

export default function LandingNavbar({
  token,
  userName,
  activeSection,
  onScrollToSection,
  onSignOut,
}) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef(null);

  const closeMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSectionClick = (e, sectionId) => {
    onScrollToSection(e, sectionId);
    closeMenu();
  };

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 bg-cream-50/95 backdrop-blur-md border-b border-ink-900/10 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 lg:h-16 flex items-center gap-3">
        {/* Logo */}
        <div
          className="flex items-center gap-2 lg:gap-3 cursor-pointer shrink-0 min-w-0"
          onClick={() => navigate('/')}
        >
          <div className="bg-ink-900 p-1.5 lg:p-2.5 rounded-xl lg:rounded-2xl shadow-md shadow-ink-900/20 -rotate-6">
            <Send className="h-4 w-4 lg:h-5 lg:w-5 text-sun-400" />
          </div>
          <span className="font-display text-lg lg:text-2xl font-bold tracking-tight text-ink-900">
            TripPilot
          </span>
        </div>

        {/* Desktop center nav */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {token && (
            <>
              <Link
                to="/"
                className="text-sm font-bold text-brand-600 bg-brand-50 py-1.5 px-3 rounded-lg"
              >
                Home
              </Link>
              <Link
                to="/dashboard"
                className="text-sm text-ink-900/70 hover:text-ink-900 transition font-semibold py-1.5 px-3 rounded-lg hover:bg-ink-900/5"
              >
                Dashboard
              </Link>
            </>
          )}
          {NAV_SECTIONS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => onScrollToSection(e, item.id)}
              className={`nav-section-link text-sm transition font-medium py-1.5 px-1 ${
                activeSection === item.id
                  ? 'nav-active text-brand-600 font-semibold'
                  : 'text-ink-900/70 hover:text-ink-900'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Desktop right actions */}
        <div className="hidden lg:flex items-center gap-4 ml-auto">
          {token ? (
            <>
              <NavUserGreeting name={userName} className="text-sm" />
              <Link
                to="/dashboard"
                className="bg-ink-900 hover:bg-ink-950 text-white font-bold py-2.5 px-5 rounded-xl transition flex items-center gap-2 shadow-sm text-sm"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="bg-ink-900/5 hover:bg-ink-900/10 text-ink-900 font-semibold py-2.5 px-4 rounded-xl border border-ink-900/10 transition text-sm"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-semibold text-ink-900/70 hover:text-ink-900 transition px-4 py-2"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl transition flex items-center gap-2 shadow-sm shadow-brand-500/30 text-sm"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile / tablet: username beside hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0 lg:hidden">
          {token && (
            <NavUserGreeting
              name={userName}
              className="text-xs sm:text-sm max-w-[88px] sm:max-w-[140px] md:max-w-[220px]"
            />
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="p-2 rounded-lg text-ink-900/60 hover:text-ink-900 hover:bg-ink-900/5 transition shrink-0"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      <div
        className={`lg:hidden overflow-hidden border-t border-ink-900/10 bg-cream-50 transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0 border-t-transparent'
        }`}
      >
        <div className={`px-4 sm:px-6 pb-4 ${mobileMenuOpen ? 'animate-slide-down' : ''}`}>
          {token && (
            <>
              <Link
                to="/"
                onClick={closeMenu}
                className="block py-3.5 text-sm font-bold text-brand-600 border-b border-ink-900/10"
              >
                Home
              </Link>
              <Link
                to="/dashboard"
                onClick={closeMenu}
                className="block py-3.5 text-sm font-semibold text-ink-900/80 hover:text-ink-900 border-b border-ink-900/10"
              >
                Dashboard
              </Link>
            </>
          )}

          {NAV_SECTIONS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => handleSectionClick(e, item.id)}
              className={`block py-3.5 text-sm font-medium border-b border-ink-900/10 transition ${
                activeSection === item.id
                  ? 'text-brand-600 font-semibold'
                  : 'text-ink-900/70 hover:text-ink-900'
              }`}
            >
              {item.label}
            </a>
          ))}

          {token ? (
            <>
              <Link
                to="/dashboard"
                onClick={closeMenu}
                className="block w-full mt-3 text-center bg-ink-900 hover:bg-ink-950 text-white font-bold py-3 rounded-xl shadow-md"
              >
                Go to Dashboard
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  onSignOut();
                }}
                className="w-full mt-2 text-center bg-ink-900/5 hover:bg-ink-900/10 text-ink-900 font-semibold py-3 rounded-xl border border-ink-900/10"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={closeMenu}
                className="block py-3.5 text-sm font-semibold text-ink-900/70 hover:text-ink-900 border-b border-ink-900/10"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={closeMenu}
                className="block w-full mt-3 text-center bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
