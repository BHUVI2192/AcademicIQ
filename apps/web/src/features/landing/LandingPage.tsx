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
      {/* Simple Navigation */}
      <nav className="border-b border-slate-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="text-slate-900 h-6 w-6" />
            <span className="text-xl font-medium tracking-tight">AcademeIQ</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link to="/login" className="hover:text-slate-900 transition-colors">Faculty</Link>
            <Link to="/login" className="hover:text-slate-900 transition-colors">Parents</Link>
            <Link to="/login" className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-50 border border-slate-100 text-[10px] font-medium text-slate-500 uppercase tracking-widest">
            <Sparkles className="h-3 w-3" />
            Enterprise Academic Management
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900">
            Institutional intelligence <span className="text-slate-400">reimagined.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            A secure, high-performance ecosystem for modern academic institutions. 
            Streamline marks, track progress, and manage resources with absolute clarity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="w-full sm:w-auto bg-slate-900 text-white px-8 py-4 rounded-md font-medium text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
              Get Started
              <ArrowRight className="h-5 w-5" />
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
