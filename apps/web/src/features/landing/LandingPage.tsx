import { Link } from 'react-router-dom';
import { 
  GraduationCap, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  ChevronRight,
  Monitor,
  Smartphone,
  Command
} from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Simple Navigation - Premium Glassmorphic */}
      <nav className="border-b border-white/10 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50 text-white transition-all">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="text-white h-6 w-6" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">AcademeIQ</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-200">
            <Link to="/login" className="hover:text-white transition-colors">Faculty</Link>
            <Link to="/login" className="hover:text-white transition-colors">Parents</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section with College Background */}
      <main className="relative min-h-[85vh] flex items-center justify-center bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/college-hero.jpg")' }}>
        {/* Dark overlay with dynamic gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/70 to-slate-900"></div>
        
        {/* Subtle grid pattern overlay for texture */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

        <div className="relative max-w-5xl mx-auto px-6 py-20 text-center space-y-8 z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-semibold text-slate-200 uppercase tracking-widest animate-pulse">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Enterprise Academic Management
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
              <span className="block text-xl sm:text-2xl md:text-3xl font-medium tracking-[0.25em] text-amber-400 mb-4 uppercase">
                Welcome to
              </span>
              ST. JOSEPH'S PU COLLEGE
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-amber-200">
                OF EXCELLENCE
              </span>
            </h1>
          </div>

          <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-light">
            A secure, high-performance ecosystem for modern academic institutions. 
            Streamline marks, track progress, and manage resources with absolute clarity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/login" className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-8 py-4 rounded-md font-semibold text-lg hover:shadow-lg hover:shadow-orange-500/20 transition-all flex items-center justify-center gap-2 group">
              Get Started
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/login" className="w-full sm:w-auto bg-white/10 backdrop-blur-md border border-white/25 text-white px-8 py-4 rounded-md font-semibold text-lg hover:bg-white/20 transition-all flex items-center justify-center">
              Learn More
            </Link>
          </div>
        </div>
      </main>

      {/* Features/Roles Grid */}
      <section className="py-24 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-[0.2em]">The Platform</h2>
            <p className="text-3xl md:text-4xl font-medium text-slate-900">Built for every stakeholder.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Faculty */}
            <div className="bg-white p-8 border border-slate-200 rounded-md shadow-sm hover:border-slate-300 transition-colors">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-md flex items-center justify-center mb-6">
                <Monitor className="text-slate-900 dark:text-white h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium mb-4">Faculty Portal</h3>
              <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                Efficient marking systems, automated performance tracking, and student insights in a clean workspace.
              </p>
              <Link to="/login" className="text-sm font-medium text-slate-900 flex items-center gap-1 hover:gap-2 transition-all">
                Enter Portal <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Parents */}
            <div className="bg-white p-8 border border-slate-200 rounded-md shadow-sm hover:border-slate-300 transition-colors">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-md flex items-center justify-center mb-6">
                <Smartphone className="text-slate-900 dark:text-white h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium mb-4">Parent Access</h3>
              <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                Real-time visibility into student progress and academic performance with mobile-first clarity.
              </p>
              <Link to="/login" className="text-sm font-medium text-slate-900 flex items-center gap-1 hover:gap-2 transition-all">
                Launch Portal <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            <span className="font-medium">AcademeIQ</span>
          </div>
          
          <div className="flex gap-8 text-sm text-slate-500">
            <Link to="/login" className="hover:text-slate-900 transition-colors">Faculty Login</Link>
            <Link to="/login" className="hover:text-slate-900 transition-colors">Parent Portal</Link>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            © 2026 AcademeIQ. ISO 27001 Certified.
          </p>
        </div>
      </footer>
    </div>
  );
}
